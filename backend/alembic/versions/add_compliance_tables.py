"""Add compliance tables

Revision ID: add_compliance_tables
Revises: add_stable_blocks
Create Date: 2025-12-17 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_compliance_tables'
down_revision: Union[str, None] = 'add_stable_blocks'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create compliance_items table
    op.create_table(
        'compliance_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('reference_number', sa.String(length=100), nullable=True),
        sa.Column('provider', sa.String(length=200), nullable=True),
        sa.Column('renewal_frequency_months', sa.Integer(), nullable=False, server_default='12'),
        sa.Column('last_completed_date', sa.DateTime(), nullable=True),
        sa.Column('next_due_date', sa.DateTime(), nullable=True),
        sa.Column('reminder_days_before', sa.Integer(), nullable=True, server_default='30'),
        sa.Column('responsible_user_id', sa.Integer(), nullable=True),
        sa.Column('certificate_url', sa.String(length=500), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['responsible_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_compliance_items_id'), 'compliance_items', ['id'], unique=False)

    # Create compliance_history table
    op.create_table(
        'compliance_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('compliance_item_id', sa.Integer(), nullable=False),
        sa.Column('completed_date', sa.DateTime(), nullable=False),
        sa.Column('completed_by_id', sa.Integer(), nullable=True),
        sa.Column('certificate_url', sa.String(length=500), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cost', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['compliance_item_id'], ['compliance_items.id'], ),
        sa.ForeignKeyConstraint(['completed_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_compliance_history_id'), 'compliance_history', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_compliance_history_id'), table_name='compliance_history')
    op.drop_table('compliance_history')
    op.drop_index(op.f('ix_compliance_items_id'), table_name='compliance_items')
    op.drop_table('compliance_items')
