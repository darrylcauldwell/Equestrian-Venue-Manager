"""Add service_request_id to yard_tasks for livery service integration

Revision ID: add_task_service_request_link
Revises: add_timesheet_logged_by
Create Date: 2025-12-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_task_service_request_link'
down_revision = 'add_timesheet_logged_by'
branch_labels = None
depends_on = None


def upgrade():
    # Add service_request_id column to yard_tasks
    op.add_column('yard_tasks', sa.Column('service_request_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_yard_tasks_service_request',
        'yard_tasks', 'service_requests',
        ['service_request_id'], ['id']
    )
    op.create_index('ix_yard_tasks_service_request_id', 'yard_tasks', ['service_request_id'], unique=True)


def downgrade():
    op.drop_index('ix_yard_tasks_service_request_id', table_name='yard_tasks')
    op.drop_constraint('fk_yard_tasks_service_request', 'yard_tasks', type_='foreignkey')
    op.drop_column('yard_tasks', 'service_request_id')
