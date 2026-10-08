from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Finding, User
from ..schemas import FindingOut, FindingPage, FindingUpdate
from ..security import get_current_user

router = APIRouter(prefix="/api/findings", tags=["findings"])

SORTS = {
    "risk": Finding.risk_score.desc(),
    "newest": Finding.first_seen.desc(),
    "oldest": Finding.first_seen.asc(),
}


def filtered_query(user_id: int, severity: str | None, category: str | None, status_: str | None, q: str | None,
                   repository: str | None, scan_id: int | None):
    stmt = select(Finding).where(Finding.user_id == user_id)
    if severity:
        stmt = stmt.where(Finding.severity.in_(severity.split(",")))
    if category:
        stmt = stmt.where(Finding.category.in_(category.split(",")))
    if status_:
        stmt = stmt.where(Finding.status.in_(status_.split(",")))
    if repository:
        stmt = stmt.where(Finding.repository == repository)
    if scan_id:
        stmt = stmt.where(Finding.scan_id == scan_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Finding.credential_type.ilike(like), Finding.repository.ilike(like),
                              Finding.file_path.ilike(like), Finding.secret_masked.ilike(like)))
    return stmt


@router.get("", response_model=FindingPage)
def list_findings(
    severity: str | None = None, category: str | None = None, status_: str | None = Query(None, alias="status"),
    q: str | None = None, repository: str | None = None, scan_id: int | None = None,
    sort: Literal["risk", "newest", "oldest"] = "risk", page: int = Query(1, ge=1), page_size: int = Query(25, ge=1, le=200),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
) -> FindingPage:
    stmt = filtered_query(user.id, severity, category, status_, q, repository, scan_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = db.scalars(stmt.order_by(SORTS[sort], Finding.id.desc()).limit(page_size).offset((page - 1) * page_size))
    return FindingPage(items=[FindingOut.model_validate(f) for f in items], total=total, page=page, page_size=page_size)


@router.get("/{finding_id}", response_model=FindingOut)
def get_finding(finding_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Finding:
    f = db.get(Finding, finding_id)
    if f is None or f.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Finding not found")
    return f


@router.patch("/{finding_id}", response_model=FindingOut)
def update_finding(finding_id: int, body: FindingUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Finding:
    f = get_finding(finding_id, user, db)
    # Apply the triage decision to every occurrence of the same secret.
    for same in db.scalars(select(Finding).where(Finding.user_id == user.id, Finding.fingerprint == f.fingerprint)):
        same.status = body.status
    db.commit()
    db.refresh(f)
    return f
