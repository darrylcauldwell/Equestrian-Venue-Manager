"""Add holiday_livery_requests table for public holiday livery booking requests

Revision ID: add_holiday_livery_requests
Revises: add_feed_supply_columns
Create Date: 2025-12-23

"""
from alembic import op
import sqlalchemy as sa


revision = 'add_holiday_livery_requests'
down_revision = 'add_feed_supply_columns'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create holidayliverystatus enum
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'holidayliverystatus') THEN
                CREATE TYPE holidayliverystatus AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
            END IF;
        END $$;
    """)

    # Create holiday_livery_requests table
    op.execute("""
        CREATE TABLE IF NOT EXISTS holiday_livery_requests (
            id SERIAL PRIMARY KEY,
            guest_name VARCHAR(100) NOT NULL,
            guest_email VARCHAR(255) NOT NULL,
            guest_phone VARCHAR(50),
            horse_name VARCHAR(100) NOT NULL,
            horse_breed VARCHAR(100),
            horse_age INTEGER,
            horse_colour VARCHAR(50),
            horse_gender VARCHAR(20),
            special_requirements TEXT,
            requested_arrival DATE NOT NULL,
            requested_departure DATE NOT NULL,
            message TEXT,
            status holidayliverystatus NOT NULL DEFAULT 'pending',
            admin_notes TEXT,
            rejection_reason TEXT,
            confirmed_arrival DATE,
            confirmed_departure DATE,
            assigned_stable_id INTEGER REFERENCES stables(id),
            created_user_id INTEGER REFERENCES users(id),
            created_horse_id INTEGER REFERENCES horses(id),
            processed_by_id INTEGER REFERENCES users(id),
            processed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes
    op.execute("CREATE INDEX IF NOT EXISTS ix_holiday_livery_requests_id ON holiday_livery_requests(id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_holiday_livery_requests_guest_email ON holiday_livery_requests(guest_email)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_holiday_livery_requests_status ON holiday_livery_requests(status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS holiday_livery_requests")
    op.execute("DROP TYPE IF EXISTS holidayliverystatus")
