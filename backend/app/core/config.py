from typing import List
from pydantic import field_validator, ValidationInfo, model_validator, Field
from pydantic_settings import BaseSettings


# Read version from VERSION file
def get_version() -> str:
    from pathlib import Path
    search_paths = [
        Path(__file__).parent.parent.parent / "VERSION",  # backend/VERSION
        Path(__file__).parent.parent.parent.parent / "VERSION",  # root/VERSION
    ]
    for version_file in search_paths:
        try:
            if version_file.exists():
                return version_file.read_text().strip()
        except Exception:
            continue
    return "1.5.9"  # Fallback to current release version


class Settings(BaseSettings):
    # App Settings
    APP_NAME: str = "WealthPulse"
    API_V1_STR: str = "/api/v1"
    APP_VERSION: str = get_version()
    ENVIRONMENT: str = "development"  # development, staging, production

    @field_validator("ENVIRONMENT")
    @classmethod
    def validate_environment(cls, v: str) -> str:
        allowed = {"development", "staging", "production"}
        if v.lower() not in allowed:
            raise ValueError(f"ENVIRONMENT must be one of {allowed}, got '{v}'")
        return v.lower()

    # Currency Settings
    DEFAULT_CURRENCY: str = "CHF"

    # Database Settings
    DATABASE_URL: str = "sqlite+aiosqlite:///./data/wealthpulse.db"
    DECIMAL_PRECISION: int = 8

    @field_validator("DATABASE_URL")
    @classmethod
    def assemble_db_connection(cls, v: str | None) -> str:
        if not v:
            return "sqlite+aiosqlite:///./data/wealthpulse.db"
        if v.startswith("postgresql://"):
            return v.replace("postgresql://", "postgresql+asyncpg://")
        # Ensure proper async driver for SQLite
        if v.startswith("sqlite://") and "aiosqlite" not in v:
            return v.replace("sqlite://", "sqlite+aiosqlite://")
        return v


    @model_validator(mode="after")
    def check_production_security(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            if "sqlite" in self.DATABASE_URL:
                raise ValueError(
                    "CRITICAL CONFIGURATION ERROR: Usage of SQLite in production usage is forbidden. "
                    "Please configure a PostgreSQL DATABASE_URL."
                )
        return self

    # CORS Settings

    BACKEND_CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173"],
        validation_alias="CORS_ORIGINS",
    )

    # Market Data Settings
    USE_MOCK_DATA: bool = False
    MARKET_DATA_RETENTION_DAYS: int = 7

    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 240
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    REFRESH_TOKEN_SECRET: str = "your-refresh-secret-key-change-in-production"
    ENCRYPTION_KEY: str = ""

    @field_validator("SECRET_KEY", "REFRESH_TOKEN_SECRET", "ENCRYPTION_KEY")
    @classmethod
    def validate_security_credentials(cls, v: str, info: ValidationInfo) -> str:
        """Ensure critical security keys are not using default placeholders."""
        placeholders = {
            "your-secret-key-change-in-production",
            "your-refresh-secret-key-change-in-production",
            ""
        }
        if v in placeholders:
            raise ValueError(f"CRITICAL: {info.field_name} must be set to a secure value in .env")
        return v


    # Admin Settings - explicit list of admin email addresses
    ADMIN_EMAILS: List[str] = []

    @field_validator("ADMIN_EMAILS", mode="before")
    @classmethod
    def parse_admin_emails(cls, v) -> List[str]:
        """Parse admin emails from comma-separated string or list, normalize to lowercase."""
        if isinstance(v, str):
            emails = [email.strip().lower() for email in v.split(",") if email.strip()]
            return emails if emails else []
        elif isinstance(v, list):
            return [email.strip().lower() for email in v if email.strip()]
        return []

    # OAuth - Google
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/auth/callback/google"

    # OAuth - Apple
    APPLE_CLIENT_ID: str = ""
    APPLE_TEAM_ID: str = ""
    APPLE_KEY_ID: str = ""
    APPLE_PRIVATE_KEY: str = ""
    APPLE_REDIRECT_URI: str = "http://localhost:5173/auth/callback/apple"

    # OAuth - LinkedIn
    LINKEDIN_CLIENT_ID: str = ""
    LINKEDIN_CLIENT_SECRET: str = ""
    LINKEDIN_REDIRECT_URI: str = "http://localhost:5173/auth/callback/linkedin"

    # CSRF Settings
    CSRF_COOKIE_NAME: str = "wp_csrftoken"
    CSRF_COOKIE_PATH: str = "/"
    CSRF_COOKIE_SAMESITE: str = "lax"
    CSRF_COOKIE_HTTPONLY: bool = False

    # WebAuthn/Passkey Settings
    WEBAUTHN_RP_ID: str = "localhost"
    WEBAUTHN_RP_NAME: str = "WealthPulse"
    WEBAUTHN_ORIGIN: str = "http://localhost:5173"


    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"  # Allow extra fields in .env


settings = Settings()
