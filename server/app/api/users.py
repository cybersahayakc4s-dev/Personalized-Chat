from typing import List
from datetime import datetime
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
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
            banner_url=user.banner_url,
            avatar_url=user.avatar_url,
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


@router.get("/me", response_model=UserRecentOut)
def get_me(
    current_user: User = Depends(get_current_user)
):
    """Returns profile for currently authenticated user."""
    is_user_online = bool(current_user.id in online_users and len(online_users[current_user.id]) > 0)
    current_presence = user_presence_status.get(current_user.id, "online") if is_user_online else "offline"
    user_account_status = getattr(current_user, "account_status", current_user.status)

    return UserRecentOut(
        id=current_user.id,
        name=current_user.name,
        email=current_user.email,
        is_main_admin=current_user.is_main_admin,
        team=current_user.team,
        is_team_leader=current_user.is_team_leader,
        banner_url=current_user.banner_url,
        avatar_url=current_user.avatar_url,
        account_status=user_account_status,
        is_active=True,
        presence=current_presence,
        status=current_presence,
        created_at=current_user.created_at,
        unread_count=0,
        is_online=is_user_online
    )


@router.post("/me/banner", response_model=UserRecentOut)
async def upload_user_banner(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Uploads a customized user profile banner (JPEG, PNG, WEBP, GIF; max 10MB)."""
    import os
    import uuid
    import aiofiles
    from fastapi import HTTPException
    from ..core.config import settings
    from ..sockets.manager import sio

    # Validate file format and size
    ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image format. Allowed formats: JPEG, PNG, WEBP, GIF.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Banner file exceeds maximum size limit of 10MB.")

    # Deep magic-byte verification (zero trust on client-supplied Content-Type header)
    if content.startswith(b"MZ") or content.startswith(b"\x7fELF") or content.startswith(b"#!\n") or content.startswith(b"#!/"):
        raise HTTPException(status_code=400, detail="Executable and script file content is strictly prohibited.")

    import filetype
    kind = filetype.guess(content)
    if not kind or kind.mime not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="File content does not match a valid image format (JPEG, PNG, WEBP, GIF).")

    # Storage directory: uploads/banners
    banners_dir = os.path.join(settings.UPLOAD_DIR, "banners")
    os.makedirs(banners_dir, exist_ok=True)

    # Server-generated extension from verified magic bytes
    ext = f".{kind.extension}" if kind and kind.extension else ".png"
    if ext == ".jpeg":
        ext = ".jpg"

    filename = f"banner_{current_user.id}_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(banners_dir, filename)

    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    # Save relative API path (consistent with API_V1_STR prefix: /api/users/banner/)
    banner_url = f"{settings.API_V1_STR}/users/banner/{filename}"
    current_user.banner_url = banner_url
    db.commit()
    db.refresh(current_user)

    # Broadcast real-time profile update to all connected clients
    try:
        await sio.emit("user:profile_updated", {
            "id": current_user.id,
            "name": current_user.name,
            "banner_url": current_user.banner_url,
            "avatar_url": current_user.avatar_url
        })
    except Exception:
        pass

    return get_me(current_user=current_user)


@router.delete("/me/banner", response_model=UserRecentOut)
async def remove_user_banner(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Removes user custom banner and resets to default."""
    import os
    from ..core.config import settings
    from ..sockets.manager import sio

    if current_user.banner_url and "/users/banner/" in current_user.banner_url:
        safe_fname = os.path.basename(current_user.banner_url.split("/users/banner/")[-1])
        fpath = os.path.join(settings.UPLOAD_DIR, "banners", safe_fname)
        if os.path.exists(fpath):
            try:
                os.remove(fpath)
            except OSError:
                pass

    current_user.banner_url = None
    db.commit()
    db.refresh(current_user)

    try:
        await sio.emit("user:profile_updated", {
            "id": current_user.id,
            "name": current_user.name,
            "banner_url": None,
            "avatar_url": current_user.avatar_url
        })
    except Exception:
        pass

    return get_me(current_user=current_user)


@router.get("/banner/{filename}")
def serve_user_banner(filename: str):
    """Serves uploaded user banner images with client-side caching."""
    import os
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    from ..core.config import settings

    safe_filename = os.path.basename(filename)
    filepath = os.path.join(settings.UPLOAD_DIR, "banners", safe_filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Banner image not found")

    ext = os.path.splitext(safe_filename)[1].lower()
    media_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif"
    }
    media_type = media_map.get(ext, "image/png")

    return FileResponse(
        path=filepath,
        media_type=media_type,
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff"
        }
    )

