"""Add supply_status and supply_notes columns to feed_requirements

Revision ID: add_feed_supply_columns
Revises: fix_billingtype_enum
Create Date: 2025-12-23

"""
from alembic import op
import sqlalchemy as sa


revision = 'add_feed_supply_columns'
down_revision = 'fix_billingtype_enum'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create supplystatus enum if not exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'supplystatus') THEN
                CREATE TYPE supplystatus AS ENUM ('adequate', 'low', 'critical');
            END IF;
        END $$;
    """)

    # Add supply_status column if not exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'feed_requirements' AND column_name = 'supply_status'
            ) THEN
                ALTER TABLE feed_requirements ADD COLUMN supply_status supplystatus DEFAULT 'adequate' NOT NULL;
            END IF;
        END $$;
    """)

    # Add supply_notes column if not exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'feed_requirements' AND column_name = 'supply_notes'
            ) THEN
                ALTER TABLE feed_requirements ADD COLUMN supply_notes TEXT;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE feed_requirements DROP COLUMN IF EXISTS supply_notes")
    op.execute("ALTER TABLE feed_requirements DROP COLUMN IF EXISTS supply_status")
