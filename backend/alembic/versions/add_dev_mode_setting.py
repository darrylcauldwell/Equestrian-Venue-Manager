"""Add dev_mode setting

Revision ID: add_dev_mode_setting
Revises: add_service_insurance_claimable
Create Date: 2024-12-24

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_dev_mode_setting'
down_revision = 'add_service_insurance_claimable'
branch_labels = None
depends_on = None


def upgrade():
    # Add dev_mode column to site_settings, defaulting to True (caching disabled)
    op.add_column('site_settings', sa.Column('dev_mode', sa.Boolean(), nullable=True, server_default='true'))


def downgrade():
    op.drop_column('site_settings', 'dev_mode')
