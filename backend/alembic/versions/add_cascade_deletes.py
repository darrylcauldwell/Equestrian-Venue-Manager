"""Add cascade delete constraints to foreign keys

Revision ID: add_cascade_deletes
Revises: add_foreign_key_indexes
Create Date: 2025-12-18 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'add_cascade_deletes'
down_revision: Union[str, None] = 'add_foreign_key_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def get_fk_constraint_name(connection, table_name: str, column_name: str) -> str | None:
    """Get the actual foreign key constraint name for a column."""
    inspector = inspect(connection)
    for fk in inspector.get_foreign_keys(table_name):
        if column_name in fk['constrained_columns']:
            return fk['name']
    return None


def upgrade() -> None:
    connection = op.get_bind()

    # compliance_history.compliance_item_id -> CASCADE
    fk_name = get_fk_constraint_name(connection, 'compliance_history', 'compliance_item_id')
    if fk_name:
        op.drop_constraint(fk_name, 'compliance_history', type_='foreignkey')
        op.create_foreign_key(
            'compliance_history_compliance_item_id_fkey',
            'compliance_history', 'compliance_items',
            ['compliance_item_id'], ['id'],
            ondelete='CASCADE'
        )

    # clinic_slots.clinic_id -> CASCADE
    fk_name = get_fk_constraint_name(connection, 'clinic_slots', 'clinic_id')
    if fk_name:
        op.drop_constraint(fk_name, 'clinic_slots', type_='foreignkey')
        op.create_foreign_key(
            'clinic_slots_clinic_id_fkey',
            'clinic_slots', 'clinic_requests',
            ['clinic_id'], ['id'],
            ondelete='CASCADE'
        )

    # clinic_participants.clinic_id -> CASCADE
    fk_name = get_fk_constraint_name(connection, 'clinic_participants', 'clinic_id')
    if fk_name:
        op.drop_constraint(fk_name, 'clinic_participants', type_='foreignkey')
        op.create_foreign_key(
            'clinic_participants_clinic_id_fkey',
            'clinic_participants', 'clinic_requests',
            ['clinic_id'], ['id'],
            ondelete='CASCADE'
        )

    # clinic_participants.slot_id -> SET NULL
    fk_name = get_fk_constraint_name(connection, 'clinic_participants', 'slot_id')
    if fk_name:
        op.drop_constraint(fk_name, 'clinic_participants', type_='foreignkey')
        op.create_foreign_key(
            'clinic_participants_slot_id_fkey',
            'clinic_participants', 'clinic_slots',
            ['slot_id'], ['id'],
            ondelete='SET NULL'
        )

    # turnout_requests.horse_id -> CASCADE
    fk_name = get_fk_constraint_name(connection, 'turnout_requests', 'horse_id')
    if fk_name:
        op.drop_constraint(fk_name, 'turnout_requests', type_='foreignkey')
        op.create_foreign_key(
            'turnout_requests_horse_id_fkey',
            'turnout_requests', 'horses',
            ['horse_id'], ['id'],
            ondelete='CASCADE'
        )


def downgrade() -> None:
    connection = op.get_bind()

    # Revert turnout_requests.horse_id
    fk_name = get_fk_constraint_name(connection, 'turnout_requests', 'horse_id')
    if fk_name:
        op.drop_constraint(fk_name, 'turnout_requests', type_='foreignkey')
        op.create_foreign_key(
            'turnout_requests_horse_id_fkey',
            'turnout_requests', 'horses',
            ['horse_id'], ['id']
        )

    # Revert clinic_participants.slot_id
    fk_name = get_fk_constraint_name(connection, 'clinic_participants', 'slot_id')
    if fk_name:
        op.drop_constraint(fk_name, 'clinic_participants', type_='foreignkey')
        op.create_foreign_key(
            'clinic_participants_slot_id_fkey',
            'clinic_participants', 'clinic_slots',
            ['slot_id'], ['id']
        )

    # Revert clinic_participants.clinic_id
    fk_name = get_fk_constraint_name(connection, 'clinic_participants', 'clinic_id')
    if fk_name:
        op.drop_constraint(fk_name, 'clinic_participants', type_='foreignkey')
        op.create_foreign_key(
            'clinic_participants_clinic_id_fkey',
            'clinic_participants', 'clinic_requests',
            ['clinic_id'], ['id']
        )

    # Revert clinic_slots.clinic_id
    fk_name = get_fk_constraint_name(connection, 'clinic_slots', 'clinic_id')
    if fk_name:
        op.drop_constraint(fk_name, 'clinic_slots', type_='foreignkey')
        op.create_foreign_key(
            'clinic_slots_clinic_id_fkey',
            'clinic_slots', 'clinic_requests',
            ['clinic_id'], ['id']
        )

    # Revert compliance_history.compliance_item_id
    fk_name = get_fk_constraint_name(connection, 'compliance_history', 'compliance_item_id')
    if fk_name:
        op.drop_constraint(fk_name, 'compliance_history', type_='foreignkey')
        op.create_foreign_key(
            'compliance_history_compliance_item_id_fkey',
            'compliance_history', 'compliance_items',
            ['compliance_item_id'], ['id']
        )
