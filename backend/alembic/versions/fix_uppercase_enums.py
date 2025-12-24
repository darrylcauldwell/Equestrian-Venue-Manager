"""Fix all UPPERCASE enums to use lowercase values

This migration fixes all PostgreSQL enums that were created with UPPERCASE values
to use lowercase values, matching the Python model definitions.

Affected enums:
- userrole: PUBLIC, LIVERY, STAFF, COACH, ADMIN -> public, livery, staff, coach, admin
- bookingtype: PUBLIC, LIVERY, EVENT, MAINTENANCE, TRAINING_CLINIC, LESSON -> lowercase
- bookingstatus: CONFIRMED, PENDING, CANCELLED -> lowercase
- paymentstatus: PENDING, PAID, NOT_REQUIRED -> lowercase
- lessonrequeststatus: PENDING, ACCEPTED, DECLINED, CONFIRMED, CANCELLED, COMPLETED -> lowercase
- availabilitymode: ALWAYS, SCHEDULED_ONLY, RECURRING, SPECIFIC -> lowercase
- bookingmode: AUTO_ACCEPT, REQUEST_FIRST -> lowercase
- billingtype: MONTHLY, WEEKLY -> monthly, weekly

Revision ID: fix_uppercase_enums
Revises: add_weekly_billing_to_livery
Create Date: 2025-12-23

"""
from alembic import op
import sqlalchemy as sa


revision = 'fix_uppercase_enums'
down_revision = 'add_weekly_billing_to_livery'
branch_labels = None
depends_on = None


def fix_enum(table_name: str, column_name: str, enum_name: str, new_values: list, default_value: str = None):
    """Helper to fix an enum column from UPPERCASE to lowercase."""
    # Step 1: Add temp column
    op.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name}_temp VARCHAR(50)")

    # Step 2: Copy data, converting to lowercase
    op.execute(f"UPDATE {table_name} SET {column_name}_temp = LOWER({column_name}::text)")

    # Step 3: Drop old column
    op.execute(f"ALTER TABLE {table_name} DROP COLUMN {column_name} CASCADE")

    # Step 4: Drop old enum type
    op.execute(f"DROP TYPE IF EXISTS {enum_name} CASCADE")

    # Step 5: Create new enum with lowercase values
    values_str = ", ".join([f"'{v}'" for v in new_values])
    op.execute(f"CREATE TYPE {enum_name} AS ENUM ({values_str})")

    # Step 6: Add new column with new enum type
    op.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {enum_name}")

    # Step 7: Copy data back
    op.execute(f"UPDATE {table_name} SET {column_name} = {column_name}_temp::{enum_name}")

    # Step 8: Set NOT NULL and default if specified
    op.execute(f"ALTER TABLE {table_name} ALTER COLUMN {column_name} SET NOT NULL")
    if default_value:
        op.execute(f"ALTER TABLE {table_name} ALTER COLUMN {column_name} SET DEFAULT '{default_value}'")

    # Step 9: Drop temp column
    op.execute(f"ALTER TABLE {table_name} DROP COLUMN {column_name}_temp")


def upgrade() -> None:
    # Fix userrole enum in users table
    fix_enum(
        table_name='users',
        column_name='role',
        enum_name='userrole',
        new_values=['public', 'livery', 'staff', 'coach', 'admin'],
        default_value=None
    )

    # Fix bookingtype enum in bookings table
    fix_enum(
        table_name='bookings',
        column_name='booking_type',
        enum_name='bookingtype',
        new_values=['public', 'livery', 'event', 'maintenance', 'training_clinic', 'lesson'],
        default_value='public'
    )

    # Fix bookingstatus enum in bookings table
    fix_enum(
        table_name='bookings',
        column_name='booking_status',
        enum_name='bookingstatus',
        new_values=['confirmed', 'pending', 'cancelled'],
        default_value='confirmed'
    )

    # Fix paymentstatus enum in bookings table
    fix_enum(
        table_name='bookings',
        column_name='payment_status',
        enum_name='paymentstatus',
        new_values=['pending', 'paid', 'not_required'],
        default_value='pending'
    )

    # Fix lessonrequeststatus enum in lesson_requests table
    fix_enum(
        table_name='lesson_requests',
        column_name='status',
        enum_name='lessonrequeststatus',
        new_values=['pending', 'accepted', 'declined', 'confirmed', 'cancelled', 'completed'],
        default_value='pending'
    )

    # Fix availabilitymode enum in coach_profiles table
    fix_enum(
        table_name='coach_profiles',
        column_name='availability_mode',
        enum_name='availabilitymode',
        new_values=['recurring', 'specific', 'always'],
        default_value='always'
    )

    # Fix bookingmode enum in coach_profiles table
    fix_enum(
        table_name='coach_profiles',
        column_name='booking_mode',
        enum_name='bookingmode',
        new_values=['auto_accept', 'request_first'],
        default_value='request_first'
    )

    # Fix billingtype enum in livery_packages table
    fix_enum(
        table_name='livery_packages',
        column_name='billing_type',
        enum_name='billingtype',
        new_values=['monthly', 'weekly'],
        default_value='monthly'
    )

    # Also fix paymentstatus in lesson_requests if it exists
    # Check if column exists first
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'lesson_requests' AND column_name = 'payment_status'
            ) THEN
                ALTER TABLE lesson_requests ADD COLUMN payment_status_temp VARCHAR(50);
                UPDATE lesson_requests SET payment_status_temp = LOWER(payment_status::text);
                ALTER TABLE lesson_requests DROP COLUMN payment_status CASCADE;
                ALTER TABLE lesson_requests ADD COLUMN payment_status paymentstatus;
                UPDATE lesson_requests SET payment_status = payment_status_temp::paymentstatus;
                ALTER TABLE lesson_requests ALTER COLUMN payment_status SET NOT NULL;
                ALTER TABLE lesson_requests ALTER COLUMN payment_status SET DEFAULT 'pending';
                ALTER TABLE lesson_requests DROP COLUMN payment_status_temp;
            END IF;
        END $$;
    """)


def downgrade() -> None:
    # This is a one-way migration - reverting to UPPERCASE is not recommended
    # as the Python models use lowercase values
    pass
