"""Consolidate bonus and adhoc adjustment types into oneoff

Revision ID: payroll_oneoff_type
Revises: merge_all_heads
Create Date: 2026-01-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'payroll_oneoff_type'
down_revision: Union[str, None] = 'merge_all_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the new 'oneoff' value to the enum
    # This must be done outside of a transaction to be able to use it immediately
    op.execute("COMMIT")
    op.execute("ALTER TYPE payrolladjustmenttype ADD VALUE IF NOT EXISTS 'oneoff'")
    op.execute("BEGIN")

    # Convert existing 'bonus' and 'adhoc' values to 'oneoff'
    op.execute("UPDATE payroll_adjustments SET adjustment_type = 'oneoff' WHERE adjustment_type IN ('bonus', 'adhoc')")


def downgrade() -> None:
    # Convert 'oneoff' back to 'bonus' (can't really distinguish which were adhoc)
    op.execute("UPDATE payroll_adjustments SET adjustment_type = 'bonus' WHERE adjustment_type = 'oneoff'")

    # Note: PostgreSQL doesn't support removing enum values directly
    # The 'oneoff' value will remain in the enum type but won't be used
