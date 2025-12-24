"""Add detailed timesheet fields

Revision ID: detailed_timesheets
Revises: simplify_shifts
Create Date: 2025-12-16 17:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'detailed_timesheets'
down_revision: Union[str, None] = 'simplify_shifts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create worktype enum
    work_type_enum = sa.Enum('yard_duties', 'yard_maintenance', 'office', 'events', 'other', name='worktype')
    work_type_enum.create(op.get_bind(), checkfirst=True)

    # Add new columns to timesheets table
    op.add_column('timesheets', sa.Column('lunch_start', sa.Time(), nullable=True))
    op.add_column('timesheets', sa.Column('lunch_end', sa.Time(), nullable=True))
    op.add_column('timesheets', sa.Column('work_type', work_type_enum, nullable=False, server_default='yard_duties'))


def downgrade() -> None:
    # Drop new columns
    op.drop_column('timesheets', 'work_type')
    op.drop_column('timesheets', 'lunch_end')
    op.drop_column('timesheets', 'lunch_start')

    # Drop the enum type
    sa.Enum(name='worktype').drop(op.get_bind(), checkfirst=True)
