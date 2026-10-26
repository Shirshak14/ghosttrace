"""Re-check one GitHub finding against the file as it is now on the default branch."""

import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import quote

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..detection.engine import scan_text
from ..models import Finding
from ..sources.github import GitHubClient, RepoInfo


@dataclass
class RecheckResult:
    present: bool
    line: int | None
    branch: str
    edit_url: str | None
    view_url: str
    message: str


def github_urls(repo_url: str, branch: str, path: str, line: int | None) -> tuple[str, str]:
    p = quote(path)
    b = quote(branch, safe="")
    return f"{repo_url}/edit/{b}/{p}", f"{repo_url}/blob/{b}/{p}" + (f"#L{line}" if line else "")


async def _fetch(full_name: str, path: str) -> tuple[RepoInfo, bytes | None]:
    async with GitHubClient() as gh:
        repo = await gh.get_repo(full_name)
        return repo, await gh.get_file(repo, path)


def recheck_finding(db: Session, f: Finding) -> RecheckResult:
    """Raises GitHubError when the repository can't be read. Commits any status or location change."""
    repo, data = asyncio.run(_fetch(f.repository, f.file_path))
    text = data.decode("utf-8", errors="ignore") if data is not None else ""
    hits = [m for m in scan_text(text, f.file_path) if m.fingerprint == f.fingerprint]
    now = datetime.now(timezone.utc)
    line = hits[0].line if hits else None
    edit_url, view_url = github_urls(repo.html_url, repo.default_branch, f.file_path, line)
    where = f"{f.file_path} on {repo.default_branch}"

    if hits:
        m = hits[0]
        f.line_number, f.snippet, f.last_seen = m.line, m.snippet, now
        if not f.in_history_only:
            f.url = f"{repo.html_url}/blob/{repo.default_branch}/{f.file_path}#L{m.line}"  # same shape the scanner writes
        db.commit()
        message = f"Still in {where} at line {m.line}."
        if f.in_history_only:
            message = f"This secret is back in the current code: {where}, line {m.line}."
        return RecheckResult(True, m.line, repo.default_branch, edit_url, view_url, message)

    if data is None:
        edit_url = None
        view_url = f"{repo.html_url}/tree/{quote(repo.default_branch, safe='')}"

    if f.in_history_only:
        # Removing it from HEAD can't clear it: the old commit still holds the secret, so the status stays as is.
        message = (f"Not in the current code, but commit {(f.commit_sha or '')[:7]} still holds it in git history. "
                   "Rotate the key, then mark it rotated.")
        return RecheckResult(False, None, repo.default_branch, edit_url, view_url, message)

    # Gone from the file: close every open copy of this finding for the same file.
    for same in db.scalars(select(Finding).where(
        Finding.user_id == f.user_id, Finding.fingerprint == f.fingerprint, Finding.repository == f.repository,
        Finding.file_path == f.file_path, Finding.in_history_only.is_(False), Finding.status == "open",
    )):
        same.status = "resolved"
        same.last_seen = now
    db.commit()
    gone = "The file no longer exists" if data is None else f"No longer in {where}"
    message = f"{gone}, so the finding is closed. It is still in git history: rotate the key if you haven't."
    return RecheckResult(False, None, repo.default_branch, edit_url, view_url, message)
