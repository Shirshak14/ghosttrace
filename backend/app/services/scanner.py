"""Scan orchestration: GitHub targets, pasted text and uploaded files."""

import asyncio
import io
import logging
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import SessionLocal
from ..detection.engine import (
    MAX_FILE_BYTES, Match, is_sensitive_path, is_test_path, looks_binary, mask_secret, should_skip_path, scan_diff_patch, scan_text,
)
from ..ml.features import FindingContext
from ..ml.scorer import score_all
from ..models import Finding, Scan
from ..sources.github import GitHubClient, GitHubError, RepoInfo, parse_owner_target, parse_repo_target

log = logging.getLogger("ghosttrace.scanner")


@dataclass
class RawHit:
    match: Match
    source_type: str
    repository: str | None = None
    file_path: str | None = None
    commit_sha: str | None = None
    url: str | None = None
    public: bool = True
    history_only: bool = False


@dataclass
class ScanStats:
    repos: int = 0
    files: int = 0
    commits: int = 0
    hits: list[RawHit] = field(default_factory=list)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _update(db: Session, scan: Scan, **fields) -> None:
    for k, v in fields.items():
        setattr(scan, k, v)
    db.commit()


# ---------------------------------------------------------------- GitHub

def vendored_prefixes(paths) -> tuple[str, ...]:
    """Directories that hold installed third-party packages (e.g. a Lambda 'package/' folder with pillow-*.dist-info).

    Anything next to a *.dist-info or *.egg-info folder is library code, not the user's, so it is skipped.
    """
    prefixes: set[str] = set()
    for path in paths:
        parts = path.split("/")
        for i, part in enumerate(parts[:-1]):
            if part.endswith((".dist-info", ".egg-info")):
                prefixes.add("/".join(parts[:i]) + "/" if i else "")
                break
    return tuple(p for p in prefixes if p)

async def _scan_repo(gh: GitHubClient, repo: RepoInfo, include_history: bool, stats: ScanStats, progress_cb) -> None:
    settings = get_settings()
    tree = await gh.get_tree(repo)
    vendored = vendored_prefixes(f.path for f in tree)
    files = [
        f for f in tree
        if not should_skip_path(f.path) and f.size <= MAX_FILE_BYTES and not f.path.startswith(vendored)
    ]
    # Sensitive-looking files first so they are always covered when the per-repo cap applies.
    files.sort(key=lambda f: (not is_sensitive_path(f.path), f.size))
    files = files[: settings.github_max_files_per_repo]

    head_fingerprints: set[str] = set()

    async def fetch_and_scan(path: str) -> None:
        data = await gh.get_file(repo, path)
        if data is None or looks_binary(data):
            return
        text = data.decode("utf-8", errors="ignore")
        stats.files += 1
        for m in scan_text(text, path):
            head_fingerprints.add(m.fingerprint)
            stats.hits.append(RawHit(
                match=m, source_type="github", repository=repo.full_name, file_path=path,
                url=f"{repo.html_url}/blob/{repo.default_branch}/{path}#L{m.line}", public=not repo.private,
            ))

    batch = 24
    for i in range(0, len(files), batch):
        await asyncio.gather(*(fetch_and_scan(f.path) for f in files[i:i + batch]))
        progress_cb(i + batch, len(files))

    if include_history:
        shas = await gh.list_commits(repo, settings.github_max_commits_per_repo)
        commit_files = await asyncio.gather(*(gh.get_commit_files(repo, sha) for sha in shas))
        seen_history: set[str] = set()
        for cfs in commit_files:
            if cfs:
                stats.commits += 1
            for cf in cfs:
                if should_skip_path(cf.path):
                    continue
                for m in scan_diff_patch(cf.patch, cf.path):
                    if m.fingerprint in head_fingerprints or m.fingerprint in seen_history:
                        continue
                    seen_history.add(m.fingerprint)
                    stats.hits.append(RawHit(
                        match=m, source_type="github", repository=repo.full_name, file_path=cf.path, commit_sha=cf.sha,
                        url=cf.html_url, public=not repo.private, history_only=True,
                    ))
    stats.repos += 1


async def _run_github(db: Session, scan: Scan, include_history: bool) -> ScanStats:
    settings = get_settings()
    stats = ScanStats()
    async with GitHubClient() as gh:
        if scan.target_type == "github_repo":
            repos = [await gh.get_repo(parse_repo_target(scan.target))]
        else:
            owner = parse_owner_target(scan.target)
            kind = "org" if scan.target_type == "github_org" else "user"
            repos = await gh.list_repos(owner, kind, settings.github_max_repos_per_owner)
            if not repos:
                _update(db, scan, message=f"No public repositories found for {owner}.")
        total = max(len(repos), 1)
        for idx, repo in enumerate(repos):
            _update(db, scan, message=f"Scanning {repo.full_name} ({idx + 1}/{len(repos)})", progress=int(5 + 85 * idx / total))

            def cb(done: int, of: int, _idx=idx) -> None:
                frac = min(done / of, 1.0) if of else 1.0
                scan.progress = int(5 + 85 * (_idx + frac * 0.8) / total)
                scan.files_scanned = stats.files
                db.commit()

            try:
                await _scan_repo(gh, repo, include_history, stats, cb)
            except GitHubError as exc:
                log.warning("Skipping %s: %s", repo.full_name, exc)
            scan.repos_scanned = stats.repos
            scan.files_scanned = stats.files
            scan.commits_scanned = stats.commits
            db.commit()
    return stats


# ---------------------------------------------------------------- text / files

def scan_text_blob(text: str, label: str, source_type: str) -> ScanStats:
    stats = ScanStats(files=1)
    for m in scan_text(text, label):
        stats.hits.append(RawHit(match=m, source_type=source_type, file_path=label, public=False))
    return stats


# Caps on what one uploaded zip may expand to, so a small archive can't tie the server up for minutes.
MAX_ZIP_ENTRIES = 5000
MAX_ZIP_TOTAL_BYTES = 200 * 1024 * 1024


class UploadTooLarge(ValueError):
    pass


def scan_upload(filename: str, data: bytes) -> ScanStats:
    stats = ScanStats()
    if filename.lower().endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            entries = [i for i in zf.infolist() if not i.is_dir()]
            if len(entries) > MAX_ZIP_ENTRIES:
                raise UploadTooLarge(f"The zip holds {len(entries):,} files; the limit is {MAX_ZIP_ENTRIES:,}.")
            total = 0
            for info in entries:
                if info.file_size > MAX_FILE_BYTES or should_skip_path(info.filename):
                    continue
                total += info.file_size
                if total > MAX_ZIP_TOTAL_BYTES:
                    raise UploadTooLarge(f"The zip expands to more than {MAX_ZIP_TOTAL_BYTES // (1024 * 1024)} MB of text.")
                # Read at most the declared size plus one byte, so an entry that lies about its size is cut off.
                with zf.open(info) as fh:
                    content = fh.read(MAX_FILE_BYTES + 1)
                if len(content) > MAX_FILE_BYTES:
                    continue
                if looks_binary(content):
                    continue
                stats.files += 1
                for m in scan_text(content.decode("utf-8", errors="ignore"), info.filename):
                    stats.hits.append(RawHit(match=m, source_type="file", file_path=info.filename, public=False))
        return stats
    if looks_binary(data):
        return stats
    stats.files = 1
    for m in scan_text(data.decode("utf-8", errors="ignore"), filename):
        stats.hits.append(RawHit(match=m, source_type="file", file_path=filename, public=False))
    return stats


# ---------------------------------------------------------------- persistence

def persist_hits(db: Session, scan: Scan, hits: list[RawHit]) -> list[Finding]:
    """Save a scan's hits. A secret already known at the same location (fingerprint + repository) updates that row
    instead of adding another, so re-scans and monitors don't multiply findings or reopen triaged ones."""
    now = _now()

    unique: list[RawHit] = []
    seen: set[tuple[str, str | None]] = set()
    for h in hits:
        key = (h.match.fingerprint, h.repository)
        if key not in seen:
            seen.add(key)
            unique.append(h)

    fingerprints = {h.match.fingerprint for h in unique}
    existing: dict[tuple[str, str | None], Finding] = {}
    # The same secret elsewhere (another repo or paste) passes on a false-positive verdict and its first-seen date.
    prior: dict[str, tuple[str, datetime]] = {}
    if fingerprints:
        for f in db.scalars(
            select(Finding).where(Finding.user_id == scan.user_id, Finding.fingerprint.in_(fingerprints))
            .order_by(Finding.first_seen.desc())
        ):
            existing.setdefault((f.fingerprint, f.repository), f)
            prior[f.fingerprint] = (f.status, f.first_seen)

    scores = score_all([
        (FindingContext(
            category=h.match.rule.category, base_severity=h.match.rule.severity, specific=h.match.rule.specific,
            secret=h.match.secret, entropy=h.match.entropy, placeholder=h.match.placeholder, test_path=is_test_path(h.file_path),
            sensitive_path=is_sensitive_path(h.file_path), history_only=h.history_only, line=h.match.snippet, public=h.public,
        ), h.match.rule.name, h.file_path, h.source_type)
        for h in unique
    ])

    findings: list[Finding] = []
    for h, s in zip(unique, scores):
        m = h.match
        current = dict(
            scan_id=scan.id, credential_type=m.rule.name, category=m.rule.category, rule_id=m.rule.id,
            secret_masked=mask_secret(m.secret, m.rule.category), source_type=h.source_type, file_path=h.file_path,
            line_number=m.line, commit_sha=h.commit_sha, url=h.url, snippet=m.snippet, in_history_only=h.history_only,
            entropy=m.entropy, confidence=s.confidence, risk_score=s.risk, severity=s.severity, risk_factors=s.factors,
            last_seen=now,
        )
        f = existing.get((m.fingerprint, h.repository))
        if f is not None:
            for k, v in current.items():
                setattr(f, k, v)
        else:
            prev_status, prev_first_seen = prior.get(m.fingerprint, (None, None))
            f = Finding(
                user_id=scan.user_id, fingerprint=m.fingerprint, repository=h.repository, **current,
                status="false_positive" if prev_status == "false_positive" else "open",
                first_seen=prev_first_seen or now,
            )
            db.add(f)
        findings.append(f)
    scan.findings_count = len(findings)
    scan.max_risk = max((f.risk_score for f in findings), default=0.0)
    db.commit()
    return findings


def dedupe_findings(db: Session) -> int:
    """One-off cleanup for databases written before persist_hits upserted: keep the newest row per
    (user, fingerprint, repository), with the earliest first_seen and the strongest triage verdict. Returns rows removed."""
    groups = db.execute(
        select(Finding.user_id, Finding.fingerprint, Finding.repository)
        .group_by(Finding.user_id, Finding.fingerprint, Finding.repository).having(func.count(Finding.id) > 1)
    ).all()
    rank = {"false_positive": 2, "resolved": 1, "open": 0}
    removed = 0
    for user_id, fingerprint, repository in groups:
        repo_match = Finding.repository.is_(None) if repository is None else Finding.repository == repository
        rows = list(db.scalars(
            select(Finding).where(Finding.user_id == user_id, Finding.fingerprint == fingerprint, repo_match)
            .order_by(Finding.id.desc())
        ))
        keep, extra = rows[0], rows[1:]
        keep.first_seen = min(r.first_seen for r in rows)
        keep.status = max((r.status for r in rows), key=lambda st: rank.get(st, 0))
        for r in extra:
            db.delete(r)
        removed += len(extra)
    db.commit()
    return removed


def fail_interrupted_scans(db: Session) -> int:
    """Scans run in-process, so any still queued or running at startup died with the previous process."""
    stuck = list(db.scalars(select(Scan).where(Scan.status.in_(["queued", "running"]))))
    for scan in stuck:
        scan.status, scan.finished_at, scan.message = "failed", _now(), "Scan interrupted"
        scan.error = "The server restarted while this scan was running. Start it again."
    db.commit()
    return len(stuck)


def run_github_scan(scan_id: int, include_history: bool = True) -> None:
    """Background entry point. Opens its own DB session."""
    db = SessionLocal()
    try:
        scan = db.get(Scan, scan_id)
        if scan is None:
            return
        _update(db, scan, status="running", started_at=_now(), progress=2, message="Connecting to GitHub")
        try:
            stats = asyncio.run(_run_github(db, scan, include_history))
            _update(db, scan, progress=95, message="Scoring findings with the AI model")
            findings = persist_hits(db, scan, stats.hits)
            _update(
                db, scan, status="completed", progress=100, finished_at=_now(),
                message=f"Scanned {stats.repos} repos, {stats.files} files and {stats.commits} commits",
            )
            from .alerts import alert_for_scan

            alert_for_scan(db, scan, findings)
        except GitHubError as exc:
            _update(db, scan, status="failed", error=str(exc), finished_at=_now(), message="Scan failed")
        except Exception as exc:  # noqa: BLE001
            log.exception("Scan %s crashed", scan_id)
            _update(db, scan, status="failed", error=f"Unexpected error: {exc}", finished_at=_now(), message="Scan failed")
    finally:
        db.close()
