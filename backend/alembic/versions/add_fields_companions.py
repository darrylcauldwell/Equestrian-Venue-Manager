"""Add fields, companion relationships, and turnout groups

Revision ID: add_fields_companions
Revises: add_medication_logs
Create Date: 2025-12-18

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_fields_companions'
down_revision = 'add_medication_logs'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types if they don't exist
    op.execute("DO $$ BEGIN CREATE TYPE fieldcondition AS ENUM ('excellent', 'good', 'fair', 'poor', 'resting'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE companionrelationship AS ENUM ('preferred', 'compatible', 'incompatible'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create fields table
    op.create_table(
        'fields',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('max_horses', sa.Integer(), nullable=True),
        sa.Column('size_acres', sa.Numeric(5, 2), nullable=True),
        sa.Column('current_condition', sa.Enum('excellent', 'good', 'fair', 'poor', 'resting', name='fieldcondition', create_constraint=False, native_enum=False), nullable=True, server_default='good'),
        sa.Column('condition_notes', sa.Text(), nullable=True),
        sa.Column('last_condition_update', sa.DateTime(), nullable=True),
        sa.Column('is_resting', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('rest_start_date', sa.Date(), nullable=True),
        sa.Column('rest_end_date', sa.Date(), nullable=True),
        sa.Column('has_shelter', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_water', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_electric_fenced', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('display_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_fields_id', 'fields', ['id'], unique=False)

    # Create field_usage_logs table
    op.create_table(
        'field_usage_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('usage_date', sa.Date(), nullable=False),
        sa.Column('condition_start', sa.Enum('excellent', 'good', 'fair', 'poor', 'resting', name='fieldcondition', create_constraint=False, native_enum=False), nullable=True),
        sa.Column('condition_end', sa.Enum('excellent', 'good', 'fair', 'poor', 'resting', name='fieldcondition', create_constraint=False, native_enum=False), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('logged_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id']),
        sa.ForeignKeyConstraint(['logged_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_usage_logs_id', 'field_usage_logs', ['id'], unique=False)
    op.create_index('ix_field_usage_logs_usage_date', 'field_usage_logs', ['usage_date'], unique=False)

    # Create field_usage_horses table (junction)
    op.create_table(
        'field_usage_horses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('usage_log_id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['usage_log_id'], ['field_usage_logs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_usage_horses_id', 'field_usage_horses', ['id'], unique=False)

    # Create horse_companions table
    op.create_table(
        'horse_companions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('companion_horse_id', sa.Integer(), nullable=False),
        sa.Column('relationship_type', sa.Enum('preferred', 'compatible', 'incompatible', name='companionrelationship', create_constraint=False, native_enum=False), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['companion_horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('horse_id', 'companion_horse_id', name='unique_horse_companion')
    )
    op.create_index('ix_horse_companions_id', 'horse_companions', ['id'], unique=False)

    # Create turnout_groups table
    op.create_table(
        'turnout_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('turnout_date', sa.Date(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('assigned_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id']),
        sa.ForeignKeyConstraint(['assigned_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_turnout_groups_id', 'turnout_groups', ['id'], unique=False)
    op.create_index('ix_turnout_groups_turnout_date', 'turnout_groups', ['turnout_date'], unique=False)

    # Create turnout_group_horses table
    op.create_table(
        'turnout_group_horses',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('turned_out_at', sa.DateTime(), nullable=True),
        sa.Column('brought_in_at', sa.DateTime(), nullable=True),
        sa.Column('turned_out_by_id', sa.Integer(), nullable=True),
        sa.Column('brought_in_by_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['turnout_groups.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id']),
        sa.ForeignKeyConstraint(['turned_out_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['brought_in_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_turnout_group_horses_id', 'turnout_group_horses', ['id'], unique=False)

    # Add turnout fields to horses table
    op.add_column('horses', sa.Column('turnout_alone', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('horses', sa.Column('turnout_notes', sa.Text(), nullable=True))


def downgrade():
    # Remove turnout columns from horses
    op.drop_column('horses', 'turnout_notes')
    op.drop_column('horses', 'turnout_alone')

    # Drop turnout_group_horses
    op.drop_index('ix_turnout_group_horses_id', table_name='turnout_group_horses')
    op.drop_table('turnout_group_horses')

    # Drop turnout_groups
    op.drop_index('ix_turnout_groups_turnout_date', table_name='turnout_groups')
    op.drop_index('ix_turnout_groups_id', table_name='turnout_groups')
    op.drop_table('turnout_groups')

    # Drop horse_companions
    op.drop_index('ix_horse_companions_id', table_name='horse_companions')
    op.drop_table('horse_companions')

    # Drop field_usage_horses
    op.drop_index('ix_field_usage_horses_id', table_name='field_usage_horses')
    op.drop_table('field_usage_horses')

    # Drop field_usage_logs
    op.drop_index('ix_field_usage_logs_usage_date', table_name='field_usage_logs')
    op.drop_index('ix_field_usage_logs_id', table_name='field_usage_logs')
    op.drop_table('field_usage_logs')

    # Drop fields
    op.drop_index('ix_fields_id', table_name='fields')
    op.drop_table('fields')

    # Drop enum types
    op.execute('DROP TYPE IF EXISTS companionrelationship')
    op.execute('DROP TYPE IF EXISTS fieldcondition')
