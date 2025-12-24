"""Add preferred_lesson_type to clinic_participants

Revision ID: add_preferred_lesson_type
Revises: add_cascade_deletes
Create Date: 2025-12-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_preferred_lesson_type'
down_revision: Union[str, None] = 'add_cascade_deletes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add preferred_lesson_type column to clinic_participants
    # Values: 'private' or 'group' - allows participants to indicate their preference
    op.add_column('clinic_participants',
        sa.Column('preferred_lesson_type', sa.String(20), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('clinic_participants', 'preferred_lesson_type')
