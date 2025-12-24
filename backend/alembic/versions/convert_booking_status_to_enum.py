"""Convert booking_status from string to enum

Revision ID: convert_booking_status_to_enum
Revises: add_key_safe_code
Create Date: 2025-12-17

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'convert_booking_status_to_enum'
down_revision: Union[str, None] = 'add_key_safe_code'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the bookingstatus enum type (uppercase to match SQLAlchemy enum names)
    op.execute("CREATE TYPE bookingstatus AS ENUM ('CONFIRMED', 'PENDING', 'CANCELLED')")

    # Alter the column to use the enum type
    # First, ensure all existing values are valid enum values (uppercase)
    op.execute("UPDATE bookings SET booking_status = UPPER(booking_status)")

    # Drop the existing default before changing type
    op.execute("ALTER TABLE bookings ALTER COLUMN booking_status DROP DEFAULT")

    # Convert the column from varchar to enum
    op.execute("""
        ALTER TABLE bookings
        ALTER COLUMN booking_status TYPE bookingstatus
        USING booking_status::bookingstatus
    """)

    # Set the default with the enum type
    op.execute("ALTER TABLE bookings ALTER COLUMN booking_status SET DEFAULT 'CONFIRMED'::bookingstatus")


def downgrade() -> None:
    # Drop the default first
    op.execute("ALTER TABLE bookings ALTER COLUMN booking_status DROP DEFAULT")

    # Convert back to varchar
    op.execute("""
        ALTER TABLE bookings
        ALTER COLUMN booking_status TYPE VARCHAR(20)
        USING booking_status::text
    """)

    # Restore lowercase default
    op.execute("ALTER TABLE bookings ALTER COLUMN booking_status SET DEFAULT 'confirmed'")

    # Update values to lowercase
    op.execute("UPDATE bookings SET booking_status = LOWER(booking_status)")

    # Drop the enum type
    op.execute("DROP TYPE bookingstatus")
