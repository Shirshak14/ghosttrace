from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

Severity = Literal["critical", "high", "medium", "low"]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---- auth / users ----
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=200)
    organization: str = Field(default="", max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: int
    email: str
    full_name: str
    organization: str
    alerts_enabled: bool
    alert_min_severity: str
    created_at: datetime


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    alerts_enabled: bool | None = None
    alert_min_severity: Severity | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---- scans ----
GithubTarget = Literal["github_user", "github_org", "github_repo"]


class GithubScanIn(BaseModel):
    target_type: GithubTarget
    target: str = Field(min_length=1, max_length=300)
    include_history: bool = True


class TextScanIn(BaseModel):
    content: str = Field(min_length=1, max_length=2_000_000)
    label: str = Field(default="Pasted text", max_length=200)


class ScanOut(ORM):
    id: int
    target_type: str
    target: str
    status: str
    progress: int
    message: str
    repos_scanned: int
    files_scanned: int
    commits_scanned: int
    findings_count: int
    max_risk: float
    error: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
    monitor_id: int | None


# ---- findings ----
class FindingOut(ORM):
    id: int
    scan_id: int
    credential_type: str
    category: str
    rule_id: str
    secret_masked: str
    fingerprint: str
    source_type: str
    repository: str | None
    file_path: str | None
    line_number: int | None
    commit_sha: str | None
    url: str | None
    snippet: str
    in_history_only: bool
    entropy: float
    confidence: float
    risk_score: float
    severity: str
    risk_factors: list
    status: str
    first_seen: datetime
    last_seen: datetime


class FindingUpdate(BaseModel):
    status: Literal["open", "resolved", "false_positive"]


class FindingPage(BaseModel):
    items: list[FindingOut]
    total: int
    page: int
    page_size: int


# ---- monitors ----
class MonitorIn(BaseModel):
    target_type: Literal["github_user", "github_org", "github_repo", "email"]
    target: str = Field(min_length=1, max_length=300)


class MonitorOut(ORM):
    id: int
    target_type: str
    target: str
    enabled: bool
    last_run_at: datetime | None
    created_at: datetime


class MonitorUpdate(BaseModel):
    enabled: bool


# ---- breach intel ----
class BreachEmailIn(BaseModel):
    email: EmailStr


class BreachOut(ORM):
    id: int
    email: str
    breach_count: int
    breaches: list
    exposed_data: list
    risk_score: float
    source: str
    checked_at: datetime


class PasswordCheckIn(BaseModel):
    # The client sends only the first 5 chars of the SHA-1 hash (k-anonymity) and the suffix,
    # or the plain password which the server hashes locally and never stores.
    password: str = Field(min_length=1, max_length=256)


class PasswordCheckOut(BaseModel):
    pwned: bool
    count: int
    strength: int
    strength_label: str
    feedback: list[str]


class AlertOut(ORM):
    id: int
    scan_id: int | None
    channel: str
    subject: str
    findings_count: int
    status: str
    error: str | None
    created_at: datetime
