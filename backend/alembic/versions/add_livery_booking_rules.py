"""Add livery booking rules and horse reference to bookings

Revision ID: add_livery_booking_rules
Revises: rename_sick_leave_to_absences
Create Date: 2025-12-17 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_livery_booking_rules'
down_revision: Union[str, None] = 'rename_sick_leave_to_absences'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add horse_id and booking_status to bookings table
    op.add_column('bookings', sa.Column('horse_id', sa.Integer(), sa.ForeignKey('horses.id'), nullable=True))
    op.add_column('bookings', sa.Column('booking_status', sa.String(length=20), nullable=False, server_default='confirmed'))

    # Add livery booking rules to site_settings
    # All limits default to NULL (no restrictions) except max_advance_days which defaults to 30 (one month rolling)
    op.add_column('site_settings', sa.Column('livery_max_future_hours_per_horse', sa.Numeric(5, 1), nullable=True))
    op.add_column('site_settings', sa.Column('livery_max_booking_hours', sa.Numeric(5, 1), nullable=True))
    op.add_column('site_settings', sa.Column('livery_min_advance_hours', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('site_settings', sa.Column('livery_max_advance_days', sa.Integer(), nullable=True, server_default='30'))
    op.add_column('site_settings', sa.Column('livery_max_weekly_hours_per_horse', sa.Numeric(5, 1), nullable=True))
    op.add_column('site_settings', sa.Column('livery_max_daily_hours_per_horse', sa.Numeric(5, 1), nullable=True))


def downgrade() -> None:
    # Remove livery booking rules from site_settings
    op.drop_column('site_settings', 'livery_max_daily_hours_per_horse')
    op.drop_column('site_settings', 'livery_max_weekly_hours_per_horse')
    op.drop_column('site_settings', 'livery_max_advance_days')
    op.drop_column('site_settings', 'livery_min_advance_hours')
    op.drop_column('site_settings', 'livery_max_booking_hours')
    op.drop_column('site_settings', 'livery_max_future_hours_per_horse')

    # Remove horse_id and booking_status from bookings
    op.drop_column('bookings', 'booking_status')
    op.drop_column('bookings', 'horse_id')
