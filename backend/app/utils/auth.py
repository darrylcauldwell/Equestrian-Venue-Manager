from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import TokenData

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(user_id: int, expire_minutes: Optional[int] = None) -> str:
    """
    Create an access token for the given user.

    Args:
        user_id: The user's ID
        expire_minutes: Token expiration in minutes (defaults to env/db setting)
    """
    minutes = expire_minutes if expire_minutes is not None else settings.access_token_expire_minutes
    expire = datetime.utcnow() + timedelta(minutes=minutes)
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "type": "access"
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(user_id: int, expire_days: Optional[int] = None) -> str:
    """
    Create a refresh token for the given user.

    Args:
        user_id: The user's ID
        expire_days: Token expiration in days (defaults to env/db setting)
    """
    days = expire_days if expire_days is not None else settings.refresh_token_expire_days
    expire = datetime.utcnow() + timedelta(days=days)
    to_encode = {
        "sub": str(user_id),
        "exp": expire,
        "type": "refresh"
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id is None:
            return None
        return TokenData(user_id=int(user_id), token_type=token_type)
    except JWTError:
        return None


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = decode_token(token)
    if token_data is None or token_data.token_type != "access":
        raise credentials_exception

    user = db.query(User).filter(User.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception

    return user


def get_current_user_optional(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> Optional[User]:
    try:
        return get_current_user(token, db)
    except HTTPException:
        return None


def require_role(*roles: UserRole):
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker


def require_roles(roles: list):
    """Require user to have one of the specified roles (by string name)."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        user_role = current_user.role.value if hasattr(current_user.role, 'value') else current_user.role
        if user_role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker


def require_staff_or_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require yard staff access (admin or is_yard_staff flag)."""
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yard staff access required"
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def has_staff_access(user: User) -> bool:
    """Check if user has staff access (admin, staff role, or legacy is_yard_staff flag)."""
    return user.role in (UserRole.ADMIN, UserRole.STAFF) or user.is_yard_staff


def require_yard_staff(current_user: User = Depends(get_current_user)) -> User:
    """Require user to have yard staff access (admin or is_yard_staff flag)."""
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Yard staff access required"
        )
    return current_user
