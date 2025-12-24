"""Add emergency_contacts table for horse-specific emergency contact records

Revision ID: add_emergency_contacts
Revises: add_task_service_request_link
Create Date: 2025-12-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_emergency_contacts'
down_revision = 'add_task_service_request_link'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types if they don't exist
    op.execute("DO $$ BEGIN CREATE TYPE contacttype AS ENUM ('vet', 'vet_backup', 'farrier', 'farrier_backup', 'owner_backup', 'insurance', 'other'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create emergency_contacts table
    op.create_table(
        'emergency_contacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('contact_type', sa.Enum('vet', 'vet_backup', 'farrier', 'farrier_backup', 'owner_backup', 'insurance', 'other', name='contacttype', create_constraint=False, native_enum=False), nullable=False),
        sa.Column('name', sa.String(150), nullable=False),
        sa.Column('phone', sa.String(20), nullable=False),
        sa.Column('phone_alt', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('practice_name', sa.String(150), nullable=True),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('available_24h', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('availability_notes', sa.Text(), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_emergency_contacts_id', 'emergency_contacts', ['id'], unique=False)
    op.create_index('ix_emergency_contacts_horse_id', 'emergency_contacts', ['horse_id'], unique=False)


def downgrade():
    op.drop_index('ix_emergency_contacts_horse_id', table_name='emergency_contacts')
    op.drop_index('ix_emergency_contacts_id', table_name='emergency_contacts')
    op.drop_table('emergency_contacts')
    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS contacttype')
