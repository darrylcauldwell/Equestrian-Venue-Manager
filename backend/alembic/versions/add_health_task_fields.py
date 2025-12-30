"""Add health task fields to yard_tasks for integrating medication, wound care, health checks, and rehab exercises

Revision ID: add_health_task_fields
Revises: add_invoices
Create Date: 2025-12-19

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_health_task_fields'
down_revision = 'add_invoices'
branch_labels = None
depends_on = None


def upgrade():
    # Create health task type enum
    op.execute("DO $$ BEGIN CREATE TYPE healthtasktype AS ENUM ('medication', 'wound_care', 'health_check', 'rehab_exercise'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Add health task fields to yard_tasks table
    op.add_column('yard_tasks', sa.Column('health_task_type',
        sa.Enum('medication', 'wound_care', 'health_check', 'rehab_exercise', name='healthtasktype', create_constraint=False, native_enum=False),
        nullable=True))
    op.add_column('yard_tasks', sa.Column('horse_id', sa.Integer(), nullable=True))
    op.add_column('yard_tasks', sa.Column('feed_addition_id', sa.Integer(), nullable=True))
    op.add_column('yard_tasks', sa.Column('wound_care_log_id', sa.Integer(), nullable=True))
    op.add_column('yard_tasks', sa.Column('rehab_task_id', sa.Integer(), nullable=True))
    op.add_column('yard_tasks', sa.Column('rehab_program_id', sa.Integer(), nullable=True))
    op.add_column('yard_tasks', sa.Column('feed_time', sa.String(20), nullable=True))
    op.add_column('yard_tasks', sa.Column('health_record_id', sa.Integer(), nullable=True))
    op.add_column('yard_tasks', sa.Column('health_record_type', sa.String(50), nullable=True))

    # Add foreign key constraints
    op.create_foreign_key('fk_yard_tasks_horse_id', 'yard_tasks', 'horses', ['horse_id'], ['id'])
    op.create_foreign_key('fk_yard_tasks_feed_addition_id', 'yard_tasks', 'feed_additions', ['feed_addition_id'], ['id'])
    op.create_foreign_key('fk_yard_tasks_wound_care_log_id', 'yard_tasks', 'wound_care_logs', ['wound_care_log_id'], ['id'])
    op.create_foreign_key('fk_yard_tasks_rehab_task_id', 'yard_tasks', 'rehab_tasks', ['rehab_task_id'], ['id'])
    op.create_foreign_key('fk_yard_tasks_rehab_program_id', 'yard_tasks', 'rehab_programs', ['rehab_program_id'], ['id'])

    # Add indexes for health task lookups
    op.create_index('ix_yard_tasks_health_task_type', 'yard_tasks', ['health_task_type'])
    op.create_index('ix_yard_tasks_horse_id', 'yard_tasks', ['horse_id'])


def downgrade():
    # Drop indexes
    op.drop_index('ix_yard_tasks_horse_id', table_name='yard_tasks')
    op.drop_index('ix_yard_tasks_health_task_type', table_name='yard_tasks')

    # Drop foreign key constraints
    op.drop_constraint('fk_yard_tasks_rehab_program_id', 'yard_tasks', type_='foreignkey')
    op.drop_constraint('fk_yard_tasks_rehab_task_id', 'yard_tasks', type_='foreignkey')
    op.drop_constraint('fk_yard_tasks_wound_care_log_id', 'yard_tasks', type_='foreignkey')
    op.drop_constraint('fk_yard_tasks_feed_addition_id', 'yard_tasks', type_='foreignkey')
    op.drop_constraint('fk_yard_tasks_horse_id', 'yard_tasks', type_='foreignkey')

    # Drop columns
    op.drop_column('yard_tasks', 'health_record_type')
    op.drop_column('yard_tasks', 'health_record_id')
    op.drop_column('yard_tasks', 'feed_time')
    op.drop_column('yard_tasks', 'rehab_program_id')
    op.drop_column('yard_tasks', 'rehab_task_id')
    op.drop_column('yard_tasks', 'wound_care_log_id')
    op.drop_column('yard_tasks', 'feed_addition_id')
    op.drop_column('yard_tasks', 'horse_id')
    op.drop_column('yard_tasks', 'health_task_type')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS healthtasktype;")
