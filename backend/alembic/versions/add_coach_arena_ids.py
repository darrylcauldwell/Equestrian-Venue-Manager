"""Add arena_ids to coach_profiles for coach arena preferences

Revision ID: add_coach_arena_ids
Revises: add_lesson_guest_fields
Create Date: 2025-12-18 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_coach_arena_ids'
down_revision: Union[str, None] = 'add_lesson_guest_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add arena_ids JSON column to coach_profiles
    op.add_column('coach_profiles', sa.Column('arena_ids', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('coach_profiles', 'arena_ids')
