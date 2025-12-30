"""Add cost column to worming_records table

Revision ID: add_worming_cost
Revises:
Create Date: 2025-12-26
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'add_worming_cost'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add cost column to worming_records
    op.add_column('worming_records', sa.Column('cost', sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column('worming_records', 'cost')
