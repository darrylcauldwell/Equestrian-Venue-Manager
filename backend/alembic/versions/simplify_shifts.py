"""Simplify shifts to morning/afternoon/full_day

Revision ID: simplify_shifts
Revises: extend_arena_properties
Create Date: 2025-12-16 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'simplify_shifts'
down_revision: Union[str, None] = 'extend_arena_properties'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create shifttype enum
    shift_type_enum = sa.Enum('morning', 'afternoon', 'full_day', name='shifttype')
    shift_type_enum.create(op.get_bind(), checkfirst=True)

    # Add shift_type column with default
    op.add_column('shifts', sa.Column('shift_type', shift_type_enum, nullable=False, server_default='full_day'))

    # Drop old time columns
    op.drop_column('shifts', 'start_time')
    op.drop_column('shifts', 'end_time')


def downgrade() -> None:
    # Add back time columns
    op.add_column('shifts', sa.Column('start_time', sa.Time(), nullable=True))
    op.add_column('shifts', sa.Column('end_time', sa.Time(), nullable=True))

    # Drop shift_type column
    op.drop_column('shifts', 'shift_type')

    # Drop the enum type
    sa.Enum(name='shifttype').drop(op.get_bind(), checkfirst=True)
