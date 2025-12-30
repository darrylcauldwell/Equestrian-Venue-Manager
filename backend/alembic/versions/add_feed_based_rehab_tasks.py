"""add feed based rehab tasks

Revision ID: add_feed_based_rehab_tasks
Revises: add_rehab_clinical_fields
Create Date: 2025-12-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_feed_based_rehab_tasks'
down_revision: Union[str, None] = 'add_rehab_clinical_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_feed_based and feed_time to rehab_tasks
    op.add_column('rehab_tasks', sa.Column('is_feed_based', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('rehab_tasks', sa.Column('feed_time', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('rehab_tasks', 'feed_time')
    op.drop_column('rehab_tasks', 'is_feed_based')
