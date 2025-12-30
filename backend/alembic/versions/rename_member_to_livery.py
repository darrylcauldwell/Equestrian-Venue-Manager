"""Rename member role to livery

Revision ID: rename_member_livery
Revises: add_user_is_active
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'rename_member_livery'
down_revision: Union[str, None] = 'add_user_is_active'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # For PostgreSQL, we need to handle enum changes carefully
    # SQLAlchemy uses enum NAMES (uppercase) by default

    # 1. Change column to text temporarily
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20)")

    # 2. Update MEMBER to LIVERY (keep uppercase as SQLAlchemy expects)
    op.execute("UPDATE users SET role = 'LIVERY' WHERE role = 'MEMBER'")

    # 3. Drop old enum and create new one with uppercase names
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("CREATE TYPE userrole AS ENUM ('PUBLIC', 'LIVERY', 'COACH', 'ADMIN')")

    # 4. Convert column back to enum
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE userrole USING role::userrole")


def downgrade() -> None:
    # Change column to text temporarily
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20)")

    # Update LIVERY back to MEMBER
    op.execute("UPDATE users SET role = 'MEMBER' WHERE role = 'LIVERY'")

    # Drop and recreate old enum
    op.execute("DROP TYPE IF EXISTS userrole")
    op.execute("CREATE TYPE userrole AS ENUM ('PUBLIC', 'MEMBER', 'COACH', 'ADMIN')")

    # Convert column back to enum
    op.execute("ALTER TABLE users ALTER COLUMN role TYPE userrole USING role::userrole")
