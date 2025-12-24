"""Add guest fields to lesson_requests for public bookings

Revision ID: add_lesson_guest_fields
Revises: add_lesson_booking_link
Create Date: 2025-12-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_lesson_guest_fields'
down_revision: Union[str, None] = 'add_lesson_booking_link'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make user_id nullable for guest bookings
    op.alter_column('lesson_requests', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=True)

    # Add guest booking fields
    op.add_column('lesson_requests', sa.Column('guest_name', sa.String(100), nullable=True))
    op.add_column('lesson_requests', sa.Column('guest_email', sa.String(255), nullable=True))
    op.add_column('lesson_requests', sa.Column('guest_phone', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('lesson_requests', 'guest_phone')
    op.drop_column('lesson_requests', 'guest_email')
    op.drop_column('lesson_requests', 'guest_name')

    # Revert user_id to non-nullable (only if no null values exist)
    op.alter_column('lesson_requests', 'user_id',
                    existing_type=sa.Integer(),
                    nullable=False)
