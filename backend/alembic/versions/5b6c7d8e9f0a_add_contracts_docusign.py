"""Add contract management and DocuSign tables

Revision ID: 5b6c7d8e9f0a
Revises: 4a2b3c4d5e6f
Create Date: 2025-12-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5b6c7d8e9f0a'
down_revision = '4a2b3c4d5e6f'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum types with lowercase values
    op.execute("DO $$ BEGIN CREATE TYPE contracttype AS ENUM ('livery', 'employment', 'custom'); EXCEPTION WHEN duplicate_object THEN null; END $$;")
    op.execute("DO $$ BEGIN CREATE TYPE signaturestatus AS ENUM ('pending', 'sent', 'signed', 'declined', 'voided'); EXCEPTION WHEN duplicate_object THEN null; END $$;")

    # Create contract_templates table
    op.create_table(
        'contract_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('contract_type', sa.Enum('livery', 'employment', 'custom', name='contracttype', create_constraint=False, native_enum=False), nullable=False),
        sa.Column('livery_package_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['livery_package_id'], ['livery_packages.id']),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_contract_templates_id', 'contract_templates', ['id'], unique=False)

    # Create contract_versions table
    op.create_table(
        'contract_versions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('template_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('html_content', sa.Text(), nullable=False),
        sa.Column('change_summary', sa.Text(), nullable=True),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['template_id'], ['contract_templates.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_contract_versions_id', 'contract_versions', ['id'], unique=False)
    op.create_index('ix_contract_versions_template_id', 'contract_versions', ['template_id'], unique=False)

    # Create contract_signatures table
    op.create_table(
        'contract_signatures',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contract_version_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('docusign_envelope_id', sa.String(100), nullable=True),
        sa.Column('status', sa.Enum('pending', 'sent', 'signed', 'declined', 'voided', name='signaturestatus', create_constraint=False, native_enum=False), nullable=False, server_default='pending'),
        sa.Column('requested_at', sa.DateTime(), nullable=True),
        sa.Column('signed_at', sa.DateTime(), nullable=True),
        sa.Column('signed_pdf_filename', sa.String(255), nullable=True),
        sa.Column('requested_by_id', sa.Integer(), nullable=False),
        sa.Column('previous_signature_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['contract_version_id'], ['contract_versions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['requested_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['previous_signature_id'], ['contract_signatures.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_contract_signatures_id', 'contract_signatures', ['id'], unique=False)
    op.create_index('ix_contract_signatures_user_id', 'contract_signatures', ['user_id'], unique=False)

    # Add DocuSign settings columns to site_settings
    op.add_column('site_settings', sa.Column('docusign_enabled', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('site_settings', sa.Column('docusign_integration_key', sa.String(100), nullable=True))
    op.add_column('site_settings', sa.Column('docusign_account_id', sa.String(100), nullable=True))
    op.add_column('site_settings', sa.Column('docusign_user_id', sa.String(100), nullable=True))
    op.add_column('site_settings', sa.Column('docusign_private_key', sa.Text(), nullable=True))
    op.add_column('site_settings', sa.Column('docusign_test_mode', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('site_settings', sa.Column('docusign_base_url', sa.String(200), nullable=True))


def downgrade():
    # Remove DocuSign settings columns from site_settings
    op.drop_column('site_settings', 'docusign_base_url')
    op.drop_column('site_settings', 'docusign_test_mode')
    op.drop_column('site_settings', 'docusign_private_key')
    op.drop_column('site_settings', 'docusign_user_id')
    op.drop_column('site_settings', 'docusign_account_id')
    op.drop_column('site_settings', 'docusign_integration_key')
    op.drop_column('site_settings', 'docusign_enabled')

    # Drop contract tables
    op.drop_index('ix_contract_signatures_user_id', table_name='contract_signatures')
    op.drop_index('ix_contract_signatures_id', table_name='contract_signatures')
    op.drop_table('contract_signatures')

    op.drop_index('ix_contract_versions_template_id', table_name='contract_versions')
    op.drop_index('ix_contract_versions_id', table_name='contract_versions')
    op.drop_table('contract_versions')

    op.drop_index('ix_contract_templates_id', table_name='contract_templates')
    op.drop_table('contract_templates')

    # Drop enum types
    op.execute('DROP TYPE IF EXISTS signaturestatus')
    op.execute('DROP TYPE IF EXISTS contracttype')
