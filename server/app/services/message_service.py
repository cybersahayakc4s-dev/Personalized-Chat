from typing import Optional, Union, Tuple, Dict, Any
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

from ..models.user import User, TeamEnum, UserStatus
from ..models.message import Message
from ..core.logging_config import get_logger

logger = get_logger("app.services.message_service")

class MessageValidationError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail

def create_chat_message(
    db: Session,
    sender: User,
    content: str,
    recipient_id: Optional[int] = None,
    team: Optional[Union[TeamEnum, str]] = None,
    format: Optional[str] = "plain",
    reply_to_id: Optional[int] = None,
) -> Tuple[Message, bool]:
    """
    Consolidated single source of truth for message creation, validation,
    destination normalization, and idempotency deduplication.
    
    Returns:
        (Message, is_duplicate: bool)
    Raises:
        MessageValidationError if validation or RBAC permission fails.
    """
    clean_content = (content or "").strip()
    if not clean_content:
        raise MessageValidationError(400, "Message content cannot be empty")

    if sender.status in [UserStatus.disabled, UserStatus.deleted]:
        raise MessageValidationError(403, "Account is deactivated or deleted")

    msg_format = format or "plain"
    is_channel_msg = msg_format in ["channel:announcements", "channel:updates"]

    target_receiver_id = recipient_id
    team_enum: Optional[TeamEnum] = None

    # Normalization & Destination Check Constraint validation
    if is_channel_msg:
        # Broadcast channels belong to neither a single recipient nor a single team
        target_receiver_id = None
        team_enum = None

        if msg_format == "channel:announcements" and not sender.is_main_admin:
            raise MessageValidationError(403, "Only Main-Admin has authorization to post in announcements")
        elif msg_format == "channel:updates" and not (sender.is_main_admin or sender.is_team_leader):
            raise MessageValidationError(403, "Only Team Leaders and Main-Admin can post in updates")

    else:
        if target_receiver_id and team:
            raise MessageValidationError(400, "Cannot set both receiver_id and team")
        if not target_receiver_id and not team:
            raise MessageValidationError(400, "Must provide either receiver_id or team")

        if team:
            if isinstance(team, TeamEnum):
                team_enum = team
            else:
                try:
                    team_enum = TeamEnum(str(team))
                except ValueError:
                    raise MessageValidationError(400, f"Invalid team: {team}")

            # RBAC Scoping check
            if not sender.is_main_admin and sender.team != team_enum:
                raise MessageValidationError(403, "You are not an active member of this team")

        if target_receiver_id:
            if target_receiver_id == sender.id:
                raise MessageValidationError(400, "Cannot send DM to yourself")
            receiver = db.query(User).filter(User.id == target_receiver_id).first()
            if not receiver:
                raise MessageValidationError(404, "Target recipient not found")
            if receiver.status == UserStatus.disabled:
                raise MessageValidationError(400, "Recipient account is disabled")
            if receiver.status == UserStatus.deleted:
                raise MessageValidationError(400, "Recipient account has been deleted")

    # Validate reply_to_id
    numeric_reply_to: Optional[int] = None
    if reply_to_id:
        orig = db.query(Message).filter(Message.id == reply_to_id).first()
        if orig:
            numeric_reply_to = orig.id

    # Idempotency Safeguard: prevent duplicate insertion of identical message within 2.5 seconds
    recent_window = datetime.utcnow() - timedelta(seconds=2.5)
    existing = db.query(Message).filter(
        Message.sender_id == sender.id,
        Message.content == clean_content,
        Message.receiver_id == target_receiver_id,
        Message.team == team_enum,
        Message.format == msg_format,
        Message.created_at >= recent_window,
        Message.deleted_at.is_(None)
    ).order_by(desc(Message.created_at)).first()

    if existing:
        return existing, True

    new_msg = Message(
        sender_id=sender.id,
        receiver_id=target_receiver_id,
        team=team_enum,
        content=clean_content,
        reply_to_id=numeric_reply_to,
        format=msg_format,
        created_at=datetime.utcnow()
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    return new_msg, False

async def broadcast_chat_message(
    sio: Any,
    msg: Message,
    sender_name: str,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Constructs message payload and broadcasts via Socket.IO to the appropriate room(s).
    """
    reply_to_data = None
    if msg.reply_to_id:
        orig = msg.reply_to_message
        if not orig and db:
            orig = db.query(Message).filter(Message.id == msg.reply_to_id).first()
        if orig:
            orig_sender = orig.sender.name if orig.sender else "User"
            orig_content = "This message was deleted" if orig.deleted_at else orig.content
            reply_to_data = {
                "id": orig.id,
                "sender_name": orig_sender,
                "team": orig.team.value if orig.team else None,
                "content": orig_content
            }

    payload = {
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": sender_name,
        "receiver_id": msg.receiver_id,
        "team": msg.team.value if msg.team else None,
        "content": msg.content,
        "reply_to_id": msg.reply_to_id,
        "reply_to": reply_to_data,
        "created_at": (msg.created_at.isoformat() + "Z") if msg.created_at else None,
        "edited_at": (msg.edited_at.isoformat() + "Z") if msg.edited_at else None,
        "deleted_at": None,
        "deleted_by_admin": False,
        "read_at": None,
        "is_pinned": bool(msg.is_pinned),
        "format": msg.format or "plain",
        "reactions": {},
        "thread_count": 0,
        "attachments": []
    }

    try:
        is_channel_msg = msg.format in ["channel:announcements", "channel:updates"]
        if msg.receiver_id:
            await sio.emit("message:receive", payload, room=f"user_{msg.receiver_id}")
            await sio.emit("message:receive", payload, room=f"user_{msg.sender_id}")
        elif is_channel_msg:
            await sio.emit("message:receive", payload)
        elif msg.team:
            await sio.emit("message:receive", payload, room=f"team_{msg.team.value}")
    except Exception as e:
        logger.error(
            f"Socket broadcast error for message {msg.id}: {e}",
            exc_info=True,
            extra={"user_id": str(msg.sender_id), "endpoint": "broadcast_chat_message"}
        )

    return payload
