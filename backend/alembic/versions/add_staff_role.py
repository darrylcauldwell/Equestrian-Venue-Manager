"""Add staff role

Revision ID: add_staff_role
Revises: add_horse_personality
Create Date: 2025-12-17 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_staff_role'
down_revision: Union[str, None] = 'add_horse_personality'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add STAFF to the userrole enum in PostgreSQL
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'STAFF'")


def downgrade() -> None:
    # Convert any 'staff' roles back to 'livery' if downgrading
    # Note: PostgreSQL doesn't support removing enum values, so we just update the data
    op.execute("UPDATE users SET role = 'LIVERY' WHERE role = 'STAFF'")
