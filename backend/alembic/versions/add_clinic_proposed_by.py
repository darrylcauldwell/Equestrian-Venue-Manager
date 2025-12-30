"""Add proposed_by_id to clinic_requests

Revision ID: add_clinic_proposed_by
Revises: add_open_to_share
Create Date: 2025-12-16 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_clinic_proposed_by'
down_revision: Union[str, None] = 'add_open_to_share'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('clinic_requests', sa.Column('proposed_by_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_clinic_requests_proposed_by',
        'clinic_requests', 'users',
        ['proposed_by_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_clinic_requests_proposed_by', 'clinic_requests', type_='foreignkey')
    op.drop_column('clinic_requests', 'proposed_by_id')
