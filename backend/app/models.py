from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200), default="")
    organization: Mapped[str] = mapped_column(String(200), default="")
    password_hash: Mapped[str] = mapped_column(String(200))
    alerts_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    alert_min_severity: Mapped[str] = mapped_column(String(16), default="high")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    scans: Mapped[list["Scan"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    monitors: Mapped[list["Monitor"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Monitor(Base):
    """A target (GitHub user/org/repo or email) that is re-scanned on a schedule."""

    __tablename__ = "monitors"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_type: Mapped[str] = mapped_column(String(32))
    target: Mapped[str] = mapped_column(String(300))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    user: Mapped[User] = relationship(back_populates="monitors")

    __table_args__ = (UniqueConstraint("user_id", "target_type", "target", name="uq_monitor_target"),)


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    monitor_id: Mapped[int | None] = mapped_column(ForeignKey("monitors.id", ondelete="SET NULL"), nullable=True)
    target_type: Mapped[str] = mapped_column(String(32))  # github_user | github_org | github_repo | text | file
    target: Mapped[str] = mapped_column(String(300))
    status: Mapped[str] = mapped_column(String(16), default="queued")  # queued | running | completed | failed
    progress: Mapped[int] = mapped_column(Integer, default=0)
    message: Mapped[str] = mapped_column(String(500), default="")
    repos_scanned: Mapped[int] = mapped_column(Integer, default=0)
    files_scanned: Mapped[int] = mapped_column(Integer, default=0)
    commits_scanned: Mapped[int] = mapped_column(Integer, default=0)
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    max_risk: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="scans")
    findings: Mapped[list["Finding"]] = relationship(back_populates="scan", cascade="all, delete-orphan")


class Finding(Base):
    __tablename__ = "findings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scan_id: Mapped[int] = mapped_column(ForeignKey("scans.id", ondelete="CASCADE"), index=True)
    credential_type: Mapped[str] = mapped_column(String(64), index=True)
    category: Mapped[str] = mapped_column(String(32))  # password | api_key | jwt | aws | ssh_key | email | ...
    rule_id: Mapped[str] = mapped_column(String(64))
    # Raw secrets are never stored: only a masked preview and a SHA-256 fingerprint for de-duplication.
    secret_masked: Mapped[str] = mapped_column(String(200))
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)
    source_type: Mapped[str] = mapped_column(String(32))  # github | text | file
    repository: Mapped[str | None] = mapped_column(String(300), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    line_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    commit_sha: Mapped[str | None] = mapped_column(String(64), nullable=True)
    url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    snippet: Mapped[str] = mapped_column(Text, default="")
    in_history_only: Mapped[bool] = mapped_column(Boolean, default=False)
    entropy: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)  # model P(real secret)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0, index=True)  # 0-100
    severity: Mapped[str] = mapped_column(String(16), default="low", index=True)
    risk_factors: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(16), default="open", index=True)  # open | resolved | false_positive
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    scan: Mapped[Scan] = relationship(back_populates="findings")


class BreachCheck(Base):
    __tablename__ = "breach_checks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    breach_count: Mapped[int] = mapped_column(Integer, default=0)
    breaches: Mapped[list] = mapped_column(JSON, default=list)
    exposed_data: Mapped[list] = mapped_column(JSON, default=list)
    risk_score: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(32), default="xposedornot")
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    scan_id: Mapped[int | None] = mapped_column(ForeignKey("scans.id", ondelete="SET NULL"), nullable=True)
    channel: Mapped[str] = mapped_column(String(16), default="email")
    subject: Mapped[str] = mapped_column(String(300))
    findings_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(16), default="sent")  # sent | failed | skipped
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
