"""Async GitHub API client used by the scanner (repo listing, trees, file contents, commit diffs)."""

import asyncio
import re
from dataclasses import dataclass
from urllib.parse import quote

import httpx

from ..config import get_settings

API = "https://api.github.com"
RAW = "https://raw.githubusercontent.com"


class GitHubError(Exception):
    pass


@dataclass
class RepoInfo:
    full_name: str
    default_branch: str
    private: bool
    html_url: str
    fork: bool
    archived: bool
    pushed_at: str | None


@dataclass
class TreeFile:
    path: str
    sha: str
    size: int


@dataclass
class GistFile:
    filename: str
    raw_url: str
    size: int
    content: str | None = None  # filled in when the API inlined it


@dataclass
class GistInfo:
    id: str
    owner: str
    html_url: str
    public: bool
    files: list[GistFile]
    updated_at: str | None = None


@dataclass
class CommitFile:
    sha: str
    path: str
    patch: str
    html_url: str
    date: str | None


class GitHubClient:
    def __init__(self, token: str | None = None, concurrency: int = 8):
        settings = get_settings()
        self.token = token if token is not None else settings.github_token
        headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "GhostTrace"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        self._client = httpx.AsyncClient(headers=headers, timeout=30.0, follow_redirects=True)
        self._sem = asyncio.Semaphore(concurrency)

    async def __aenter__(self) -> "GitHubClient":
        return self

    async def __aexit__(self, *exc) -> None:
        await self._client.aclose()

    async def _get(self, url: str, params: dict | None = None) -> httpx.Response:
        async with self._sem:
            for attempt in range(3):
                try:
                    resp = await self._client.get(url, params=params)
                except httpx.TransportError as exc:
                    if attempt == 2:
                        raise GitHubError(f"Network error talking to GitHub: {exc}") from exc
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                if resp.status_code in (502, 503, 504) and attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                return resp
        raise GitHubError("GitHub did not respond")

    @staticmethod
    def _raise_for(resp: httpx.Response, what: str) -> None:
        if resp.status_code == 404:
            raise GitHubError(f"{what} was not found on GitHub (or it is private and the token cannot see it).")
        if resp.status_code in (401,):
            raise GitHubError("The GitHub token was rejected. Check GITHUB_TOKEN.")
        if resp.status_code in (403, 429):
            remaining = resp.headers.get("x-ratelimit-remaining")
            if remaining == "0" or resp.status_code == 429:
                raise GitHubError("GitHub API rate limit reached. Add a GITHUB_TOKEN or wait for the limit to reset.")
            raise GitHubError(f"GitHub refused access to {what}.")
        if resp.status_code >= 400:
            raise GitHubError(f"GitHub returned {resp.status_code} for {what}.")

    @staticmethod
    def _repo(data: dict) -> RepoInfo:
        return RepoInfo(
            full_name=data["full_name"],
            default_branch=data.get("default_branch") or "main",
            private=bool(data.get("private")),
            html_url=data.get("html_url", ""),
            fork=bool(data.get("fork")),
            archived=bool(data.get("archived")),
            pushed_at=data.get("pushed_at"),
        )

    async def get_repo(self, full_name: str) -> RepoInfo:
        resp = await self._get(f"{API}/repos/{full_name}")
        self._raise_for(resp, f"Repository {full_name}")
        return self._repo(resp.json())

    async def list_repos(self, owner: str, kind: str, limit: int) -> list[RepoInfo]:
        """kind is 'user' or 'org'. Returns non-fork repos, most recently pushed first."""
        base = f"{API}/orgs/{owner}/repos" if kind == "org" else f"{API}/users/{owner}/repos"
        params = {"per_page": 100, "sort": "pushed", "direction": "desc"}
        if kind == "user":
            params["type"] = "owner"
        repos: list[RepoInfo] = []
        page = 1
        while len(repos) < limit and page <= 10:
            resp = await self._get(base, {**params, "page": page})
            self._raise_for(resp, f"{'Organization' if kind == 'org' else 'User'} {owner}")
            batch = resp.json()
            if not batch:
                break
            repos.extend(self._repo(r) for r in batch if not r.get("fork"))
            if len(batch) < 100:
                break
            page += 1
        return repos[:limit]

    async def get_tree(self, repo: RepoInfo) -> list[TreeFile]:
        resp = await self._get(f"{API}/repos/{repo.full_name}/git/trees/{quote(repo.default_branch, safe='')}", {"recursive": "1"})
        if resp.status_code == 409:  # empty repository
            return []
        self._raise_for(resp, f"File tree of {repo.full_name}")
        data = resp.json()
        return [TreeFile(path=t["path"], sha=t["sha"], size=t.get("size", 0)) for t in data.get("tree", []) if t.get("type") == "blob"]

    async def get_file(self, repo: RepoInfo, path: str) -> bytes | None:
        url = f"{RAW}/{repo.full_name}/{quote(repo.default_branch, safe='')}/{quote(path)}"
        resp = await self._get(url)
        if resp.status_code != 200:
            return None
        return resp.content

    async def list_commits(self, repo: RepoInfo, limit: int) -> list[str]:
        resp = await self._get(f"{API}/repos/{repo.full_name}/commits", {"per_page": min(limit, 100), "sha": repo.default_branch})
        if resp.status_code == 409:
            return []
        self._raise_for(resp, f"Commits of {repo.full_name}")
        return [c["sha"] for c in resp.json()[:limit]]

    async def get_commit_files(self, repo: RepoInfo, sha: str) -> list[CommitFile]:
        resp = await self._get(f"{API}/repos/{repo.full_name}/commits/{sha}")
        if resp.status_code != 200:
            return []
        data = resp.json()
        date = (data.get("commit") or {}).get("author", {}).get("date")
        html = data.get("html_url", "")
        return [
            CommitFile(sha=sha, path=f["filename"], patch=f.get("patch") or "", html_url=html, date=date)
            for f in data.get("files", [])
            if f.get("patch")
        ]

    @staticmethod
    def _gist(data: dict) -> GistInfo:
        return GistInfo(
            id=data["id"],
            owner=(data.get("owner") or {}).get("login") or "anonymous",
            html_url=data.get("html_url", f"https://gist.github.com/{data['id']}"),
            public=bool(data.get("public", True)),
            files=[
                GistFile(filename=name, raw_url=f.get("raw_url", ""), size=f.get("size") or 0,
                         content=None if f.get("truncated") else f.get("content"))
                for name, f in (data.get("files") or {}).items()
            ],
            updated_at=data.get("updated_at"),
        )

    async def list_gists(self, owner: str, limit: int) -> list[GistInfo]:
        """Public gists of a user, most recently updated first."""
        gists: list[GistInfo] = []
        page = 1
        while len(gists) < limit and page <= 10:
            resp = await self._get(f"{API}/users/{owner}/gists", {"per_page": 100, "page": page})
            if resp.status_code == 404:
                return []
            self._raise_for(resp, f"Gists of {owner}")
            batch = resp.json()
            gists.extend(self._gist(g) for g in batch)
            if len(batch) < 100:
                break
            page += 1
        return gists[:limit]

    async def get_gist(self, gist_id: str, revision: str | None = None) -> GistInfo:
        url = f"{API}/gists/{gist_id}" + (f"/{revision}" if revision else "")
        resp = await self._get(url)
        self._raise_for(resp, f"Gist {gist_id}")
        return self._gist(resp.json())

    async def list_gist_revisions(self, gist_id: str, limit: int) -> list[str]:
        """Revision SHAs, newest first (the first one is the current version)."""
        resp = await self._get(f"{API}/gists/{gist_id}/commits", {"per_page": min(limit, 100)})
        if resp.status_code != 200:
            return []
        return [c["version"] for c in resp.json()[:limit]]

    async def get_gist_file(self, f: GistFile) -> bytes | None:
        if f.content is not None:
            return f.content.encode()
        if not f.raw_url:
            return None
        resp = await self._get(f.raw_url)
        return resp.content if resp.status_code == 200 else None

    async def rate_limit(self) -> dict:
        resp = await self._get(f"{API}/rate_limit")
        if resp.status_code != 200:
            return {}
        core = resp.json().get("resources", {}).get("core", {})
        return {"limit": core.get("limit"), "remaining": core.get("remaining"), "reset": core.get("reset")}


def parse_repo_target(target: str) -> str:
    """Accepts 'owner/repo', 'https://github.com/owner/repo(.git)' and returns 'owner/repo'."""
    t = target.strip().removesuffix("/").removesuffix(".git")
    for prefix in ("https://github.com/", "http://github.com/", "github.com/", "git@github.com:"):
        if t.lower().startswith(prefix):
            t = t[len(prefix):]
            break
    parts = [p for p in t.split("/") if p]
    if len(parts) < 2:
        raise GitHubError("Enter a repository as owner/name or a github.com URL.")
    return f"{parts[0]}/{parts[1]}"


def parse_owner_target(target: str) -> str:
    t = target.strip().removesuffix("/")
    for prefix in ("https://github.com/", "http://github.com/", "github.com/", "@"):
        if t.lower().startswith(prefix):
            t = t[len(prefix):]
            break
    owner = t.split("/")[0]
    if not owner:
        raise GitHubError("Enter a GitHub username or organization.")
    return owner


GIST_ID_RE = re.compile(r"^[0-9a-f]{20,40}$", re.I)


def parse_gist_target(target: str) -> str:
    """Accepts a gist ID or a gist.github.com URL and returns the ID."""
    t = target.strip().removesuffix("/").split("#")[0].split("?")[0]
    gist_id = t.split("/")[-1].removesuffix(".git")
    if not GIST_ID_RE.match(gist_id):
        raise GitHubError("Enter a gist ID or a gist.github.com URL.")
    return gist_id.lower()


def parse_target(target_type: str, target: str) -> str:
    """Normalize a scan or monitor target for its type."""
    if target_type == "github_repo":
        return parse_repo_target(target)
    if target_type == "github_gist":
        return parse_gist_target(target)
    return parse_owner_target(target)
