"""Extend professional categories with saddler and feed_store

Revision ID: extend_professional_categories
Revises: add_venue_coordinates
Create Date: 2024-12-16

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'extend_professional_categories'
down_revision: Union[str, None] = 'add_venue_coordinates'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new values to professionalcategory enum (uppercase to match other enum values)
    op.execute("ALTER TYPE professionalcategory ADD VALUE IF NOT EXISTS 'SADDLER'")
    op.execute("ALTER TYPE professionalcategory ADD VALUE IF NOT EXISTS 'FEED_STORE'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    # Would need to recreate the type and update all references
    pass
