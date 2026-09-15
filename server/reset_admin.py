import sys
import getpass
from datetime import datetime
from app.core.database import SessionLocal
from app.core.security import get_password_hash, verify_password
from app.core.config import settings
from app.models.user import User, UserStatus
from app.models.refresh_token import RefreshToken

def reset_admin(email: str = None, password: str = None, name: str = None):
    """
    Direct CLI utility to reset or update the Main-Admin credentials.
    If arguments are not passed, defaults to the credentials configured in .env.
    """
    target_email = (email or settings.INITIAL_ADMIN_EMAIL).lower().strip()
    target_name = (name or settings.INITIAL_ADMIN_NAME).strip()
    target_password = password or settings.INITIAL_ADMIN_PASSWORD

    db = SessionLocal()
    try:
        admin = db.query(User).filter(User.is_main_admin == True).first()
        if not admin:
            admin = User(
                name=target_name,
                email=target_email,
                password_hash=get_password_hash(target_password),
                is_main_admin=True,
                team=None,
                is_team_leader=False,
                status=UserStatus.active,
                created_at=datetime.utcnow()
            )
            db.add(admin)
            db.commit()
            print(f"[OK] Successfully created Main-Admin account for: {target_email}")
        else:
            admin.email = target_email
            admin.name = target_name
            admin.password_hash = get_password_hash(target_password)
            # Revoke all active sessions
            revoked_count = db.query(RefreshToken).filter(
                RefreshToken.user_id == admin.id,
                RefreshToken.revoked_at.is_(None)
            ).update({"revoked_at": datetime.utcnow()})
            db.commit()
            print(f"[OK] Successfully updated Main-Admin credentials for: {target_email}")
            if revoked_count > 0:
                print(f"[INFO] Revoked {revoked_count} active sessions for this account.")
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Reset or synchronize Main-Admin credentials.")
    parser.add_argument("--email", help="New admin email (defaults to .env INITIAL_ADMIN_EMAIL)")
    parser.add_argument("--password", help="New admin password (defaults to .env INITIAL_ADMIN_PASSWORD)")
    parser.add_argument("--name", help="New admin display name (defaults to .env INITIAL_ADMIN_NAME)")
    parser.add_argument("--interactive", action="store_true", help="Prompt interactively for credentials")
    args = parser.parse_args()

    if args.interactive:
        email = input(f"Admin Email [{settings.INITIAL_ADMIN_EMAIL}]: ").strip() or settings.INITIAL_ADMIN_EMAIL
        name = input(f"Admin Name [{settings.INITIAL_ADMIN_NAME}]: ").strip() or settings.INITIAL_ADMIN_NAME
        password = getpass.getpass("Admin Password (leave blank for .env default): ") or settings.INITIAL_ADMIN_PASSWORD
        reset_admin(email, password, name)
    else:
        reset_admin(args.email, args.password, args.name)
