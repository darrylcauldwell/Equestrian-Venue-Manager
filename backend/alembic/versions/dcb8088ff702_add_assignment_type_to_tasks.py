"""add_assignment_type_to_tasks

Revision ID: dcb8088ff702
Revises: add_rugging_guide
Create Date: 2025-12-17 18:34:55.664984

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'dcb8088ff702'
down_revision: Union[str, None] = 'add_rugging_guide'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create the enum type first
    assignment_type = sa.Enum('SPECIFIC', 'POOL', 'BACKLOG', name='assignmenttype')
    assignment_type.create(op.get_bind(), checkfirst=True)

    # Add the column with default value
    op.add_column('yard_tasks', sa.Column('assignment_type',
        sa.Enum('SPECIFIC', 'POOL', 'BACKLOG', name='assignmenttype'),
        nullable=True,
        server_default='BACKLOG'))

    # Update existing rows to have BACKLOG as default
    op.execute("UPDATE yard_tasks SET assignment_type = 'BACKLOG' WHERE assignment_type IS NULL")


def downgrade() -> None:
    op.drop_column('yard_tasks', 'assignment_type')
    # Drop the enum type
    sa.Enum(name='assignmenttype').drop(op.get_bind(), checkfirst=True)
