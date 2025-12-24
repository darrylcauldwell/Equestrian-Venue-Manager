"""Add weekly_price and billing_type to livery_packages

Revision ID: add_weekly_billing_to_livery
Revises: add_venue_fee_waived_flags
Create Date: 2025-12-23

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_weekly_billing_to_livery'
down_revision = 'add_venue_fee_waived_flags'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add weekly_price column for holiday livery
    op.add_column('livery_packages', sa.Column('weekly_price', sa.Numeric(precision=10, scale=2), nullable=True))

    # Add billing_type enum column
    # First create the enum type
    billing_type_enum = sa.Enum('MONTHLY', 'WEEKLY', name='billingtype')
    billing_type_enum.create(op.get_bind(), checkfirst=True)

    # Add the column with default value
    op.add_column('livery_packages', sa.Column('billing_type', billing_type_enum, nullable=False, server_default='MONTHLY'))


def downgrade() -> None:
    # Remove columns
    op.drop_column('livery_packages', 'billing_type')
    op.drop_column('livery_packages', 'weekly_price')

    # Drop enum type
    sa.Enum(name='billingtype').drop(op.get_bind(), checkfirst=True)
