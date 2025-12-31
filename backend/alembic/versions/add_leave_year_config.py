"""Add leave year configuration and leaving date

Revision ID: add_leave_year_config
Revises: add_payroll_features
Create Date: 2025-12-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_leave_year_config'
down_revision: Union[str, None] = 'add_payroll_features'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add leave_year_start_month to site_settings
    op.add_column('site_settings', sa.Column('leave_year_start_month', sa.Integer(), nullable=True, server_default='1'))

    # Add leaving_date to users table
    op.add_column('users', sa.Column('leaving_date', sa.Date(), nullable=True))

    # Update default for annual_leave_entitlement from 28 to 23
    # Note: This only affects new records, not existing ones
    op.alter_column('users', 'annual_leave_entitlement',
                    server_default='23')


def downgrade() -> None:
    op.drop_column('users', 'leaving_date')
    op.drop_column('site_settings', 'leave_year_start_month')
    op.alter_column('users', 'annual_leave_entitlement',
                    server_default='28')
