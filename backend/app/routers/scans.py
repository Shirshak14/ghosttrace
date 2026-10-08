from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Finding, Scan, User
from ..schemas import FindingOut, GithubScanIn, ScanOut, TextScanIn
from ..security import get_current_user
from ..services.alerts import alert_for_scan
from ..services.scanner import persist_hits, run_github_scan, scan_text_blob, scan_upload
from ..sources.github import GitHubError, parse_owner_target, parse_repo_target

router = APIRouter(prefix="/api/scans", tags=["scans"])
MAX_UPLOAD = 20 * 1024 * 1024


def _get_scan(db: Session, user: User, scan_id: int) -> Scan:
    scan = db.get(Scan, scan_id)
    if scan is None or scan.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan not found")
    return scan


def _complete_inline(db: Session, scan: Scan, stats) -> Scan:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    scan.status, scan.started_at = "running", now
    findings = persist_hits(db, scan, stats.hits)
    scan.files_scanned = stats.files
    scan.status, scan.progress, scan.finished_at = "completed", 100, datetime.now(timezone.utc)
    scan.message = f"Scanned {stats.files} file(s)"
    db.commit()
    alert_for_scan(db, scan, findings)
    db.refresh(scan)
    return scan


@router.post("/github", response_model=ScanOut, status_code=status.HTTP_202_ACCEPTED)
def start_github_scan(body: GithubScanIn, tasks: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Scan:
    try:
        target = parse_repo_target(body.target) if body.target_type == "github_repo" else parse_owner_target(body.target)
    except GitHubError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))
    active = db.scalar(select(func.count()).select_from(Scan).where(Scan.user_id == user.id, Scan.status.in_(["queued", "running"])))
    if active and active >= 3:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "You already have 3 scans running. Wait for one to finish.")
    scan = Scan(user_id=user.id, target_type=body.target_type, target=target, message="Queued")
    db.add(scan)
    db.commit()
    db.refresh(scan)
    tasks.add_task(run_github_scan, scan.id, body.include_history)
    return scan


@router.post("/text", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def scan_text_content(body: TextScanIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Scan:
    scan = Scan(user_id=user.id, target_type="text", target=body.label or "Pasted text")
    db.add(scan)
    db.commit()
    return _complete_inline(db, scan, scan_text_blob(body.content, body.label or "pasted.txt", "text"))


@router.post("/upload", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
async def scan_file(file: UploadFile = File(...), label: str = Form(default=""), user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Scan:
    data = await file.read(MAX_UPLOAD + 1)
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Files must be 20 MB or smaller.")
    name = file.filename or "upload.txt"
    scan = Scan(user_id=user.id, target_type="file", target=label or name)
    db.add(scan)
    db.commit()
    try:
        stats = scan_upload(name, data)
    except Exception as exc:  # bad zip etc.
        scan.status, scan.error = "failed", f"Could not read file: {exc}"
        db.commit()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, scan.error)
    return _complete_inline(db, scan, stats)


@router.get("", response_model=list[ScanOut])
def list_scans(limit: int = Query(50, le=200), offset: int = 0, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Scan]:
    return list(db.scalars(select(Scan).where(Scan.user_id == user.id).order_by(Scan.created_at.desc()).limit(limit).offset(offset)))


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(scan_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Scan:
    return _get_scan(db, user, scan_id)


@router.get("/{scan_id}/findings", response_model=list[FindingOut])
def scan_findings(scan_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Finding]:
    scan = _get_scan(db, user, scan_id)
    return list(db.scalars(select(Finding).where(Finding.scan_id == scan.id).order_by(Finding.risk_score.desc())))


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(scan_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    scan = _get_scan(db, user, scan_id)
    if scan.status == "running":
        raise HTTPException(status.HTTP_409_CONFLICT, "Wait for the scan to finish before deleting it.")
    db.delete(scan)
    db.commit()
