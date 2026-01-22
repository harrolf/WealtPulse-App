"""Set default values for user boolean fields

Revision ID: 908b603d780d
Revises: d85b864326bb
Create Date: 2026-01-18 13:15:03.568534

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "908b603d780d"
down_revision: Union[str, Sequence[str], None] = "d85b864326bb"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Update existing NULL values to proper defaults
    conn = op.get_bind()

    # Set default values for existing rows where these fields are NULL
    conn.execute(sa.text("UPDATE users SET is_active = TRUE WHERE is_active IS NULL"))
    conn.execute(
        sa.text("UPDATE users SET is_verified = FALSE WHERE is_verified IS NULL")
    )
    conn.execute(sa.text("UPDATE users SET is_admin = FALSE WHERE is_admin IS NULL"))
    conn.execute(
        sa.text("UPDATE users SET email_verified = FALSE WHERE email_verified IS NULL")
    )

    # Now alter columns to have NOT NULL constraint with default values
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column(
            "is_active",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.text("TRUE"),
        )
        batch_op.alter_column(
            "is_verified",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
        )
        batch_op.alter_column(
            "is_admin",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
        )
        batch_op.alter_column(
            "email_verified",
            existing_type=sa.Boolean(),
            nullable=False,
            server_default=sa.text("FALSE"),
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Remove NOT NULL constraints
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.alter_column(
            "is_active", existing_type=sa.Boolean(), nullable=True, server_default=None
        )
        batch_op.alter_column(
            "is_verified",
            existing_type=sa.Boolean(),
            nullable=True,
            server_default=None,
        )
        batch_op.alter_column(
            "is_admin", existing_type=sa.Boolean(), nullable=True, server_default=None
        )
        batch_op.alter_column(
            "email_verified",
            existing_type=sa.Boolean(),
            nullable=True,
            server_default=None,
        )
