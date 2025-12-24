"""Add ledger_entries table for account billing

Revision ID: add_ledger_entries
Revises: add_turnout_requests
Create Date: 2024-12-17 20:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_ledger_entries'
down_revision = 'add_turnout_requests'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'ledger_entries',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('transaction_type', sa.Enum('package_charge', 'service_charge', 'payment', 'credit', 'adjustment', name='transactiontype'), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('service_request_id', sa.Integer(), nullable=True),
        sa.Column('livery_package_id', sa.Integer(), nullable=True),
        sa.Column('period_start', sa.DateTime(), nullable=True),
        sa.Column('period_end', sa.DateTime(), nullable=True),
        sa.Column('transaction_date', sa.DateTime(), nullable=False),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['service_request_id'], ['service_requests.id'], ),
        sa.ForeignKeyConstraint(['livery_package_id'], ['livery_packages.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ledger_entries_id'), 'ledger_entries', ['id'], unique=False)
    op.create_index('ix_ledger_entries_user_id', 'ledger_entries', ['user_id'], unique=False)
    op.create_index('ix_ledger_entries_transaction_date', 'ledger_entries', ['transaction_date'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_ledger_entries_transaction_date', table_name='ledger_entries')
    op.drop_index('ix_ledger_entries_user_id', table_name='ledger_entries')
    op.drop_index(op.f('ix_ledger_entries_id'), table_name='ledger_entries')
    op.drop_table('ledger_entries')
    op.execute("DROP TYPE IF EXISTS transactiontype")
