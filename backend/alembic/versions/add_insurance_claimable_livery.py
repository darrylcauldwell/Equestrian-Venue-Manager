"""Add is_insurance_claimable to livery_packages

Revision ID: add_insurance_claimable_livery
Revises: add_insurance_claimable
Create Date: 2024-01-15
"""
from alembic import op
import sqlalchemy as sa


revision = 'add_insurance_claimable_livery'
down_revision = 'add_insurance_claimable'
branch_labels = None
depends_on = None


def upgrade():
    # Add is_insurance_claimable column to livery_packages table
    op.add_column('livery_packages', sa.Column('is_insurance_claimable', sa.Boolean(),
                                               nullable=False, server_default='false'))


def downgrade():
    op.drop_column('livery_packages', 'is_insurance_claimable')
