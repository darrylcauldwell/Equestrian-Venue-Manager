"""Add stables table and horse stable assignment

Revision ID: add_stables
Revises: add_arena_image_url
Create Date: 2025-12-17 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_stables'
down_revision: Union[str, None] = 'add_arena_image_url'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create stables table
    op.create_table(
        'stables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stables_id'), 'stables', ['id'], unique=False)

    # Add stable_id to horses table
    op.add_column('horses', sa.Column('stable_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_horses_stable_id', 'horses', 'stables', ['stable_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_horses_stable_id', 'horses', type_='foreignkey')
    op.drop_column('horses', 'stable_id')
    op.drop_index(op.f('ix_stables_id'), table_name='stables')
    op.drop_table('stables')
