from datetime import timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from app.models import RefreshToken
from app.core.config import settings
from app.core import security
from app.utils.datetime_utils import utc_now


class AuthService:
    async def save_refresh_token(
        self, db: AsyncSession, user_id: int, refresh_token_str: str = None
    ) -> str:
        """
        Save a refresh token to the database.
        If refresh_token_str is provided, it tries to save it (hashed).
        If not provided, or if collision occurs, it generates a new one.
        Returns the raw refresh token string that was saved.
        """
        token_to_save = refresh_token_str or security.create_refresh_token(user_id)

        # Store refresh token with retry for collision
        for i in range(3):
            try:
                refresh_expires = utc_now() + timedelta(
                    days=settings.REFRESH_TOKEN_EXPIRE_DAYS
                )
                db_refresh = RefreshToken(
                    user_id=user_id,
                    token_hash=security.get_token_hash(token_to_save),
                    expires_at=refresh_expires,
                    revoked=False,
                )
                db.add(db_refresh)
                await db.commit()
                return token_to_save
            except IntegrityError:
                await db.rollback()
                # Regenerate token and try again
                if i < 2:
                    token_to_save = security.create_refresh_token(user_id)
            except Exception:
                await db.rollback()
                raise

        raise IntegrityError(
            "Failed to save refresh token after retries", params=None, orig=None
        )


auth_service = AuthService()
