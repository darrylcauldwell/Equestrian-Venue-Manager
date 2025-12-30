"""Add vet-related horse personality traits

Revision ID: add_vet_personality_traits
Revises: add_staff_role
Create Date: 2025-12-17 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_vet_personality_traits'
down_revision: Union[str, None] = 'add_staff_role'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Personality traits - Catching
    op.add_column('horses', sa.Column('difficult_to_catch', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('horses', sa.Column('catching_notes', sa.String(length=500), nullable=True))

    # Personality traits - Vet
    op.add_column('horses', sa.Column('vet_friendly', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('horses', sa.Column('needle_shy', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('horses', sa.Column('vet_notes', sa.String(length=500), nullable=True))

    # Personality traits - Tying
    op.add_column('horses', sa.Column('can_be_tied', sa.Boolean(), nullable=False, server_default='1'))
    op.add_column('horses', sa.Column('tying_notes', sa.String(length=500), nullable=True))

    # Personality traits - Sedation risk
    op.add_column('horses', sa.Column('has_sedation_risk', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('horses', sa.Column('sedation_notes', sa.String(length=500), nullable=True))

    # Personality traits - Headshyness
    op.add_column('horses', sa.Column('headshy', sa.Boolean(), nullable=False, server_default='0'))
    op.add_column('horses', sa.Column('headshy_notes', sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column('horses', 'headshy_notes')
    op.drop_column('horses', 'headshy')
    op.drop_column('horses', 'sedation_notes')
    op.drop_column('horses', 'has_sedation_risk')
    op.drop_column('horses', 'tying_notes')
    op.drop_column('horses', 'can_be_tied')
    op.drop_column('horses', 'vet_notes')
    op.drop_column('horses', 'needle_shy')
    op.drop_column('horses', 'vet_friendly')
    op.drop_column('horses', 'catching_notes')
    op.drop_column('horses', 'difficult_to_catch')
