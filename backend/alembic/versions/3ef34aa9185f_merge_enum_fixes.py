"""merge_enum_fixes

Revision ID: 3ef34aa9185f
Revises: fix_demeanor_enum, fix_leavetype_enum
Create Date: 2025-12-19 15:45:20.613183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ef34aa9185f'
down_revision: Union[str, None] = ('fix_demeanor_enum', 'fix_leavetype_enum')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
