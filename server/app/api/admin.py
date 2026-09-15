import os
from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..core.database import get_db
from ..core.security import get_password_hash, verify_password
from ..models.user import User, UserStatus, TeamEnum
from ..models.membership import TeamMembership
from ..models.team_settings import TeamSettings
from ..models.audit_log import AuditLog
from ..models.workspace_settings import WorkspaceSettings
from ..models.refresh_token import RefreshToken
from ..schemas.user import UserCreate, UserUpdate, UserOut
from ..schemas.admin import AdminPasswordReset, AdminUserOut, TeamSettingsUpdate, TeamSettingsOut, AuditLogOut, WorkspaceSettingsOut, WorkspaceSettingsUpdate
from .deps import get_current_main_admin
from ..core.logging_config import get_logger
from ..sockets.manager import update_user_team_rooms, broadcast_user_updated

logger = get_logger("app.api.admin")

router = APIRouter(prefix="/main-admin", tags=["Main-Admin"])

def log_admin_action(db: Session, actor_id: int, action: str, details: str = "", target: str = None):
    try:
        log = AuditLog(
            actor_id=actor_id,
            action=action,
            target=target,
            details=details,
            created_at=datetime.utcnow()
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.error(
            f"Failed to record audit log action='{action}' target='{target}': {e}",
            exc_info=True,
            extra={"user_id": str(actor_id), "endpoint": "log_admin_action"}
        )

@router.get("/admins", response_model=List[AdminUserOut])
def list_main_admins(
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    admins = db.query(User).filter(User.is_main_admin == True).order_by(User.id.asc()).all()
    return [AdminUserOut.model_validate(a) for a in admins]

@router.get("/users", response_model=List[UserOut])
def list_all_users(
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).order_by(User.id.asc()).all()
    return [UserOut.model_validate(u) for u in users]

@router.post("/users", response_model=UserOut)
async def create_user(
    user_in: UserCreate,
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    email = user_in.email.lower().strip()
    if not user_in.password or not user_in.password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required and cannot be empty."
        )

    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
    
    # Step-Up Auth for Main-Admin provisioning
    if user_in.is_main_admin:
        if not user_in.current_admin_password or not verify_password(user_in.current_admin_password, admin.password_hash):
            log_admin_action(
                db,
                actor_id=admin.id,
                action="admin:create_admin_failed",
                target=email,
                details=f"Failed Main-Admin provisioning attempt by {admin.name} ({admin.email}) for target {email} (invalid/missing admin password)"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Incorrect admin password. Cannot provision a Main-Admin account."
            )
    
    # Create user
    new_user = User(
        name=user_in.name.strip(),
        email=email,
        password_hash=get_password_hash(user_in.password),
        is_main_admin=user_in.is_main_admin,
        team=user_in.team,
        is_team_leader=user_in.is_team_leader if user_in.team else False,
        status=UserStatus.active,
        created_by=admin.id,
        created_at=datetime.utcnow()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Log Main-Admin provisioning in audit_logs
    if new_user.is_main_admin:
        log_admin_action(
            db,
            actor_id=admin.id,
            action="admin:create_admin",
            target=str(new_user.id),
            details=f"Main-Admin {admin.name} ({admin.email}) provisioned new Main-Admin {new_user.name} ({new_user.email}). co_admin_created_by: {admin.name} (id={admin.id})"
        )

    # If team assigned upfront, log initial TeamMembership
    if new_user.team:
        membership = TeamMembership(
            user_id=new_user.id,
            team=new_user.team,
            joined_at=datetime.utcnow(),
            left_at=None
        )
        db.add(membership)
        db.commit()

    # Broadcast real-time user creation event to all connected clients
    try:
        from ..sockets.manager import sio
        await sio.emit("user:created", {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
            "team": new_user.team.value if new_user.team else None,
            "is_main_admin": new_user.is_main_admin,
            "is_team_leader": new_user.is_team_leader,
            "account_status": new_user.status.value if hasattr(new_user.status, "value") else str(new_user.status),
            "is_active": new_user.status != UserStatus.disabled,
            "presence": "offline",
            "status": new_user.status.value if hasattr(new_user.status, "value") else str(new_user.status),
            "created_at": (new_user.created_at.isoformat() + "Z") if new_user.created_at else None
        })
    except Exception as e:
        logger.error(
            f"Socket broadcast error on user:created for user {new_user.id}: {e}",
            exc_info=True,
            extra={"user_id": str(admin.id), "endpoint": "create_user"}
        )

    return UserOut.model_validate(new_user)

@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    user_in: UserUpdate,
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.is_main_admin and user.id == admin.id and user_in.status == UserStatus.disabled:
        raise HTTPException(status_code=400, detail="Main-Admin cannot disable their own account")

    changes = []
    old_team_val = user.team.value if user.team else None

    if user_in.name is not None and user_in.name.strip() != user.name:
        changes.append(f"name: '{user.name}' -> '{user_in.name.strip()}'")
        user.name = user_in.name.strip()

    # Team change tracking & append-only TeamMembership logging
    new_team_val = old_team_val
    if user_in.team is not None and user_in.team != user.team:
        now = datetime.utcnow()
        old_team_str = user.team.value if user.team else "None"
        new_team_str = user_in.team.value if user_in.team else "None"
        changes.append(f"team: {old_team_str} -> {new_team_str}")

        # Close previous active membership
        if user.team:
            active_m = db.query(TeamMembership).filter(
                TeamMembership.user_id == user.id,
                TeamMembership.team == user.team,
                TeamMembership.left_at.is_(None)
            ).first()
            if active_m:
                active_m.left_at = now

        # If assigning a new team (not None), open new membership
        if user_in.team:
            new_m = TeamMembership(
                user_id=user.id,
                team=user_in.team,
                joined_at=now,
                left_at=None
            )
            db.add(new_m)
            user.team = user_in.team
            new_team_val = user_in.team.value
        else:
            user.team = None
            user.is_team_leader = False
            new_team_val = None

    if user_in.is_team_leader is not None:
        target_leader = user_in.is_team_leader if user.team else False
        if target_leader != user.is_team_leader:
            changes.append(f"is_team_leader: {user.is_team_leader} -> {target_leader}")
            user.is_team_leader = target_leader

    if user_in.status is not None and user_in.status != user.status:
        changes.append(f"status: {user.status} -> {user_in.status}")
        user.status = user_in.status

    db.commit()
    db.refresh(user)

    # Log changes to audit_logs
    if changes:
        details_str = f"Updated user {user.id} ({user.email}): " + ", ".join(changes)
        log_admin_action(db, actor_id=admin.id, action="user:update", details=details_str, target=str(user.id))

    # Real-time room migration for all active socket connections of this user
    if user_in.team is not None and old_team_val != new_team_val:
        await update_user_team_rooms(user.id, old_team_val, new_team_val)

    # Broadcast user update company-wide
    out = UserOut.model_validate(user)
    await broadcast_user_updated(out.model_dump(mode="json"))

    return out

@router.patch("/users/{user_id}/password")
def reset_user_password(
    user_id: int,
    reset_data: AdminPasswordReset,
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Step-Up Auth if target is a Main-Admin
    if user.is_main_admin:
        if not reset_data.current_admin_password or not verify_password(reset_data.current_admin_password, admin.password_hash):
            log_admin_action(
                db,
                actor_id=admin.id,
                action="admin:reset_admin_password_failed",
                target=str(user.id),
                details=f"Failed Main-Admin password reset attempt by {admin.name} ({admin.email}) on target {user.name} ({user.email}) (invalid/missing admin password)"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Incorrect admin password. Cannot reset a Main-Admin's password."
            )
    
    user.password_hash = get_password_hash(reset_data.new_password)
    
    # Revoke all active refresh tokens for this user immediately killing prior sessions
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": datetime.utcnow()})
    db.commit()

    # Record audit log
    log_admin_action(
        db,
        actor_id=admin.id,
        action="user:reset_password",
        target=str(user.id),
        details=f"Admin {admin.name} ({admin.email}) reset password for user {user.name} ({user.email}). Prior refresh tokens revoked."
    )

    return {"message": f"Password reset successfully for {user.name} ({user.email})"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Main-Admin cannot delete their own account")
    if user.status == UserStatus.deleted:
        raise HTTPException(status_code=400, detail="User is already deleted")

    import time
    import secrets
    original_name = user.name
    original_email = user.email

    # Scramble credentials & archive
    timestamp = int(time.time())
    user.email = f"deleted_{user.id}_{timestamp}@archived.internal"
    user.password_hash = get_password_hash(secrets.token_urlsafe(32))
    user.name = "[Deleted User]"
    user.status = UserStatus.deleted

    # Revoke all active refresh tokens immediately
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None)
    ).update({"revoked_at": datetime.utcnow()})

    # Close active team membership
    if user.team:
        active_m = db.query(TeamMembership).filter(
            TeamMembership.user_id == user.id,
            TeamMembership.team == user.team,
            TeamMembership.left_at.is_(None)
        ).first()
        if active_m:
            active_m.left_at = datetime.utcnow()
        user.team = None
        user.is_team_leader = False

    db.commit()
    db.refresh(user)

    # Audit log
    log_admin_action(
        db,
        actor_id=admin.id,
        action="user:delete",
        target=str(user.id),
        details=f"Admin {admin.name} ({admin.email}) deleted and archived user {original_name} ({original_email})."
    )

    # Broadcast real-time user update company-wide
    out = UserOut.model_validate(user)
    await broadcast_user_updated(out.model_dump(mode="json"))

    return {"message": f"User {original_name} ({original_email}) successfully deleted and archived."}

@router.patch("/teams/{team}/settings", response_model=TeamSettingsOut)
def update_team_settings(
    team: TeamEnum,
    settings_in: TeamSettingsUpdate,
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    ts = db.query(TeamSettings).filter(TeamSettings.team == team).first()
    if not ts:
        ts = TeamSettings(team=team, max_file_size_mb=500, leader_ceiling_mb=2048)
        db.add(ts)
    
    if settings_in.max_file_size_mb is not None:
        ts.max_file_size_mb = settings_in.max_file_size_mb
    if settings_in.leader_ceiling_mb is not None:
        ts.leader_ceiling_mb = settings_in.leader_ceiling_mb
    
    ts.updated_by = admin.id
    ts.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ts)
    return TeamSettingsOut.model_validate(ts)

@router.get("/audit-logs", response_model=List[AuditLogOut])
def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).offset(offset).limit(limit).all()
    out = []
    for l in logs:
        out.append(AuditLogOut(
            id=l.id,
            actor_id=l.actor_id,
            actor_name=l.actor.name if l.actor else "System",
            action=l.action,
            target=l.target,
            details=l.details,
            ip_address=l.ip_address or "127.0.0.1",
            created_at=l.created_at.isoformat() + "Z"
        ))
    return out

@router.get("/settings", response_model=WorkspaceSettingsOut)
def get_workspace_settings(
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    ws = db.query(WorkspaceSettings).first()
    if not ws:
        ws = WorkspaceSettings()
        db.add(ws)
        db.commit()
        db.refresh(ws)
    return WorkspaceSettingsOut.model_validate(ws)

@router.put("/settings", response_model=WorkspaceSettingsOut)
def update_workspace_settings(
    settings_in: WorkspaceSettingsUpdate,
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    ws = db.query(WorkspaceSettings).first()
    if not ws:
        ws = WorkspaceSettings()
        db.add(ws)
        db.commit()
        db.refresh(ws)

    data = settings_in.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(ws, k, v)

    db.commit()
    db.refresh(ws)
    log_admin_action(db, admin.id, "settings.update", "Updated workspace configuration")
    return WorkspaceSettingsOut.model_validate(ws)

@router.post("/reset-data")
def reset_workspace_data(
    admin: User = Depends(get_current_main_admin),
    db: Session = Depends(get_db)
):
    """
    Destructive: Resets workspace messages, reactions, team reads, and non-seed attachments.
    Restricted to Main-Admin only and logged in audit_logs.
    """
    from ..models.reaction import MessageReaction
    from ..models.attachment import Attachment
    from ..models.team_read import TeamReadReceipt
    from ..models.message import Message

    # 1. Delete message reactions
    db.query(MessageReaction).delete()
    # 2. Delete team read receipts
    db.query(TeamReadReceipt).delete()
    # 3. Delete attachments (and clean up uploaded files if present)
    attachments = db.query(Attachment).all()
    for att in attachments:
        if att.file_path and os.path.exists(att.file_path):
            try:
                os.remove(att.file_path)
            except Exception as e:
                logger.warning(f"Could not remove file {att.file_path} during reset: {e}")
    db.query(Attachment).delete()
    # 4. Delete messages
    db.query(Message).delete()
    db.commit()

    log_admin_action(
        db,
        actor_id=admin.id,
        action="workspace:reset_seed",
        details="Purged all chat messages, reactions, team reads, and attachment uploads.",
        target="workspace"
    )

    return {"status": "ok", "message": "Workspace chat data reset to clean state successfully."}
