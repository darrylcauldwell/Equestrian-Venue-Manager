"""Add insurance_claimable to service_requests

Revision ID: add_insurance_claimable
Revises: add_quote_workflow
Create Date: 2024-12-23

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_insurance_claimable'
down_revision = 'add_quote_workflow'
branch_labels = None
depends_on = None


def upgrade():
    # Add insurance_claimable column to service_requests table
    op.add_column('service_requests', sa.Column('insurance_claimable', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    op.drop_column('service_requests', 'insurance_claimable')
