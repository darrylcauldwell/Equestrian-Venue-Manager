"""Add rugging guide settings

Revision ID: add_rugging_guide
Revises: drop_facilities_table
Create Date: 2025-12-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_rugging_guide'
down_revision: Union[str, None] = 'drop_facilities_table'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('site_settings', sa.Column('rugging_guide', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('site_settings', 'rugging_guide')
