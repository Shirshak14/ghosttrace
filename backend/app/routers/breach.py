from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..intel.breach import BreachLookupError, check_email, password_strength, pwned_password_count
from ..models import BreachCheck, User
from ..schemas import BreachEmailIn, BreachOut, PasswordCheckIn, PasswordCheckOut
from ..security import get_current_user

router = APIRouter(prefix="/api/breach", tags=["breach"])


async def run_email_check(db: Session, user: User, email: str) -> BreachCheck:
    result = await check_email(email)
    check = BreachCheck(
        user_id=user.id, email=email.lower(), breach_count=len(result["breaches"]), breaches=result["breaches"],
        exposed_data=result["data_classes"], risk_score=result["risk"], source=result["source"],
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.post("/email", response_model=BreachOut)
async def email_check(body: BreachEmailIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> BreachCheck:
    try:
        return await run_email_check(db, user, body.email)
    except BreachLookupError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))


@router.get("/history", response_model=list[BreachOut])
def history(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[BreachCheck]:
    return list(db.scalars(select(BreachCheck).where(BreachCheck.user_id == user.id).order_by(BreachCheck.checked_at.desc()).limit(100)))


@router.post("/password", response_model=PasswordCheckOut)
async def password_check(body: PasswordCheckIn, _: User = Depends(get_current_user)) -> PasswordCheckOut:
    try:
        count = await pwned_password_count(body.password)
    except BreachLookupError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc))
    score, label, feedback = password_strength(body.password)
    if count:
        score, label = 0, "Compromised"
        feedback.insert(0, f"This password appears {count:,} times in known breaches. Never use it.")
    return PasswordCheckOut(pwned=count > 0, count=count, strength=score, strength_label=label, feedback=feedback)
