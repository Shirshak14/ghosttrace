"""Scan orchestration: GitHub targets, pasted text and uploaded files."""

import asyncio
import io
import logging
import zipfile
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import SessionLocal
from ..detection.engine import (
    MAX_FILE_BYTES, Match, is_sensitive_path, is_test_path, looks_binary, mask_secret, should_skip_path, scan_diff_patch, scan_text,
)
from ..ml.features import FindingContext
from ..ml.scorer import score
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


def scan_upload(filename: str, data: bytes) -> ScanStats:
    stats = ScanStats()
    if filename.lower().endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            for info in zf.infolist():
                if info.is_dir() or info.file_size > MAX_FILE_BYTES or should_skip_path(info.filename):
                    continue
                content = zf.read(info)
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
    now = _now()
    prior = {
        f.fingerprint: f
        for f in db.scalars(select(Finding).where(Finding.user_id == scan.user_id).order_by(Finding.first_seen.desc()))
    }
    findings: list[Finding] = []
    seen: set[tuple[str, str | None]] = set()
    for h in hits:
        m = h.match
        key = (m.fingerprint, h.repository)
        if key in seen:
            continue
        seen.add(key)
        ctx = FindingContext(
            category=m.rule.category, base_severity=m.rule.severity, specific=m.rule.specific, secret=m.secret,
            entropy=m.entropy, placeholder=m.placeholder, test_path=is_test_path(h.file_path),
            sensitive_path=is_sensitive_path(h.file_path), history_only=h.history_only, line=m.snippet, public=h.public,
        )
        s = score(ctx, m.rule.name, h.file_path, h.source_type)
        previous = prior.get(m.fingerprint)
        f = Finding(
            user_id=scan.user_id, scan_id=scan.id, credential_type=m.rule.name, category=m.rule.category, rule_id=m.rule.id,
            secret_masked=mask_secret(m.secret, m.rule.category), fingerprint=m.fingerprint, source_type=h.source_type,
            repository=h.repository, file_path=h.file_path, line_number=m.line, commit_sha=h.commit_sha, url=h.url,
            snippet=m.snippet, in_history_only=h.history_only, entropy=m.entropy, confidence=s.confidence,
            risk_score=s.risk, severity=s.severity, risk_factors=s.factors,
            status=previous.status if previous and previous.status == "false_positive" else "open",
            first_seen=previous.first_seen if previous else now, last_seen=now,
        )
        db.add(f)
        findings.append(f)
    scan.findings_count = len(findings)
    scan.max_risk = max((f.risk_score for f in findings), default=0.0)
    db.commit()
    return findings


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
