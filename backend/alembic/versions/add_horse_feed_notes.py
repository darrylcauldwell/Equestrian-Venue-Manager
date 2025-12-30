"""Add feed_notes column to horses table

Revision ID: add_horse_feed_notes
Revises: add_stables
Create Date: 2025-12-17 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_horse_feed_notes'
down_revision: Union[str, None] = 'add_stables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('horses', sa.Column('feed_notes', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('horses', 'feed_notes')
