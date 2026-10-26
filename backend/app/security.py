import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import User

ALGORITHM = "HS256"
_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_access_token(user: User) -> str:
    settings = get_settings()
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": str(user.id), "ver": user.token_version or 0, "exp": expires}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


RESET_TOKEN_MINUTES = 30


def _pw_fingerprint(password_hash: str) -> str:
    return hashlib.sha256(password_hash.encode()).hexdigest()[:16]


def create_reset_token(user: User) -> str:
    """Signed, short-lived, single-use: it embeds a fingerprint of the current password hash, so it stops
    working as soon as the password changes. It has no `sub` claim, so it can never be used as a login token."""
    expires = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_MINUTES)
    payload = {"uid": user.id, "pwf": _pw_fingerprint(user.password_hash), "purpose": "reset", "exp": expires}
    return jwt.encode(payload, get_settings().secret_key, algorithm=ALGORITHM)


def user_from_reset_token(token: str, db: Session) -> User | None:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
        if payload.get("purpose") != "reset":
            return None
        user = db.get(User, int(payload["uid"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    if user is None or payload.get("pwf") != _pw_fingerprint(user.password_hash):
        return None
    return user


VERIFY_TOKEN_HOURS = 48


def create_verify_token(user: User) -> str:
    """Proves the holder received mail at this address. Bound to the email, so it stops working if the address changes."""
    expires = datetime.now(timezone.utc) + timedelta(hours=VERIFY_TOKEN_HOURS)
    payload = {"uid": user.id, "email": user.email, "purpose": "verify", "exp": expires}
    return jwt.encode(payload, get_settings().secret_key, algorithm=ALGORITHM)


def user_from_verify_token(token: str, db: Session) -> User | None:
    try:
        payload = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
        if payload.get("purpose") != "verify":
            return None
        user = db.get(User, int(payload["uid"]))
    except (jwt.PyJWTError, KeyError, ValueError):
        return None
    if user is None or payload.get("email") != user.email:
        return None
    return user


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated", {"WWW-Authenticate": "Bearer"})
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, get_settings().secret_key, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized
    user = db.get(User, user_id)
    if user is None or payload.get("ver", 0) != (user.token_version or 0):
        raise unauthorized
    return user
