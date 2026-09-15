from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_serializer
from ..models.user import TeamEnum

class AdminPasswordReset(BaseModel):
    new_password: str
    current_admin_password: Optional[str] = None

class AdminUserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    created_at: Optional[datetime] = None

    @field_serializer('created_at', when_used='json')
    def serialize_created_at(self, dt: Optional[datetime]):
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.isoformat() + "Z"
        return dt.isoformat()

    class Config:
        from_attributes = True

class TeamSettingsUpdate(BaseModel):
    max_file_size_mb: Optional[int] = None
    leader_ceiling_mb: Optional[int] = None

class TeamSettingsOut(BaseModel):
    team: TeamEnum
    max_file_size_mb: int
    leader_ceiling_mb: int

    class Config:
        from_attributes = True

class AuditLogOut(BaseModel):
    id: int
    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    action: str
    target: Optional[str] = None
    details: str
    ip_address: str
    created_at: str

    class Config:
        from_attributes = True

class WorkspaceSettingsOut(BaseModel):
    workspace_name: str
    domain: str
    retention_days: int
    allow_file_uploads: bool
    max_upload_size_bytes: int
    maintenance_notice: Optional[str] = None
    sound_enabled: bool
    allow_custom_channels: bool = False

    class Config:
        from_attributes = True

class WorkspaceSettingsUpdate(BaseModel):
    workspace_name: Optional[str] = None
    domain: Optional[str] = None
    retention_days: Optional[int] = None
    allow_file_uploads: Optional[bool] = None
    max_upload_size_bytes: Optional[int] = None
    maintenance_notice: Optional[str] = None
    sound_enabled: Optional[bool] = None
    allow_custom_channels: Optional[bool] = None
