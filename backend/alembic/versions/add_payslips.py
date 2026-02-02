"""Add payslips table for PDF document storage

Revision ID: add_payslips
Revises: add_hourly_rate_history
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'add_payslips'
down_revision: Union[str, None] = 'add_hourly_rate_history'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'payslips',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=False),
        sa.Column('document_type', sa.Enum('payslip', 'annual_summary',
                  name='payslipdocumenttype'), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('pdf_filename', sa.String(length=255), nullable=False),
        sa.Column('original_filename', sa.String(length=255), nullable=True),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('uploaded_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id']),
        sa.ForeignKeyConstraint(['uploaded_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('staff_id', 'document_type', 'year', 'month',
                            name='uq_payslip_staff_type_period'),
    )
    op.create_index(op.f('ix_payslips_id'), 'payslips', ['id'], unique=False)
    op.create_index('ix_payslips_staff_year', 'payslips', ['staff_id', 'year'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_payslips_staff_year', table_name='payslips')
    op.drop_index(op.f('ix_payslips_id'), table_name='payslips')
    op.drop_table('payslips')
    op.execute("DROP TYPE IF EXISTS payslipdocumenttype")
