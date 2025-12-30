"""Add rehab and recurring support to service requests

Revision ID: add_rehab_service_requests
Revises: sync_all_enum_values
Create Date: 2025-12-23

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_rehab_service_requests'
down_revision = 'sync_all_enum_values'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add 'rehab' to servicecategory enum
    op.execute("ALTER TYPE servicecategory ADD VALUE IF NOT EXISTS 'rehab'")

    # Create recurringpattern enum
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recurringpattern') THEN
                CREATE TYPE recurringpattern AS ENUM ('none', 'daily', 'weekdays', 'custom');
            END IF;
        END$$;
    """)

    # Add new columns to service_requests table
    op.add_column('service_requests',
        sa.Column('rehab_program_id', sa.Integer(), sa.ForeignKey('rehab_programs.id', ondelete='SET NULL'), nullable=True)
    )
    op.add_column('service_requests',
        sa.Column('rehab_task_id', sa.Integer(), sa.ForeignKey('rehab_tasks.id', ondelete='SET NULL'), nullable=True)
    )
    op.add_column('service_requests',
        sa.Column('recurring_pattern', sa.Enum('none', 'daily', 'weekdays', 'custom', name='recurringpattern'), nullable=False, server_default='none')
    )
    op.add_column('service_requests',
        sa.Column('recurring_days', sa.Text(), nullable=True)
    )
    op.add_column('service_requests',
        sa.Column('recurring_end_date', sa.Date(), nullable=True)
    )
    op.add_column('service_requests',
        sa.Column('recurring_series_id', sa.Integer(), nullable=True)
    )


def downgrade() -> None:
    # Remove columns
    op.drop_column('service_requests', 'recurring_series_id')
    op.drop_column('service_requests', 'recurring_end_date')
    op.drop_column('service_requests', 'recurring_days')
    op.drop_column('service_requests', 'recurring_pattern')
    op.drop_column('service_requests', 'rehab_task_id')
    op.drop_column('service_requests', 'rehab_program_id')

    # Note: Removing enum values from PostgreSQL is complex and usually not done in downgrades
    # as other code may still reference them
