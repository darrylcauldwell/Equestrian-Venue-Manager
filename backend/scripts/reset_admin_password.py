#!/usr/bin/env python3
"""
BREAKGLASS: Reset admin password to default.

This script resets the admin user's password to the default password.
This should ONLY be used in emergency situations when you've lost access
to the admin account.

The default admin credentials after reset:
    Username: admin
    Password: password

IMPORTANT: Change this password immediately after login!

Usage:
    python scripts/reset_admin_password.py

Or via environment variable at container startup:
    RESET_ADMIN_PASSWORD=true docker compose up
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


def reset_admin_password(db: Session) -> bool:
    """
    Reset admin user's password to default.

    Returns:
        True if password was reset, False if admin doesn't exist
    """
    # Find the admin user
    admin_user = db.query(User).filter(
        User.username == DEFAULT_ADMIN_USERNAME,
        User.role == UserRole.ADMIN
    ).first()

    if not admin_user:
        print(f"ERROR: Admin user '{DEFAULT_ADMIN_USERNAME}' not found!")
        print("Please create an admin user first using init_admin.py")
        return False

    # Reset password
    admin_user.password_hash = get_password_hash(DEFAULT_ADMIN_PASSWORD)
    admin_user.must_change_password = True

    db.commit()

    print("=" * 60)
    print("BREAKGLASS: Admin password has been reset!")
    print("=" * 60)
    print(f"  Username: {DEFAULT_ADMIN_USERNAME}")
    print(f"  Password: {DEFAULT_ADMIN_PASSWORD}")
    print("=" * 60)
    print()
    print("IMPORTANT: Change this password immediately after login!")
    print()

    return True


def main():
    """Main function to reset admin password."""
    print()
    print("Equestrian Venue Manager - Breakglass Password Reset")
    print("-" * 50)
    print()

    db = SessionLocal()

    try:
        success = reset_admin_password(db)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error resetting admin password: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
