"""Add saddles table and link to saddle_fit_records

Revision ID: 8e9f0a1b2c3d
Revises: 7d8e9f0a1b2c
Create Date: 2025-12-28

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8e9f0a1b2c3d'
down_revision = '7d8e9f0a1b2c'
branch_labels = None
depends_on = None


def upgrade():
    # Create saddles table
    op.create_table(
        'saddles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('horse_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('saddle_type', sa.String(50), nullable=False),
        sa.Column('brand', sa.String(100), nullable=True),
        sa.Column('model', sa.String(100), nullable=True),
        sa.Column('serial_number', sa.String(100), nullable=True),
        sa.Column('purchase_date', sa.Date(), nullable=True),
        sa.Column('is_active', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_saddles_id'), 'saddles', ['id'], unique=False)
    op.create_index(op.f('ix_saddles_horse_id'), 'saddles', ['horse_id'], unique=False)

    # Add saddle_id column to saddle_fit_records
    op.add_column('saddle_fit_records', sa.Column('saddle_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_saddle_fit_records_saddle_id',
        'saddle_fit_records',
        'saddles',
        ['saddle_id'],
        ['id'],
        ondelete='SET NULL'
    )
    op.create_index(op.f('ix_saddle_fit_records_saddle_id'), 'saddle_fit_records', ['saddle_id'], unique=False)


def downgrade():
    # Remove saddle_id from saddle_fit_records
    op.drop_index(op.f('ix_saddle_fit_records_saddle_id'), table_name='saddle_fit_records')
    op.drop_constraint('fk_saddle_fit_records_saddle_id', 'saddle_fit_records', type_='foreignkey')
    op.drop_column('saddle_fit_records', 'saddle_id')

    # Drop saddles table
    op.drop_index(op.f('ix_saddles_horse_id'), table_name='saddles')
    op.drop_index(op.f('ix_saddles_id'), table_name='saddles')
    op.drop_table('saddles')
