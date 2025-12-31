"""Add payroll information fields to staff_profiles

Revision ID: add_payroll_info_fields
Revises: add_payroll_features
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_payroll_info_fields'
down_revision: Union[str, None] = 'add_payroll_features'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add payroll information fields (mandatory for accountant)
    op.add_column('staff_profiles', sa.Column('national_insurance_number', sa.String(13), nullable=True))
    op.add_column('staff_profiles', sa.Column('bank_account_number', sa.String(8), nullable=True))
    op.add_column('staff_profiles', sa.Column('bank_sort_code', sa.String(8), nullable=True))
    op.add_column('staff_profiles', sa.Column('bank_account_name', sa.String(100), nullable=True))

    # Add tax information fields (optional)
    op.add_column('staff_profiles', sa.Column('tax_code', sa.String(10), nullable=True))
    op.add_column('staff_profiles', sa.Column('student_loan_plan', sa.String(20), nullable=True))

    # Add P45 fields from previous employer (optional)
    op.add_column('staff_profiles', sa.Column('p45_date_left_previous', sa.Date(), nullable=True))
    op.add_column('staff_profiles', sa.Column('p45_tax_paid_previous', sa.Numeric(10, 2), nullable=True))
    op.add_column('staff_profiles', sa.Column('p45_pay_to_date_previous', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('staff_profiles', 'p45_pay_to_date_previous')
    op.drop_column('staff_profiles', 'p45_tax_paid_previous')
    op.drop_column('staff_profiles', 'p45_date_left_previous')
    op.drop_column('staff_profiles', 'student_loan_plan')
    op.drop_column('staff_profiles', 'tax_code')
    op.drop_column('staff_profiles', 'bank_account_name')
    op.drop_column('staff_profiles', 'bank_sort_code')
    op.drop_column('staff_profiles', 'bank_account_number')
    op.drop_column('staff_profiles', 'national_insurance_number')
