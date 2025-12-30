"""merge_heads

Revision ID: 0e7bc295424e
Revises: add_health_task_fields, a8c3f5d92b71, coach_single_arena
Create Date: 2025-12-19 13:31:21.947926

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0e7bc295424e'
down_revision: Union[str, None] = ('add_health_task_fields', 'a8c3f5d92b71', 'coach_single_arena')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
