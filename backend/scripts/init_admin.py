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

Environment variables:
    SKIP_PASSWORD_CHANGE: Set to 'true' to skip password change requirement (for CI/testing)
    CI: When set, automatically skips password change requirement

Usage:
    python scripts/init_admin.py
"""

import os
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

    # In CI/testing environments, skip password change requirement
    skip_password_change = (
        os.environ.get("SKIP_PASSWORD_CHANGE", "").lower() == "true" or
        os.environ.get("CI", "").lower() == "true"
    )

    # Create default admin user
    admin_user = User(
        username=DEFAULT_ADMIN_USERNAME,
        name=DEFAULT_ADMIN_NAME,
        password_hash=get_password_hash(DEFAULT_ADMIN_PASSWORD),
        role=UserRole.ADMIN,
        must_change_password=not skip_password_change
    )

    db.add(admin_user)
    db.commit()

    print("=" * 60)
    print("Default admin user created!")
    print("=" * 60)
    print(f"  Username: {DEFAULT_ADMIN_USERNAME}")
    print(f"  Password: {DEFAULT_ADMIN_PASSWORD}")
    if skip_password_change:
        print("  Password change: SKIPPED (CI/test mode)")
    else:
        print("  Password change: REQUIRED on first login")
    print("=" * 60)
    print()
    if not skip_password_change:
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
