#!/usr/bin/env python3
"""
Seed E2E test fixtures - minimal, deterministic data for testing.

This script loads seed_data.e2e.json which contains a minimal dataset
specifically designed for E2E testing. Unlike the demo data, this
dataset is:
- Minimal (only what tests need)
- Predictable (matches frontend/e2e/fixtures.ts expectations)
- Deterministic (same data every run)

Usage:
    python scripts/seed_e2e.py [--no-clear]

Options:
    --no-clear    Don't clear existing data before seeding (not recommended)
"""

import json
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


def main():
    """Main function to seed E2E test fixtures."""
    from app.database import SessionLocal
    from app.utils.backup import import_database, SeedingError
    from app.utils.seed_validator import SeedValidationError

    clear_first = "--no-clear" not in sys.argv

    print("=" * 50)
    print("E2E Test Fixtures Seeder")
    print("=" * 50)

    # Load E2E fixtures
    seed_file = Path(__file__).parent.parent / "seed_data.e2e.json"
    if not seed_file.exists():
        print(f"ERROR: E2E fixtures file not found: {seed_file}")
        print("Please ensure seed_data.e2e.json exists in the backend directory.")
        sys.exit(1)

    print(f"Loading fixtures from: {seed_file}")
    with open(seed_file, "r") as f:
        data = json.load(f)

    # Create database session
    db = SessionLocal()

    try:
        if clear_first:
            print("Clearing existing data...")

        print("Importing E2E fixtures...")
        counts = import_database(db, data, clear_first=clear_first, validate=True)

        print("=" * 50)
        print("E2E fixtures loaded successfully!")
        print("=" * 50)
        print("\nEntities created:")
        for entity, count in sorted(counts.items()):
            if count > 0:
                print(f"  {entity}: {count}")

        print("\nTest users available:")
        print("  admin     / password  (role: admin)")
        print("  coach     / password  (role: coach)")
        print("  livery1   / password  (role: livery)")
        print("  livery2   / password  (role: livery)")
        print("  staff1    / password  (role: staff)")
        print("  public1   / password  (role: public)")

    except SeedValidationError as e:
        print(f"\nERROR: Validation failed:\n{e}")
        sys.exit(1)
    except SeedingError as e:
        print(f"\nERROR: Seeding failed:\n{e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
