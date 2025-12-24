"""Extend arena properties

Revision ID: extend_arena_properties
Revises: add_coach_role
Create Date: 2025-12-16 16:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'extend_arena_properties'
down_revision: Union[str, None] = 'add_coach_role'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to arenas table
    op.add_column('arenas', sa.Column('size', sa.String(50), nullable=True))
    op.add_column('arenas', sa.Column('surface_type', sa.String(50), nullable=True))
    op.add_column('arenas', sa.Column('price_per_hour', sa.Numeric(10, 2), nullable=True))
    op.add_column('arenas', sa.Column('has_lights', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('arenas', sa.Column('jumps_type', sa.String(50), nullable=True))
    op.add_column('arenas', sa.Column('free_for_livery', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('arenas', 'free_for_livery')
    op.drop_column('arenas', 'jumps_type')
    op.drop_column('arenas', 'has_lights')
    op.drop_column('arenas', 'price_per_hour')
    op.drop_column('arenas', 'surface_type')
    op.drop_column('arenas', 'size')
