"""Turn the Samsung CredData benchmark into labelled training features for the risk model.

CredData (https://github.com/Samsung/CredData, Apache-2.0) labels ~64k lines from 337 real GitHub repositories as
true or false credentials. This script runs the GhostTrace detection engine over those repositories, keeps the hits that
land on a labelled line and stores only their numeric features (no source code, no secrets) in `real_features.npz`,
which `train.py` mixes in with the generated data.

Run (needs git and a few GB of disk):
    git clone --depth 1 https://github.com/Samsung/CredData
    python -m app.ml.collect_creddata --creddata CredData --repos /tmp/creddata-repos
"""

import argparse
import binascii
import csv
import hashlib
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from ..detection.engine import MAX_FILE_BYTES, is_sensitive_path, is_test_path, looks_binary, scan_text, should_skip_path
from .features import FindingContext, extract

OUT = Path(__file__).with_name("real_features.npz")


def fetch(creddata: Path, repos: Path, jobs: int = 8) -> None:
    """Shallow-fetch every repository of the benchmark at its pinned commit."""
    snapshot = json.loads((creddata / "snapshot.json").read_text())

    def get(item) -> None:
        rid, url = item
        d = repos / rid[:8]
        if (d / ".done").exists():
            return
        d.mkdir(parents=True, exist_ok=True)
        sha = rid[:40]
        for cmd in (["git", "init", "-q"], ["git", "remote", "add", "origin", url], ["git", "fetch", "-q", "--depth", "1", "origin", sha],
                    ["git", "checkout", "-q", sha]):
            subprocess.run(cmd, cwd=d, check=True, capture_output=True, timeout=600)
        (d / ".done").touch()

    with ThreadPoolExecutor(jobs) as ex:
        list(ex.map(get, snapshot.items()))


def collect(creddata: Path, repos: Path) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    snapshot = json.loads((creddata / "snapshot.json").read_text())
    X: list[list[float]] = []
    y: list[int] = []
    groups: list[int] = []
    for gid, rid in enumerate(snapshot):
        meta = creddata / "meta" / f"{binascii.crc32(binascii.unhexlify(rid)):08x}.csv"
        root = repos / rid[:8]
        if not meta.exists() or not (root / ".done").exists():
            continue
        # CredData renames files to the first 8 hex digits of sha256(path), so rebuild that mapping.
        by_id: dict[str, tuple[Path, str]] = {}
        for dirpath, dirnames, filenames in os.walk(root):
            if ".git" in dirnames:
                dirnames.remove(".git")
            for name in filenames:
                full = Path(dirpath) / name
                rel = full.relative_to(root).as_posix()
                by_id[hashlib.sha256(rel.encode()).hexdigest()[:8]] = (full, rel)
        labels: dict[str, dict[int, set[str]]] = {}
        with meta.open(newline="", encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                if r["GroundTruth"] not in ("T", "F"):
                    continue
                try:
                    first, last = int(r["LineStart"]), int(r["LineEnd"])
                except ValueError:
                    continue
                for line in range(first, last + 1):
                    labels.setdefault(r["FileID"], {}).setdefault(line, set()).add(r["GroundTruth"])
        for file_id, lines in labels.items():
            if file_id not in by_id:
                continue
            full, rel = by_id[file_id]
            try:
                data = full.read_bytes()
            except OSError:
                continue
            if len(data) > MAX_FILE_BYTES or looks_binary(data) or should_skip_path(rel):
                continue
            for m in scan_text(data.decode("utf-8", errors="ignore"), rel):
                marks = lines.get(m.line)
                if not marks:
                    continue
                ctx = FindingContext(
                    category=m.rule.category, base_severity=m.rule.severity, specific=m.rule.specific, secret=m.secret,
                    entropy=m.entropy, placeholder=m.placeholder, test_path=is_test_path(rel), sensitive_path=is_sensitive_path(rel),
                    history_only=False, line=m.snippet, public=True,
                )
                X.append(extract(ctx))
                y.append(1 if "T" in marks else 0)
                groups.append(gid)
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int8), np.array(groups, dtype=np.int16)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--creddata", type=Path, required=True, help="Checkout of Samsung/CredData")
    ap.add_argument("--repos", type=Path, required=True, help="Scratch directory for the benchmark repositories")
    ap.add_argument("--skip-fetch", action="store_true")
    args = ap.parse_args()
    if not args.skip_fetch:
        fetch(args.creddata, args.repos)
    X, y, groups = collect(args.creddata, args.repos)
    np.savez_compressed(OUT, X=X, y=y, groups=groups)
    print(f"{len(y)} labelled hits from {len(set(groups.tolist()))} repositories ({int(y.sum())} real, {int((1 - y).sum())} false) -> {OUT}")


if __name__ == "__main__":
    main()
