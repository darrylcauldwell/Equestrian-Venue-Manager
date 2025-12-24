"""Add 'extended' value to leavetype enum

Revision ID: add_extended_leavetype
Revises: add_holiday_livery_requests
Create Date: 2025-12-23

"""
from alembic import op


revision = 'add_extended_leavetype'
down_revision = 'add_holiday_livery_requests'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'extended' to leavetype enum if not exists
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_enum
                WHERE enumlabel = 'extended'
                AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'leavetype')
            ) THEN
                ALTER TYPE leavetype ADD VALUE 'extended';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    pass
