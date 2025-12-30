"""Add invoice tables

Revision ID: add_invoices
Revises: add_fields_companions
Create Date: 2025-12-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_invoices'
down_revision = 'add_fields_companions'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types if they don't exist
    op.execute("DO $$ BEGIN CREATE TYPE invoicestatus AS ENUM ('draft', 'issued', 'paid', 'cancelled', 'overdue'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create invoices table
    op.create_table(
        'invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('invoice_number', sa.String(20), nullable=False),
        sa.Column('period_start', sa.Date(), nullable=False),
        sa.Column('period_end', sa.Date(), nullable=False),
        sa.Column('subtotal', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('payments_received', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('balance_due', sa.Numeric(10, 2), nullable=False, server_default='0'),
        sa.Column('status', sa.Enum('draft', 'issued', 'paid', 'cancelled', 'overdue', name='invoicestatus', create_constraint=False, native_enum=False), nullable=False, server_default='draft'),
        sa.Column('issue_date', sa.Date(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=True),
        sa.Column('paid_date', sa.Date(), nullable=True),
        sa.Column('pdf_filename', sa.String(255), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_invoices_id', 'invoices', ['id'], unique=False)
    op.create_index('ix_invoices_invoice_number', 'invoices', ['invoice_number'], unique=True)
    op.create_index('ix_invoices_user_id', 'invoices', ['user_id'], unique=False)

    # Create invoice_line_items table
    op.create_table(
        'invoice_line_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('ledger_entry_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('quantity', sa.Numeric(10, 2), nullable=False, server_default='1'),
        sa.Column('unit_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('category', sa.String(50), nullable=True),
        sa.Column('item_date_start', sa.Date(), nullable=True),
        sa.Column('item_date_end', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ledger_entry_id'], ['ledger_entries.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_invoice_line_items_id', 'invoice_line_items', ['id'], unique=False)


def downgrade():
    op.drop_index('ix_invoice_line_items_id', table_name='invoice_line_items')
    op.drop_table('invoice_line_items')

    op.drop_index('ix_invoices_user_id', table_name='invoices')
    op.drop_index('ix_invoices_invoice_number', table_name='invoices')
    op.drop_index('ix_invoices_id', table_name='invoices')
    op.drop_table('invoices')

    op.execute('DROP TYPE IF EXISTS invoicestatus')
