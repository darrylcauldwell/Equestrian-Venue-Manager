"""Add medication logging and rehab program tables

Revision ID: add_medication_logs
Revises: add_emergency_contacts
Create Date: 2025-12-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_medication_logs'
down_revision = 'add_emergency_contacts'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types if they don't exist
    op.execute("DO $$ BEGIN CREATE TYPE healingstatus AS ENUM ('improving', 'stable', 'worsening', 'infected', 'healed'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE appetitestatus AS ENUM ('normal', 'reduced', 'not_eating', 'increased'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE demeanrostatus AS ENUM ('bright', 'quiet', 'lethargic', 'agitated'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE rehabstatus AS ENUM ('draft', 'active', 'paused', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE taskfrequency AS ENUM ('daily', 'twice_daily', 'every_other_day', 'weekly', 'as_needed'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create medication_admin_logs table
    op.create_table(
        'medication_admin_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('feed_addition_id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('admin_date', sa.Date(), nullable=False),
        sa.Column('feed_time', sa.Enum('morning', 'evening', 'both', name='feedtime', create_constraint=False, native_enum=False), nullable=False),
        sa.Column('was_given', sa.Boolean(), nullable=False),
        sa.Column('skip_reason', sa.Text(), nullable=True),
        sa.Column('given_by_id', sa.Integer(), nullable=False),
        sa.Column('given_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['feed_addition_id'], ['feed_additions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['given_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('feed_addition_id', 'admin_date', 'feed_time', name='unique_med_admin')
    )
    op.create_index('ix_medication_admin_logs_id', 'medication_admin_logs', ['id'], unique=False)
    op.create_index('ix_medication_admin_logs_horse_id', 'medication_admin_logs', ['horse_id'], unique=False)
    op.create_index('ix_medication_admin_logs_admin_date', 'medication_admin_logs', ['admin_date'], unique=False)

    # Create wound_care_logs table
    op.create_table(
        'wound_care_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('wound_name', sa.String(100), nullable=False),
        sa.Column('wound_location', sa.String(100), nullable=True),
        sa.Column('wound_description', sa.Text(), nullable=True),
        sa.Column('treatment_date', sa.Date(), nullable=False),
        sa.Column('treatment_time', sa.Time(), nullable=True),
        sa.Column('treatment_given', sa.Text(), nullable=False),
        sa.Column('products_used', sa.Text(), nullable=True),
        sa.Column('healing_assessment', sa.Enum('improving', 'stable', 'worsening', 'infected', 'healed', name='healingstatus', create_constraint=False, native_enum=False), nullable=True),
        sa.Column('assessment_notes', sa.Text(), nullable=True),
        sa.Column('next_treatment_due', sa.Date(), nullable=True),
        sa.Column('treated_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('is_resolved', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('resolved_date', sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['treated_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_wound_care_logs_id', 'wound_care_logs', ['id'], unique=False)
    op.create_index('ix_wound_care_logs_horse_id', 'wound_care_logs', ['horse_id'], unique=False)

    # Create health_observations table
    op.create_table(
        'health_observations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('observation_date', sa.Date(), nullable=False),
        sa.Column('observation_time', sa.Time(), nullable=True),
        sa.Column('temperature', sa.Numeric(4, 1), nullable=True),
        sa.Column('appetite', sa.Enum('normal', 'reduced', 'not_eating', 'increased', name='appetitestatus', create_constraint=False, native_enum=False), nullable=True),
        sa.Column('demeanor', sa.Enum('bright', 'quiet', 'lethargic', 'agitated', name='demeanrostatus', create_constraint=False, native_enum=False), nullable=True),
        sa.Column('droppings_normal', sa.Boolean(), nullable=True),
        sa.Column('concerns', sa.Text(), nullable=True),
        sa.Column('action_taken', sa.Text(), nullable=True),
        sa.Column('vet_notified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('observed_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['observed_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_health_observations_id', 'health_observations', ['id'], unique=False)
    op.create_index('ix_health_observations_horse_id', 'health_observations', ['horse_id'], unique=False)
    op.create_index('ix_health_observations_date', 'health_observations', ['observation_date'], unique=False)

    # Create rehab_programs table
    op.create_table(
        'rehab_programs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('prescribed_by', sa.String(150), nullable=True),
        sa.Column('prescription_date', sa.Date(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('expected_end_date', sa.Date(), nullable=True),
        sa.Column('actual_end_date', sa.Date(), nullable=True),
        sa.Column('status', sa.Enum('draft', 'active', 'paused', 'completed', 'cancelled', name='rehabstatus', create_constraint=False, native_enum=False), nullable=False, server_default='draft'),
        sa.Column('current_phase', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_rehab_programs_id', 'rehab_programs', ['id'], unique=False)
    op.create_index('ix_rehab_programs_horse_id', 'rehab_programs', ['horse_id'], unique=False)

    # Create rehab_phases table
    op.create_table(
        'rehab_phases',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=False),
        sa.Column('phase_number', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('duration_days', sa.Integer(), nullable=False),
        sa.Column('start_day', sa.Integer(), nullable=False),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('completed_date', sa.Date(), nullable=True),
        sa.Column('completion_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['program_id'], ['rehab_programs.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_rehab_phases_id', 'rehab_phases', ['id'], unique=False)

    # Create rehab_tasks table
    op.create_table(
        'rehab_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('phase_id', sa.Integer(), nullable=False),
        sa.Column('task_type', sa.String(50), nullable=False),
        sa.Column('description', sa.String(500), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=True),
        sa.Column('frequency', sa.Enum('daily', 'twice_daily', 'every_other_day', 'weekly', 'as_needed', name='taskfrequency', create_constraint=False, native_enum=False), nullable=False, server_default='daily'),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('equipment_needed', sa.String(200), nullable=True),
        sa.Column('sequence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['phase_id'], ['rehab_phases.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_rehab_tasks_id', 'rehab_tasks', ['id'], unique=False)

    # Create rehab_task_logs table
    op.create_table(
        'rehab_task_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('program_id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('feed_time', sa.Enum('morning', 'evening', 'both', name='feedtime', create_constraint=False, native_enum=False), nullable=True),
        sa.Column('was_completed', sa.Boolean(), nullable=False),
        sa.Column('skip_reason', sa.Text(), nullable=True),
        sa.Column('actual_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('horse_response', sa.Text(), nullable=True),
        sa.Column('concerns', sa.Text(), nullable=True),
        sa.Column('vet_notified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('completed_by_id', sa.Integer(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['task_id'], ['rehab_tasks.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['program_id'], ['rehab_programs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['completed_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_rehab_task_logs_id', 'rehab_task_logs', ['id'], unique=False)
    op.create_index('ix_rehab_task_logs_log_date', 'rehab_task_logs', ['log_date'], unique=False)


def downgrade():
    op.drop_index('ix_rehab_task_logs_log_date', table_name='rehab_task_logs')
    op.drop_index('ix_rehab_task_logs_id', table_name='rehab_task_logs')
    op.drop_table('rehab_task_logs')

    op.drop_index('ix_rehab_tasks_id', table_name='rehab_tasks')
    op.drop_table('rehab_tasks')

    op.drop_index('ix_rehab_phases_id', table_name='rehab_phases')
    op.drop_table('rehab_phases')

    op.drop_index('ix_rehab_programs_horse_id', table_name='rehab_programs')
    op.drop_index('ix_rehab_programs_id', table_name='rehab_programs')
    op.drop_table('rehab_programs')

    op.drop_index('ix_health_observations_date', table_name='health_observations')
    op.drop_index('ix_health_observations_horse_id', table_name='health_observations')
    op.drop_index('ix_health_observations_id', table_name='health_observations')
    op.drop_table('health_observations')

    op.drop_index('ix_wound_care_logs_horse_id', table_name='wound_care_logs')
    op.drop_index('ix_wound_care_logs_id', table_name='wound_care_logs')
    op.drop_table('wound_care_logs')

    op.drop_index('ix_medication_admin_logs_admin_date', table_name='medication_admin_logs')
    op.drop_index('ix_medication_admin_logs_horse_id', table_name='medication_admin_logs')
    op.drop_index('ix_medication_admin_logs_id', table_name='medication_admin_logs')
    op.drop_table('medication_admin_logs')

    # Drop enum types
    op.execute('DROP TYPE IF EXISTS taskfrequency')
    op.execute('DROP TYPE IF EXISTS rehabstatus')
    op.execute('DROP TYPE IF EXISTS demeanrostatus')
    op.execute('DROP TYPE IF EXISTS appetitestatus')
    op.execute('DROP TYPE IF EXISTS healingstatus')
