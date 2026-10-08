import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Finding, Scan, User
from ..security import get_current_user
from ..services.reports import build_pdf
from .findings import filtered_query

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/findings.csv")
def findings_csv(
    severity: str | None = None, category: str | None = None, status_: str | None = Query(None, alias="status"),
    q: str | None = None, scan_id: int | None = None, user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    rows = db.scalars(filtered_query(user.id, severity, category, status_, q, None, scan_id).order_by(Finding.risk_score.desc()))
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "severity", "risk_score", "confidence", "credential_type", "category", "status", "repository", "file_path",
                "line", "commit", "history_only", "secret_masked", "first_seen", "url"])
    for f in rows:
        w.writerow([f.id, f.severity, f.risk_score, f.confidence, f.credential_type, f.category, f.status, f.repository or "",
                    f.file_path or "", f.line_number or "", f.commit_sha or "", f.in_history_only, f.secret_masked,
                    f.first_seen.isoformat(), f.url or ""])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="ghosttrace-findings-{stamp}.csv"'})


@router.get("/summary.pdf")
def summary_pdf(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    findings = list(db.scalars(select(Finding).where(Finding.user_id == user.id)))
    scans = list(db.scalars(select(Scan).where(Scan.user_id == user.id)))
    pdf = build_pdf(user, findings, scans, "Exposure summary", "All open findings across every scan in this workspace.")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="ghosttrace-summary-{stamp}.pdf"'})


@router.get("/scan/{scan_id}.pdf")
def scan_pdf(scan_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Response:
    scan = db.get(Scan, scan_id)
    if scan is None or scan.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    findings = list(db.scalars(select(Finding).where(Finding.scan_id == scan.id)))
    sub = f"{scan.target_type.replace('_', ' ').title()}: {scan.target} · {scan.repos_scanned} repos, {scan.files_scanned} files, {scan.commits_scanned} commits"
    pdf = build_pdf(user, findings, [scan], f"Scan #{scan.id}: {scan.target}", sub)
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="ghosttrace-scan-{scan.id}.pdf"'})
