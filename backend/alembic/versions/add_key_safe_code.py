"""Add key_safe_code to site_settings

Revision ID: add_key_safe_code
Revises: add_structured_address
Create Date: 2025-12-17 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_key_safe_code'
down_revision: Union[str, None] = 'add_structured_address'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('site_settings', sa.Column('key_safe_code', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('site_settings', 'key_safe_code')
