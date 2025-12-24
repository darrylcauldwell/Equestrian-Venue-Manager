"""Add structured address fields to site_settings

Revision ID: add_structured_address
Revises: add_livery_booking_rules
Create Date: 2025-12-17 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_structured_address'
down_revision: Union[str, None] = 'add_livery_booking_rules'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add structured address fields
    op.add_column('site_settings', sa.Column('address_street', sa.String(200), nullable=True))
    op.add_column('site_settings', sa.Column('address_town', sa.String(100), nullable=True))
    op.add_column('site_settings', sa.Column('address_county', sa.String(100), nullable=True))
    op.add_column('site_settings', sa.Column('address_postcode', sa.String(10), nullable=True))

    # Migrate data from old address field if it exists
    # The old address format was: "Abbey Farm, Country Lane, Somewhere, AB1 2CD"
    # We'll try to parse it, but this is best-effort
    connection = op.get_bind()
    result = connection.execute(sa.text("SELECT id, address FROM site_settings WHERE address IS NOT NULL"))
    for row in result:
        if row.address:
            parts = [p.strip() for p in row.address.split(',')]
            street = parts[0] if len(parts) > 0 else None
            town = parts[1] if len(parts) > 1 else None
            county = parts[2] if len(parts) > 2 else None
            postcode = parts[3] if len(parts) > 3 else None

            connection.execute(
                sa.text("""
                    UPDATE site_settings
                    SET address_street = :street,
                        address_town = :town,
                        address_county = :county,
                        address_postcode = :postcode
                    WHERE id = :id
                """),
                {"street": street, "town": town, "county": county, "postcode": postcode, "id": row.id}
            )

    # Drop the old address column
    op.drop_column('site_settings', 'address')


def downgrade() -> None:
    # Re-add old address column
    op.add_column('site_settings', sa.Column('address', sa.String(500), nullable=True))

    # Migrate data back to old format
    connection = op.get_bind()
    result = connection.execute(sa.text("""
        SELECT id, address_street, address_town, address_county, address_postcode
        FROM site_settings
    """))
    for row in result:
        parts = [p for p in [row.address_street, row.address_town, row.address_county, row.address_postcode] if p]
        address = ', '.join(parts) if parts else None
        connection.execute(
            sa.text("UPDATE site_settings SET address = :address WHERE id = :id"),
            {"address": address, "id": row.id}
        )

    # Drop structured fields
    op.drop_column('site_settings', 'address_postcode')
    op.drop_column('site_settings', 'address_county')
    op.drop_column('site_settings', 'address_town')
    op.drop_column('site_settings', 'address_street')
