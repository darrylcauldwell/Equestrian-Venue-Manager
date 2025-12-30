"""Add turnout_cutoff_date to site_settings

Revision ID: add_turnout_cutoff
Revises: 3ef34aa9185f
Create Date: 2024-12-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_turnout_cutoff'
down_revision: Union[str, None] = '3ef34aa9185f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add turnout_cutoff_date column to site_settings
    op.add_column('site_settings', sa.Column('turnout_cutoff_date', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('site_settings', 'turnout_cutoff_date')
