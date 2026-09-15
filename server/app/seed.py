from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import text
from .core.database import engine, SessionLocal, Base
from .core.config import settings
from .core.security import get_password_hash
from .core.logging_config import get_logger
from .models.user import User, TeamEnum, UserStatus
from .models.team_settings import TeamSettings
from .models.membership import TeamMembership
from .models.message import Message
from .models.attachment import Attachment
from .models.team_read import TeamReadReceipt

logger = get_logger("app.seed")

def init_db():
    # Ensure tables exist (Alembic handles migrations)
    Base.metadata.create_all(bind=engine)

    # Auto-migrate newly added columns for SQLite/dev databases
    try:
        with engine.connect() as conn:
            if settings.DATABASE_URL.startswith("sqlite"):
                cols = [row[1] for row in conn.execute(text("PRAGMA table_info(workspace_settings)")).fetchall()]
                if "allow_custom_channels" not in cols:
                    conn.execute(text("ALTER TABLE workspace_settings ADD COLUMN allow_custom_channels BOOLEAN NOT NULL DEFAULT 0"))
                    conn.commit()
            else:
                conn.execute(text("ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS allow_custom_channels BOOLEAN DEFAULT FALSE"))
                conn.commit()
    except Exception as mig_err:
        logger.warning(f"Auto-migration check notice: {mig_err}")

    db: Session = SessionLocal()
    try:
        # Seed default TeamSettings for all 5 teams if not present
        for team in TeamEnum:
            ts = db.query(TeamSettings).filter(TeamSettings.team == team).first()
            if not ts:
                ts = TeamSettings(
                    team=team,
                    max_file_size_mb=settings.DEFAULT_MAX_FILE_SIZE_MB,
                    leader_ceiling_mb=settings.DEFAULT_LEADER_CEILING_MB,
                    updated_at=datetime.utcnow()
                )
                db.add(ts)
        db.commit()

        # Seed WorkspaceSettings if not present
        from .models.workspace_settings import WorkspaceSettings
        ws = db.query(WorkspaceSettings).first()
        if not ws:
            ws = WorkspaceSettings(
                workspace_name="Cyber Sahayak",
                domain="cybersahayak.local",
                retention_days=90,
                allow_file_uploads=True,
                max_upload_size_bytes=500 * 1024 * 1024,
                sound_enabled=True
            )
            db.add(ws)
            db.commit()

        # Seed or synchronize initial Main-Admin
        admin = db.query(User).filter(User.is_main_admin == True).first()
        target_email = settings.INITIAL_ADMIN_EMAIL.lower().strip()
        target_name = settings.INITIAL_ADMIN_NAME.strip()
        target_password = settings.INITIAL_ADMIN_PASSWORD.strip()

        if not admin:
            admin_user = User(
                name=target_name,
                email=target_email,
                password_hash=get_password_hash(target_password),
                is_main_admin=True,
                team=None,
                is_team_leader=False,
                status=UserStatus.active,
                created_at=datetime.utcnow()
            )
            db.add(admin_user)
            db.commit()
            logger.info(f"Bootstrapped initial Main-Admin: {target_email}")
        else:
            # Production Safety Guarantee: Never overwrite or synchronize existing admin credentials on startup
            logger.info(f"Main-Admin account already exists ({admin.email}). Startup credential synchronization skipped for production security.")

    finally:
        db.close()

if __name__ == "__main__":
    init_db()
