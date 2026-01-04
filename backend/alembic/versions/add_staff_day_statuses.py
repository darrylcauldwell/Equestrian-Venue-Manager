"""Add staff_day_statuses table for unavailable/absent tracking

Revision ID: add_staff_day_statuses
Revises: add_rota_display_order
Create Date: 2026-01-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'add_staff_day_statuses'
down_revision: Union[str, None] = 'add_rota_display_order'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Define the enum type
daystatustype = postgresql.ENUM('unavailable', 'absent', name='daystatustype', create_type=False)


def upgrade() -> None:
    # Create enum type for day status (if not exists)
    op.execute("DO $$ BEGIN CREATE TYPE daystatustype AS ENUM ('unavailable', 'absent'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Check if table already exists before creating
    conn = op.get_bind()
    result = conn.execute(sa.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'staff_day_statuses')"))
    table_exists = result.scalar()

    if not table_exists:
        # Create the staff_day_statuses table
        op.create_table(
            'staff_day_statuses',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('staff_id', sa.Integer(), nullable=False),
            sa.Column('date', sa.Date(), nullable=False),
            sa.Column('status_type', daystatustype, nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['staff_id'], ['users.id'], ),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_staff_day_statuses_id'), 'staff_day_statuses', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_staff_day_statuses_id'), table_name='staff_day_statuses')
    op.drop_table('staff_day_statuses')
    op.execute("DROP TYPE IF EXISTS daystatustype")
