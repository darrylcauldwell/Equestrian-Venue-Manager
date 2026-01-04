"""Add feed change notifications and acknowledgements tables

Revision ID: add_feed_notifications
Revises: add_staff_day_statuses
Create Date: 2026-01-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'add_feed_notifications'
down_revision: Union[str, None] = 'add_staff_day_statuses'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Define the enum type
feedchangetype = postgresql.ENUM(
    'requirement_created', 'requirement_updated', 'requirement_deleted',
    'addition_created', 'addition_updated', 'addition_deleted',
    'supply_alert',
    name='feedchangetype',
    create_type=False
)


def upgrade() -> None:
    # Create enum type for feed change type (if not exists)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE feedchangetype AS ENUM (
                'requirement_created', 'requirement_updated', 'requirement_deleted',
                'addition_created', 'addition_updated', 'addition_deleted',
                'supply_alert'
            );
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """)

    # Check if notifications table already exists before creating
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feed_change_notifications')"
    ))
    notifications_exists = result.scalar()

    if not notifications_exists:
        # Create the feed_change_notifications table
        op.create_table(
            'feed_change_notifications',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('change_type', feedchangetype, nullable=False),
            sa.Column('horse_id', sa.Integer(), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('details', sa.JSON(), nullable=True),
            sa.Column('created_by_id', sa.Integer(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['horse_id'], ['horses.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_feed_change_notifications_id'), 'feed_change_notifications', ['id'], unique=False)
        op.create_index('ix_feed_change_notifications_horse_id', 'feed_change_notifications', ['horse_id'], unique=False)
        op.create_index('ix_feed_change_notifications_created_at', 'feed_change_notifications', ['created_at'], unique=False)

    # Check if acknowledgements table already exists before creating
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'feed_change_acknowledgements')"
    ))
    acknowledgements_exists = result.scalar()

    if not acknowledgements_exists:
        # Create the feed_change_acknowledgements table
        op.create_table(
            'feed_change_acknowledgements',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('notification_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('acknowledged_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['notification_id'], ['feed_change_notifications.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['users.id']),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('notification_id', 'user_id', name='uq_notification_user')
        )
        op.create_index(op.f('ix_feed_change_acknowledgements_id'), 'feed_change_acknowledgements', ['id'], unique=False)
        op.create_index('ix_feed_change_acknowledgements_notification_id', 'feed_change_acknowledgements', ['notification_id'], unique=False)
        op.create_index('ix_feed_change_acknowledgements_user_id', 'feed_change_acknowledgements', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_feed_change_acknowledgements_user_id', table_name='feed_change_acknowledgements')
    op.drop_index('ix_feed_change_acknowledgements_notification_id', table_name='feed_change_acknowledgements')
    op.drop_index(op.f('ix_feed_change_acknowledgements_id'), table_name='feed_change_acknowledgements')
    op.drop_table('feed_change_acknowledgements')

    op.drop_index('ix_feed_change_notifications_created_at', table_name='feed_change_notifications')
    op.drop_index('ix_feed_change_notifications_horse_id', table_name='feed_change_notifications')
    op.drop_index(op.f('ix_feed_change_notifications_id'), table_name='feed_change_notifications')
    op.drop_table('feed_change_notifications')

    op.execute("DROP TYPE IF EXISTS feedchangetype")
