"""add_ssl_domain_settings

Revision ID: 7dbf7c8fda00
Revises: 28f771267b27
Create Date: 2025-12-30 17:44:22.943329

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7dbf7c8fda00'
down_revision: Union[str, None] = '28f771267b27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add SSL/Domain configuration columns to site_settings
    op.add_column('site_settings', sa.Column('ssl_domain', sa.String(length=255), nullable=True))
    op.add_column('site_settings', sa.Column('ssl_acme_email', sa.String(length=255), nullable=True))
    op.add_column('site_settings', sa.Column('ssl_enabled', sa.Boolean(), nullable=True))
    op.add_column('site_settings', sa.Column('ssl_traefik_dashboard_enabled', sa.Boolean(), nullable=True))
    op.add_column('site_settings', sa.Column('ssl_traefik_dashboard_user', sa.String(length=100), nullable=True))
    op.add_column('site_settings', sa.Column('ssl_traefik_dashboard_password_hash', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('site_settings', 'ssl_traefik_dashboard_password_hash')
    op.drop_column('site_settings', 'ssl_traefik_dashboard_user')
    op.drop_column('site_settings', 'ssl_traefik_dashboard_enabled')
    op.drop_column('site_settings', 'ssl_enabled')
    op.drop_column('site_settings', 'ssl_acme_email')
    op.drop_column('site_settings', 'ssl_domain')
