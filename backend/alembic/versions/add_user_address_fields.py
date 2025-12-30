"""Add address fields to users table

Revision ID: add_user_address_fields
Revises: convert_booking_status_to_enum
Create Date: 2025-12-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_user_address_fields'
down_revision: Union[str, None] = 'convert_booking_status_to_enum'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('address_street', sa.String(200), nullable=True))
    op.add_column('users', sa.Column('address_town', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('address_county', sa.String(100), nullable=True))
    op.add_column('users', sa.Column('address_postcode', sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'address_postcode')
    op.drop_column('users', 'address_county')
    op.drop_column('users', 'address_town')
    op.drop_column('users', 'address_street')
