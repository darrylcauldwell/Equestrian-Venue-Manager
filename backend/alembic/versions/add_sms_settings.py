"""Add SMS notification settings

Revision ID: add_sms_settings
Revises: add_clinic_slots
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_sms_settings'
down_revision: Union[str, None] = 'add_clinic_slots'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add SMS configuration columns to site_settings
    op.add_column('site_settings', sa.Column('sms_enabled', sa.Boolean(), server_default='false'))
    op.add_column('site_settings', sa.Column('sms_provider', sa.String(50), nullable=True, server_default='twilio'))
    op.add_column('site_settings', sa.Column('sms_account_sid', sa.String(100), nullable=True))
    op.add_column('site_settings', sa.Column('sms_auth_token', sa.String(100), nullable=True))
    op.add_column('site_settings', sa.Column('sms_from_number', sa.String(20), nullable=True))
    op.add_column('site_settings', sa.Column('sms_test_mode', sa.Boolean(), server_default='true'))


def downgrade() -> None:
    op.drop_column('site_settings', 'sms_test_mode')
    op.drop_column('site_settings', 'sms_from_number')
    op.drop_column('site_settings', 'sms_auth_token')
    op.drop_column('site_settings', 'sms_account_sid')
    op.drop_column('site_settings', 'sms_provider')
    op.drop_column('site_settings', 'sms_enabled')
