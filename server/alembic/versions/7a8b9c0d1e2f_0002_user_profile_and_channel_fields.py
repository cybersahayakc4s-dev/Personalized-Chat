"""0002_user_profile_and_channel_fields

Revision ID: 7a8b9c0d1e2f
Revises: 630c01cd9424
Create Date: 2026-09-19 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, Sequence[str], None] = '630c01cd9424'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema with additive-only columns."""
    op.add_column(
        'workspace_settings',
        sa.Column('allow_custom_channels', sa.Boolean(), server_default=sa.text('false'), nullable=False)
    )
    op.add_column(
        'users',
        sa.Column('banner_url', sa.String(length=512), nullable=True)
    )
    op.add_column(
        'users',
        sa.Column('avatar_url', sa.String(length=512), nullable=True)
    )


def downgrade() -> None:
    """Additive migration: downgrade intentionally no-op to prevent data loss in automated pipelines."""
    pass
