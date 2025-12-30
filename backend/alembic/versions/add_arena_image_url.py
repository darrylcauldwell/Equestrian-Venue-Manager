"""Add image_url to arenas

Revision ID: add_arena_image_url
Revises: rename_member_livery
Create Date: 2025-12-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_arena_image_url'
down_revision: Union[str, None] = 'rename_member_livery'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('arenas', sa.Column('image_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('arenas', 'image_url')
