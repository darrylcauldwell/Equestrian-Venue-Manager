"""Add payroll features - hourly rate and adjustments

Revision ID: add_payroll_features
Revises: 075212831772
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_payroll_features'
down_revision: Union[str, None] = '075212831772'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add hourly_rate to staff_profiles
    op.add_column('staff_profiles', sa.Column('hourly_rate', sa.Numeric(10, 2), nullable=True))

    # Create payroll_adjustments table
    # sa.Enum will automatically create the payrolladjustmenttype enum in PostgreSQL
    op.create_table(
        'payroll_adjustments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=False),
        sa.Column('adjustment_type', sa.Enum('bonus', 'adhoc', 'tip', name='payrolladjustmenttype'), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('description', sa.String(255), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False),
        sa.Column('taxable', sa.Boolean(), server_default='true', nullable=False),  # Tips are tax-free
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),  # Null for tips from livery
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payroll_adjustments_id'), 'payroll_adjustments', ['id'], unique=False)
    op.create_index(op.f('ix_payroll_adjustments_staff_id'), 'payroll_adjustments', ['staff_id'], unique=False)
    op.create_index(op.f('ix_payroll_adjustments_payment_date'), 'payroll_adjustments', ['payment_date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_payroll_adjustments_payment_date'), table_name='payroll_adjustments')
    op.drop_index(op.f('ix_payroll_adjustments_staff_id'), table_name='payroll_adjustments')
    op.drop_index(op.f('ix_payroll_adjustments_id'), table_name='payroll_adjustments')
    op.drop_table('payroll_adjustments')
    op.execute("DROP TYPE payrolladjustmenttype")
    op.drop_column('staff_profiles', 'hourly_rate')
