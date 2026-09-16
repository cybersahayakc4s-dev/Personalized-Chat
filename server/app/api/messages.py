from typing import List, Optional, Tuple, Dict
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, asc, desc
from ..core.database import get_db
from ..core.limiter import limiter, get_user_or_ip
from ..models.user import User, TeamEnum
from ..models.membership import TeamMembership
from ..models.message import Message
from ..models.attachment import Attachment
from ..models.team_read import TeamReadReceipt
from ..models.reaction import MessageReaction
from ..schemas.chat import MessageCreate, MessageEdit, MessageOut, MarkReadRequest, ReactionToggle, PinToggle, AttachmentOut
from ..services.message_service import create_chat_message, broadcast_chat_message, MessageValidationError
from .deps import get_current_user
from ..core.logging_config import get_logger

logger = get_logger("app.api.messages")

router = APIRouter(prefix="/messages", tags=["Messages"])

def check_message_read_access(msg: Message, user: User, db: Session) -> bool:
    """
    Evaluates whether a user has authorization to read/view a specific message.
    
    Authorization Rules:
    - 1:1 Direct Messages (receiver_id is not None):
        Readable strictly by the sender or receiver. Main-Admin is NOT exempt.
    - Global Broadcast Channels (channel:announcements, channel:updates):
        Readable by all authenticated workspace users.
    - Team Channels (team is not None):
        - Main-Admin retains global read access for workspace oversight.
        - Employees must have an active or historical TeamMembership interval covering msg.created_at.
    """
    # 1. 1:1 Direct Message: strictly confidential between participants
    if msg.receiver_id is not None:
        return user.id in (msg.sender_id, msg.receiver_id)

    # 2. Public / Company broadcast channels
    if msg.format in ("channel:announcements", "channel:updates"):
        return True

    # 3. Team channel messages
    if msg.team is not None:
        if user.is_main_admin:
            return True
        if user.team == msg.team:
            return True
        # Check historical membership intervals
        memberships = db.query(TeamMembership).filter(
            TeamMembership.user_id == user.id,
            TeamMembership.team == msg.team
        ).all()
        for m in memberships:
            if m.left_at is None and msg.created_at >= m.joined_at:
                return True
            elif m.left_at is not None and m.joined_at <= msg.created_at <= m.left_at:
                return True
        return False

    return False


def check_message_pin_access(msg: Message, user: User, db: Session) -> Tuple[bool, int, str]:
    """
    Evaluates whether a user is authorized to pin/unpin a message.
    Returns (is_allowed: bool, status_code: int, error_detail: str).
    """
    # 1. 1:1 Direct Message: only participants can pin/unpin
    if msg.receiver_id is not None:
        if user.id in (msg.sender_id, msg.receiver_id):
            return True, 200, ""
        # Return 404 to prevent resource enumeration of private DMs
        return False, 404, "Message not found"

    # 2. Announcements broadcast channel: Main-Admin only
    if msg.format == "channel:announcements":
        if user.is_main_admin:
            return True, 200, ""
        return False, 403, "Only Main-Admin is authorized to pin announcements"

    # 3. Updates broadcast channel: Main-Admin and Team Leaders
    if msg.format == "channel:updates":
        if user.is_main_admin or user.is_team_leader:
            return True, 200, ""
        return False, 403, "Only Team Leaders and Main-Admin can pin updates"

    # 4. Team channel messages:
    if msg.team is not None:
        if user.is_main_admin:
            return True, 200, ""
        if user.team == msg.team:
            # Active member of the team
            return True, 200, ""
        # Check if caller was ever a member to distinguish between 404 and 403
        memberships = db.query(TeamMembership).filter(
            TeamMembership.user_id == user.id,
            TeamMembership.team == msg.team
        ).all()
        if not memberships:
            return False, 404, "Message not found"
        # Historical / archived read-only member
        return False, 403, "Archived members have read-only access and cannot pin messages"

    return False, 404, "Message not found"


def format_message_out(msg: Message, db: Optional[Session] = None) -> MessageOut:
    reply_to_data = None
    if msg.reply_to_id and msg.reply_to_message:
        orig = msg.reply_to_message
        orig_sender = orig.sender.name if orig.sender else "User"
        orig_content = "This message was deleted" if orig.deleted_at else orig.content
        reply_to_data = {
            "id": orig.id,
            "sender_name": orig_sender,
            "team": orig.team.value if orig.team else None,
            "content": orig_content
        }

    # Group reactions by emoji
    reactions_dict: dict[str, list[int]] = {}
    if hasattr(msg, "reactions") and msg.reactions:
        for r in msg.reactions:
            reactions_dict.setdefault(r.emoji, []).append(r.user_id)

    # Thread count
    thread_count = 0
    if db is not None:
        thread_count = db.query(Message).filter(Message.reply_to_id == msg.id, Message.deleted_at.is_(None)).count()

    formatted_attachments = []
    if hasattr(msg, "attachments") and msg.attachments:
        for a in msg.attachments:
            formatted_attachments.append(AttachmentOut(
                id=a.id,
                message_id=a.message_id,
                file_name=a.file_name,
                file_size_bytes=a.file_size_bytes,
                mime_type=a.mime_type or "application/octet-stream",
                url=f"/api/attachments/{a.id}/view",
                download_url=f"/api/attachments/{a.id}/download"
            ))

    return MessageOut(
        id=msg.id,
        sender_id=msg.sender_id,
        sender_name=msg.sender.name if msg.sender else "Unknown",
        receiver_id=msg.receiver_id,
        team=msg.team,
        content=msg.content,
        reply_to_id=msg.reply_to_id,
        reply_to=reply_to_data,
        created_at=msg.created_at,
        edited_at=msg.edited_at,
        deleted_at=msg.deleted_at,
        deleted_by_admin=msg.deleted_by_admin,
        read_at=msg.read_at,
        is_pinned=bool(getattr(msg, "is_pinned", False)),
        format=getattr(msg, "format", "plain") or "plain",
        reactions=reactions_dict,
        thread_count=thread_count,
        attachments=formatted_attachments
    )

@router.get("", response_model=List[MessageOut])
def get_messages(
    format: Optional[str] = None,
    team: Optional[TeamEnum] = None,
    receiver_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    before_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Message)

    # 1. RBAC Scoping:
    # Main-Admin retains global archive access to team channels and announcements,
    # but has ZERO BACKDOOR to 1:1 direct messages between other users.
    if current_user.is_main_admin:
        admin_allowed_clauses = [
            Message.format.in_(["channel:announcements", "channel:updates"]),
            Message.team.isnot(None),
            and_(
                Message.receiver_id.isnot(None),
                or_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == current_user.id
                )
            )
        ]
        query = query.filter(or_(*admin_allowed_clauses))
    else:
        active_memberships = db.query(TeamMembership).filter(
            TeamMembership.user_id == current_user.id,
            TeamMembership.left_at.is_(None)
        ).all()
        user_active_teams = set(m.team for m in active_memberships)
        if current_user.team:
            user_active_teams.add(current_user.team)

        allowed_clauses = [
            Message.format.in_(["channel:announcements", "channel:updates"]),
            and_(
                Message.receiver_id.isnot(None),
                or_(
                    Message.sender_id == current_user.id,
                    Message.receiver_id == current_user.id
                )
            )
        ]
        if user_active_teams:
            allowed_clauses.append(Message.team.in_(list(user_active_teams)))

        query = query.filter(or_(*allowed_clauses))

    # 2. Query filters
    if format:
        query = query.filter(Message.format == format)

    if team:
        if not current_user.is_main_admin:
            active_memberships = db.query(TeamMembership).filter(
                TeamMembership.user_id == current_user.id,
                TeamMembership.left_at.is_(None)
            ).all()
            user_active_teams = set(m.team for m in active_memberships)
            if current_user.team:
                user_active_teams.add(current_user.team)
            if team not in user_active_teams:
                return []
        query = query.filter(Message.team == team)

    if receiver_id:
        query = query.filter(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == receiver_id),
                and_(Message.sender_id == receiver_id, Message.receiver_id == current_user.id)
            )
        )

    # 3. Cursor pagination
    if before_id is not None:
        query = query.filter(Message.id < before_id)

    # 4. Fetch most recent messages slice (limit/offset)
    messages = query.order_by(desc(Message.created_at), desc(Message.id)).offset(offset).limit(limit).all()

    # Re-order to ascending chronological order for UI
    messages.reverse()

    return [format_message_out(m, db) for m in messages]

@router.get("/dm/{user_id}", response_model=List[MessageOut])
def get_dm_history(
    user_id: int,
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Target user not found")

    # Fetch 1:1 DMs strictly between current_user and target (read-only query)
    query = db.query(Message).filter(
        or_(
            and_(Message.sender_id == current_user.id, Message.receiver_id == user_id),
            and_(Message.sender_id == user_id, Message.receiver_id == current_user.id)
        )
    )

    if before_id is not None:
        query = query.filter(Message.id < before_id)

    messages = query.order_by(desc(Message.created_at), desc(Message.id)).limit(limit).all()
    messages.reverse()

    return [format_message_out(m, db) for m in messages]

@router.get("/team/{team}", response_model=List[MessageOut])
def get_team_history(
    team: TeamEnum,
    limit: int = Query(50, ge=1, le=100),
    before_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Main-Admin can view entire historical archive without restriction
    if current_user.is_main_admin:
        query = db.query(Message).filter(Message.team == team)
    else:
        # For employees: query user's TeamMembership intervals
        memberships = db.query(TeamMembership).filter(
            TeamMembership.user_id == current_user.id,
            TeamMembership.team == team
        ).all()

        if not memberships:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not and have never been a member of this team"
            )

        # Build OR clauses for all membership windows
        window_clauses = []
        for m in memberships:
            if m.left_at is None:
                # Currently active: from joined_at onwards
                window_clauses.append(Message.created_at >= m.joined_at)
            else:
                # Past window: between joined_at and left_at
                window_clauses.append(and_(Message.created_at >= m.joined_at, Message.created_at <= m.left_at))

        query = db.query(Message).filter(
            Message.team == team,
            or_(*window_clauses)
        )

    if before_id is not None:
        query = query.filter(Message.id < before_id)

    messages = query.order_by(desc(Message.created_at), desc(Message.id)).limit(limit).all()
    messages.reverse()

    return [format_message_out(m, db) for m in messages]

@router.get("/search")
def search_workspace(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    clean_q = q.strip()
    if not clean_q:
        return {"messages": [], "files": []}

    search_pattern = f"%{clean_q}%"

    # Determine user's authorized teams
    user_teams = []
    if current_user.is_main_admin:
        user_teams = [t for t in TeamEnum]
    else:
        memberships = db.query(TeamMembership).filter(TeamMembership.user_id == current_user.id).all()
        user_teams = list(set([m.team for m in memberships]))
        if current_user.team and current_user.team not in user_teams:
            user_teams.append(current_user.team)

    # Base permission condition:
    # Zero-backdoor rule: direct messages MUST only be accessible if current_user is sender or receiver.
    perm_clauses = [
        Message.format.in_(["channel:announcements", "channel:updates"]),
        and_(
            Message.receiver_id.isnot(None),
            or_(Message.sender_id == current_user.id, Message.receiver_id == current_user.id)
        )
    ]
    if user_teams:
        perm_clauses.append(and_(Message.team.in_(user_teams), Message.receiver_id.is_(None)))

    # 1. Query Messages matching content
    msg_query = db.query(Message).filter(
        Message.deleted_at.is_(None),
        or_(*perm_clauses),
        Message.content.ilike(search_pattern)
    ).order_by(desc(Message.created_at)).limit(40).all()

    formatted_messages = []
    for m in msg_query:
        chat_type = "dm" if m.receiver_id else "team" if m.team else "channel"
        if m.format == "channel:announcements":
            chat_title = "announcements"
            conv_id = "c-announcements"
        elif m.format == "channel:updates":
            chat_title = "updates"
            conv_id = "c-updates"
        elif m.team:
            chat_title = m.team.value
            conv_id = f"c-{m.team.value.replace('_', '-')}"
        elif m.receiver_id:
            other_id = m.receiver_id if m.sender_id == current_user.id else m.sender_id
            other_user = db.query(User).filter(User.id == other_id).first()
            chat_title = other_user.name if other_user else f"User {other_id}"
            p1 = min(current_user.id, other_id)
            p2 = max(current_user.id, other_id)
            conv_id = f"dm-{p1}-{p2}"
        else:
            chat_title = "announcements"
            conv_id = "c-announcements"

        formatted_messages.append({
            "id": m.id,
            "content": m.content,
            "sender_id": m.sender_id,
            "sender_name": m.sender.name if m.sender else "User",
            "receiver_id": m.receiver_id,
            "team": m.team.value if m.team else None,
            "conversation_id": conv_id,
            "chat_title": chat_title,
            "chat_type": chat_type,
            "created_at": (m.created_at.isoformat() + "Z") if m.created_at else None,
            "has_attachments": bool(m.attachments),
            "attachment_count": len(m.attachments) if m.attachments else 0
        })

    # 2. Query Attachments matching file_name
    file_query = db.query(Attachment, Message).join(
        Message, Attachment.message_id == Message.id
    ).filter(
        Message.deleted_at.is_(None),
        or_(*perm_clauses),
        Attachment.file_name.ilike(search_pattern)
    ).order_by(desc(Message.created_at)).limit(40).all()

    formatted_files = []
    for att, m in file_query:
        chat_type = "dm" if m.receiver_id else "team" if m.team else "channel"
        if m.format == "channel:announcements":
            chat_title = "announcements"
            conv_id = "c-announcements"
        elif m.format == "channel:updates":
            chat_title = "updates"
            conv_id = "c-updates"
        elif m.team:
            chat_title = m.team.value
            conv_id = f"c-{m.team.value.replace('_', '-')}"
        elif m.receiver_id:
            other_id = m.receiver_id if m.sender_id == current_user.id else m.sender_id
            other_user = db.query(User).filter(User.id == other_id).first()
            chat_title = other_user.name if other_user else f"User {other_id}"
            p1 = min(current_user.id, other_id)
            p2 = max(current_user.id, other_id)
            conv_id = f"dm-{p1}-{p2}"
        else:
            chat_title = "announcements"
            conv_id = "c-announcements"

        formatted_files.append({
            "id": att.id,
            "file_name": att.file_name,
            "file_size_bytes": att.file_size_bytes,
            "mime_type": att.mime_type or "application/octet-stream",
            "url": f"/api/attachments/{att.id}/view",
            "download_url": f"/api/attachments/{att.id}/download",
            "message_id": m.id,
            "conversation_id": conv_id,
            "chat_title": chat_title,
            "chat_type": chat_type,
            "sender_id": m.sender_id,
            "sender_name": m.sender.name if m.sender else "User",
            "created_at": (m.created_at.isoformat() + "Z") if m.created_at else None
        })

    return {
        "messages": formatted_messages,
        "files": formatted_files
    }

@router.post("", response_model=MessageOut)
@limiter.limit("60/minute", key_func=get_user_or_ip)
async def send_message(
    request: Request,
    msg_in: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    target_receiver_id = msg_in.receiver_id or msg_in.recipient_id

    try:
        new_msg, is_dup = create_chat_message(
            db=db,
            sender=current_user,
            content=msg_in.content,
            recipient_id=target_receiver_id,
            team=msg_in.team,
            format=msg_in.format,
            reply_to_id=msg_in.reply_to_id
        )
    except MessageValidationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail)

    out = format_message_out(new_msg, db)

    if not is_dup:
        from ..sockets.manager import sio
        await broadcast_chat_message(sio, new_msg, current_user.name, db)

    return out


@router.patch("/{message_id}", response_model=MessageOut)
async def edit_message(
    message_id: int,
    edit_in: MessageEdit,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.deleted_at is not None:
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    if not edit_in.content or not edit_in.content.strip():
        raise HTTPException(status_code=400, detail="Content cannot be empty")

    msg.content = edit_in.content.strip()
    msg.edited_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)

    out = format_message_out(msg)

    try:
        from ..sockets.manager import broadcast_message_edited
        await broadcast_message_edited(out.model_dump(mode="json"))
    except Exception as e:
        logger.error(
            f"Failed to broadcast message edit for message {msg.id}: {e}",
            exc_info=True,
            extra={"user_id": str(current_user.id), "endpoint": "edit_message"}
        )

    return out

@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.deleted_at is not None:
        return {"message": "Message already deleted"}

    if msg.receiver_id is not None:
        # Zero backdoor on private DMs: only message owner can delete their own DM message
        if msg.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only delete your own direct messages")
        is_owner = True
        is_admin = False
    else:
        is_owner = (msg.sender_id == current_user.id)
        is_admin = current_user.is_main_admin
        if not is_owner and not is_admin:
            raise HTTPException(status_code=403, detail="Not authorized to delete this message")

    msg.deleted_at = datetime.utcnow()
    msg.deleted_by_admin = (not is_owner and is_admin)
    db.commit()

    sender_name = msg.sender.name if msg.sender else "User"
    sender_label = sender_name.split(" ")[0]

    del_payload = {
        "id": msg.id,
        "message_id": msg.id,
        "team": msg.team.value if msg.team else None,
        "receiver_id": msg.receiver_id,
        "sender_id": msg.sender_id,
        "sender_name": sender_name,
        "deleted_at": msg.deleted_at.isoformat() + "Z",
        "deleted_by_admin": msg.deleted_by_admin,
        "last_message": f"{sender_label}: Message deleted"
    }

    try:
        from ..sockets.manager import broadcast_message_deleted
        await broadcast_message_deleted(del_payload)
    except Exception as e:
        logger.error(
            f"Failed to broadcast message delete for message {msg.id}: {e}",
            exc_info=True,
            extra={"user_id": str(current_user.id), "endpoint": "delete_message"}
        )

    return del_payload

@router.post("/{message_id}/reactions", response_model=MessageOut)
async def toggle_reaction(
    message_id: int,
    react_in: ReactionToggle,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg or msg.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Message not found")

    emoji = react_in.emoji.strip()
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji cannot be empty")

    # Zero backdoor and IDOR protection: user must have authorization to access this message
    if not check_message_read_access(msg, current_user, db):
        if msg.receiver_id is not None:
            raise HTTPException(status_code=403, detail="Not authorized to react to this direct message")
        raise HTTPException(status_code=404, detail="Message not found")

    existing = db.query(MessageReaction).filter(
        MessageReaction.message_id == message_id,
        MessageReaction.user_id == current_user.id,
        MessageReaction.emoji == emoji
    ).first()

    if existing:
        db.delete(existing)
    else:
        new_react = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            emoji=emoji,
            created_at=datetime.utcnow()
        )
        db.add(new_react)

    db.commit()
    db.refresh(msg)

    out = format_message_out(msg, db)

    try:
        from ..sockets.manager import broadcast_reaction_update
        await broadcast_reaction_update({
            "message_id": msg.id,
            "team": msg.team.value if msg.team else None,
            "receiver_id": msg.receiver_id,
            "sender_id": msg.sender_id,
            "reactions": out.reactions
        })
    except Exception as e:
        logger.error(
            f"Failed to broadcast reaction update for message {msg.id}: {e}",
            exc_info=True,
            extra={"user_id": str(current_user.id), "endpoint": "react_to_message"}
        )

    return out

@router.post("/{message_id}/pin", response_model=MessageOut)
@router.patch("/{message_id}/pin", response_model=MessageOut)
async def toggle_pin_message(
    message_id: int,
    pin_in: Optional[PinToggle] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    msg = db.query(Message).filter(Message.id == message_id).first()
    if not msg or msg.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Message not found")

    allowed, err_code, err_msg = check_message_pin_access(msg, current_user, db)
    if not allowed:
        raise HTTPException(status_code=err_code, detail=err_msg)

    if pin_in and pin_in.is_pinned is not None:
        msg.is_pinned = pin_in.is_pinned
    else:
        msg.is_pinned = not msg.is_pinned

    db.commit()
    db.refresh(msg)

    out = format_message_out(msg, db)

    try:
        from ..sockets.manager import broadcast_pin_update
        await broadcast_pin_update({
            "message_id": msg.id,
            "team": msg.team.value if msg.team else None,
            "receiver_id": msg.receiver_id,
            "sender_id": msg.sender_id,
            "is_pinned": msg.is_pinned
        })
    except Exception as e:
        logger.error(
            f"Failed to broadcast pin update for message {msg.id}: {e}",
            exc_info=True,
            extra={"user_id": str(current_user.id), "endpoint": "toggle_pin_message"}
        )

    return out

@router.get("/{message_id}/thread", response_model=List[MessageOut])
def get_message_thread(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    parent = db.query(Message).filter(Message.id == message_id).first()
    if not parent or parent.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Message not found")

    # IDOR Protection & Zero-Backdoor privacy enforcement: conceal private threads with 404
    if not check_message_read_access(parent, current_user, db):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    replies = db.query(Message).filter(
        Message.reply_to_id == message_id,
        Message.deleted_at.is_(None)
    ).order_by(asc(Message.created_at)).all()

    return [format_message_out(parent, db)] + [format_message_out(r, db) for r in replies]

@router.get("/pinned", response_model=List[MessageOut])
def get_pinned_messages(
    chat_type: Optional[str] = None,
    chat_id: Optional[str] = None,
    team: Optional[str] = None,
    recipient_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    team_val = team or (chat_id if chat_type == 'team' else None)
    recip_val = recipient_id or (int(chat_id) if chat_type == 'dm' and chat_id else None)

    if team_val:
        try:
            team_enum = TeamEnum(team_val)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid team")
        # Verify team access for non-admins
        if not current_user.is_main_admin:
            memberships = db.query(TeamMembership).filter(
                TeamMembership.user_id == current_user.id,
                TeamMembership.team == team_enum
            ).all()
            if not memberships and current_user.team != team_enum:
                raise HTTPException(status_code=403, detail="You are not a member of this team")
        msgs = db.query(Message).filter(
            Message.team == team_enum,
            Message.is_pinned == True,
            Message.deleted_at.is_(None)
        ).order_by(asc(Message.created_at)).all()
    elif recip_val:
        msgs = db.query(Message).filter(
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == recip_val),
                and_(Message.sender_id == recip_val, Message.receiver_id == current_user.id)
            ),
            Message.is_pinned == True,
            Message.deleted_at.is_(None)
        ).order_by(asc(Message.created_at)).all()
    else:
        raise HTTPException(status_code=400, detail="Must specify team or recipient_id")

    return [format_message_out(m, db) for m in msgs]



