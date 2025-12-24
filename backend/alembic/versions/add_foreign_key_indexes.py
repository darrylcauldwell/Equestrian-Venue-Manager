"""Add indexes on foreign key columns for query performance

Revision ID: add_foreign_key_indexes
Revises: f92a54c792e1
Create Date: 2025-12-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_foreign_key_indexes'
down_revision: Union[str, None] = 'f92a54c792e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# List of (table_name, column_name) tuples for foreign keys needing indexes
FK_INDEXES = [
    # bookings
    ('bookings', 'arena_id'),
    ('bookings', 'user_id'),
    ('bookings', 'horse_id'),

    # horses
    ('horses', 'owner_id'),
    ('horses', 'stable_id'),
    ('horses', 'livery_package_id'),

    # yard_tasks
    ('yard_tasks', 'reported_by_id'),
    ('yard_tasks', 'assigned_to_id'),
    ('yard_tasks', 'completed_by_id'),
    ('yard_tasks', 'parent_task_id'),

    # task_comments
    ('task_comments', 'task_id'),
    ('task_comments', 'user_id'),

    # clinic_requests
    ('clinic_requests', 'proposed_by_id'),
    ('clinic_requests', 'reviewed_by_id'),
    ('clinic_requests', 'booking_id'),
    ('clinic_requests', 'notice_id'),

    # clinic_slots
    ('clinic_slots', 'clinic_id'),
    ('clinic_slots', 'arena_id'),

    # clinic_participants
    ('clinic_participants', 'clinic_id'),
    ('clinic_participants', 'slot_id'),
    ('clinic_participants', 'user_id'),
    ('clinic_participants', 'horse_id'),

    # service_requests
    ('service_requests', 'service_id'),
    ('service_requests', 'horse_id'),
    ('service_requests', 'requested_by_id'),
    ('service_requests', 'assigned_to_id'),
    ('service_requests', 'completed_by_id'),

    # notices
    ('notices', 'created_by_id'),

    # compliance_items
    ('compliance_items', 'responsible_user_id'),

    # compliance_history
    ('compliance_history', 'compliance_item_id'),
    ('compliance_history', 'completed_by_id'),

    # health records
    ('farrier_records', 'horse_id'),
    ('dentist_records', 'horse_id'),
    ('vaccination_records', 'horse_id'),
    ('worming_records', 'horse_id'),

    # staff_management
    ('shifts', 'staff_id'),
    ('shifts', 'created_by_id'),
    ('timesheets', 'staff_id'),
    ('timesheets', 'approved_by_id'),
    ('holiday_requests', 'staff_id'),
    ('holiday_requests', 'approved_by_id'),
    ('unplanned_absences', 'staff_id'),
    ('unplanned_absences', 'reported_to_id'),

    # turnout_requests
    ('turnout_requests', 'horse_id'),
    ('turnout_requests', 'requested_by_id'),
    ('turnout_requests', 'reviewed_by_id'),

    # feed management
    ('feed_requirements', 'updated_by_id'),
    ('feed_additions', 'horse_id'),
    ('feed_additions', 'requested_by_id'),
    ('feed_additions', 'approved_by_id'),
    ('feed_supply_alerts', 'horse_id'),
    ('feed_supply_alerts', 'created_by_id'),
    ('feed_supply_alerts', 'resolved_by_id'),

    # ledger_entries
    ('ledger_entries', 'user_id'),
    ('ledger_entries', 'service_request_id'),
    ('ledger_entries', 'livery_package_id'),
    ('ledger_entries', 'created_by_id'),

    # stables
    ('stables', 'block_id'),

    # backups
    ('backups', 'created_by_id'),
]


def upgrade() -> None:
    conn = op.get_bind()
    for table, column in FK_INDEXES:
        index_name = f'ix_{table}_{column}'
        # Check if index already exists
        result = conn.execute(
            sa.text(
                "SELECT 1 FROM pg_indexes WHERE indexname = :index_name"
            ),
            {"index_name": index_name}
        ).fetchone()
        if not result:
            op.create_index(index_name, table, [column], unique=False)


def downgrade() -> None:
    for table, column in reversed(FK_INDEXES):
        index_name = f'ix_{table}_{column}'
        op.drop_index(index_name, table_name=table)
