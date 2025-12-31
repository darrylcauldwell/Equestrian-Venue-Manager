"""Merge all migration heads

Revision ID: merge_all_heads
Revises: add_leave_year_config, add_staff_thanks
Create Date: 2025-12-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'merge_all_heads'
down_revision: Union[str, Sequence[str], None] = (
    'add_leave_year_config',
    'add_staff_thanks',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
