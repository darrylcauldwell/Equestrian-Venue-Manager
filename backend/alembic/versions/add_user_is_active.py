"""Add is_active field to users

Revision ID: add_user_is_active
Revises: extend_professional_categories
Create Date: 2024-12-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_user_is_active'
down_revision: Union[str, None] = 'extend_professional_categories'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    op.drop_column('users', 'is_active')
