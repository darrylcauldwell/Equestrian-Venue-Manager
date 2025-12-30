"""Add booking_id to lesson_requests for arena blocking

Revision ID: add_lesson_booking_link
Revises: add_adhoc_lessons
Create Date: 2025-12-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_lesson_booking_link'
down_revision: Union[str, None] = 'add_adhoc_lessons'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add booking_id column to lesson_requests
    op.add_column('lesson_requests', sa.Column('booking_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_lesson_requests_booking_id',
        'lesson_requests',
        'bookings',
        ['booking_id'],
        ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_lesson_requests_booking_id', 'lesson_requests', type_='foreignkey')
    op.drop_column('lesson_requests', 'booking_id')
