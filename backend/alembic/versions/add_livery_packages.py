"""Add livery_packages table

Revision ID: add_livery_packages
Revises: add_security_settings
Create Date: 2025-12-17 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_livery_packages'
down_revision: Union[str, None] = 'add_security_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'livery_packages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('price_display', sa.String(length=50), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('features', sa.Text(), nullable=True),
        sa.Column('additional_note', sa.Text(), nullable=True),
        sa.Column('is_featured', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_livery_packages_id'), 'livery_packages', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_livery_packages_id'), table_name='livery_packages')
    op.drop_table('livery_packages')
