"""Add is_insurance_claimable to services table

Revision ID: add_service_insurance_claimable
Revises: add_insurance_claimable_livery
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa


revision = 'add_service_insurance_claimable'
down_revision = 'add_insurance_claimable_livery'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_insurance_claimable column to services table
    op.add_column('services', sa.Column('is_insurance_claimable', sa.Boolean(),
                                        nullable=False, server_default='false'))


def downgrade():
    op.drop_column('services', 'is_insurance_claimable')
