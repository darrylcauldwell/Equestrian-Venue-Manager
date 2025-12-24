"""Add venue coordinates for weather

Revision ID: add_venue_coordinates
Revises: add_clinic_proposed_by
Create Date: 2025-12-16 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_venue_coordinates'
down_revision: Union[str, None] = 'add_clinic_proposed_by'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('site_settings', sa.Column('venue_latitude', sa.Numeric(10, 6), nullable=True))
    op.add_column('site_settings', sa.Column('venue_longitude', sa.Numeric(10, 6), nullable=True))


def downgrade() -> None:
    op.drop_column('site_settings', 'venue_longitude')
    op.drop_column('site_settings', 'venue_latitude')
