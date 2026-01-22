"""create_asset_type_categories_table

Revision ID: ab477f8f791b
Revises: eae6bf3d0c23
Create Date: 2026-01-21 23:11:30.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ab477f8f791b'
down_revision: Union[str, Sequence[str], None] = 'eae6bf3d0c23'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create asset_type_categories table."""
    op.create_table(
        'asset_type_categories',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_system', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('display_config', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    
    # Create index on name for performance
    op.create_index('ix_asset_type_categories_name', 'asset_type_categories', ['name'], unique=True)


def downgrade() -> None:
    """Drop asset_type_categories table."""
    op.drop_index('ix_asset_type_categories_name', table_name='asset_type_categories')
    op.drop_table('asset_type_categories')
