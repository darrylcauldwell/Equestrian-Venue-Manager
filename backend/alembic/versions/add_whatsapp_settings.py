"""Add WhatsApp notification settings

Revision ID: add_whatsapp_settings
Revises: add_dark_mode_colors
Create Date: 2025-12-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_whatsapp_settings'
down_revision: Union[str, None] = 'add_dark_mode_colors'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add WhatsApp notification settings
    # Uses same Twilio credentials as SMS (sms_account_sid, sms_auth_token)
    op.add_column('site_settings', sa.Column('whatsapp_enabled', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('site_settings', sa.Column('whatsapp_phone_number', sa.String(length=20), nullable=True))
    op.add_column('site_settings', sa.Column('whatsapp_test_mode', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('site_settings', sa.Column('whatsapp_default_template', sa.String(length=100), nullable=True))
    # Notification type toggles (all default to true when WhatsApp is enabled)
    op.add_column('site_settings', sa.Column('whatsapp_notify_invoice', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('site_settings', sa.Column('whatsapp_notify_feed_alerts', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('site_settings', sa.Column('whatsapp_notify_service_requests', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('site_settings', sa.Column('whatsapp_notify_holiday_livery', sa.Boolean(), nullable=True, server_default='true'))


def downgrade() -> None:
    op.drop_column('site_settings', 'whatsapp_notify_holiday_livery')
    op.drop_column('site_settings', 'whatsapp_notify_service_requests')
    op.drop_column('site_settings', 'whatsapp_notify_feed_alerts')
    op.drop_column('site_settings', 'whatsapp_notify_invoice')
    op.drop_column('site_settings', 'whatsapp_default_template')
    op.drop_column('site_settings', 'whatsapp_test_mode')
    op.drop_column('site_settings', 'whatsapp_phone_number')
    op.drop_column('site_settings', 'whatsapp_enabled')
