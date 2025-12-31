"""Add staff thanks table for appreciation messages and tips

Revision ID: add_staff_thanks
Revises: add_payroll_features
Create Date: 2025-12-31

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_staff_thanks'
down_revision: Union[str, None] = 'add_payroll_info_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create staff_thanks table
    op.create_table(
        'staff_thanks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('tip_amount', sa.Numeric(10, 2), nullable=True),
        sa.Column('tip_payment_intent_id', sa.String(255), nullable=True),
        sa.Column('tip_paid', sa.Boolean(), default=False, nullable=False),
        sa.Column('read_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_staff_thanks_id'), 'staff_thanks', ['id'], unique=False)
    op.create_index(op.f('ix_staff_thanks_staff_id'), 'staff_thanks', ['staff_id'], unique=False)
    op.create_index(op.f('ix_staff_thanks_sender_id'), 'staff_thanks', ['sender_id'], unique=False)

    # Add thanks_id column to payroll_adjustments to link tips to thanks messages
    op.add_column('payroll_adjustments', sa.Column('thanks_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_payroll_adjustments_thanks_id',
        'payroll_adjustments',
        'staff_thanks',
        ['thanks_id'],
        ['id']
    )


def downgrade() -> None:
    # Remove foreign key and column from payroll_adjustments
    op.drop_constraint('fk_payroll_adjustments_thanks_id', 'payroll_adjustments', type_='foreignkey')
    op.drop_column('payroll_adjustments', 'thanks_id')

    # Drop staff_thanks table
    op.drop_index(op.f('ix_staff_thanks_sender_id'), table_name='staff_thanks')
    op.drop_index(op.f('ix_staff_thanks_staff_id'), table_name='staff_thanks')
    op.drop_index(op.f('ix_staff_thanks_id'), table_name='staff_thanks')
    op.drop_table('staff_thanks')
