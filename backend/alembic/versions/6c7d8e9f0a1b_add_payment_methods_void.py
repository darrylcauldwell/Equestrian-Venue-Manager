"""Add payment method tracking and void functionality to ledger entries

Revision ID: 6c7d8e9f0a1b
Revises: 5b6c7d8e9f0a
Create Date: 2025-12-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '6c7d8e9f0a1b'
down_revision = '5b6c7d8e9f0a'
branch_labels = None
depends_on = None


def upgrade():
    # Create payment_method enum type with lowercase values
    op.execute("""
        CREATE TYPE paymentmethod AS ENUM (
            'cash', 'bank_transfer', 'card', 'cheque', 'direct_debit', 'other'
        )
    """)

    # Add payment tracking columns
    op.add_column('ledger_entries', sa.Column('payment_method', sa.Enum(
        'cash', 'bank_transfer', 'card', 'cheque', 'direct_debit', 'other',
        name='paymentmethod'
    ), nullable=True))
    op.add_column('ledger_entries', sa.Column('payment_reference', sa.String(100), nullable=True))
    op.add_column('ledger_entries', sa.Column('receipt_number', sa.String(20), nullable=True))

    # Add void tracking columns
    op.add_column('ledger_entries', sa.Column('voided', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('ledger_entries', sa.Column('voided_at', sa.DateTime(), nullable=True))
    op.add_column('ledger_entries', sa.Column('voided_by_id', sa.Integer(), nullable=True))
    op.add_column('ledger_entries', sa.Column('void_reason', sa.Text(), nullable=True))
    op.add_column('ledger_entries', sa.Column('original_entry_id', sa.Integer(), nullable=True))

    # Add foreign key constraints
    op.create_foreign_key(
        'fk_ledger_entries_voided_by',
        'ledger_entries', 'users',
        ['voided_by_id'], ['id']
    )
    op.create_foreign_key(
        'fk_ledger_entries_original_entry',
        'ledger_entries', 'ledger_entries',
        ['original_entry_id'], ['id']
    )

    # Add unique constraint for receipt_number
    op.create_unique_constraint('uq_ledger_entries_receipt_number', 'ledger_entries', ['receipt_number'])

    # Add indexes for common queries
    op.create_index('ix_ledger_entries_voided', 'ledger_entries', ['voided'])
    op.create_index('ix_ledger_entries_payment_method', 'ledger_entries', ['payment_method'])
    op.create_index('ix_ledger_entries_receipt_number', 'ledger_entries', ['receipt_number'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_ledger_entries_receipt_number', 'ledger_entries')
    op.drop_index('ix_ledger_entries_payment_method', 'ledger_entries')
    op.drop_index('ix_ledger_entries_voided', 'ledger_entries')

    # Drop unique constraint
    op.drop_constraint('uq_ledger_entries_receipt_number', 'ledger_entries', type_='unique')

    # Drop foreign keys
    op.drop_constraint('fk_ledger_entries_original_entry', 'ledger_entries', type_='foreignkey')
    op.drop_constraint('fk_ledger_entries_voided_by', 'ledger_entries', type_='foreignkey')

    # Drop columns
    op.drop_column('ledger_entries', 'original_entry_id')
    op.drop_column('ledger_entries', 'void_reason')
    op.drop_column('ledger_entries', 'voided_by_id')
    op.drop_column('ledger_entries', 'voided_at')
    op.drop_column('ledger_entries', 'voided')
    op.drop_column('ledger_entries', 'receipt_number')
    op.drop_column('ledger_entries', 'payment_reference')
    op.drop_column('ledger_entries', 'payment_method')

    # Drop enum type
    op.execute('DROP TYPE paymentmethod')
