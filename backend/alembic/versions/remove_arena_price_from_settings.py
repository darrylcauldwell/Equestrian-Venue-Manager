"""Remove arena_booking_price_per_hour from site_settings

Revision ID: remove_arena_price_from_settings
Revises: 4trm90mej13n
Create Date: 2025-12-23

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'remove_arena_price_from_settings'
down_revision = '4trm90mej13n'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove arena_booking_price_per_hour column from site_settings
    # Arena pricing is now managed per-arena in the arenas table
    op.drop_column('site_settings', 'arena_booking_price_per_hour')


def downgrade() -> None:
    # Restore arena_booking_price_per_hour column
    op.add_column(
        'site_settings',
        sa.Column('arena_booking_price_per_hour', sa.Integer(), nullable=True, server_default='2500')
    )
