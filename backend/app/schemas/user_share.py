from datetime import datetime
from pydantic import BaseModel


class UserShareBase(BaseModel):
    viewer_id: int
    permission: str = "read"  # "read", "full"


class UserShareCreate(UserShareBase):
    pass


class UserShareUpdate(BaseModel):
    permission: str


class UserShare(UserShareBase):
    id: int
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True
