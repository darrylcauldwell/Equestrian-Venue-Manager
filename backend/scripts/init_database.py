#!/usr/bin/env python3
"""
Initialize database with minimal required data for production.

This script creates ONLY:
- The admin user account

Demo data should be loaded separately via the admin Settings page.

Usage:
    python scripts/init_database.py
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session


def init_admin_user(db: Session) -> bool:
    """
    Create the initial admin user if it doesn't exist.

    Returns:
        True if admin was created, False if already exists
    """
    from app.models.user import User, UserRole
    from app.utils.auth import get_password_hash

    # Check if admin already exists
    existing_admin = db.query(User).filter(User.username == "admin").first()
    if existing_admin:
        print("Admin user already exists - skipping creation")
        return False

    # Create admin user
    admin = User(
        username="admin",
        email="admin@example.com",
        name="Administrator",
        password_hash=get_password_hash("password"),
        role=UserRole.ADMIN,
        is_active=True,
        must_change_password=True  # Force password change on first login
    )
    db.add(admin)
    db.commit()

    print("Admin user created successfully")
    return True


def main():
    """Main function to initialize the database."""
    from app.database import SessionLocal

    print("=" * 50)
    print("Database Initialization")
    print("=" * 50)

    db = SessionLocal()

    try:
        created = init_admin_user(db)

        print("=" * 50)
        print("Initialization complete!")
        print("=" * 50)

        if created:
            print("\nAdmin account created:")
            print("  Username: admin")
            print("  Password: password")
            print("")
            print("IMPORTANT: Change the admin password after first login!")

        print("\nTo load demo data, log in as admin and go to:")
        print("  Settings > Demo Data > Enable Demo Data")

    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
