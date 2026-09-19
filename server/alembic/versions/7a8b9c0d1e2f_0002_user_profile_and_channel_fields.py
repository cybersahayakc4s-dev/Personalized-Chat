"""0002_user_profile_and_channel_fields

Revision ID: 7a8b9c0d1e2f
Revises: 630c01cd9424
Create Date: 2026-09-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, Sequence[str], None] = '630c01cd9424'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with idempotent additive-only columns."""
    conn = op.get_bind()
    is_sqlite = conn.dialect.name == 'sqlite'

    if is_sqlite:
        inspector = inspect(conn)
        ws_cols = [c['name'] for c in inspector.get_columns('workspace_settings')]
        if 'allow_custom_channels' not in ws_cols:
            conn.execute(sa.text('ALTER TABLE workspace_settings ADD COLUMN allow_custom_channels BOOLEAN DEFAULT 0 NOT NULL;'))
        u_cols = [c['name'] for c in inspector.get_columns('users')]
        if 'banner_url' not in u_cols:
            conn.execute(sa.text('ALTER TABLE users ADD COLUMN banner_url VARCHAR(512);'))
        if 'avatar_url' not in u_cols:
            conn.execute(sa.text('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512);'))
    else:
        conn.execute(sa.text('ALTER TABLE workspace_settings ADD COLUMN IF NOT EXISTS allow_custom_channels BOOLEAN DEFAULT false NOT NULL;'))
        conn.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url VARCHAR(512);'))
        conn.execute(sa.text('ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(512);'))


def downgrade() -> None:
    """Additive migration: downgrade intentionally no-op to prevent data loss in automated pipelines."""
    pass
