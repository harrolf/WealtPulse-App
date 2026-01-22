from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select

from ..database import get_db
from ..models import User, UserShare
from ..core import security
from ..core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")


async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = security.verify_token(token)
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    # Check if user exists
    user = await db.get(User, user_id)
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


async def get_effective_user_id(
    request: Request = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> int:
    """
    Determine the target user ID based on context (header) and permissions.
    """
    # Check for context header
    target_user_id_str = request.headers.get("X-Portfolio-User-ID") if request else None

    if not target_user_id_str:
        return current_user.id

    try:
        target_user_id = int(target_user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid target user ID")

    # If targeting self, always allowed
    if target_user_id == current_user.id:
        return current_user.id

    # Admin bypass
    if current_user.is_admin:
        return target_user_id

    # Check shared access
    # from app.models import UserShare (Moved to top)
    stmt = select(UserShare).where(
        UserShare.owner_id == target_user_id, UserShare.viewer_id == current_user.id
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()

    if share:
        return target_user_id

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You do not have access to this portfolio",
    )


# Helper to preserve existing endpoint signatures temporarily or refactor them
# Ideally we replace usages of get_current_user_id() with properties of get_current_user()
async def get_current_user_id(current_user: User = Depends(get_current_user)) -> int:
    return current_user.id


async def get_current_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges",
        )
    return current_user
async def get_optional_user_id(
    db: AsyncSession = Depends(get_db), request: Request = None
) -> Optional[int]:
    """
    Get user ID if logged in, otherwise return None.
    Does not raise 401.
    """
    auth_header = request.headers.get("Authorization") if request else None
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.split(" ")[1]
    try:
        payload = security.verify_token(token)
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            return None
        return int(user_id_str)
    except (JWTError, ValueError):
        return None
