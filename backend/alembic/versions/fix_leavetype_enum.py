"""Fix enum types to use lowercase values matching Python models

Revision ID: fix_leavetype_enum
Revises: 3a15b9283b1d
Create Date: 2025-12-19

This migration converts all PostgreSQL enum types from uppercase values to lowercase,
matching what the Python enum definitions use with values_callable.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'fix_leavetype_enum'
down_revision: Union[str, None] = '3a15b9283b1d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def fix_enum_column(table: str, column: str, enum_name: str, new_values: list[str], default_value: str = None) -> None:
    """Helper to recreate a column's enum type with lowercase values."""
    values_str = ", ".join(f"'{v}'" for v in new_values)

    # Create new enum type
    op.execute(f"CREATE TYPE {enum_name}_new AS ENUM ({values_str})")

    # Drop any default first (otherwise can't convert type)
    op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT")

    # Convert existing data to lowercase and change column type
    op.execute(f"""
        ALTER TABLE {table}
        ALTER COLUMN {column} TYPE {enum_name}_new
        USING (LOWER({column}::text)::{enum_name}_new)
    """)

    # Drop old enum type and rename new one
    op.execute(f"DROP TYPE {enum_name}")
    op.execute(f"ALTER TYPE {enum_name}_new RENAME TO {enum_name}")

    # Re-add default if specified
    if default_value:
        op.execute(f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT '{default_value}'")


def upgrade() -> None:
    # Fix leavetype enum (adding 'extended')
    fix_enum_column('holiday_requests', 'leave_type', 'leavetype',
             ['annual', 'unpaid', 'toil', 'extended'], 'annual')

    # Fix leavestatus enum
    fix_enum_column('holiday_requests', 'status', 'leavestatus',
             ['pending', 'approved', 'rejected', 'cancelled'], 'pending')

    # Fix timesheetstatus enum
    fix_enum_column('timesheets', 'status', 'timesheetstatus',
             ['draft', 'submitted', 'approved', 'rejected'], 'draft')

    # Fix shifttype enum
    fix_enum_column('shifts', 'shift_type', 'shifttype',
             ['morning', 'afternoon', 'full_day'], 'morning')

    # Fix shiftrole enum
    fix_enum_column('shifts', 'role', 'shiftrole',
             ['yard_duties', 'office', 'events', 'teaching', 'maintenance', 'other'], 'yard_duties')


def downgrade() -> None:
    # Note: downgrade would lose 'extended' for leavetype
    pass
