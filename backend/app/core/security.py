from datetime import timedelta
from typing import Union, Any, Optional
from jose import jwt, JWTError

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import RefreshToken
from app.utils.datetime_utils import utc_now

import bcrypt
import hashlib
from sqlalchemy import select


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password:
        return False
    # bcrypt requires bytes
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def get_password_hash(password: str) -> str:
    # bcrypt.hashpw returns bytes, we decode to store as string
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = utc_now() + expires_delta
    else:
        expire = utc_now() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(
        to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
    subject: Union[str, Any], expires_delta: Optional[timedelta] = None
) -> str:
    if expires_delta:
        expire = utc_now() + expires_delta
    else:
        expire = utc_now() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    # Sign with dedicated refresh token secret
    import uuid
    to_encode = {"exp": expire, "sub": str(subject), "type": "refresh", "jti": str(uuid.uuid4())}
    encoded_jwt = jwt.encode(
        to_encode, settings.REFRESH_TOKEN_SECRET, algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def verify_token(token: str) -> dict:
    """Decode and verify an access token."""
    try:
        decoded_token = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        return decoded_token
    except JWTError as e:
        raise e


def verify_refresh_token(token: str) -> dict:
    """Decode and verify a refresh token."""
    try:
        decoded_token = jwt.decode(
            token, settings.REFRESH_TOKEN_SECRET, algorithms=[settings.ALGORITHM]
        )
        return decoded_token
    except JWTError as e:
        raise e


def get_token_hash(token: str) -> str:
    """Return SHA256 hash of the token for DB storage."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def revoke_refresh_token(db: AsyncSession, token: str) -> None:
    """Revoke a refresh token by marking it as revoked in DB."""
    token_hash = get_token_hash(token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    result = await db.execute(stmt)
    db_token = result.scalar_one_or_none()

    if db_token:
        db_token.revoked = True
        db.add(db_token)
        await db.commit()


async def is_token_revoked(db: AsyncSession, token: str) -> bool:
    """Check if a token (refresh token) is revoked."""
    token_hash = get_token_hash(token)
    stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    result = await db.execute(stmt)
    db_token = result.scalar_one_or_none()

    # If not found, it's technically 'invalid' in a strict whitelist system,
    # but for revocation check, we mostly care if it IS found and IS revoked.
    if not db_token:
        return True  # Not in DB = Revoked/Invalid

    return db_token.revoked


# ----------------------------------------------------------------------------
# Symmetric Encryption Helpers (for OAuth tokens)
# ----------------------------------------------------------------------------
# Moved to app.core.crypto to avoid circular imports with models.py
