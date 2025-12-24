"""Add turnout_requests table

Revision ID: add_turnout_requests
Revises: dcb8088ff702
Create Date: 2024-12-17 19:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_turnout_requests'
down_revision = 'dcb8088ff702'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'turnout_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('requested_by_id', sa.Integer(), nullable=False),
        sa.Column('request_date', sa.Date(), nullable=False),
        sa.Column('turnout_type', sa.Enum('out', 'in', name='turnouttype'), default='out'),
        sa.Column('field_preference', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'approved', 'declined', name='turnoutstatus'), default='pending'),
        sa.Column('reviewed_by_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('response_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ),
        sa.ForeignKeyConstraint(['requested_by_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['reviewed_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_turnout_requests_id'), 'turnout_requests', ['id'], unique=False)
    op.create_index('ix_turnout_requests_date', 'turnout_requests', ['request_date'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_turnout_requests_date', table_name='turnout_requests')
    op.drop_index(op.f('ix_turnout_requests_id'), table_name='turnout_requests')
    op.drop_table('turnout_requests')
    op.execute("DROP TYPE IF EXISTS turnouttype")
    op.execute("DROP TYPE IF EXISTS turnoutstatus")
