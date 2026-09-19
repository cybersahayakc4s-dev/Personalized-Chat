#!/usr/bin/env python3
"""
Database Migration & Parity Verification Script for Personalize Chat.
Works with both SQLite (local development) and PostgreSQL (production).
Idempotent and safe to run multiple times without data loss.
"""

import os
import sys
from sqlalchemy import create_engine, text

def get_database_url():
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1].strip()

    env_url = os.environ.get("DATABASE_URL")
    if env_url:
        return env_url

    # Check root .env file
    env_file = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_file):
        with open(env_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_URL=") and not line.startswith("#"):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")

    # Local fallback
    return "sqlite:///./personalize_chat.db"

def run_migration():
    db_url = get_database_url()
    print(f"[*] Target Database: {db_url}")

    connect_args = {}
    if db_url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    engine = create_engine(db_url, connect_args=connect_args)

    with engine.connect() as conn:
        is_sqlite = db_url.startswith("sqlite")
        print(f"[*] Engine dialect: {'SQLite' if is_sqlite else 'PostgreSQL/SQLAlchemy'}")

        # 1. Check workspace_settings
        print("\n--- Inspecting [workspace_settings] ---")
        if is_sqlite:
            ws_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(workspace_settings)")).fetchall()]
            if "allow_custom_channels" not in ws_cols:
                print("  [+] Adding column 'allow_custom_channels' to workspace_settings...")
                conn.execute(text("ALTER TABLE workspace_settings ADD COLUMN allow_custom_channels BOOLEAN NOT NULL DEFAULT 0"))
                conn.commit()
            else:
                print("  [OK] Column 'allow_custom_channels' already exists.")
        else:
            conn.execute(text("ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS allow_custom_channels BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("  [OK] Column 'allow_custom_channels' verified/added via IF NOT EXISTS.")

        # 2. Check users
        print("\n--- Inspecting [users] ---")
        if is_sqlite:
            u_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(users)")).fetchall()]
            if "banner_url" not in u_cols:
                print("  [+] Adding column 'banner_url' to users...")
                conn.execute(text("ALTER TABLE users ADD COLUMN banner_url VARCHAR(512)"))
                conn.commit()
            else:
                print("  [OK] Column 'banner_url' already exists.")

            if "avatar_url" not in u_cols:
                print("  [+] Adding column 'avatar_url' to users...")
                conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512)"))
                conn.commit()
            else:
                print("  [OK] Column 'avatar_url' already exists.")
        else:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url VARCHAR(512)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512)"))
            conn.commit()
            print("  [OK] Columns 'banner_url' and 'avatar_url' verified/added via IF NOT EXISTS.")

    print("\n[SUCCESS] All database migrations and schema parity checks completed successfully!")

if __name__ == "__main__":
    run_migration()
