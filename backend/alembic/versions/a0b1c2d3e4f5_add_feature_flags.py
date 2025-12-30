"""Add feature_flags JSON column to site_settings

Revision ID: a0b1c2d3e4f5
Revises: 9f0a1b2c3d4e
Create Date: 2024-12-28

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a0b1c2d3e4f5'
down_revision: Union[str, None] = '9f0a1b2c3d4e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Default feature flags - all disabled except user_management and timesheets
DEFAULT_FEATURE_FLAGS = {
    # Core (always enabled, cannot be disabled)
    "user_management": {"enabled": True, "group": "core", "locked": True},

    # Staff Operations - timesheets enabled for initial rollout
    "timesheets": {"enabled": True, "group": "staff_operations", "locked": False},
    "staff_management": {"enabled": False, "group": "staff_operations", "locked": False},
    "yard_tasks": {"enabled": False, "group": "staff_operations", "locked": False},

    # Livery
    "livery_services": {"enabled": False, "group": "livery", "locked": False},
    "holiday_livery": {"enabled": False, "group": "livery", "locked": False},
    "turnout_management": {"enabled": False, "group": "livery", "locked": False},

    # Health & Care
    "health_records": {"enabled": False, "group": "health", "locked": False},
    "care_plans": {"enabled": False, "group": "health", "locked": False},
    "feed_management": {"enabled": False, "group": "health", "locked": False},
    "worming_management": {"enabled": False, "group": "health", "locked": False},

    # Facilities
    "arena_management": {"enabled": False, "group": "facilities", "locked": False},
    "arena_bookings": {"enabled": False, "group": "facilities", "locked": False},
    "stables_management": {"enabled": False, "group": "facilities", "locked": False},
    "fields_management": {"enabled": False, "group": "facilities", "locked": False},
    "land_management": {"enabled": False, "group": "facilities", "locked": False},

    # Financial
    "invoicing": {"enabled": False, "group": "financial", "locked": False},
    "billing_payments": {"enabled": False, "group": "financial", "locked": False},

    # Events
    "events_clinics": {"enabled": False, "group": "events", "locked": False},
    "lessons": {"enabled": False, "group": "events", "locked": False},

    # Communication
    "noticeboard": {"enabled": False, "group": "communication", "locked": False},
    "service_requests": {"enabled": False, "group": "communication", "locked": False},
    "professional_directory": {"enabled": False, "group": "communication", "locked": False},

    # Contracts
    "contract_management": {"enabled": False, "group": "contracts", "locked": False},
    "e_signatures": {"enabled": False, "group": "contracts", "locked": False},

    # Administration
    "compliance": {"enabled": False, "group": "administration", "locked": False},
    "security_management": {"enabled": False, "group": "administration", "locked": False},
    "backups": {"enabled": False, "group": "administration", "locked": False},

    # Integrations (reference existing toggles)
    "stripe_integration": {"enabled": False, "group": "integrations", "locked": False},
    "docusign_integration": {"enabled": False, "group": "integrations", "locked": False},
    "whatsapp_notifications": {"enabled": False, "group": "integrations", "locked": False},
    "sms_notifications": {"enabled": False, "group": "integrations", "locked": False},
}


def upgrade() -> None:
    # Add feature_flags JSON column
    op.add_column('site_settings', sa.Column('feature_flags', sa.JSON(), nullable=True))

    # Set default value for existing rows
    import json
    op.execute(
        sa.text(
            "UPDATE site_settings SET feature_flags = :flags"
        ).bindparams(flags=json.dumps(DEFAULT_FEATURE_FLAGS))
    )


def downgrade() -> None:
    op.drop_column('site_settings', 'feature_flags')
