"""add_livery_billing_fields

Revision ID: 331b1ec59ce5
Revises: add_ledger_entries
Create Date: 2025-12-17 20:01:14.829088

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '331b1ec59ce5'
down_revision: Union[str, None] = 'add_ledger_entries'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add monthly_price to livery_packages for billing calculations
    op.add_column('livery_packages', sa.Column('monthly_price', sa.Numeric(precision=10, scale=2), nullable=True))

    # Add livery package assignment fields to horses (not users - each horse has its own package)
    op.add_column('horses', sa.Column('livery_package_id', sa.Integer(), nullable=True))
    op.add_column('horses', sa.Column('livery_start_date', sa.Date(), nullable=True))
    op.add_column('horses', sa.Column('livery_end_date', sa.Date(), nullable=True))
    op.create_foreign_key('fk_horses_livery_package', 'horses', 'livery_packages', ['livery_package_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_horses_livery_package', 'horses', type_='foreignkey')
    op.drop_column('horses', 'livery_end_date')
    op.drop_column('horses', 'livery_start_date')
    op.drop_column('horses', 'livery_package_id')
    op.drop_column('livery_packages', 'monthly_price')
