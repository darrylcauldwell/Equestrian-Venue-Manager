"""Add scheduler configuration columns to site_settings

Revision ID: add_scheduler_columns
Revises: merge_turnout_careplans
Create Date: 2024-12-24

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_scheduler_columns'
down_revision: Union[str, None] = 'merge_turnout_careplans'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add all scheduler configuration columns to site_settings
    op.add_column('site_settings', sa.Column('scheduler_health_tasks_hour', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('site_settings', sa.Column('scheduler_health_tasks_minute', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('site_settings', sa.Column('scheduler_rollover_hour', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('site_settings', sa.Column('scheduler_rollover_minute', sa.Integer(), nullable=True, server_default='5'))
    op.add_column('site_settings', sa.Column('scheduler_billing_day', sa.Integer(), nullable=True, server_default='1'))
    op.add_column('site_settings', sa.Column('scheduler_billing_hour', sa.Integer(), nullable=True, server_default='6'))
    op.add_column('site_settings', sa.Column('scheduler_billing_minute', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('site_settings', sa.Column('scheduler_backup_hour', sa.Integer(), nullable=True, server_default='2'))
    op.add_column('site_settings', sa.Column('scheduler_backup_minute', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('site_settings', sa.Column('scheduler_cleanup_hour', sa.Integer(), nullable=True, server_default='2'))
    op.add_column('site_settings', sa.Column('scheduler_cleanup_minute', sa.Integer(), nullable=True, server_default='30'))


def downgrade() -> None:
    op.drop_column('site_settings', 'scheduler_cleanup_minute')
    op.drop_column('site_settings', 'scheduler_cleanup_hour')
    op.drop_column('site_settings', 'scheduler_backup_minute')
    op.drop_column('site_settings', 'scheduler_backup_hour')
    op.drop_column('site_settings', 'scheduler_billing_minute')
    op.drop_column('site_settings', 'scheduler_billing_hour')
    op.drop_column('site_settings', 'scheduler_billing_day')
    op.drop_column('site_settings', 'scheduler_rollover_minute')
    op.drop_column('site_settings', 'scheduler_rollover_hour')
    op.drop_column('site_settings', 'scheduler_health_tasks_minute')
    op.drop_column('site_settings', 'scheduler_health_tasks_hour')
