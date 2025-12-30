"""Add physio_records table for physiotherapy sessions

Revision ID: 9f0a1b2c3d4e
Revises: 8e9f0a1b2c3d
Create Date: 2025-12-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '9f0a1b2c3d4e'
down_revision = '8e9f0a1b2c3d'
branch_labels = None
depends_on = None


def upgrade():
    # Create physio_records table
    op.create_table(
        'physio_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('session_date', sa.Date(), nullable=False),
        sa.Column('practitioner_name', sa.String(100), nullable=True),
        sa.Column('treatment_type', sa.String(100), nullable=False),
        sa.Column('areas_treated', sa.Text(), nullable=True),
        sa.Column('findings', sa.Text(), nullable=True),
        sa.Column('treatment_notes', sa.Text(), nullable=True),
        sa.Column('recommendations', sa.Text(), nullable=True),
        sa.Column('next_session_due', sa.Date(), nullable=True),
        sa.Column('cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_physio_records_id'), 'physio_records', ['id'], unique=False)
    op.create_index(op.f('ix_physio_records_horse_id'), 'physio_records', ['horse_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_physio_records_horse_id'), table_name='physio_records')
    op.drop_index(op.f('ix_physio_records_id'), table_name='physio_records')
    op.drop_table('physio_records')
