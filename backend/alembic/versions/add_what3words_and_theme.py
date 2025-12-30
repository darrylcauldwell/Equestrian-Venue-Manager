"""Add what3words and theme settings

Revision ID: add_what3words_theme
Revises: add_livery_packages
Create Date: 2025-12-17 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_what3words_theme'
down_revision: Union[str, None] = 'add_livery_packages'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add what3words field
    op.add_column('site_settings', sa.Column('what3words', sa.String(length=100), nullable=True))
    # Add theme customization fields
    op.add_column('site_settings', sa.Column('theme_primary_color', sa.String(length=7), nullable=True, server_default='#3B82F6'))
    op.add_column('site_settings', sa.Column('theme_accent_color', sa.String(length=7), nullable=True, server_default='#10B981'))
    op.add_column('site_settings', sa.Column('theme_font_family', sa.String(length=50), nullable=True, server_default='Inter'))
    op.add_column('site_settings', sa.Column('theme_mode', sa.String(length=10), nullable=True, server_default='light'))


def downgrade() -> None:
    op.drop_column('site_settings', 'theme_mode')
    op.drop_column('site_settings', 'theme_font_family')
    op.drop_column('site_settings', 'theme_accent_color')
    op.drop_column('site_settings', 'theme_primary_color')
    op.drop_column('site_settings', 'what3words')
