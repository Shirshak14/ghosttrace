from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Alert, User
from ..schemas import AlertOut
from ..security import get_current_user
from ..services.alerts import EmailNotConfigured, send_email

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


@router.get("", response_model=list[AlertOut])
def list_alerts(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Alert]:
    return list(db.scalars(select(Alert).where(Alert.user_id == user.id).order_by(Alert.created_at.desc()).limit(200)))


@router.get("/config")
def alert_config(_: User = Depends(get_current_user)) -> dict:
    s = get_settings()
    return {"email_configured": bool(s.smtp_host), "github_token_configured": bool(s.github_token),
            "breach_source": "Have I Been Pwned" if s.hibp_api_key else "XposedOrNot"}


@router.post("/test")
def send_test(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    subject = "[GhostTrace] Test alert"
    alert = Alert(user_id=user.id, subject=subject, findings_count=0)
    try:
        send_email(user.email, subject, "Email alerts from GhostTrace are working.",
                   "<p style='font-family:Arial'>Email alerts from <b>GhostTrace</b> are working.</p>")
        alert.status = "sent"
    except EmailNotConfigured as exc:
        alert.status, alert.error = "skipped", str(exc)
    except Exception as exc:  # noqa: BLE001
        alert.status, alert.error = "failed", str(exc)
    db.add(alert)
    db.commit()
    if alert.status != "sent":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, alert.error)
    return {"status": "sent", "to": user.email}
