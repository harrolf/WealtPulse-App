from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class TokenData(BaseModel):
    id: Optional[str] = None


class TokenRefresh(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    is_active: bool
    is_verified: bool
    is_admin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class OAuthCallback(BaseModel):
    code: str
    state: Optional[str] = None
    provider: str


class PasskeyRegisterRequest(BaseModel):
    username: str  # Usually email
    device_name: Optional[str] = "Chrome on macOS"  # Default


class PasskeyLoginRequest(BaseModel):
    username: Optional[str] = None  # Optional usually, but helpful


class OAuthAccountInfo(BaseModel):
    provider: str
    created_at: datetime

    class Config:
        from_attributes = True


class PasskeyInfo(BaseModel):
    credential_id: str
    device_name: Optional[str]
    created_at: datetime
    last_used_at: Optional[datetime]

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None
    settings: Optional[dict] = None


class PasswordResetRequest(BaseModel):
    password: str
