"""add_demo_data_enabled

Revision ID: 3a15b9283b1d
Revises: 0e7bc295424e
Create Date: 2025-12-19

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a15b9283b1d'
down_revision: Union[str, None] = '0e7bc295424e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('site_settings', sa.Column('demo_data_enabled', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    op.drop_column('site_settings', 'demo_data_enabled')
