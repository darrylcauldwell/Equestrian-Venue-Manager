"""add weight bodycondition saddlefit records

Revision ID: 4a2b3c4d5e6f
Revises: d1c0e1d7670b
Create Date: 2025-12-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4a2b3c4d5e6f'
down_revision: Union[str, None] = 'd1c0e1d7670b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create weight_records table
    op.create_table('weight_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('record_date', sa.Date(), nullable=False),
        sa.Column('weight_kg', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('unit_entered', sa.String(length=10), nullable=True),
        sa.Column('method', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_weight_records_id'), 'weight_records', ['id'], unique=False)

    # Create body_condition_records table
    op.create_table('body_condition_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('record_date', sa.Date(), nullable=False),
        sa.Column('score', sa.Integer(), nullable=False),
        sa.Column('assessed_by', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_body_condition_records_id'), 'body_condition_records', ['id'], unique=False)

    # Create saddle_fit_records table
    op.create_table('saddle_fit_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('check_date', sa.Date(), nullable=False),
        sa.Column('fitter_name', sa.String(length=100), nullable=True),
        sa.Column('saddle_type', sa.String(length=100), nullable=True),
        sa.Column('fit_status', sa.String(length=50), nullable=False),
        sa.Column('adjustments_made', sa.Text(), nullable=True),
        sa.Column('next_check_due', sa.Date(), nullable=True),
        sa.Column('cost', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_saddle_fit_records_id'), 'saddle_fit_records', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_saddle_fit_records_id'), table_name='saddle_fit_records')
    op.drop_table('saddle_fit_records')
    op.drop_index(op.f('ix_body_condition_records_id'), table_name='body_condition_records')
    op.drop_table('body_condition_records')
    op.drop_index(op.f('ix_weight_records_id'), table_name='weight_records')
    op.drop_table('weight_records')
