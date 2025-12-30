"""Add land management tables for grants, features, flood monitoring, and analytics

Revision ID: 7d8e9f0a1b2c
Revises: 6c7d8e9f0a1b
Create Date: 2025-12-27

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '7d8e9f0a1b2c'
down_revision = '6c7d8e9f0a1b'
branch_labels = None
depends_on = None


def upgrade():
    # ========================================================================
    # Create enum types (all lowercase values)
    # ========================================================================

    # Grant enums
    op.execute("""
        CREATE TYPE grantschemetype AS ENUM (
            'countryside_stewardship_mid', 'countryside_stewardship_higher',
            'hedgerow_boundary', 'woodland_planting', 'tree_health',
            'environmental_land_management', 'sfi', 'other'
        )
    """)

    op.execute("""
        CREATE TYPE grantstatus AS ENUM (
            'draft', 'submitted', 'under_review', 'approved',
            'rejected', 'active', 'completed', 'withdrawn'
        )
    """)

    op.execute("""
        CREATE TYPE grantpaymentstatus AS ENUM (
            'scheduled', 'received', 'overdue', 'cancelled'
        )
    """)

    # Land feature enums
    op.execute("""
        CREATE TYPE landfeaturetype AS ENUM (
            'hedgerow', 'tree', 'tree_group', 'pond', 'watercourse',
            'boundary_fence', 'electric_fence', 'post_and_rail',
            'water_trough', 'gate', 'other'
        )
    """)

    op.execute("""
        CREATE TYPE featurecondition AS ENUM (
            'excellent', 'good', 'fair', 'poor', 'critical'
        )
    """)

    op.execute("""
        CREATE TYPE watersourcetype AS ENUM (
            'mains_feed', 'natural_spring', 'manual_fill', 'rainwater'
        )
    """)

    op.execute("""
        CREATE TYPE maintenancetype AS ENUM (
            'cutting', 'trimming', 'repair', 'replacement', 'inspection',
            'fill', 'voltage_check', 'cleaning', 'treatment', 'other'
        )
    """)

    # Flood monitoring enums
    op.execute("""
        CREATE TYPE floodrisklevel AS ENUM (
            'very_low', 'low', 'medium', 'high', 'severe'
        )
    """)

    # Analytics enums
    op.execute("""
        CREATE TYPE suggestiontype AS ENUM (
            'rest_field', 'rotate_horses', 'reduce_usage', 'condition_check'
        )
    """)

    op.execute("""
        CREATE TYPE suggestionpriority AS ENUM (
            'low', 'medium', 'high', 'urgent'
        )
    """)

    # ========================================================================
    # Create grants table
    # ========================================================================
    op.create_table(
        'grants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('scheme_type', postgresql.ENUM(
            'countryside_stewardship_mid', 'countryside_stewardship_higher',
            'hedgerow_boundary', 'woodland_planting', 'tree_health',
            'environmental_land_management', 'sfi', 'other',
            name='grantschemetype', create_type=False
        ), nullable=False),
        sa.Column('status', postgresql.ENUM(
            'draft', 'submitted', 'under_review', 'approved',
            'rejected', 'active', 'completed', 'withdrawn',
            name='grantstatus', create_type=False
        ), nullable=False, server_default='draft'),
        sa.Column('reference_number', sa.String(100), nullable=True),
        sa.Column('application_date', sa.Date(), nullable=True),
        sa.Column('submission_deadline', sa.Date(), nullable=True),
        sa.Column('decision_date', sa.Date(), nullable=True),
        sa.Column('agreement_start_date', sa.Date(), nullable=True),
        sa.Column('agreement_end_date', sa.Date(), nullable=True),
        sa.Column('total_value', sa.Numeric(10, 2), nullable=True),
        sa.Column('annual_payment', sa.Numeric(10, 2), nullable=True),
        sa.Column('scheme_provider', sa.String(200), nullable=True),
        sa.Column('next_inspection_date', sa.Date(), nullable=True),
        sa.Column('inspection_notes', sa.Text(), nullable=True),
        sa.Column('compliance_requirements', sa.JSON(), nullable=True),
        sa.Column('documents', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reference_number', name='uq_grants_reference_number')
    )
    op.create_index('ix_grants_id', 'grants', ['id'])
    op.create_index('ix_grants_scheme_type', 'grants', ['scheme_type'])
    op.create_index('ix_grants_status', 'grants', ['status'])

    # ========================================================================
    # Create grant_payment_schedules table
    # ========================================================================
    op.create_table(
        'grant_payment_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('grant_id', sa.Integer(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(10, 2), nullable=False),
        sa.Column('status', postgresql.ENUM(
            'scheduled', 'received', 'overdue', 'cancelled',
            name='grantpaymentstatus', create_type=False
        ), nullable=False, server_default='scheduled'),
        sa.Column('received_date', sa.Date(), nullable=True),
        sa.Column('reference', sa.String(100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['grant_id'], ['grants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_grant_payment_schedules_id', 'grant_payment_schedules', ['id'])
    op.create_index('ix_grant_payment_schedules_due_date', 'grant_payment_schedules', ['due_date'])

    # ========================================================================
    # Create land_features table
    # ========================================================================
    op.create_table(
        'land_features',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('feature_type', postgresql.ENUM(
            'hedgerow', 'tree', 'tree_group', 'pond', 'watercourse',
            'boundary_fence', 'electric_fence', 'post_and_rail',
            'water_trough', 'gate', 'other',
            name='landfeaturetype', create_type=False
        ), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('field_id', sa.Integer(), nullable=True),
        sa.Column('location_description', sa.Text(), nullable=True),
        sa.Column('length_meters', sa.Float(), nullable=True),
        sa.Column('area_sqm', sa.Float(), nullable=True),
        sa.Column('current_condition', postgresql.ENUM(
            'excellent', 'good', 'fair', 'poor', 'critical',
            name='featurecondition', create_type=False
        ), nullable=True, server_default='good'),
        sa.Column('last_inspection_date', sa.Date(), nullable=True),
        sa.Column('maintenance_frequency_days', sa.Integer(), nullable=True),
        sa.Column('last_maintenance_date', sa.Date(), nullable=True),
        sa.Column('next_maintenance_due', sa.Date(), nullable=True),
        # Tree-specific
        sa.Column('tpo_protected', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('tpo_reference', sa.String(100), nullable=True),
        sa.Column('tree_species', sa.String(100), nullable=True),
        # Hedgerow-specific
        sa.Column('hedgerow_species_mix', sa.String(500), nullable=True),
        # Fence-specific
        sa.Column('fence_type', sa.String(100), nullable=True),
        sa.Column('fence_height_cm', sa.Integer(), nullable=True),
        # Water trough-specific
        sa.Column('water_source_type', postgresql.ENUM(
            'mains_feed', 'natural_spring', 'manual_fill', 'rainwater',
            name='watersourcetype', create_type=False
        ), nullable=True),
        sa.Column('fill_frequency_days', sa.Integer(), nullable=True),
        sa.Column('last_fill_date', sa.Date(), nullable=True),
        # Electric fence-specific
        sa.Column('electric_fence_voltage_check_date', sa.Date(), nullable=True),
        sa.Column('electric_fence_working', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('electric_fence_voltage', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_land_features_id', 'land_features', ['id'])
    op.create_index('ix_land_features_feature_type', 'land_features', ['feature_type'])
    op.create_index('ix_land_features_field_id', 'land_features', ['field_id'])
    op.create_index('ix_land_features_next_maintenance_due', 'land_features', ['next_maintenance_due'])

    # ========================================================================
    # Create feature_maintenance_logs table
    # ========================================================================
    op.create_table(
        'feature_maintenance_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('feature_id', sa.Integer(), nullable=False),
        sa.Column('maintenance_date', sa.Date(), nullable=False),
        sa.Column('maintenance_type', postgresql.ENUM(
            'cutting', 'trimming', 'repair', 'replacement', 'inspection',
            'fill', 'voltage_check', 'cleaning', 'treatment', 'other',
            name='maintenancetype', create_type=False
        ), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('condition_before', postgresql.ENUM(
            'excellent', 'good', 'fair', 'poor', 'critical',
            name='featurecondition', create_type=False
        ), nullable=True),
        sa.Column('condition_after', postgresql.ENUM(
            'excellent', 'good', 'fair', 'poor', 'critical',
            name='featurecondition', create_type=False
        ), nullable=True),
        sa.Column('performed_by_id', sa.Integer(), nullable=True),
        sa.Column('contractor_name', sa.String(200), nullable=True),
        sa.Column('cost', sa.Numeric(10, 2), nullable=True),
        sa.Column('photos', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['feature_id'], ['land_features.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['performed_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_feature_maintenance_logs_id', 'feature_maintenance_logs', ['id'])
    op.create_index('ix_feature_maintenance_logs_maintenance_date', 'feature_maintenance_logs', ['maintenance_date'])

    # ========================================================================
    # Create grant_field_links table
    # ========================================================================
    op.create_table(
        'grant_field_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('grant_id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['grant_id'], ['grants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('grant_id', 'field_id', name='unique_grant_field')
    )
    op.create_index('ix_grant_field_links_id', 'grant_field_links', ['id'])

    # ========================================================================
    # Create grant_feature_links table
    # ========================================================================
    op.create_table(
        'grant_feature_links',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('grant_id', sa.Integer(), nullable=False),
        sa.Column('feature_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['grant_id'], ['grants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['feature_id'], ['land_features.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('grant_id', 'feature_id', name='unique_grant_feature')
    )
    op.create_index('ix_grant_feature_links_id', 'grant_feature_links', ['id'])

    # ========================================================================
    # Create flood_monitoring_stations table
    # ========================================================================
    op.create_table(
        'flood_monitoring_stations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('station_id', sa.String(100), nullable=False),
        sa.Column('station_name', sa.String(200), nullable=False),
        sa.Column('river_name', sa.String(200), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('warning_threshold_meters', sa.Float(), nullable=True),
        sa.Column('severe_threshold_meters', sa.Float(), nullable=True),
        sa.Column('last_reading', sa.Float(), nullable=True),
        sa.Column('last_reading_time', sa.DateTime(), nullable=True),
        sa.Column('last_fetched', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('station_id', name='uq_flood_monitoring_stations_station_id')
    )
    op.create_index('ix_flood_monitoring_stations_id', 'flood_monitoring_stations', ['id'])

    # ========================================================================
    # Create field_flood_risks table
    # ========================================================================
    op.create_table(
        'field_flood_risks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('monitoring_station_id', sa.Integer(), nullable=False),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('risk_level_override', postgresql.ENUM(
            'very_low', 'low', 'medium', 'high', 'severe',
            name='floodrisklevel', create_type=False
        ), nullable=True),
        sa.Column('flood_history', sa.JSON(), nullable=True),
        sa.Column('evacuation_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['monitoring_station_id'], ['flood_monitoring_stations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('field_id', 'monitoring_station_id', name='unique_field_station')
    )
    op.create_index('ix_field_flood_risks_id', 'field_flood_risks', ['id'])
    op.create_index('ix_field_flood_risks_field_id', 'field_flood_risks', ['field_id'])

    # ========================================================================
    # Create field_usage_analytics table
    # ========================================================================
    op.create_table(
        'field_usage_analytics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('total_days_used', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_horse_days', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('average_horses_per_day', sa.Float(), nullable=True),
        sa.Column('usage_percentage', sa.Float(), nullable=True),
        sa.Column('condition_at_start', postgresql.ENUM(
            'excellent', 'good', 'fair', 'poor', 'critical',
            name='featurecondition', create_type=False
        ), nullable=True),
        sa.Column('condition_at_end', postgresql.ENUM(
            'excellent', 'good', 'fair', 'poor', 'critical',
            name='featurecondition', create_type=False
        ), nullable=True),
        sa.Column('condition_trend', sa.String(20), nullable=True),
        sa.Column('rest_days_taken', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('calculated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('field_id', 'year', 'month', name='unique_field_analytics_period')
    )
    op.create_index('ix_field_usage_analytics_id', 'field_usage_analytics', ['id'])
    op.create_index('ix_field_usage_analytics_year_month', 'field_usage_analytics', ['year', 'month'])

    # ========================================================================
    # Create field_rotation_suggestions table
    # ========================================================================
    op.create_table(
        'field_rotation_suggestions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('field_id', sa.Integer(), nullable=False),
        sa.Column('suggested_date', sa.Date(), nullable=False),
        sa.Column('suggestion_type', postgresql.ENUM(
            'rest_field', 'rotate_horses', 'reduce_usage', 'condition_check',
            name='suggestiontype', create_type=False
        ), nullable=False),
        sa.Column('priority', postgresql.ENUM(
            'low', 'medium', 'high', 'urgent',
            name='suggestionpriority', create_type=False
        ), nullable=False, server_default='medium'),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('acknowledged', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('acknowledged_by_id', sa.Integer(), nullable=True),
        sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['field_id'], ['fields.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['acknowledged_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_rotation_suggestions_id', 'field_rotation_suggestions', ['id'])
    op.create_index('ix_field_rotation_suggestions_suggested_date', 'field_rotation_suggestions', ['suggested_date'])
    op.create_index('ix_field_rotation_suggestions_acknowledged', 'field_rotation_suggestions', ['acknowledged'])


def downgrade():
    # Drop tables in reverse dependency order
    op.drop_index('ix_field_rotation_suggestions_acknowledged', 'field_rotation_suggestions')
    op.drop_index('ix_field_rotation_suggestions_suggested_date', 'field_rotation_suggestions')
    op.drop_index('ix_field_rotation_suggestions_id', 'field_rotation_suggestions')
    op.drop_table('field_rotation_suggestions')

    op.drop_index('ix_field_usage_analytics_year_month', 'field_usage_analytics')
    op.drop_index('ix_field_usage_analytics_id', 'field_usage_analytics')
    op.drop_table('field_usage_analytics')

    op.drop_index('ix_field_flood_risks_field_id', 'field_flood_risks')
    op.drop_index('ix_field_flood_risks_id', 'field_flood_risks')
    op.drop_table('field_flood_risks')

    op.drop_index('ix_flood_monitoring_stations_id', 'flood_monitoring_stations')
    op.drop_table('flood_monitoring_stations')

    op.drop_index('ix_grant_feature_links_id', 'grant_feature_links')
    op.drop_table('grant_feature_links')

    op.drop_index('ix_grant_field_links_id', 'grant_field_links')
    op.drop_table('grant_field_links')

    op.drop_index('ix_feature_maintenance_logs_maintenance_date', 'feature_maintenance_logs')
    op.drop_index('ix_feature_maintenance_logs_id', 'feature_maintenance_logs')
    op.drop_table('feature_maintenance_logs')

    op.drop_index('ix_land_features_next_maintenance_due', 'land_features')
    op.drop_index('ix_land_features_field_id', 'land_features')
    op.drop_index('ix_land_features_feature_type', 'land_features')
    op.drop_index('ix_land_features_id', 'land_features')
    op.drop_table('land_features')

    op.drop_index('ix_grant_payment_schedules_due_date', 'grant_payment_schedules')
    op.drop_index('ix_grant_payment_schedules_id', 'grant_payment_schedules')
    op.drop_table('grant_payment_schedules')

    op.drop_index('ix_grants_status', 'grants')
    op.drop_index('ix_grants_scheme_type', 'grants')
    op.drop_index('ix_grants_id', 'grants')
    op.drop_table('grants')

    # Drop enum types
    op.execute('DROP TYPE suggestionpriority')
    op.execute('DROP TYPE suggestiontype')
    op.execute('DROP TYPE floodrisklevel')
    op.execute('DROP TYPE maintenancetype')
    op.execute('DROP TYPE watersourcetype')
    op.execute('DROP TYPE featurecondition')
    op.execute('DROP TYPE landfeaturetype')
    op.execute('DROP TYPE grantpaymentstatus')
    op.execute('DROP TYPE grantstatus')
    op.execute('DROP TYPE grantschemetype')
