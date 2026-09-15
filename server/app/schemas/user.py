from typing import Optional, List, Union
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_serializer, ConfigDict
from ..models.user import TeamEnum, UserStatus

class UserBase(BaseModel):
    name: str
    email: EmailStr
    team: Optional[TeamEnum] = None
    is_team_leader: bool = False

class UserCreate(UserBase):
    password: str
    is_main_admin: bool = False
    current_admin_password: Optional[str] = None

class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = None
    team: Optional[TeamEnum] = None
    is_team_leader: Optional[bool] = None
    status: Optional[Union[str, UserStatus]] = None

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    is_main_admin: bool
    team: Optional[TeamEnum] = None
    is_team_leader: bool
    account_status: UserStatus = UserStatus.active
    is_active: bool = True
    presence: str = "offline"
    status: Union[str, UserStatus] = "active"
    created_at: datetime

    @field_serializer('created_at', when_used='json')
    def serialize_created_at(self, dt: Optional[datetime]):
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.isoformat() + "Z"
        return dt.isoformat()

    class Config:
        from_attributes = True

class UserRecentOut(UserOut):
    unread_count: int = 0
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None
    is_online: bool = False

    @field_serializer('last_message_time', when_used='json')
    def serialize_last_time(self, dt: Optional[datetime]):
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.isoformat() + "Z"
        return dt.isoformat()

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserOut

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: Optional[str] = None

class TeamMemberDirectory(BaseModel):
    team: TeamEnum
    name_display: str
    members: List[UserOut]
    max_file_size_mb: int
    leader_ceiling_mb: int
    is_member: bool
    is_archived_member: bool
    unread_count: int = 0
    last_message: Optional[str] = None
    last_message_time: Optional[datetime] = None

    @field_serializer('last_message_time', when_used='json')
    def serialize_team_last_time(self, dt: Optional[datetime]):
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.isoformat() + "Z"
        return dt.isoformat()
