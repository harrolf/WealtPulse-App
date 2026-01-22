"""add_performance_indices

Revision ID: e7d98f0edfbe
Revises: 908b603d780d
Create Date: 2026-01-18 20:02:11.830234

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e7d98f0edfbe"
down_revision: Union[str, Sequence[str], None] = "908b603d780d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add composite index on assets table
    with op.batch_alter_table("assets", schema=None) as batch_op:
        batch_op.create_index(
            "idx_user_assettype", ["user_id", "asset_type_id"], unique=False
        )

    # Add composite index on refresh_tokens table
    with op.batch_alter_table("refresh_tokens", schema=None) as batch_op:
        batch_op.create_index(
            "idx_user_expires", ["user_id", "expires_at"], unique=False
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop composite indices
    with op.batch_alter_table("refresh_tokens", schema=None) as batch_op:
        batch_op.drop_index("idx_user_expires")

    with op.batch_alter_table("assets", schema=None) as batch_op:
        batch_op.drop_index("idx_user_assettype")
