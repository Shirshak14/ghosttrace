from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Monitor, User
from ..schemas import MonitorIn, MonitorOut, MonitorUpdate
from ..security import get_current_user
from ..services.monitoring import run_monitor
from ..sources.github import GitHubError, parse_owner_target, parse_repo_target

router = APIRouter(prefix="/api/monitors", tags=["monitors"])


def _normalize(body: MonitorIn) -> str:
    if body.target_type == "email":
        if "@" not in body.target:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Enter a valid email address.")
        return body.target.strip().lower()
    try:
        return parse_repo_target(body.target) if body.target_type == "github_repo" else parse_owner_target(body.target)
    except GitHubError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc))


def _get(db: Session, user: User, monitor_id: int) -> Monitor:
    m = db.get(Monitor, monitor_id)
    if m is None or m.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Monitor not found")
    return m


@router.get("", response_model=list[MonitorOut])
def list_monitors(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Monitor]:
    return list(db.scalars(select(Monitor).where(Monitor.user_id == user.id).order_by(Monitor.created_at.desc())))


@router.post("", response_model=MonitorOut, status_code=status.HTTP_201_CREATED)
def create_monitor(body: MonitorIn, tasks: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Monitor:
    target = _normalize(body)
    if db.scalar(select(Monitor).where(Monitor.user_id == user.id, Monitor.target_type == body.target_type, Monitor.target == target)):
        raise HTTPException(status.HTTP_409_CONFLICT, "You are already monitoring this target.")
    m = Monitor(user_id=user.id, target_type=body.target_type, target=target)
    db.add(m)
    db.commit()
    db.refresh(m)
    tasks.add_task(run_monitor, m.id)  # baseline run
    return m


@router.patch("/{monitor_id}", response_model=MonitorOut)
def update_monitor(monitor_id: int, body: MonitorUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Monitor:
    m = _get(db, user, monitor_id)
    m.enabled = body.enabled
    db.commit()
    db.refresh(m)
    return m


@router.post("/{monitor_id}/run", response_model=MonitorOut, status_code=status.HTTP_202_ACCEPTED)
def run_now(monitor_id: int, tasks: BackgroundTasks, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Monitor:
    m = _get(db, user, monitor_id)
    tasks.add_task(run_monitor, m.id)
    return m


@router.delete("/{monitor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_monitor(monitor_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> None:
    db.delete(_get(db, user, monitor_id))
    db.commit()
