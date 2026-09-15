from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from ..core.database import get_db
from ..core.config import settings as app_settings
from ..models.user import User, TeamEnum
from ..models.membership import TeamMembership
from ..models.team_settings import TeamSettings
from ..models.message import Message
from ..models.team_read import TeamReadReceipt
from ..schemas.user import TeamMemberDirectory, UserOut
from ..schemas.admin import TeamSettingsUpdate, TeamSettingsOut
from .deps import get_current_user

router = APIRouter(prefix="/teams", tags=["Teams"])

TEAM_DISPLAY_NAMES = {
    TeamEnum.team_ai: "AI Team",
    TeamEnum.team_legal: "Legal Team",
    TeamEnum.hr_admin: "HR Team",
    TeamEnum.seo: "SEO Team",
    TeamEnum.coordination: "Ops Team"
}

@router.get("", response_model=List[TeamMemberDirectory])
def get_teams_directory(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    directory = []
    
    # Query all active team settings
    team_settings_dict = {ts.team: ts for ts in db.query(TeamSettings).all()}

    # Query user's past team memberships
    past_memberships = db.query(TeamMembership).filter(
        TeamMembership.user_id == current_user.id
    ).all()
    past_teams = {m.team for m in past_memberships}

    for team in TeamEnum:
        # Fetch current members
        members = db.query(User).filter(User.team == team).order_by(User.name.asc()).all()
        
        # Get settings
        ts = team_settings_dict.get(team)
        max_size = ts.max_file_size_mb if ts else app_settings.DEFAULT_MAX_FILE_SIZE_MB
        ceiling = ts.leader_ceiling_mb if ts else app_settings.DEFAULT_LEADER_CEILING_MB

        is_active_member = (current_user.team == team) or current_user.is_main_admin
        is_archived = (not is_active_member) and (team in past_teams) and (not current_user.is_main_admin)

        unread_count = 0
        last_message_preview = None
        last_message_time = None

        if is_active_member:
            # Query the latest message in this team
            last_msg = db.query(Message).filter(
                Message.team == team
            ).order_by(desc(Message.created_at)).first()

            if last_msg:
                last_message_time = last_msg.created_at
                sender_name = last_msg.sender.name if last_msg.sender else "User"
                if last_msg.sender_id == current_user.id:
                    sender_label = "You"
                else:
                    sender_label = sender_name.split(" ")[0]

                if last_msg.deleted_at:
                    preview_text = "Message deleted"
                elif last_msg.content:
                    content_str = last_msg.content.strip()
                    preview_text = content_str[:45] + ("..." if len(content_str) > 45 else "")
                elif last_msg.attachments:
                    first_att = last_msg.attachments[0]
                    mime = first_att.mime_type or ""
                    fname = first_att.file_name or ""
                    if mime.startswith("audio/") or "voice_message" in fname or fname.endswith(".webm"):
                        preview_text = "🎙️ Voice message"
                    elif mime.startswith("image/"):
                        preview_text = "📷 Photo"
                    elif mime.startswith("video/"):
                        preview_text = "🎥 Video"
                    else:
                        preview_text = "📎 Attachment"
                else:
                    preview_text = ""

                last_message_preview = f"{sender_label}: {preview_text}"

            # Query the user's last read timestamp for this team
            receipt = db.query(TeamReadReceipt).filter(
                TeamReadReceipt.user_id == current_user.id,
                TeamReadReceipt.team == team
            ).first()

            if receipt:
                cutoff = receipt.last_read_at
            elif current_user.is_main_admin:
                cutoff = current_user.created_at
            else:
                active_m = db.query(TeamMembership).filter(
                    TeamMembership.user_id == current_user.id,
                    TeamMembership.team == team,
                    TeamMembership.left_at.is_(None)
                ).first()
                cutoff = active_m.joined_at if active_m else current_user.created_at

            unread_count = db.query(Message).filter(
                Message.team == team,
                Message.sender_id != current_user.id,
                Message.deleted_at.is_(None),
                Message.created_at > cutoff
            ).count()

        directory.append(TeamMemberDirectory(
            team=team,
            name_display=TEAM_DISPLAY_NAMES.get(team, team.value),
            members=[UserOut.model_validate(m) for m in members],
            max_file_size_mb=max_size,
            leader_ceiling_mb=ceiling,
            is_member=is_active_member,
            is_archived_member=is_archived,
            unread_count=unread_count,
            last_message=last_message_preview,
            last_message_time=last_message_time
        ))

    return directory

@router.patch("/{team}/settings", response_model=TeamSettingsOut)
def update_team_file_limit(
    team: TeamEnum,
    settings_in: TeamSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ts = db.query(TeamSettings).filter(TeamSettings.team == team).first()
    if not ts:
        ts = TeamSettings(
            team=team,
            max_file_size_mb=app_settings.DEFAULT_MAX_FILE_SIZE_MB,
            leader_ceiling_mb=app_settings.DEFAULT_LEADER_CEILING_MB
        )
        db.add(ts)

    # Permission check: Main-Admin has total control
    if current_user.is_main_admin:
        if settings_in.max_file_size_mb is not None:
            ts.max_file_size_mb = settings_in.max_file_size_mb
        if settings_in.leader_ceiling_mb is not None:
            ts.leader_ceiling_mb = settings_in.leader_ceiling_mb
    elif current_user.is_team_leader and current_user.team == team:
        # Team Leader can only update max_file_size_mb up to their ceiling
        if settings_in.leader_ceiling_mb is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Main-Admin can adjust the team ceiling limit"
            )
        if settings_in.max_file_size_mb is not None:
            if settings_in.max_file_size_mb > ts.leader_ceiling_mb:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Requested size ({settings_in.max_file_size_mb}MB) exceeds team ceiling of {ts.leader_ceiling_mb}MB. Contact Main-Admin to raise ceiling."
                )
            ts.max_file_size_mb = settings_in.max_file_size_mb
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Main-Admin or this team's Team Leader can adjust upload settings"
        )

    ts.updated_by = current_user.id
    ts.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ts)
    return TeamSettingsOut.model_validate(ts)
