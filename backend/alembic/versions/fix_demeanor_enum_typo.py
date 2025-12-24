"""Fix demeanor enum typo - demeanrostatus to demeanorstatus

Revision ID: fix_demeanor_enum
Revises: add_adhoc_lessons
Create Date: 2025-12-19

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fix_demeanor_enum'
down_revision = 'add_adhoc_lessons'
branch_labels = None
depends_on = None


def upgrade():
    # Create the correctly spelled enum type
    op.execute("DO $$ BEGIN CREATE TYPE demeanorstatus AS ENUM ('bright', 'quiet', 'lethargic', 'agitated'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Update the column to use the correct type (if it exists with wrong type)
    # First check if table exists and has the wrong enum
    op.execute("""
        DO $$
        BEGIN
            -- Check if demeanor column exists and uses wrong type
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'health_observations' AND column_name = 'demeanor'
            ) THEN
                -- Alter the column to use the correct enum type
                ALTER TABLE health_observations
                ALTER COLUMN demeanor TYPE demeanorstatus
                USING demeanor::text::demeanorstatus;
            END IF;
        END $$;
    """)


def downgrade():
    # Revert to the typo'd enum (for consistency with original migration)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'health_observations' AND column_name = 'demeanor'
            ) THEN
                ALTER TABLE health_observations
                ALTER COLUMN demeanor TYPE demeanrostatus
                USING demeanor::text::demeanrostatus;
            END IF;
        END $$;
    """)
    op.execute('DROP TYPE IF EXISTS demeanorstatus')
