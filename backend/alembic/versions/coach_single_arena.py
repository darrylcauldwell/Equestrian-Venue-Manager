"""Change coach_profiles from arena_ids (JSON) to arena_id (single FK)

Revision ID: coach_single_arena
Revises: add_coach_arena_ids
Create Date: 2025-12-18 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'coach_single_arena'
down_revision: Union[str, None] = 'add_coach_arena_ids'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new arena_id column
    op.add_column('coach_profiles', sa.Column('arena_id', sa.Integer(), nullable=True))

    # Add foreign key constraint
    op.create_foreign_key(
        'fk_coach_profiles_arena_id',
        'coach_profiles', 'arenas',
        ['arena_id'], ['id']
    )

    # Add index for performance
    op.create_index('ix_coach_profiles_arena_id', 'coach_profiles', ['arena_id'])

    # Migrate data: if arena_ids JSON has values, take the first one
    # PostgreSQL uses ->> for JSON text extraction and -> for JSON object
    op.execute("""
        UPDATE coach_profiles
        SET arena_id = (arena_ids->>0)::INTEGER
        WHERE arena_ids IS NOT NULL
        AND arena_ids::text != '[]'
        AND arena_ids::text != 'null'
    """)

    # Drop old arena_ids column
    op.drop_column('coach_profiles', 'arena_ids')


def downgrade() -> None:
    # Add back arena_ids column
    op.add_column('coach_profiles', sa.Column('arena_ids', sa.JSON(), nullable=True))

    # Migrate data back: convert arena_id to JSON array (PostgreSQL syntax)
    op.execute("""
        UPDATE coach_profiles
        SET arena_ids = jsonb_build_array(arena_id)
        WHERE arena_id IS NOT NULL
    """)

    # Drop index
    op.drop_index('ix_coach_profiles_arena_id', table_name='coach_profiles')

    # Drop foreign key
    op.drop_constraint('fk_coach_profiles_arena_id', 'coach_profiles', type_='foreignkey')

    # Drop arena_id column
    op.drop_column('coach_profiles', 'arena_id')
