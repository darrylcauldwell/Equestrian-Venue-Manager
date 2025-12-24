"""Add group lesson pricing fields

Revision ID: 2b5128743e47
Revises: add_clinic_slots
Create Date: 2024-12-17

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2b5128743e47'
down_revision = 'add_sms_settings'
branch_labels = None
depends_on = None


def upgrade():
    # Add group pricing fields to clinic_requests
    op.add_column('clinic_requests', sa.Column('group_price_per_person', sa.Numeric(10, 2), nullable=True))
    op.add_column('clinic_requests', sa.Column('max_group_size', sa.Integer(), nullable=True))

    # Add is_group_slot to clinic_slots
    op.add_column('clinic_slots', sa.Column('is_group_slot', sa.Boolean(), server_default='false', nullable=False))


def downgrade():
    # Remove columns
    op.drop_column('clinic_slots', 'is_group_slot')
    op.drop_column('clinic_requests', 'max_group_size')
    op.drop_column('clinic_requests', 'group_price_per_person')
