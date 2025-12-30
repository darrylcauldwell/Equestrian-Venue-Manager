"""Merge turnout cutoff and care plan migrations

Revision ID: merge_turnout_careplans
Revises: add_turnout_cutoff, add_staff_managed_care_plan
Create Date: 2024-12-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'merge_turnout_careplans'
down_revision: Union[str, None] = ('add_turnout_cutoff', 'add_staff_managed_care_plan')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
