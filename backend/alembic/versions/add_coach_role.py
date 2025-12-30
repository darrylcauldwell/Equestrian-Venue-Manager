"""Add coach role to user role enum

Revision ID: add_coach_role
Revises: c766a3d78488
Create Date: 2025-12-16 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'add_coach_role'
down_revision: Union[str, None] = 'c766a3d78488'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 'COACH' to the userrole enum
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'COACH'")


def downgrade() -> None:
    # Note: PostgreSQL doesn't support removing enum values
    # This would require recreating the type and all dependent columns
    # For safety, we'll leave the enum value in place during downgrade
    pass
