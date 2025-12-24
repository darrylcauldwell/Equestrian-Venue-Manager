"""Add clinic slots and notification tracking

Revision ID: add_clinic_slots
Revises: add_livery_billing_day
Create Date: 2024-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_clinic_slots'
down_revision: Union[str, None] = 'add_livery_billing_day'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create clinic_slots table
    op.create_table(
        'clinic_slots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clinic_id', sa.Integer(), nullable=False),
        sa.Column('slot_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=False),
        sa.Column('end_time', sa.Time(), nullable=False),
        sa.Column('group_name', sa.String(100), nullable=True),
        sa.Column('description', sa.String(255), nullable=True),
        sa.Column('arena_id', sa.Integer(), nullable=True),
        sa.Column('max_participants', sa.Integer(), nullable=True),
        sa.Column('sequence', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['clinic_id'], ['clinic_requests.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['arena_id'], ['arenas.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_clinic_slots_clinic_id', 'clinic_slots', ['clinic_id'])
    op.create_index('ix_clinic_slots_slot_date', 'clinic_slots', ['slot_date'])

    # Add slot_id and notification columns to clinic_participants
    op.add_column('clinic_participants', sa.Column('slot_id', sa.Integer(), nullable=True))
    op.add_column('clinic_participants', sa.Column('slot_notified_at', sa.DateTime(), nullable=True))
    op.add_column('clinic_participants', sa.Column('sms_notified_at', sa.DateTime(), nullable=True))

    # Add foreign key constraint for slot_id
    op.create_foreign_key(
        'fk_participant_slot',
        'clinic_participants',
        'clinic_slots',
        ['slot_id'],
        ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Remove foreign key and columns from clinic_participants
    op.drop_constraint('fk_participant_slot', 'clinic_participants', type_='foreignkey')
    op.drop_column('clinic_participants', 'sms_notified_at')
    op.drop_column('clinic_participants', 'slot_notified_at')
    op.drop_column('clinic_participants', 'slot_id')

    # Drop clinic_slots table
    op.drop_index('ix_clinic_slots_slot_date', 'clinic_slots')
    op.drop_index('ix_clinic_slots_clinic_id', 'clinic_slots')
    op.drop_table('clinic_slots')
