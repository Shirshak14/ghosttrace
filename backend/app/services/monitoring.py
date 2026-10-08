"""Scheduled re-scans of monitored targets."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from ..config import get_settings
from ..db import SessionLocal
from ..intel.breach import BreachLookupError
from ..models import BreachCheck, Monitor, Scan, User
from .alerts import EmailNotConfigured, send_email
from ..models import Alert
from .scanner import run_github_scan

log = logging.getLogger("ghosttrace.monitoring")


def run_monitor(monitor_id: int) -> None:
    db = SessionLocal()
    try:
        m = db.get(Monitor, monitor_id)
        if m is None:
            return
        m.last_run_at = datetime.now(timezone.utc)
        db.commit()
        if m.target_type == "email":
            _run_email_monitor(db, m)
            return
        scan = Scan(user_id=m.user_id, monitor_id=m.id, target_type=m.target_type, target=m.target, message="Queued by monitor")
        db.add(scan)
        db.commit()
        scan_id = scan.id
    finally:
        db.close()
    run_github_scan(scan_id, include_history=True)


def _run_email_monitor(db, m: Monitor) -> None:
    from ..routers.breach import run_email_check

    user = db.get(User, m.user_id)
    previous = db.scalar(select(BreachCheck).where(BreachCheck.user_id == m.user_id, BreachCheck.email == m.target)
                         .order_by(BreachCheck.checked_at.desc()))
    known = {b.get("name") for b in (previous.breaches if previous else [])}
    try:
        check = asyncio.run(run_email_check(db, user, m.target))
    except BreachLookupError as exc:
        log.warning("Email monitor %s failed: %s", m.id, exc)
        return
    new = [b for b in check.breaches if b.get("name") not in known]
    if previous is not None and new and user.alerts_enabled:
        subject = f"[GhostTrace] {m.target} appeared in {len(new)} new breach(es)"
        names = ", ".join(b.get("name") or "?" for b in new)
        alert = Alert(user_id=user.id, subject=subject, findings_count=len(new))
        try:
            send_email(user.email, subject, f"{m.target} was found in: {names}. Change the password on these services.",
                       f"<p><b>{m.target}</b> was found in: {names}.</p><p>Change the password on these services and anywhere it was reused.</p>")
            alert.status = "sent"
        except EmailNotConfigured as exc:
            alert.status, alert.error = "skipped", str(exc)
        except Exception as exc:  # noqa: BLE001
            alert.status, alert.error = "failed", str(exc)
        db.add(alert)
        db.commit()


def run_due_monitors() -> None:
    interval = timedelta(minutes=get_settings().monitor_interval_minutes)
    now = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        due = []
        for m in db.scalars(select(Monitor).where(Monitor.enabled.is_(True))):
            last = m.last_run_at
            if last is not None and last.tzinfo is None:
                last = last.replace(tzinfo=timezone.utc)
            if last is None or now - last >= interval:
                due.append(m.id)
    finally:
        db.close()
    for mid in due:
        try:
            run_monitor(mid)
        except Exception:  # noqa: BLE001
            log.exception("Monitor %s failed", mid)


def start_scheduler():
    from apscheduler.schedulers.background import BackgroundScheduler

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(run_due_monitors, "interval", minutes=5, id="monitors", max_instances=1, coalesce=True)
    scheduler.start()
    return scheduler
