"""Add logged_by_id to timesheets for admin logging

Revision ID: add_timesheet_logged_by
Revises: task_maintenance_day
Create Date: 2025-01-01

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_timesheet_logged_by'
down_revision = 'task_maintenance_day'
branch_labels = None
depends_on = None


def upgrade():
    # Add logged_by_id column to timesheets table
    op.add_column('timesheets', sa.Column('logged_by_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_timesheets_logged_by',
        'timesheets', 'users',
        ['logged_by_id'], ['id']
    )


def downgrade():
    op.drop_constraint('fk_timesheets_logged_by', 'timesheets', type_='foreignkey')
    op.drop_column('timesheets', 'logged_by_id')
