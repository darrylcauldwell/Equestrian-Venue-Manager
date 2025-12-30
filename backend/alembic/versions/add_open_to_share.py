"""Add open_to_share to bookings

Revision ID: add_open_to_share
Revises: add_image_urls
Create Date: 2025-12-16 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_open_to_share'
down_revision: Union[str, None] = 'add_image_urls'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('bookings', sa.Column('open_to_share', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('bookings', 'open_to_share')
