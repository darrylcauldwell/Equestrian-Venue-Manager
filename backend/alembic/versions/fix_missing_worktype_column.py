"""Fix all potentially missing columns after enum CASCADE drops

Revision ID: fix_missing_worktype_column
Revises: add_extended_leavetype
Create Date: 2025-12-23

This migration ensures all columns that might have been dropped by
CASCADE operations during enum fixes are properly recreated.
"""
from alembic import op


revision = 'fix_missing_worktype_column'
down_revision = 'add_extended_leavetype'
branch_labels = None
depends_on = None


def ensure_column(table: str, column: str, col_type: str, default: str = None, nullable: bool = True):
    """Helper to add a column if it doesn't exist."""
    not_null = "" if nullable else "NOT NULL"
    default_clause = f"DEFAULT {default}" if default else ""
    op.execute(f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = '{table}' AND column_name = '{column}'
            ) THEN
                ALTER TABLE {table} ADD COLUMN {column} {col_type} {default_clause} {not_null};
            END IF;
        END $$;
    """)


def ensure_enum(enum_name: str, values: list):
    """Helper to create enum if it doesn't exist."""
    values_str = ", ".join([f"'{v}'" for v in values])
    op.execute(f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}') THEN
                CREATE TYPE {enum_name} AS ENUM ({values_str});
            END IF;
        END $$;
    """)


def add_enum_value_if_missing(enum_name: str, value: str):
    """Add a value to an existing enum if it doesn't exist."""
    op.execute(f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = '{value}'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '{enum_name}')
            ) THEN
                ALTER TYPE {enum_name} ADD VALUE '{value}';
            END IF;
        END $$;
    """)


def upgrade() -> None:
    # ========================================
    # TIMESHEETS TABLE
    # ========================================
    ensure_enum('worktype', ['yard_duties', 'yard_maintenance', 'office', 'events', 'teaching', 'maintenance', 'other'])

    # Add yard_maintenance if enum already exists but missing this value
    add_enum_value_if_missing('worktype', 'yard_maintenance')

    ensure_column('timesheets', 'work_type', 'worktype', "'yard_duties'", nullable=False)
    ensure_column('timesheets', 'lunch_start', 'TIME')
    ensure_column('timesheets', 'lunch_end', 'TIME')
    ensure_column('timesheets', 'logged_by_id', 'INTEGER')

    # Add foreign key if missing
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_timesheets_logged_by_id'
            ) THEN
                ALTER TABLE timesheets ADD CONSTRAINT fk_timesheets_logged_by_id
                FOREIGN KEY (logged_by_id) REFERENCES users(id);
            END IF;
        END $$;
    """)

    # ========================================
    # FEED_SCHEDULES / FEED_REQUIREMENTS TABLE
    # ========================================
    ensure_enum('feedtime', ['morning', 'evening', 'both'])
    ensure_enum('supplystatus', ['adequate', 'low', 'critical'])

    # Check if feed_schedules exists (it's an alias for feed_requirements)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feed_schedules') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'feed_schedules' AND column_name = 'feed_time'
                ) THEN
                    ALTER TABLE feed_schedules ADD COLUMN feed_time feedtime;
                END IF;
            END IF;
        END $$;
    """)

    # ========================================
    # FEED_ADDITIONS TABLE
    # ========================================
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feed_additions') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'feed_additions' AND column_name = 'feed_time'
                ) THEN
                    ALTER TABLE feed_additions ADD COLUMN feed_time feedtime DEFAULT 'both' NOT NULL;
                END IF;
            END IF;
        END $$;
    """)

    # ========================================
    # LESSON_REQUESTS TABLE
    # ========================================
    ensure_enum('discipline', ['dressage', 'show_jumping', 'cross_country', 'eventing', 'flatwork',
                               'polework', 'hacking', 'groundwork', 'lunging', 'natural_horsemanship', 'other'])

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lesson_requests') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'lesson_requests' AND column_name = 'discipline'
                ) THEN
                    ALTER TABLE lesson_requests ADD COLUMN discipline discipline;
                END IF;
            END IF;
        END $$;
    """)

    # ========================================
    # LIVERY_PACKAGES TABLE - billing_type
    # ========================================
    ensure_enum('billingtype', ['monthly', 'weekly'])
    ensure_column('livery_packages', 'billing_type', 'billingtype', "'monthly'", nullable=False)
    ensure_column('livery_packages', 'weekly_price', 'NUMERIC(10, 2)')


def downgrade() -> None:
    pass
