"""Add image URLs to site settings

Revision ID: add_image_urls
Revises: add_facilities
Create Date: 2025-12-16 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_image_urls'
down_revision: Union[str, None] = 'add_facilities'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('site_settings', sa.Column('banner_image_url', sa.String(length=500), nullable=True))
    op.add_column('site_settings', sa.Column('logo_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('site_settings', 'logo_url')
    op.drop_column('site_settings', 'banner_image_url')
