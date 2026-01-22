"""add_display_config_to_asset_types

Revision ID: 9429bc99b36c
Revises: ab323c3fb182
Create Date: 2026-01-21 23:17:15.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9429bc99b36c'
down_revision: Union[str, Sequence[str], None] = 'ab323c3fb182'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add display_config column to asset_types table."""
    op.add_column('asset_types', sa.Column('display_config', sa.JSON(), nullable=True, server_default='{}'))


def downgrade() -> None:
    """Remove display_config column from asset_types table."""
    op.drop_column('asset_types', 'display_config')
