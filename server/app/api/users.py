from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, desc, func, case
from ..core.database import get_db
from ..models.user import User, UserStatus
from ..models.message import Message
from ..schemas.user import UserRecentOut
from .deps import get_current_user
from ..sockets.manager import online_users, user_presence_status

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserRecentOut])
def get_colleagues(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Fetch all colleagues except self
    all_users = db.query(User).filter(User.id != current_user.id).all()
    if not all_users:
        return []

    # 2. Batched unread count per sender to current_user (1 query)
    unread_counts = (
        db.query(Message.sender_id, func.count(Message.id))
        .filter(
            Message.receiver_id == current_user.id,
            Message.read_at.is_(None),
            Message.deleted_at.is_(None)
        )
        .group_by(Message.sender_id)
        .all()
    )
    unread_map = {sender_id: count for sender_id, count in unread_counts}

    # 3. Batched latest DM per counterpart (2 fixed queries total)
    counterpart_expr = case(
        (Message.sender_id == current_user.id, Message.receiver_id),
        else_=Message.sender_id
    )
    latest_ids = (
        db.query(counterpart_expr.label("counterpart_id"), func.max(Message.id).label("max_id"))
        .filter(
            or_(
                Message.sender_id == current_user.id,
                Message.receiver_id == current_user.id
            ),
            Message.receiver_id.isnot(None)
        )
        .group_by("counterpart_id")
        .all()
    )
    max_ids = [row.max_id for row in latest_ids if row.max_id is not None]

    latest_msg_map = {}
    if max_ids:
        latest_msgs = (
            db.query(Message)
            .options(joinedload(Message.attachments))
            .filter(Message.id.in_(max_ids))
            .all()
        )
        for msg in latest_msgs:
            other_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
            latest_msg_map[other_id] = msg

    results = []
    for user in all_users:
        last_msg = latest_msg_map.get(user.id)
        unread_count = unread_map.get(user.id, 0)

        msg_preview = None
        msg_time = None
        if last_msg:
            msg_time = last_msg.created_at
            if last_msg.deleted_at:
                msg_preview = "Message deleted by Admin" if last_msg.deleted_by_admin else "This message was deleted"
            elif last_msg.content:
                msg_preview = last_msg.content[:40] + ("..." if len(last_msg.content) > 40 else "")
            elif last_msg.attachments:
                first_att = last_msg.attachments[0]
                mime = first_att.mime_type or ""
                fname = first_att.file_name or ""
                if mime.startswith("audio/") or "voice_message" in fname or fname.endswith(".webm"):
                    msg_preview = "🎙️ Voice message"
                elif mime.startswith("image/"):
                    msg_preview = "📷 Photo"
                elif mime.startswith("video/"):
                    msg_preview = "🎥 Video"
                else:
                    msg_preview = "📎 Attachment"

        is_user_online = bool(user.id in online_users and len(online_users[user.id]) > 0)
        user_account_status = getattr(user, "account_status", user.status)
        is_active = getattr(user, "is_active", user.status != UserStatus.disabled)
        current_presence = user_presence_status.get(user.id, "online") if is_user_online else "offline"
        legacy_status = current_presence if is_user_online else (user_account_status.value if hasattr(user_account_status, "value") else str(user_account_status))

        results.append(UserRecentOut(
            id=user.id,
            name=user.name,
            email=user.email,
            is_main_admin=user.is_main_admin,
            team=user.team,
            is_team_leader=user.is_team_leader,
            account_status=user_account_status,
            is_active=is_active,
            presence=current_presence,
            status=legacy_status,
            created_at=user.created_at,
            unread_count=unread_count,
            last_message=msg_preview,
            last_message_time=msg_time,
            is_online=is_user_online
        ))

    # Sort users by most recent message time first, then by name
    results.sort(
        key=lambda u: (u.last_message_time or datetime.min, u.name),
        reverse=True
    )
    return results
