"""add_app_config_settings

Revision ID: 4trm90mej13n
Revises: dvdnll8gkf45
Create Date: 2025-12-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4trm90mej13n'
down_revision: Union[str, None] = 'dvdnll8gkf45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add application configuration columns to site_settings table
    op.add_column('site_settings', sa.Column('arena_booking_price_per_hour', sa.Integer(), nullable=True, server_default='2500'))
    op.add_column('site_settings', sa.Column('access_token_expire_minutes', sa.Integer(), nullable=True, server_default='30'))
    op.add_column('site_settings', sa.Column('refresh_token_expire_days', sa.Integer(), nullable=True, server_default='7'))
    op.add_column('site_settings', sa.Column('frontend_url', sa.String(length=200), nullable=True, server_default='http://localhost:3000'))


def downgrade() -> None:
    # Remove application configuration columns
    op.drop_column('site_settings', 'frontend_url')
    op.drop_column('site_settings', 'refresh_token_expire_days')
    op.drop_column('site_settings', 'access_token_expire_minutes')
    op.drop_column('site_settings', 'arena_booking_price_per_hour')
