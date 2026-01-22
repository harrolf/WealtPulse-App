from typing import Dict, Tuple
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models import User, OAuthAccount
from app.utils.datetime_utils import utc_now
# from app.core.security import get_password_hash # If we need to create users


class OAuthService:
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=10.0)

    async def close(self):
        await self.http_client.aclose()

    # --- GOOGLE ---
    def get_google_auth_url(self, state: str) -> str:
        base_url = "https://accounts.google.com/o/oauth2/v2/auth"
        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "response_type": "code",
            "scope": "openid email profile",
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "state": state,
            "access_type": "offline",
            "prompt": "consent",
        }
        query = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query}"

    async def exchange_google_code(self, code: str) -> Dict:
        url = "https://oauth2.googleapis.com/token"
        data = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        }
        response = await self.http_client.post(url, data=data)
        response.raise_for_status()
        return response.json()

    async def get_google_user_info(self, access_token: str) -> Dict:
        url = "https://www.googleapis.com/oauth2/v3/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}
        response = await self.http_client.get(url, headers=headers)
        response.raise_for_status()
        return response.json()

    # --- APPLE ---
    def get_apple_auth_url(self, state: str) -> str:
        base_url = "https://appleid.apple.com/auth/authorize"
        params = {
            "client_id": settings.APPLE_CLIENT_ID,
            "response_type": "code",  # can be code id_token
            "scope": "name email",
            "response_mode": "form_post",
            "redirect_uri": settings.APPLE_REDIRECT_URI,
            "state": state,
        }
        query = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query}"

    # Apple exchange is more complex requiring client_secret generation (JWT)
    # Skipping detailed Apple implementation for now to focus on Google first,
    # but framework is here.

    # --- LINKEDIN ---
    def get_linkedin_auth_url(self, state: str) -> str:
        base_url = "https://www.linkedin.com/oauth/v2/authorization"
        params = {
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "response_type": "code",
            "scope": "r_liteprofile r_emailaddress",
            "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
            "state": state,
        }
        query = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"{base_url}?{query}"

    async def exchange_linkedin_code(self, code: str) -> Dict:
        url = "https://www.linkedin.com/oauth/v2/accessToken"
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": settings.LINKEDIN_REDIRECT_URI,
            "client_id": settings.LINKEDIN_CLIENT_ID,
            "client_secret": settings.LINKEDIN_CLIENT_SECRET,
        }
        response = await self.http_client.post(url, data=data)
        response.raise_for_status()
        return response.json()

    async def get_linkedin_user_info(self, access_token: str) -> Dict:
        # Linkedin requires two calls for profile and email usually or simplified scope
        url = "https://api.linkedin.com/v2/me"
        headers = {"Authorization": f"Bearer {access_token}"}
        response = await self.http_client.get(url, headers=headers)
        response.raise_for_status()
        profile = response.json()

        # Get email
        email_url = "https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))"
        email_resp = await self.http_client.get(email_url, headers=headers)
        email_data = email_resp.json()
        email = email_data["elements"][0]["handle~"]["emailAddress"]

        return {
            "id": profile["id"],
            "name": f"{profile.get('localizedFirstName', '')} {profile.get('localizedLastName', '')}",
            "email": email,
        }

    # --- COMMON ---
    async def get_user_from_provider(
        self, provider: str, code: str, db: AsyncSession
    ) -> Tuple[User, bool]:
        """
        Exchange code for token, get user info, and find/create user in DB.
        Returns (User, is_new_user)
        """
        token_data = {}
        user_info = {}

        if provider == "google":
            token_data = await self.exchange_google_code(code)
            user_info = await self.get_google_user_info(token_data["access_token"])
            # user_info: sub, name, email, email_verified, picture
            provider_user_id = user_info["sub"]
            email = user_info["email"]
            name = user_info["name"]

        elif provider == "linkedin":
            token_data = await self.exchange_linkedin_code(code)
            user_info = await self.get_linkedin_user_info(token_data["access_token"])
            provider_user_id = user_info["id"]
            email = user_info["email"]
            name = user_info["name"]

        else:
            raise ValueError(f"Provider {provider} not implemented yet")

        # 1. Check if OAuth account exists
        stmt = (
            select(OAuthAccount)
            .join(User)
            .where(
                OAuthAccount.provider == provider,
                OAuthAccount.provider_user_id == provider_user_id,
            )
        )
        result = await db.execute(stmt)
        oauth_account = result.scalars().first()

        if oauth_account:
            # Update tokens
            oauth_account.access_token = token_data.get("access_token")
            # oauth_account.refresh_token = token_data.get("refresh_token") # Google only gives refresh on first time unless forced
            oauth_account.updated_at = utc_now()
            await db.commit()
            return oauth_account.user, False

        # 2. Check if user with email exists
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        user = result.scalars().first()
        is_new = False

        if not user:
            # Create new user
            is_new = True
            user = User(
                email=email,
                name=name,
                is_active=True,
                is_verified=True,  # OAuth trusted
                email_verified=True,
                is_admin=email.lower() in settings.ADMIN_EMAILS,
            )
            db.add(user)
            await db.flush()  # Get ID

        # 3. Create OAuth account link
        new_oauth = OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            access_token=token_data.get("access_token"),
            refresh_token=token_data.get("refresh_token"),
            token_expires_at=None,  # TODO: calculate from expires_in
        )
        db.add(new_oauth)
        await db.commit()
        await db.refresh(user)

        return user, is_new


oauth_service = OAuthService()
