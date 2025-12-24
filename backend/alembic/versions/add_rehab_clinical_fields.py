"""add rehab clinical fields

Revision ID: add_rehab_clinical_fields
Revises: add_dev_mode_setting
Create Date: 2025-12-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_rehab_clinical_fields'
down_revision: Union[str, None] = 'add_dev_mode_setting'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add lameness_score and physical_observations to rehab_task_logs
    op.add_column('rehab_task_logs', sa.Column('lameness_score', sa.Integer(), nullable=True))
    op.add_column('rehab_task_logs', sa.Column('physical_observations', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('rehab_task_logs', 'physical_observations')
    op.drop_column('rehab_task_logs', 'lameness_score')
