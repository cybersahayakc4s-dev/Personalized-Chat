from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, field_serializer
from ..models.user import TeamEnum

class AttachmentOut(BaseModel):
    id: int
    message_id: int
    file_name: str
    file_size_bytes: int
    mime_type: str
    url: Optional[str] = None
    download_url: Optional[str] = None

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    receiver_id: Optional[int] = None
    recipient_id: Optional[int] = None
    team: Optional[TeamEnum] = None
    content: Optional[str] = None
    reply_to_id: Optional[int] = None
    format: Optional[str] = "plain"

class MessageEdit(BaseModel):
    content: str

class ReactionToggle(BaseModel):
    emoji: str

class PinToggle(BaseModel):
    is_pinned: Optional[bool] = None

class MessageOut(BaseModel):
    id: int
    sender_id: int
    sender_name: str
    receiver_id: Optional[int] = None
    team: Optional[TeamEnum] = None
    content: Optional[str] = None
    reply_to_id: Optional[int] = None
    reply_to: Optional[Dict[str, Any]] = None
    created_at: datetime
    edited_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    deleted_by_admin: bool = False
    read_at: Optional[datetime] = None
    is_pinned: bool = False
    format: Optional[str] = "plain"
    reactions: Dict[str, List[int]] = {}
    thread_count: int = 0
    attachments: List[AttachmentOut] = []

    @field_serializer('created_at', 'edited_at', 'deleted_at', 'read_at', when_used='json')
    def serialize_dt(self, dt: Optional[datetime]):
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.isoformat() + "Z"
        return dt.isoformat()

    class Config:
        from_attributes = True

class MarkReadRequest(BaseModel):
    sender_id: Optional[int] = None
    team: Optional[TeamEnum] = None
