"""Scan text for credentials using the rule set, with entropy and placeholder analysis."""

import bisect
import hashlib
import math
import re
from collections import Counter
from dataclasses import dataclass

from .rules import RULES, Rule

MAX_FILE_BYTES = 1_000_000

SKIP_DIRS = {
    "node_modules", "vendor", "dist", "build", ".git", "__pycache__", ".venv", "venv", "bower_components",
    ".next", ".nuxt", "target", "coverage", ".gradle", "Pods",
}
SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Pipfile.lock", "composer.lock",
    "Cargo.lock", "go.sum", "Gemfile.lock", "bun.lockb",
}
BINARY_EXT = {
    ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svgz", ".pdf", ".zip", ".gz", ".tgz", ".tar", ".rar",
    ".7z", ".jar", ".war", ".class", ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".woff", ".woff2", ".ttf",
    ".otf", ".eot", ".mp3", ".mp4", ".mov", ".avi", ".webm", ".wav", ".flac", ".psd", ".ai", ".sketch", ".fig",
    ".pyc", ".pyo", ".db", ".sqlite", ".sqlite3", ".parquet", ".npy", ".pkl", ".h5", ".onnx", ".pt", ".ckpt",
}

PLACEHOLDER_RE = re.compile(
    r"(?i)(example|sample|dummy|placeholder|changeme|change_me|your[_\-]?|<[^>]*>|\$\{|\{\{|%\(|xxxx|\*\*\*\*|"
    r"fake|redacted|insert|replace|todo|test(?:ing)?[_\-]?(?:key|token|secret|pass)|not[_\-]?a[_\-]?real|"
    r"process\.env|os\.environ|getenv|env\[|config\.|settings\.|0000000|1234567|abcdef(?:g|1)|password123|secret123)"
)
TEST_PATH_RE = re.compile(r"(?i)(^|/)(tests?|spec|specs|__tests__|fixtures?|mocks?|examples?|samples?|docs?|demo|testdata)(/|$)|"
                          r"\.(test|spec)\.|_test\.|test_|\.example$|\.sample$|\.template$|\.dist$|readme")
SENSITIVE_PATH_RE = re.compile(r"(?i)(^|/)\.env(\.|$)|\.pem$|\.key$|id_rsa|id_ed25519|credentials|secrets?\.(json|ya?ml|toml)|"
                               r"\.npmrc$|\.pypirc$|\.netrc$|\.git-credentials$|config\.(json|ya?ml)$|settings\.py$|\.tfvars$|"
                               r"docker-compose|\.properties$|wp-config\.php$")
EMAIL_IGNORE_RE = re.compile(r"(?i)(@example\.(com|org|net)|@test\.|@localhost|noreply|no-reply|@users\.noreply\.github\.com|"
                             r"@(domain|email|company|yourcompany|mail)\.com$|\.(png|jpg|gif|svg|css|js)$|@[0-9.]+$|^git@)")


@dataclass
class Match:
    rule: Rule
    secret: str
    line: int
    start: int
    end: int
    snippet: str
    entropy: float
    placeholder: bool

    @property
    def fingerprint(self) -> str:
        return fingerprint(self.rule.category, self.secret)


def fingerprint(category: str, secret: str) -> str:
    return hashlib.sha256(f"{category}:{secret}".encode()).hexdigest()


def shannon_entropy(value: str) -> float:
    if not value:
        return 0.0
    counts = Counter(value)
    n = len(value)
    return -sum(c / n * math.log2(c / n) for c in counts.values())


def mask_secret(secret: str, category: str = "") -> str:
    if category == "private_key" or secret.startswith("-----BEGIN"):
        header = secret.splitlines()[0] if secret else "PRIVATE KEY"
        return f"{header[:60]} [redacted]"
    if category == "email":
        local, _, domain = secret.partition("@")
        return f"{local[:2]}{'•' * max(1, min(len(local) - 2, 6))}@{domain}"
    if len(secret) <= 8:
        return secret[:1] + "•" * (len(secret) - 1)
    keep = 4 if len(secret) < 24 else 6
    return f"{secret[:keep]}{'•' * min(len(secret) - keep - 2, 16)}{secret[-2:]}"


def should_skip_path(path: str) -> bool:
    parts = path.replace("\\", "/").split("/")
    if any(p in SKIP_DIRS for p in parts[:-1]):
        return True
    name = parts[-1]
    if name in SKIP_FILES or name.endswith((".min.js", ".min.css", ".map")):
        return True
    dot = name.rfind(".")
    return dot != -1 and name[dot:].lower() in BINARY_EXT


def looks_binary(data: bytes) -> bool:
    return b"\x00" in data[:8000]


def is_test_path(path: str | None) -> bool:
    return bool(path and TEST_PATH_RE.search(path))


def is_sensitive_path(path: str | None) -> bool:
    return bool(path and SENSITIVE_PATH_RE.search(path))


def is_placeholder(secret: str, line: str) -> bool:
    if PLACEHOLDER_RE.search(secret):
        return True
    if len(set(secret)) <= 3:
        return True
    # e.g. password = "${DB_PASSWORD}" or os.environ["X"] on the same line
    return bool(re.search(r"(?i)(process\.env|os\.environ|getenv\(|\$\{[A-Z_]+\})", line))


CODE_EXT = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".rb", ".php", ".cs", ".rs", ".kt", ".swift", ".c", ".cc", ".cpp", ".h", ".scala", ".lua", ".pl", ".sh"}


def is_code_reference(secret: str, text: str, start: int, end: int, path: str | None) -> bool:
    """True when a generic-rule 'secret' is really a variable, attribute or call, not a literal value."""
    if any(c in secret for c in "()"):
        return True
    after = text[end:end + 3].lstrip(" 	")
    if after[:1] in ("(", "["):
        return True
    quoted = start > 0 and text[start - 1] in "'\""
    if quoted:
        return False
    # Unquoted value inside source code (not .env/.yml/.properties) is an identifier or expression, not a literal.
    ext = ("." + path.rsplit(".", 1)[-1].lower()) if path and "." in path.rsplit("/", 1)[-1] else ""
    if ext in CODE_EXT:
        return True
    return False


def _line_starts(text: str) -> list[int]:
    starts = [0]
    for i, ch in enumerate(text):
        if ch == "\n":
            starts.append(i + 1)
    return starts


def _snippet(text: str, starts: list[int], line_idx: int, secret: str, category: str) -> str:
    begin = starts[line_idx]
    end = starts[line_idx + 1] - 1 if line_idx + 1 < len(starts) else len(text)
    line = text[begin:end]
    first_line_of_secret = secret.splitlines()[0] if secret else ""
    masked = line.replace(first_line_of_secret, mask_secret(secret, category)) if first_line_of_secret else line
    masked = masked.strip()
    return masked[:240] + ("…" if len(masked) > 240 else "")


def scan_text(text: str, path: str | None = None, include_emails: bool = True) -> list[Match]:
    if not text:
        return []
    starts = _line_starts(text)
    raw: list[Match] = []
    for rule in RULES:
        if rule.category == "email" and not include_emails:
            continue
        for m in rule.pattern.finditer(text):
            secret = m.group(rule.group)
            if not secret:
                continue
            s, e = m.span(rule.group)
            line_idx = bisect.bisect_right(starts, s) - 1
            line_end = starts[line_idx + 1] - 1 if line_idx + 1 < len(starts) else len(text)
            line_text = text[starts[line_idx]:line_end]
            entropy = shannon_entropy(secret)
            if rule.min_entropy and entropy < rule.min_entropy:
                continue
            if rule.category == "email" and EMAIL_IGNORE_RE.search(secret):
                continue
            if not rule.specific and rule.category != "email" and is_code_reference(secret, text, s, e, path):
                continue
            raw.append(Match(
                rule=rule,
                secret=secret,
                line=line_idx + 1,
                start=s,
                end=e,
                snippet=_snippet(text, starts, line_idx, secret, rule.category),
                entropy=round(entropy, 3),
                placeholder=is_placeholder(secret, line_text) if rule.category != "email" else False,
            ))

    # Overlap resolution: specific rules beat generic ones; among equals keep the longer span.
    raw.sort(key=lambda x: (not x.rule.specific, -(x.end - x.start), x.start))
    kept: list[Match] = []
    seen: set[tuple[str, str]] = set()
    for m in raw:
        if any(m.start < k.end and k.start < m.end for k in kept):
            continue
        key = (m.rule.category, m.secret)
        if key in seen:
            continue
        seen.add(key)
        kept.append(m)
    kept.sort(key=lambda x: x.start)
    return kept


def scan_diff_patch(patch: str, path: str | None = None) -> list[Match]:
    """Scan only the added lines of a unified diff, reporting new-file line numbers."""
    added: list[str] = []
    line_map: list[int] = []
    new_line = 0
    for line in patch.splitlines():
        if line.startswith("@@"):
            hdr = re.search(r"\+(\d+)", line)
            new_line = int(hdr.group(1)) - 1 if hdr else 0
            continue
        if line.startswith("+") and not line.startswith("+++"):
            new_line += 1
            added.append(line[1:])
            line_map.append(new_line)
        elif not line.startswith("-"):
            new_line += 1
    matches = scan_text("\n".join(added), path)
    for m in matches:
        if 0 < m.line <= len(line_map):
            m.line = line_map[m.line - 1]
    return matches
