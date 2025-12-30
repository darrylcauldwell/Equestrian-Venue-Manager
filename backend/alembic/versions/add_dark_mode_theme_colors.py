"""Add dark mode theme color settings

Revision ID: add_dark_mode_colors
Revises: merge_turnout_careplans
Create Date: 2025-12-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_dark_mode_colors'
down_revision: Union[str, None] = 'add_scheduler_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add dark mode theme color fields
    op.add_column('site_settings', sa.Column('theme_primary_color_dark', sa.String(length=7), nullable=True, server_default='#60A5FA'))
    op.add_column('site_settings', sa.Column('theme_accent_color_dark', sa.String(length=7), nullable=True, server_default='#34D399'))


def downgrade() -> None:
    op.drop_column('site_settings', 'theme_accent_color_dark')
    op.drop_column('site_settings', 'theme_primary_color_dark')
