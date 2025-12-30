"""add_stripe_settings

Revision ID: dvdnll8gkf45
Revises: 3ef34aa9185f
Create Date: 2025-12-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dvdnll8gkf45'
down_revision: Union[str, None] = '3ef34aa9185f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add Stripe payment settings columns to site_settings table
    op.add_column('site_settings', sa.Column('stripe_enabled', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('site_settings', sa.Column('stripe_secret_key', sa.String(length=200), nullable=True))
    op.add_column('site_settings', sa.Column('stripe_publishable_key', sa.String(length=200), nullable=True))
    op.add_column('site_settings', sa.Column('stripe_webhook_secret', sa.String(length=200), nullable=True))


def downgrade() -> None:
    # Remove Stripe payment settings columns
    op.drop_column('site_settings', 'stripe_webhook_secret')
    op.drop_column('site_settings', 'stripe_publishable_key')
    op.drop_column('site_settings', 'stripe_secret_key')
    op.drop_column('site_settings', 'stripe_enabled')
