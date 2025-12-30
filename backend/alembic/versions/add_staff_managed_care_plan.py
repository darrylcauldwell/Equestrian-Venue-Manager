"""Add staff_managed and weekly_care_price to rehab_programs

Revision ID: add_staff_managed_care_plan
Revises: add_feed_based_rehab_tasks
Create Date: 2025-12-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_staff_managed_care_plan'
down_revision: Union[str, None] = 'add_feed_based_rehab_tasks'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add staff_managed column - when True, all tasks are handled by staff
    op.add_column('rehab_programs', sa.Column('staff_managed', sa.Boolean(), nullable=False, server_default='false'))

    # Add weekly_care_price column - weekly supplement charged for staff-managed care
    op.add_column('rehab_programs', sa.Column('weekly_care_price', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('rehab_programs', 'weekly_care_price')
    op.drop_column('rehab_programs', 'staff_managed')
