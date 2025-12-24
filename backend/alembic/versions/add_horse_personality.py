"""Add horse personality traits

Revision ID: add_horse_personality
Revises: add_compliance_tables
Create Date: 2025-12-17 19:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_horse_personality'
down_revision: Union[str, None] = 'add_compliance_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add passport_name field
    op.add_column('horses', sa.Column('passport_name', sa.String(length=200), nullable=True))

    # Personality traits - Farrier
    op.add_column('horses', sa.Column('farrier_friendly', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('horses', sa.Column('farrier_notes', sa.String(length=500), nullable=True))

    # Personality traits - Dentist
    op.add_column('horses', sa.Column('dentist_friendly', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('horses', sa.Column('needs_sedation_dentist', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('horses', sa.Column('dentist_notes', sa.String(length=500), nullable=True))

    # Personality traits - Clipping
    op.add_column('horses', sa.Column('clipping_friendly', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('horses', sa.Column('needs_sedation_clipping', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('horses', sa.Column('clipping_notes', sa.String(length=500), nullable=True))

    # Personality traits - General handling
    op.add_column('horses', sa.Column('kicks', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('horses', sa.Column('bites', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('horses', sa.Column('handling_notes', sa.String(length=500), nullable=True))

    # Personality traits - Loading
    op.add_column('horses', sa.Column('loads_well', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('horses', sa.Column('loading_notes', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('horses', 'loading_notes')
    op.drop_column('horses', 'loads_well')
    op.drop_column('horses', 'handling_notes')
    op.drop_column('horses', 'bites')
    op.drop_column('horses', 'kicks')
    op.drop_column('horses', 'clipping_notes')
    op.drop_column('horses', 'needs_sedation_clipping')
    op.drop_column('horses', 'clipping_friendly')
    op.drop_column('horses', 'dentist_notes')
    op.drop_column('horses', 'needs_sedation_dentist')
    op.drop_column('horses', 'dentist_friendly')
    op.drop_column('horses', 'farrier_notes')
    op.drop_column('horses', 'farrier_friendly')
    op.drop_column('horses', 'passport_name')
