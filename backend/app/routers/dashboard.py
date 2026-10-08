from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..detection.rules import CATEGORY_LABELS
from ..models import Alert, BreachCheck, Finding, Monitor, Scan, User
from ..schemas import FindingOut, ScanOut
from ..security import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])
SEVERITIES = ["critical", "high", "medium", "low"]


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


@router.get("/summary")
def summary(days: int = Query(30, ge=7, le=365), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    findings = list(db.scalars(select(Finding).where(Finding.user_id == user.id)))
    open_f = [f for f in findings if f.status == "open"]
    scans = list(db.scalars(select(Scan).where(Scan.user_id == user.id).order_by(Scan.created_at.desc())))
    monitors = list(db.scalars(select(Monitor).where(Monitor.user_id == user.id)))

    latest_breach: dict[str, BreachCheck] = {}
    for b in db.scalars(select(BreachCheck).where(BreachCheck.user_id == user.id).order_by(BreachCheck.checked_at.desc())):
        latest_breach.setdefault(b.email, b)

    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=days - 1)).date()
    trend = {(start + timedelta(days=i)).isoformat(): {s: 0 for s in SEVERITIES} for i in range(days)}
    for f in findings:
        day = _aware(f.first_seen).date().isoformat()
        if day in trend:
            trend[day][f.severity] += 1

    repos: dict[str, dict] = defaultdict(lambda: {"open": 0, "max_risk": 0.0, "critical": 0})
    for f in open_f:
        if f.repository:
            r = repos[f.repository]
            r["open"] += 1
            r["max_risk"] = max(r["max_risk"], f.risk_score)
            r["critical"] += f.severity == "critical"
    top_repos = sorted(({"repository": k, **v} for k, v in repos.items()), key=lambda r: (-r["max_risk"], -r["open"]))[:6]

    buckets = Counter(min(int(f.risk_score // 10), 9) for f in open_f)
    resolved = [f for f in findings if f.status == "resolved"]
    exposure_score = round(min(100.0, sum(f.risk_score for f in open_f if f.severity in ("critical", "high")) / 4), 1)

    return {
        "totals": {
            "findings": len(findings),
            "open": len(open_f),
            "critical_open": sum(f.severity == "critical" for f in open_f),
            "high_open": sum(f.severity == "high" for f in open_f),
            "resolved": len(resolved),
            "false_positives": sum(f.status == "false_positive" for f in findings),
            "scans": len(scans),
            "repositories": len({f.repository for f in findings if f.repository}),
            "files_scanned": sum(s.files_scanned for s in scans),
            "avg_risk": round(sum(f.risk_score for f in open_f) / len(open_f), 1) if open_f else 0.0,
            "monitors_active": sum(m.enabled for m in monitors),
            "breached_emails": sum(1 for b in latest_breach.values() if b.breach_count > 0),
            "exposure_score": exposure_score,
        },
        "by_severity": {s: sum(f.severity == s for f in open_f) for s in SEVERITIES},
        "by_category": sorted(
            ({"category": c, "label": CATEGORY_LABELS.get(c, c), "count": n} for c, n in Counter(f.category for f in open_f).items()),
            key=lambda x: -x["count"],
        ),
        "trend": [{"date": d, **v} for d, v in trend.items()],
        "risk_distribution": [{"bucket": f"{i * 10}-{i * 10 + 9 if i < 9 else 100}", "count": buckets.get(i, 0)} for i in range(10)],
        "top_repositories": top_repos,
        "recent_scans": [ScanOut.model_validate(s).model_dump(mode="json") for s in scans[:5]],
        "top_findings": [FindingOut.model_validate(f).model_dump(mode="json") for f in sorted(open_f, key=lambda f: -f.risk_score)[:6]],
    }


@router.get("/timeline")
def timeline(limit: int = Query(60, le=300), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[dict]:
    events: list[dict] = []
    for s in db.scalars(select(Scan).where(Scan.user_id == user.id).order_by(Scan.created_at.desc()).limit(limit)):
        if s.finished_at:
            events.append({
                "type": "scan_failed" if s.status == "failed" else "scan_completed",
                "at": _aware(s.finished_at).isoformat(),
                "title": f"Scan of {s.target} {'failed' if s.status == 'failed' else 'completed'}",
                "detail": s.error or f"{s.findings_count} finding(s), max risk {s.max_risk:.0f}",
                "scan_id": s.id,
                "severity": None,
            })
    seen_fp: set[str] = set()
    for f in db.scalars(select(Finding).where(Finding.user_id == user.id).order_by(Finding.first_seen.asc())):
        if f.fingerprint in seen_fp or f.severity not in ("critical", "high"):
            continue
        seen_fp.add(f.fingerprint)
        events.append({
            "type": "exposure",
            "at": _aware(f.first_seen).isoformat(),
            "title": f"{f.credential_type} exposed",
            "detail": f"{f.repository + '/' if f.repository else ''}{f.file_path or ''}",
            "scan_id": f.scan_id,
            "finding_id": f.id,
            "severity": f.severity,
        })
    for a in db.scalars(select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc()).limit(limit)):
        events.append({"type": f"alert_{a.status}", "at": _aware(a.created_at).isoformat(), "title": a.subject,
                       "detail": a.error or "Email alert delivered", "scan_id": a.scan_id, "severity": None})
    for b in db.scalars(select(BreachCheck).where(BreachCheck.user_id == user.id, BreachCheck.breach_count > 0)
                        .order_by(BreachCheck.checked_at.desc()).limit(limit)):
        events.append({"type": "breach", "at": _aware(b.checked_at).isoformat(), "title": f"{b.email} found in {b.breach_count} breach(es)",
                       "detail": ", ".join(x.get("name") or "" for x in b.breaches[:4]), "severity": "high" if b.risk_score >= 50 else "medium"})
    events.sort(key=lambda e: e["at"], reverse=True)
    return events[:limit]
