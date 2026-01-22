from datetime import timedelta

from typing import Any, List

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.core import security
from app.core.config import settings
from app.models import User, OAuthAccount, WebAuthnCredential
from sqlalchemy import delete
from app.schemas.auth import (
    Token,
    TokenRefresh,
    UserRegister,
    UserResponse,
    PasskeyRegisterRequest,
    OAuthAccountInfo,
    PasskeyInfo,
)
from app.services.oauth_service import oauth_service
from app.services.auth_service import auth_service
from itsdangerous import URLSafeTimedSerializer

from app.core.rate_limit import limiter

router = APIRouter()


@router.post("/register", response_model=UserResponse)
async def register(
    user_in: UserRegister, db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Create new user with email and password.
    """
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this user name already in the system.",
        )

    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        name=user_in.name,
        is_active=True,
        # verification logic could be here
        is_verified=False,
        is_admin=user_in.email.lower() in settings.ADMIN_EMAILS,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/login", response_model=Token)
@limiter.limit("5/minute")
async def login_access_token(
    request: Request,
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests.
    """
    # Find user
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()

    if (
        not user
        or not user.hashed_password
        or not security.verify_password(form_data.password, user.hashed_password)
    ):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )

    # Store refresh token via service
    # from app.services.auth_service import auth_service (Moved to top)
    refresh_token = await auth_service.save_refresh_token(db, user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
    }


@router.post("/refresh", response_model=Token)
async def refresh_token(
    token_in: TokenRefresh, db: AsyncSession = Depends(deps.get_db)
) -> Any:
    """
    Refresh access token.
    """
    try:
        payload = security.verify_refresh_token(token_in.refresh_token)
        # Check if it's a refresh token
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid token type")

        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise HTTPException(status_code=400, detail="Invalid token")

        # Optional: Check if token is revoked in DB (not fully implemented yet)
        if await security.is_token_revoked(db, token_in.refresh_token):
            raise HTTPException(status_code=400, detail="Token revoked")

    except (deps.JWTError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid token")

    # Check if user exists and is active
    user = await db.get(User, int(user_id_str))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    
    # Store user_id to avoid lazy loading issues
    user_id = user.id

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user_id, expires_delta=access_token_expires
    )

    # ROTATE Refresh Token
    # 1. Revoke old
    await security.revoke_refresh_token(db, token_in.refresh_token)

    # 2. Issue new via service
    # from app.services.auth_service import auth_service (Moved to top)
    new_refresh_token = await auth_service.save_refresh_token(db, user_id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": new_refresh_token,
    }


@router.post("/test-token", response_model=UserResponse)
async def test_token(current_user: User = Depends(deps.get_current_user)) -> Any:
    """
    Test access token
    """
    return current_user


@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(deps.get_current_user)) -> Any:
    """
    Get current user.
    """
    return current_user


# --- OAuth Endpoints ---


@router.get("/oauth/{provider}")
async def oauth_login(provider: str, state: str = "state"):
    """
    Get the OAuth login URL for the provider.
    """
    # Generate signed state
    serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
    state = serializer.dumps("oauth")

    if provider == "google":
        return {"url": oauth_service.get_google_auth_url(state)}
    elif provider == "apple":
        return {"url": oauth_service.get_apple_auth_url(state)}
    elif provider == "linkedin":
        return {"url": oauth_service.get_linkedin_auth_url(state)}
    else:
        raise HTTPException(status_code=400, detail="Provider not supported")


@router.post("/oauth/{provider}/callback", response_model=Token)
async def oauth_callback(
    provider: str,
    code: str = Body(..., embed=True),
    state: str = Body("state", embed=True),  # In real app, verify state
    db: AsyncSession = Depends(deps.get_db),
):
    # Verify state
    try:
        serializer = URLSafeTimedSerializer(settings.SECRET_KEY)
        data = serializer.loads(state, max_age=300)  # 5 minutes expiration
        if data != "oauth":
            raise ValueError("Invalid state data")
    except Exception:
        raise HTTPException(
            status_code=400, detail="Invalid or expired state parameter"
        )

    try:
        user, is_new = await oauth_service.get_user_from_provider(provider, code, db)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        user.id, expires_delta=access_token_expires
    )

    # Store refresh token via service
    # from app.services.auth_service import auth_service (Moved to top)
    refresh_token = await auth_service.save_refresh_token(db, user.id)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "refresh_token": refresh_token,
    }


# --- Passkey Endpoints ---


@router.post("/passkey/register/options")
async def register_passkey_options(
    request: PasskeyRegisterRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db),
):
    # options = await webauthn_service.generate_registration_options(current_user, db)
    # return options
    raise HTTPException(
        status_code=501, detail="Passkey registration is currently disabled."
    )


@router.get("/accounts", response_model=List[OAuthAccountInfo])
async def get_connected_accounts(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db),
):
    """List all connected OAuth accounts for the current user."""
    # from app.models import OAuthAccount (Moved to top)
    result = await db.execute(
        select(OAuthAccount).where(OAuthAccount.user_id == current_user.id)
    )
    return result.scalars().all()


@router.delete("/oauth/{provider}")
async def unlink_oauth_account(
    provider: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db),
):
    """Unlink an OAuth account from the current user."""
    # Imports moved to top
    stmt = delete(OAuthAccount).where(
        OAuthAccount.user_id == current_user.id, OAuthAccount.provider == provider
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "success"}


@router.get("/passkeys", response_model=List[PasskeyInfo])
async def get_passkeys(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db),
):
    """List all registered passkeys for the current user."""
    # Imports moved to top
    result = await db.execute(
        select(WebAuthnCredential).where(WebAuthnCredential.user_id == current_user.id)
    )
    return result.scalars().all()


@router.delete("/passkeys/{credential_id}")
async def delete_passkey(
    credential_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db),
):
    """Remove a registered passkey."""
    # Imports moved to top
    stmt = delete(WebAuthnCredential).where(
        WebAuthnCredential.user_id == current_user.id,
        WebAuthnCredential.credential_id == credential_id,
    )
    await db.execute(stmt)
    await db.commit()
    return {"status": "success"}


# Note: Complete Passkey implementation requires verify endpoints which I'll stub for now
# as they require robust session management for the challenge which is complex to add in one shot.
