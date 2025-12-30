"""add_livery_billing_day

Revision ID: add_livery_billing_day
Revises: 331b1ec59ce5
Create Date: 2025-12-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_livery_billing_day'
down_revision: Union[str, None] = '331b1ec59ce5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add livery_billing_day to site_settings (day of month 1-28, default 1st)
    op.add_column('site_settings', sa.Column('livery_billing_day', sa.Integer(), nullable=True, server_default='1'))


def downgrade() -> None:
    op.drop_column('site_settings', 'livery_billing_day')
