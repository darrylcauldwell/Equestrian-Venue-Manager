"""add_backup_tables

Revision ID: f92a54c792e1
Revises: 2b5128743e47
Create Date: 2025-12-17 23:03:24.536331

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f92a54c792e1'
down_revision: Union[str, None] = '2b5128743e47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create backup_schedules table
    op.create_table('backup_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=True),
        sa.Column('frequency', sa.String(length=20), nullable=True),
        sa.Column('retention_days', sa.Integer(), nullable=True),
        sa.Column('last_run', sa.DateTime(), nullable=True),
        sa.Column('next_run', sa.DateTime(), nullable=True),
        sa.Column('s3_enabled', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_backup_schedules_id'), 'backup_schedules', ['id'], unique=False)

    # Create backups table
    op.create_table('backups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('backup_date', sa.DateTime(), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('entity_counts', sa.JSON(), nullable=True),
        sa.Column('storage_location', sa.String(length=50), nullable=True),
        sa.Column('s3_url', sa.String(length=500), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_backups_id'), 'backups', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_backups_id'), table_name='backups')
    op.drop_table('backups')
    op.drop_index(op.f('ix_backup_schedules_id'), table_name='backup_schedules')
    op.drop_table('backup_schedules')
