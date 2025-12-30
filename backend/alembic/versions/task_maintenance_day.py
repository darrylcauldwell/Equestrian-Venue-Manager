"""Add maintenance day flag to tasks

Revision ID: task_maintenance_day
Revises: detailed_timesheets
Create Date: 2025-12-16 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'task_maintenance_day'
down_revision: Union[str, None] = 'detailed_timesheets'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_maintenance_day_task column to yard_tasks table
    op.add_column('yard_tasks', sa.Column('is_maintenance_day_task', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('yard_tasks', 'is_maintenance_day_task')
