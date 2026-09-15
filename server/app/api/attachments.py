import os
import uuid
import aiofiles
from typing import Optional
from datetime import datetime
import filetype
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.config import settings
from ..core.limiter import limiter, get_user_or_ip
from ..models.user import User, TeamEnum
from ..models.team_settings import TeamSettings
from ..models.membership import TeamMembership
from ..models.message import Message
from ..models.attachment import Attachment
from ..schemas.chat import MessageOut
from .messages import format_message_out
from .deps import get_current_user
from ..sockets.manager import broadcast_attachment_message
from ..core.logging_config import get_logger

logger = get_logger("app.api.attachments")

router = APIRouter(prefix="/attachments", tags=["Attachments"])

DISALLOWED_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".ps1", ".vbs", ".msi", ".dll",
    ".scr", ".com", ".pif", ".cpl", ".jar"
}

@router.post("/upload", response_model=MessageOut)
@limiter.limit("15/minute", key_func=get_user_or_ip)
async def upload_attachment(
    request: Request,
    file: UploadFile = File(...),
    receiver_id: Optional[int] = Form(None),
    team: Optional[str] = Form(None),
    content: Optional[str] = Form(None),
    format: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    team_enum = None
    if team:
        try:
            team_enum = TeamEnum(team)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid team name")

    if not receiver_id and not team_enum:
        raise HTTPException(status_code=400, detail="Must specify either receiver_id or team")
    if receiver_id and team_enum:
        raise HTTPException(status_code=400, detail="Cannot specify both receiver_id and team")

    # Team chat permission validation
    if team_enum:
        if not current_user.is_main_admin and current_user.team != team_enum:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not an active member of this team"
            )
        # Determine team file size limit
        ts = db.query(TeamSettings).filter(TeamSettings.team == team_enum).first()
        max_allowed_mb = ts.max_file_size_mb if ts else settings.DEFAULT_MAX_FILE_SIZE_MB
    else:
        max_allowed_mb = settings.DEFAULT_MAX_FILE_SIZE_MB

    max_allowed_bytes = max_allowed_mb * 1024 * 1024

    # Validate file extension against executable and dangerous formats
    original_name = file.filename or "unnamed_file"
    ext = os.path.splitext(original_name)[1].lower()
    if ext in DISALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Executable and script files ({ext}) are strictly prohibited."
        )

    unique_file_name = f"{uuid.uuid4().hex}{ext}"
    target_path = os.path.join(settings.UPLOAD_DIR, unique_file_name)

    # Stream file to disk while validating size and inspecting content
    total_bytes = 0
    first_chunk = None
    try:
        async with aiofiles.open(target_path, "wb") as out_file:
            while chunk := await file.read(1024 * 1024):  # 1MB chunks
                if first_chunk is None:
                    first_chunk = chunk
                    # Block executable magic headers outright
                    if chunk.startswith(b"MZ") or chunk.startswith(b"\x7fELF") or chunk.startswith(b"#!\n") or chunk.startswith(b"#!/"):
                        await out_file.close()
                        if os.path.exists(target_path):
                            os.remove(target_path)
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Executable file content is strictly prohibited."
                        )
                    guessed = filetype.guess(chunk)
                    if guessed and guessed.extension in ["exe", "elf", "dll", "dylib"]:
                        await out_file.close()
                        if os.path.exists(target_path):
                            os.remove(target_path)
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Executable file content is strictly prohibited."
                        )

                total_bytes += len(chunk)
                if total_bytes > max_allowed_bytes:
                    # Clean up file on size violation
                    await out_file.close()
                    if os.path.exists(target_path):
                        os.remove(target_path)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the allowed limit of {max_allowed_mb} MB"
                    )
                await out_file.write(chunk)
    except Exception as e:
        if os.path.exists(target_path):
            try:
                os.remove(target_path)
            except Exception as del_err:
                logger.error(f"Failed to cleanup failed upload file {target_path}: {del_err}", exc_info=True)
        if isinstance(e, HTTPException):
            raise e
        logger.error(
            f"Failed to save uploaded attachment '{original_name}': {e}",
            exc_info=True,
            extra={"user_id": str(current_user.id), "endpoint": "upload_attachment"}
        )
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {str(e)}")

    # Verify actual content type against claimed type
    final_mime = file.content_type or "application/octet-stream"
    if first_chunk:
        guessed = filetype.guess(first_chunk)
        if guessed:
            detected_mime = guessed.mime
            claimed_prefix = (file.content_type or "").split("/")[0]
            detected_prefix = detected_mime.split("/")[0]
            if claimed_prefix in ["image", "video", "audio"] and detected_prefix != claimed_prefix:
                if os.path.exists(target_path):
                    try:
                        os.remove(target_path)
                    except Exception as del_err:
                        logger.error(f"Failed to cleanup invalid mime file {target_path}: {del_err}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File content ({detected_mime}) does not match claimed type ({file.content_type})"
                )
            final_mime = detected_mime

    # Create Message
    new_msg = Message(
        sender_id=current_user.id,
        receiver_id=receiver_id,
        team=team_enum,
        content=content.strip() if content else None,
        format=format or "plain",
        created_at=datetime.utcnow()
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    # Create Attachment
    attachment = Attachment(
        message_id=new_msg.id,
        file_name=original_name,
        file_path=target_path,
        file_size_bytes=total_bytes,
        mime_type=final_mime
    )
    db.add(attachment)
    db.commit()
    db.refresh(new_msg)

    msg_out = format_message_out(new_msg)
    try:
        await broadcast_attachment_message(msg_out.model_dump(mode="json"))
    except Exception as e:
        logger.error(
            f"Failed to broadcast attachment message {new_msg.id}: {e}",
            exc_info=True,
            extra={"user_id": str(current_user.id), "endpoint": "upload_attachment"}
        )

    return msg_out

@router.get("/{attachment_id}/download")
def download_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    msg = att.message
    # Permission check: if DM, caller must be sender or receiver; if Team, caller must have access
    if msg.receiver_id:
        if not (current_user.id in [msg.sender_id, msg.receiver_id]):
            raise HTTPException(status_code=403, detail="Not authorized to download this file")
    elif msg.team:
        if not current_user.is_main_admin and current_user.team != msg.team:
            # Check historical membership
            has_hist = db.query(TeamMembership).filter(
                TeamMembership.user_id == current_user.id,
                TeamMembership.team == msg.team
            ).first()
            if not has_hist:
                raise HTTPException(status_code=403, detail="Not authorized to access this team file")

    if not os.path.exists(att.file_path):
        raise HTTPException(status_code=404, detail="File content missing on server disk")

    return FileResponse(
        path=att.file_path,
        filename=att.file_name,
        media_type=att.mime_type
    )

@router.get("/{attachment_id}/view")
def view_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    att = db.query(Attachment).filter(Attachment.id == attachment_id).first()
    if not att:
        raise HTTPException(status_code=404, detail="Attachment not found")

    msg = att.message
    if msg.receiver_id:
        if not (current_user.id in [msg.sender_id, msg.receiver_id]):
            raise HTTPException(status_code=403, detail="Not authorized to view this file")
    elif msg.team:
        if not current_user.is_main_admin and current_user.team != msg.team:
            has_hist = db.query(TeamMembership).filter(
                TeamMembership.user_id == current_user.id,
                TeamMembership.team == msg.team
            ).first()
            if not has_hist:
                raise HTTPException(status_code=403, detail="Not authorized to access this team file")

    if not os.path.exists(att.file_path):
        raise HTTPException(status_code=404, detail="File content missing on server disk")

    return FileResponse(
        path=att.file_path,
        media_type=att.mime_type,
        headers={
            "Content-Security-Policy": "sandbox",
            "X-Content-Type-Options": "nosniff"
        }
    )
