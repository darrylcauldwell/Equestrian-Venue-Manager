"""Add rota_display_order column to users table

Revision ID: add_rota_display_order
Revises: add_field_assignments_sheep
Create Date: 2026-01-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_rota_display_order'
down_revision: Union[str, None] = 'add_field_assignments_sheep'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('rota_display_order', sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'rota_display_order')
