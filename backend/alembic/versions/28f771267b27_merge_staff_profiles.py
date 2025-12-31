"""merge_staff_profiles

Revision ID: 28f771267b27
Revises: a0b1c2d3e4f5, add_staff_profiles
Create Date: 2025-12-30 17:13:23.561019

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '28f771267b27'
down_revision: Union[str, None] = ('a0b1c2d3e4f5', 'add_staff_profiles')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
