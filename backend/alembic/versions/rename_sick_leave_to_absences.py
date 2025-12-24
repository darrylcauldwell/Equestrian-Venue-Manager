"""Rename sick_leave to unplanned_absences and add staff leave fields

Revision ID: rename_sick_leave_to_absences
Revises: add_vet_personality_traits
Create Date: 2025-12-17 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'rename_sick_leave_to_absences'
down_revision: Union[str, None] = 'add_vet_personality_traits'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename sick_leave table to unplanned_absences
    op.rename_table('sick_leave', 'unplanned_absences')

    # Add reason column to unplanned_absences (for categorizing: sickness, emergency, no contact, etc.)
    op.add_column('unplanned_absences', sa.Column('reason', sa.String(length=100), nullable=True))

    # Add staff-specific fields to users table
    op.add_column('users', sa.Column('is_yard_staff', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('staff_type', sa.String(length=20), nullable=True))
    op.add_column('users', sa.Column('annual_leave_entitlement', sa.Integer(), nullable=True, server_default='28'))


def downgrade() -> None:
    # Remove staff fields from users
    op.drop_column('users', 'annual_leave_entitlement')
    op.drop_column('users', 'staff_type')
    op.drop_column('users', 'is_yard_staff')

    # Remove reason column from unplanned_absences
    op.drop_column('unplanned_absences', 'reason')

    # Rename unplanned_absences back to sick_leave
    op.rename_table('unplanned_absences', 'sick_leave')
