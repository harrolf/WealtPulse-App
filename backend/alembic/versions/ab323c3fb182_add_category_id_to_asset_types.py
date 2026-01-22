"""add_category_id_to_asset_types

Revision ID: ab323c3fb182
Revises: eae6bf3d0c23
Create Date: 2026-01-21 23:06:25.830500

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ab323c3fb182'
down_revision: Union[str, Sequence[str], None] = 'ab477f8f791b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add category_id column and foreign key to asset_types table."""
    # Add the category_id column (nullable initially)
    op.add_column('asset_types', sa.Column('category_id', sa.Integer(), nullable=True))
    
    # Create foreign key constraint
    op.create_foreign_key(
        'fk_asset_types_category_id',
        'asset_types', 'asset_type_categories',
        ['category_id'], ['id'],
        ondelete='SET NULL'
    )
    
    # Create index for performance
    op.create_index(
        'ix_asset_types_category_id',
        'asset_types',
        ['category_id'],
        unique=False
    )


def downgrade() -> None:
    """Remove category_id column and foreign key from asset_types table."""
    # Drop index
    op.drop_index('ix_asset_types_category_id', table_name='asset_types')
    
    # Drop foreign key
    op.drop_constraint('fk_asset_types_category_id', 'asset_types', type_='foreignkey')
    
    # Drop column
    op.drop_column('asset_types', 'category_id')
