"""add_remaining_missing_columns

Revision ID: c8d4e9f2a1b3
Revises: 9429bc99b36c
Create Date: 2026-01-21 23:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8d4e9f2a1b3'
down_revision: Union[str, Sequence[str], None] = '9429bc99b36c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add remaining missing columns to various tables."""
    # Add supports_pricing to asset_types
    op.add_column('asset_types', sa.Column('supports_pricing', sa.Boolean(), nullable=True, server_default='true'))


def downgrade() -> None:
    """Remove the added columns."""
    op.drop_column('asset_types', 'supports_pricing')
