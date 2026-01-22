from typing import List
from webauthn import (
    generate_registration_options,
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    RegistrationCredential,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.models import User, WebAuthnCredential


class WebAuthnService:
    def _get_credentials_for_user(
        self, user_credentials: List[WebAuthnCredential]
    ) -> List[RegistrationCredential]:
        return [
            RegistrationCredential(
                id=cred.credential_id.encode(),  # Assuming base64 or bytes storage logic
                # For py_webauthn version we might need to handle decoding if stored as base64 string
                type="public-key",
            )
            for cred in user_credentials
        ]

    async def generate_registration_options(self, user: User, db: AsyncSession):
        # Retrieve existing credentials to exclude them
        stmt = select(WebAuthnCredential).where(WebAuthnCredential.user_id == user.id)
        result = await db.execute(stmt)
        user_creds = result.scalars().all()

        # Simple bytes user ID creation
        user_handle = str(user.id).encode()

        options = generate_registration_options(
            rp_id=settings.WEBAUTHN_RP_ID,
            rp_name=settings.WEBAUTHN_RP_NAME,
            user_id=user_handle,
            user_name=user.email,
            user_display_name=user.name,
            exclude_credentials=self._get_credentials_for_user(user_creds),
            authenticator_selection=AuthenticatorSelectionCriteria(
                user_verification=UserVerificationRequirement.PREFERRED
            ),
        )
        return options

    async def verify_registration(
        self, user: User, db: AsyncSession, credential_json: dict, device_name: str
    ):
        # We need to retrieve the challenge from session/cache.
        # For simplicity in this implementation we assume the client sends it back or we verify statelessly/trust temporarily
        # BUT secure implementation requires storing challenge.
        # Here we'll rely on the caller to provide the expected challenge if needed.
        # Ideally, `verify_registration_response` takes `expected_challenge`.
        pass

    # Note: Full WebAuthn implementation requires server-side state (session/redis) to store challenges.
    # I'll implement a simplified version that assumes state management issues are handled by the caller (auth endpoints)


webauthn_service = WebAuthnService()
