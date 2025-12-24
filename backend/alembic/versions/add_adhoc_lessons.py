"""Add ad-hoc lessons feature - coach profiles and lesson requests

Revision ID: add_adhoc_lessons
Revises: clinic_fee_structure
Create Date: 2025-12-18 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_adhoc_lessons'
down_revision: Union[str, None] = 'clinic_fee_structure'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create enum types needed for lesson requests (PostgreSQL doesn't support IF NOT EXISTS for CREATE TYPE)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE lessonrequeststatus AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CONFIRMED', 'CANCELLED', 'COMPLETED');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE availabilitymode AS ENUM ('ALWAYS', 'SCHEDULED_ONLY');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE bookingmode AS ENUM ('AUTO_ACCEPT', 'REQUEST_FIRST');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)

    # Create coach_profiles table
    op.create_table(
        'coach_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('disciplines', sa.JSON(), nullable=True),
        sa.Column('teaching_description', sa.Text(), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('availability_mode', sa.String(20), server_default='always'),
        sa.Column('booking_mode', sa.String(20), server_default='request_first'),
        sa.Column('lesson_duration_minutes', sa.Integer(), server_default='45'),
        sa.Column('coach_fee', sa.Numeric(10, 2), nullable=False),
        sa.Column('venue_fee', sa.Numeric(10, 2), nullable=True),
        sa.Column('livery_venue_fee', sa.Numeric(10, 2), server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='false'),
        sa.Column('approved_by_id', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['approved_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('ix_coach_profiles_id', 'coach_profiles', ['id'])
    op.create_index('ix_coach_profiles_user_id', 'coach_profiles', ['user_id'])

    # Create coach_recurring_schedules table
    op.create_table(
        'coach_recurring_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('coach_profile_id', sa.Integer(), nullable=False),
        sa.Column('day_of_week', sa.Integer(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.ForeignKeyConstraint(['coach_profile_id'], ['coach_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_coach_recurring_schedules_id', 'coach_recurring_schedules', ['id'])
    op.create_index('ix_coach_recurring_schedules_coach_profile_id', 'coach_recurring_schedules', ['coach_profile_id'])

    # Create coach_availability_slots table
    op.create_table(
        'coach_availability_slots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('coach_profile_id', sa.Integer(), nullable=False),
        sa.Column('slot_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('is_booked', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['coach_profile_id'], ['coach_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_coach_availability_slots_id', 'coach_availability_slots', ['id'])
    op.create_index('ix_coach_availability_slots_coach_profile_id', 'coach_availability_slots', ['coach_profile_id'])
    op.create_index('ix_coach_availability_slots_slot_date', 'coach_availability_slots', ['slot_date'])

    # Create lesson_requests table
    op.create_table(
        'lesson_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('coach_profile_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=True),
        sa.Column('requested_date', sa.Date(), nullable=False),
        sa.Column('requested_time', sa.Time(), nullable=True),
        sa.Column('alternative_dates', sa.Text(), nullable=True),
        sa.Column('discipline', sa.String(50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('coach_fee', sa.Numeric(10, 2), nullable=False),
        sa.Column('venue_fee', sa.Numeric(10, 2), nullable=False),
        sa.Column('total_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('confirmed_date', sa.Date(), nullable=True),
        sa.Column('confirmed_start_time', sa.Time(), nullable=True),
        sa.Column('confirmed_end_time', sa.Time(), nullable=True),
        sa.Column('arena_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('coach_response', sa.Text(), nullable=True),
        sa.Column('declined_reason', sa.Text(), nullable=True),
        sa.Column('payment_status', sa.String(20), server_default='pending'),
        sa.Column('payment_ref', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('responded_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['coach_profile_id'], ['coach_profiles.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id']),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_lesson_requests_id', 'lesson_requests', ['id'])
    op.create_index('ix_lesson_requests_coach_profile_id', 'lesson_requests', ['coach_profile_id'])
    op.create_index('ix_lesson_requests_user_id', 'lesson_requests', ['user_id'])
    op.create_index('ix_lesson_requests_status', 'lesson_requests', ['status'])


def downgrade() -> None:
    op.drop_table('lesson_requests')
    op.drop_table('coach_availability_slots')
    op.drop_table('coach_recurring_schedules')
    op.drop_table('coach_profiles')
