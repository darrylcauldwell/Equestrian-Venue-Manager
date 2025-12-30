"""Add venue_fee_waived flags to lessons and clinics

Revision ID: add_venue_fee_waived_flags
Revises: remove_arena_price_from_settings
Create Date: 2025-12-23

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_venue_fee_waived_flags'
down_revision = 'remove_arena_price_from_settings'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add venue_fee_waived to lesson_requests
    op.add_column('lesson_requests', sa.Column('venue_fee_waived', sa.Boolean(), nullable=False, server_default='false'))

    # Add venue_fee_waived to clinic_requests (for entire clinic)
    op.add_column('clinic_requests', sa.Column('venue_fee_waived', sa.Boolean(), nullable=False, server_default='false'))

    # Add venue_fee_waived to clinic_slots (per-slot control)
    op.add_column('clinic_slots', sa.Column('venue_fee_waived', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove venue_fee_waived columns
    op.drop_column('clinic_slots', 'venue_fee_waived')
    op.drop_column('clinic_requests', 'venue_fee_waived')
    op.drop_column('lesson_requests', 'venue_fee_waived')
