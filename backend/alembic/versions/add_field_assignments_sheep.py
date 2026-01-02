"""Add horse field assignments and sheep flock management

Revision ID: add_field_assignments_sheep
Revises: payroll_oneoff_type
Create Date: 2026-01-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_field_assignments_sheep'
down_revision: Union[str, None] = 'payroll_oneoff_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add box_rest column to horses table
    op.add_column('horses', sa.Column('box_rest', sa.Boolean(), nullable=False, server_default='false'))

    # Create horse_field_assignments table
    op.create_table('horse_field_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('assigned_by_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_horse_field_assignments_id', 'horse_field_assignments', ['id'])
    op.create_index('ix_horse_field_assignments_horse_id', 'horse_field_assignments', ['horse_id'])
    op.create_index('ix_horse_field_assignments_field_id', 'horse_field_assignments', ['field_id'])

    # Create sheep_flocks table
    op.create_table('sheep_flocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('count', sa.Integer(), nullable=False),
        sa.Column('breed', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sheep_flocks_id', 'sheep_flocks', ['id'])

    # Create sheep_flock_field_assignments table
    op.create_table('sheep_flock_field_assignments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('flock_id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('assigned_by_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['flock_id'], ['sheep_flocks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_sheep_flock_field_assignments_id', 'sheep_flock_field_assignments', ['id'])
    op.create_index('ix_sheep_flock_field_assignments_flock_id', 'sheep_flock_field_assignments', ['flock_id'])
    op.create_index('ix_sheep_flock_field_assignments_field_id', 'sheep_flock_field_assignments', ['field_id'])


def downgrade() -> None:
    op.drop_table('sheep_flock_field_assignments')
    op.drop_table('sheep_flocks')
    op.drop_table('horse_field_assignments')
    op.drop_column('horses', 'box_rest')
