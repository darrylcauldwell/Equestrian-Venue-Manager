"""Add hourly rate history table for tracking wage changes over time

Revision ID: add_hourly_rate_history
Revises: add_feed_notifications
Create Date: 2026-01-04

"""
from typing import Sequence, Union
from datetime import date

from alembic import op
import sqlalchemy as sa


revision: str = 'add_hourly_rate_history'
down_revision: Union[str, None] = 'add_feed_notifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the hourly_rate_history table
    op.create_table(
        'hourly_rate_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('staff_id', sa.Integer(), nullable=False),
        sa.Column('hourly_rate', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('effective_date', sa.Date(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['staff_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_hourly_rate_history_id'), 'hourly_rate_history', ['id'], unique=False)
    op.create_index('ix_hourly_rate_history_staff_date', 'hourly_rate_history', ['staff_id', 'effective_date'], unique=False)

    # Seed existing hourly rates into the history table
    # Get admin user id for created_by (use first admin user found)
    conn = op.get_bind()

    # Find an admin user to use as created_by
    admin_result = conn.execute(sa.text(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    ))
    admin_row = admin_result.fetchone()

    if admin_row:
        admin_id = admin_row[0]
        today = date.today().isoformat()

        # Get all staff profiles with hourly rates and insert into history
        profiles_result = conn.execute(sa.text(
            "SELECT user_id, hourly_rate FROM staff_profiles WHERE hourly_rate IS NOT NULL"
        ))

        for row in profiles_result:
            conn.execute(sa.text(
                """
                INSERT INTO hourly_rate_history (staff_id, hourly_rate, effective_date, notes, created_by_id, created_at)
                VALUES (:staff_id, :hourly_rate, :effective_date, :notes, :created_by_id, NOW())
                """
            ), {
                'staff_id': row[0],
                'hourly_rate': float(row[1]),
                'effective_date': today,
                'notes': 'Initial rate (migrated from existing data)',
                'created_by_id': admin_id
            })


def downgrade() -> None:
    op.drop_index('ix_hourly_rate_history_staff_date', table_name='hourly_rate_history')
    op.drop_index(op.f('ix_hourly_rate_history_id'), table_name='hourly_rate_history')
    op.drop_table('hourly_rate_history')
