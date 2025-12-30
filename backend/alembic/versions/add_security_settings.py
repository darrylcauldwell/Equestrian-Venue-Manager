"""Add security settings fields

Revision ID: add_security_settings
Revises: add_horse_feed_notes
Create Date: 2025-12-17 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_security_settings'
down_revision: Union[str, None] = 'add_horse_feed_notes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('site_settings', sa.Column('gate_code', sa.String(length=50), nullable=True))
    op.add_column('site_settings', sa.Column('security_info', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('site_settings', 'security_info')
    op.drop_column('site_settings', 'gate_code')
