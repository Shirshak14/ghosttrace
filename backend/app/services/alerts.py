"""Email alerts for new high-risk findings."""

import html
import logging
import smtplib
import ssl
from email.message import EmailMessage

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Alert, Finding, Scan, User

log = logging.getLogger("ghosttrace.alerts")
SEV_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
SEV_COLOR = {"critical": "#ff4d6d", "high": "#ff8a3d", "medium": "#f5c84c", "low": "#4cc9f0"}


class EmailNotConfigured(Exception):
    pass


def send_email(to: str, subject: str, text_body: str, html_body: str) -> None:
    s = get_settings()
    if not s.smtp_host:
        raise EmailNotConfigured("SMTP is not configured (set SMTP_HOST, SMTP_USER, SMTP_PASSWORD).")
    msg = EmailMessage()
    msg["From"] = s.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    ctx = ssl.create_default_context()
    if s.smtp_port == 465:
        with smtplib.SMTP_SSL(s.smtp_host, s.smtp_port, context=ctx, timeout=20) as server:
            if s.smtp_user:
                server.login(s.smtp_user, s.smtp_password or "")
            server.send_message(msg)
    else:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as server:
            if s.smtp_starttls:
                server.starttls(context=ctx)
            if s.smtp_user:
                server.login(s.smtp_user, s.smtp_password or "")
            server.send_message(msg)


def _render(scan: Scan, findings: list[Finding]) -> tuple[str, str]:
    s = get_settings()
    link = f"{s.frontend_url}/app/scans/{scan.id}"
    rows_text = "\n".join(
        f"- [{f.severity.upper()}] {f.credential_type} in {f.repository or ''}{'/' if f.repository else ''}{f.file_path or ''}"
        f":{f.line_number or ''} (risk {f.risk_score:.0f})"
        for f in findings
    )
    text = (
        f"GhostTrace found {len(findings)} new exposed credential(s) while scanning {scan.target}.\n\n{rows_text}\n\n"
        f"Review and rotate them: {link}\n"
    )
    rows_html = "".join(
        f"<tr><td style='padding:8px 10px;border-bottom:1px solid #1d2c45'>"
        f"<span style='color:{SEV_COLOR[f.severity]};font-family:monospace;font-size:12px;text-transform:uppercase'>{f.severity}</span></td>"
        f"<td style='padding:8px 10px;border-bottom:1px solid #1d2c45;color:#e6ecf5'>{html.escape(f.credential_type)}<br>"
        f"<span style='color:#9aabc4;font-family:monospace;font-size:12px'>{html.escape((f.repository or '') + ('/' if f.repository else '') + (f.file_path or ''))}:{f.line_number or ''}</span></td>"
        f"<td style='padding:8px 10px;border-bottom:1px solid #1d2c45;color:#e6ecf5;font-family:monospace'>{f.risk_score:.0f}</td></tr>"
        for f in findings[:25]
    )
    body = f"""<div style="background:#050a14;padding:32px;font-family:Arial,sans-serif">
<div style="max-width:620px;margin:0 auto;background:#08111f;border:1px solid #162a47;border-radius:12px;padding:28px">
<div style="color:#22d3ee;font-family:monospace;font-size:12px;letter-spacing:2px">GHOSTTRACE ALERT</div>
<h2 style="color:#fff;margin:10px 0 6px">{len(findings)} exposed credential(s) found</h2>
<p style="color:#9aabc4;margin:0 0 18px">Target: <b style="color:#e6ecf5">{html.escape(scan.target)}</b></p>
<table style="width:100%;border-collapse:collapse;font-size:14px">{rows_html}</table>
<a href="{link}" style="display:inline-block;margin-top:22px;background:#22d3ee;color:#050a14;padding:11px 20px;border-radius:8px;font-weight:bold;text-decoration:none">Review findings</a>
<p style="color:#6b7f9e;font-size:12px;margin-top:22px">Rotate any exposed secret immediately; deleting the file does not remove it from git history.</p>
</div></div>"""
    return text, body


def alert_for_scan(db: Session, scan: Scan, findings: list[Finding]) -> Alert | None:
    user = db.get(User, scan.user_id)
    if user is None or not user.alerts_enabled:
        return None
    threshold = SEV_RANK.get(user.alert_min_severity, 2)
    # Only alert on credentials that have not been seen in an earlier scan.
    earlier = set(db.scalars(
        select(Finding.fingerprint).where(Finding.user_id == user.id, Finding.scan_id != scan.id)
    ))
    fresh = [
        f for f in findings
        if SEV_RANK[f.severity] >= threshold and f.status == "open" and f.fingerprint not in earlier
    ]
    if not fresh:
        return None
    fresh.sort(key=lambda f: -f.risk_score)
    subject = f"[GhostTrace] {len(fresh)} exposed credential(s) in {scan.target}"
    alert = Alert(user_id=user.id, scan_id=scan.id, subject=subject, findings_count=len(fresh))
    try:
        text, body = _render(scan, fresh)
        send_email(user.email, subject, text, body)
        alert.status = "sent"
    except EmailNotConfigured as exc:
        alert.status = "skipped"
        alert.error = str(exc)
    except Exception as exc:  # noqa: BLE001
        log.warning("Alert email failed: %s", exc)
        alert.status = "failed"
        alert.error = str(exc)
    db.add(alert)
    db.commit()
    return alert
