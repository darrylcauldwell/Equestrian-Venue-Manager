"""Add staff profiles table

Revision ID: add_staff_profiles
Revises: merge_turnout_careplans
Create Date: 2024-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_staff_profiles'
down_revision: Union[str, None] = 'merge_turnout_careplans'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'staff_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        # Personal information
        sa.Column('date_of_birth', sa.Date(), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        # Employment information
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('job_title', sa.String(length=100), nullable=True),
        # Personal contact details
        sa.Column('personal_email', sa.String(length=255), nullable=True),
        sa.Column('personal_phone', sa.String(length=20), nullable=True),
        # Home address
        sa.Column('address_street', sa.String(length=200), nullable=True),
        sa.Column('address_town', sa.String(length=100), nullable=True),
        sa.Column('address_county', sa.String(length=100), nullable=True),
        sa.Column('address_postcode', sa.String(length=10), nullable=True),
        # Emergency contact
        sa.Column('emergency_contact_name', sa.String(length=100), nullable=True),
        sa.Column('emergency_contact_phone', sa.String(length=20), nullable=True),
        sa.Column('emergency_contact_relationship', sa.String(length=50), nullable=True),
        # Qualifications
        sa.Column('qualifications', sa.Text(), nullable=True),
        sa.Column('dbs_check_date', sa.Date(), nullable=True),
        sa.Column('dbs_certificate_number', sa.String(length=50), nullable=True),
        # Admin notes
        sa.Column('notes', sa.Text(), nullable=True),
        # Timestamps
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        # Constraints
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_staff_profiles_id'), 'staff_profiles', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_staff_profiles_id'), table_name='staff_profiles')
    op.drop_table('staff_profiles')
