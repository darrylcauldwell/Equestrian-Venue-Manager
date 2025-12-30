"""Add quote workflow to service requests

Revision ID: add_quote_workflow
Revises: 3ef34aa9185f
Create Date: 2024-12-23

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_quote_workflow'
down_revision = 'add_rehab_service_requests'
branch_labels = None
depends_on = None


def upgrade():
    # Add 'quoted' value to requeststatus enum
    op.execute("ALTER TYPE requeststatus ADD VALUE IF NOT EXISTS 'quoted' AFTER 'pending'")

    # Add quote fields to service_requests table
    op.add_column('service_requests', sa.Column('quote_amount', sa.Numeric(10, 2), nullable=True))
    op.add_column('service_requests', sa.Column('quote_notes', sa.Text(), nullable=True))
    op.add_column('service_requests', sa.Column('quoted_at', sa.DateTime(), nullable=True))
    op.add_column('service_requests', sa.Column('quoted_by_id', sa.Integer(), nullable=True))

    # Add foreign key for quoted_by_id
    op.create_foreign_key(
        'fk_service_requests_quoted_by_id',
        'service_requests',
        'users',
        ['quoted_by_id'],
        ['id']
    )


def downgrade():
    # Remove foreign key
    op.drop_constraint('fk_service_requests_quoted_by_id', 'service_requests', type_='foreignkey')

    # Remove columns
    op.drop_column('service_requests', 'quoted_by_id')
    op.drop_column('service_requests', 'quoted_at')
    op.drop_column('service_requests', 'quote_notes')
    op.drop_column('service_requests', 'quote_amount')

    # Note: Cannot easily remove enum value in PostgreSQL
