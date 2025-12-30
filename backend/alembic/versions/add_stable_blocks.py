"""Add stable blocks

Revision ID: add_stable_blocks
Revises: add_what3words_theme
Create Date: 2025-12-17 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_stable_blocks'
down_revision: Union[str, None] = 'add_what3words_theme'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create stable_blocks table
    op.create_table(
        'stable_blocks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_stable_blocks_id'), 'stable_blocks', ['id'], unique=False)

    # Add block_id and number columns to stables table
    op.add_column('stables', sa.Column('block_id', sa.Integer(), nullable=True))
    op.add_column('stables', sa.Column('number', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_stables_block_id', 'stables', 'stable_blocks', ['block_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_stables_block_id', 'stables', type_='foreignkey')
    op.drop_column('stables', 'number')
    op.drop_column('stables', 'block_id')
    op.drop_index(op.f('ix_stable_blocks_id'), table_name='stable_blocks')
    op.drop_table('stable_blocks')
