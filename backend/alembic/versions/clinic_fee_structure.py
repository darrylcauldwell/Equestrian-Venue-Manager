"""Update clinic fee structure - remove duration_type, rename time fields, add fee breakdown

Revision ID: clinic_fee_structure
Revises: add_preferred_lesson_type
Create Date: 2025-12-18 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'clinic_fee_structure'
down_revision: Union[str, None] = 'add_preferred_lesson_type'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename time columns to proposed_start_time and proposed_end_time
    op.alter_column('clinic_requests', 'start_time', new_column_name='proposed_start_time')
    op.alter_column('clinic_requests', 'end_time', new_column_name='proposed_end_time')

    # Add new fee structure columns
    op.add_column('clinic_requests',
        sa.Column('coach_fee_private', sa.Numeric(10, 2), nullable=True)
    )
    op.add_column('clinic_requests',
        sa.Column('coach_fee_group', sa.Numeric(10, 2), nullable=True)
    )
    op.add_column('clinic_requests',
        sa.Column('venue_fee_private', sa.Numeric(10, 2), nullable=True)
    )
    op.add_column('clinic_requests',
        sa.Column('venue_fee_group', sa.Numeric(10, 2), nullable=True)
    )
    op.add_column('clinic_requests',
        sa.Column('livery_venue_fee_private', sa.Numeric(10, 2), server_default='0')
    )
    op.add_column('clinic_requests',
        sa.Column('livery_venue_fee_group', sa.Numeric(10, 2), server_default='0')
    )

    # Migrate existing price data to coach fees (if any exists)
    op.execute("""
        UPDATE clinic_requests
        SET coach_fee_private = price_per_lesson,
            coach_fee_group = group_price_per_person
        WHERE price_per_lesson IS NOT NULL OR group_price_per_person IS NOT NULL
    """)

    # Drop old columns
    op.drop_column('clinic_requests', 'duration_type')
    op.drop_column('clinic_requests', 'price_per_lesson')
    op.drop_column('clinic_requests', 'group_price_per_person')


def downgrade() -> None:
    # Re-add old columns
    op.add_column('clinic_requests',
        sa.Column('duration_type', sa.String(20), server_default='full_day')
    )
    op.add_column('clinic_requests',
        sa.Column('price_per_lesson', sa.Numeric(10, 2), nullable=True)
    )
    op.add_column('clinic_requests',
        sa.Column('group_price_per_person', sa.Numeric(10, 2), nullable=True)
    )

    # Migrate fee data back to old columns
    op.execute("""
        UPDATE clinic_requests
        SET price_per_lesson = coach_fee_private,
            group_price_per_person = coach_fee_group
        WHERE coach_fee_private IS NOT NULL OR coach_fee_group IS NOT NULL
    """)

    # Drop new fee columns
    op.drop_column('clinic_requests', 'coach_fee_private')
    op.drop_column('clinic_requests', 'coach_fee_group')
    op.drop_column('clinic_requests', 'venue_fee_private')
    op.drop_column('clinic_requests', 'venue_fee_group')
    op.drop_column('clinic_requests', 'livery_venue_fee_private')
    op.drop_column('clinic_requests', 'livery_venue_fee_group')

    # Rename time columns back
    op.alter_column('clinic_requests', 'proposed_start_time', new_column_name='start_time')
    op.alter_column('clinic_requests', 'proposed_end_time', new_column_name='end_time')
