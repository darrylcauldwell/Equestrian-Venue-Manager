#!/usr/bin/env python3
"""
Seed database with test data for development/UX testing.

Uses the unified import function from app.utils.backup, which handles
both seed format (name references, relative dates) and backup format
(IDs, absolute dates).

Usage:
    python scripts/seed_database.py [--clear] [--no-validate]

Options:
    --clear         Clear existing data before seeding (WARNING: destructive!)
    --no-validate   Skip seed data validation (not recommended)
"""

import json
import sys
from pathlib import Path
from typing import Optional

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session


def load_seed_data() -> dict:
    """Load seed data from JSON file."""
    seed_file = Path(__file__).parent.parent / "seed_data.json"
    with open(seed_file, "r") as f:
        return json.load(f)


def seed_demo_data(db: Session, clear_first: bool = False, validate: bool = True) -> dict:
    """
    Seed demo data into the database.

    This function can be called from the API or CLI.

    All operations are performed in a single transaction. If any operation fails,
    all changes are rolled back automatically.

    Args:
        db: SQLAlchemy database session
        clear_first: Whether to clear existing data first
        validate: Whether to validate seed data before importing (default: True)

    Returns:
        Dictionary with counts of created entities

    Raises:
        SeedValidationError: If validation fails (when validate=True)
        SeedingError: If any part of the seeding fails. All changes are rolled back.
    """
    from app.utils.backup import import_database

    # Load seed data
    data = load_seed_data()

    # Use unified import function (handles transaction safety internally)
    counts = import_database(db, data, clear_first=clear_first, validate=validate)

    return counts


def main():
    """Main function to seed the database (CLI entry point)."""
    from app.database import SessionLocal
    from app.utils.backup import SeedingError
    from app.utils.seed_validator import SeedValidationError

    clear_first = "--clear" in sys.argv
    validate = "--no-validate" not in sys.argv

    print("=" * 50)
    print("Database Seeder")
    print("=" * 50)

    if not validate:
        print("WARNING: Validation disabled. Errors may occur during import.")

    if clear_first:
        response = input("WARNING: This will delete all existing data. Continue? (yes/no): ")
        if response.lower() != "yes":
            print("Aborted.")
            return

    # Create database session
    db = SessionLocal()

    try:
        counts = seed_demo_data(db, clear_first=clear_first, validate=validate)

        print("=" * 50)
        print("Seeding complete!")
        print("=" * 50)
        print("\nEntities created:")
        for entity, count in counts.items():
            if count > 0:
                print(f"  {entity}: {count}")

        # Print user accounts grouped by role (read from seed data)
        seed_data = load_seed_data()
        users_by_role: dict[str, list[str]] = {}
        for user in seed_data.get("users", []):
            role = user.get("role", "unknown")
            users_by_role.setdefault(role, []).append(user["username"])

        print("\nTest accounts created (all passwords: 'password'):")
        role_order = ["admin", "coach", "livery", "staff", "public"]
        for role in role_order:
            if role in users_by_role:
                print(f"  {role.capitalize():7} {', '.join(sorted(users_by_role[role]))}")

    except SeedValidationError as e:
        print(f"\nVALIDATION FAILED:")
        print(e.result.get_report())
        print("\nNo data was imported. Fix the validation errors above and retry.")
        sys.exit(1)
    except SeedingError as e:
        print(f"\nSEEDING FAILED: {e}")
        print("All changes have been rolled back - no partial data remains.")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
