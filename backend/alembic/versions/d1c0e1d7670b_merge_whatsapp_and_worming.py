"""merge_whatsapp_and_worming

Revision ID: d1c0e1d7670b
Revises: add_whatsapp_settings, add_worming_cost
Create Date: 2025-12-26 15:56:47.349063

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1c0e1d7670b'
down_revision: Union[str, None] = ('add_whatsapp_settings', 'add_worming_cost')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
