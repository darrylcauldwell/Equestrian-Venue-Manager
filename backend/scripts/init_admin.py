#!/usr/bin/env python3
"""
Initialize database with default admin user.

This script should be run after database migrations to ensure there is
always an admin user available. It will only create the admin if no
admin user exists.

The default admin credentials are:
    Username: admin
    Password: password

IMPORTANT: Change this password immediately after first login!

Usage:
    python scripts/init_admin.py
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash

DEFAULT_ADMIN_USERNAME = "admin"
DEFAULT_ADMIN_PASSWORD = "password"
DEFAULT_ADMIN_NAME = "System Administrator"


def create_default_admin(db: Session) -> bool:
    """
    Create default admin user if no admin exists.

    Returns:
        True if admin was created, False if admin already exists
    """
    # Check if any admin user exists
    existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if existing_admin:
        print(f"Admin user already exists: {existing_admin.username}")
        return False

    # Create default admin user
    admin_user = User(
        username=DEFAULT_ADMIN_USERNAME,
        name=DEFAULT_ADMIN_NAME,
        password_hash=get_password_hash(DEFAULT_ADMIN_PASSWORD),
        role=UserRole.ADMIN,
        must_change_password=True  # Force password change on first login
    )

    db.add(admin_user)
    db.commit()

    print("=" * 60)
    print("Default admin user created!")
    print("=" * 60)
    print(f"  Username: {DEFAULT_ADMIN_USERNAME}")
    print(f"  Password: {DEFAULT_ADMIN_PASSWORD}")
    print("=" * 60)
    print()
    print("IMPORTANT: Change this password immediately after first login!")
    print()

    return True


def main():
    """Main function to initialize admin user."""
    print()
    print("Equestrian Venue Manager - Admin Initialization")
    print("-" * 50)
    print()

    db = SessionLocal()

    try:
        created = create_default_admin(db)
        sys.exit(0 if created else 0)  # Both cases are success
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
