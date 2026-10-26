from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import User
from ..ratelimit import rate_limit
from ..schemas import ForgotPasswordIn, LoginIn, ResetPasswordIn, RegisterIn, TokenIn, TokenOut, UserOut, UserUpdate
from ..security import (
    create_access_token, create_reset_token, create_verify_token, get_current_user, hash_password, user_from_reset_token,
    user_from_verify_token, verify_password,
)
from ..services.alerts import send_password_reset, send_verification

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(rate_limit("register", 5, 3600))])
def register(body: RegisterIn, tasks: BackgroundTasks, db: Session = Depends(get_db)) -> TokenOut:
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(
        email=email,
        full_name=body.full_name.strip(),
        organization=body.organization.strip(),
        password_hash=hash_password(body.password),
        # Without SMTP there is no way to deliver a confirmation link, so local/dev installs skip the step.
        email_verified=not get_settings().smtp_host,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    if not user.email_verified:
        tasks.add_task(send_verification, user, create_verify_token(user))
    return TokenOut(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut, dependencies=[Depends(rate_limit("login", 10, 300))])
def login(body: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return TokenOut(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(rate_limit("forgot", 5, 3600))])
def forgot_password(body: ForgotPasswordIn, tasks: BackgroundTasks, db: Session = Depends(get_db)) -> dict:
    # Same response whether or not the account exists, so this can't be used to discover registered emails.
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    if user is not None:
        tasks.add_task(send_password_reset, user, create_reset_token(user))
    return {"message": "If an account exists for that email, a reset link is on its way."}


@router.post("/reset-password", dependencies=[Depends(rate_limit("reset", 10, 3600))])
def reset_password(body: ResetPasswordIn, db: Session = Depends(get_db)) -> dict:
    user = user_from_reset_token(body.token, db)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This reset link is invalid or has expired. Request a new one.")
    user.password_hash = hash_password(body.password)
    user.token_version = (user.token_version or 0) + 1  # sign out every device that had the old password
    # Following a link sent to the address proves the account owns it.
    user.email_verified = True
    db.commit()
    return {"message": "Password updated. You can sign in now."}


@router.post("/verify-email", response_model=UserOut, dependencies=[Depends(rate_limit("verify", 20, 3600))])
def verify_email(body: TokenIn, db: Session = Depends(get_db)) -> User:
    user = user_from_verify_token(body.token, db)
    if user is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This confirmation link is invalid or has expired.")
    user.email_verified = True
    db.commit()
    db.refresh(user)
    return user


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED, dependencies=[Depends(rate_limit("resend", 3, 3600))])
def resend_verification(tasks: BackgroundTasks, user: User = Depends(get_current_user)) -> dict:
    if user.email_verified:
        return {"message": "Your email is already confirmed."}
    if not get_settings().smtp_host:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Email delivery isn't set up on this server yet.")
    tasks.add_task(send_verification, user, create_verify_token(user))
    return {"message": f"We sent a new confirmation link to {user.email}."}


@router.post("/logout-others", response_model=TokenOut)
def logout_other_devices(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> TokenOut:
    """Invalidate every login token issued so far and hand this device a fresh one."""
    user.token_version = (user.token_version or 0) + 1
    db.commit()
    db.refresh(user)
    return TokenOut(access_token=create_access_token(user), user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user
