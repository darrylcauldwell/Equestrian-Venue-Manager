#!/usr/bin/env python3
"""
Create initial admin user for Equestrian Venue Manager.

Run this script after database migrations to create the first admin user.
This admin can then create arenas and manage other users through the application.

Usage:
    python scripts/create_admin.py --username admin --password YourSecurePassword

Note: Username and password are required arguments - no defaults are provided for security.
"""

import argparse
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app.database import SessionLocal, engine
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash


def create_admin_user(
    username: str,
    password: str,
    name: str = "System Admin"
) -> bool:
    """
    Create an admin user if one doesn't already exist.

    Returns True if admin was created, False if admin already exists.
    """
    db: Session = SessionLocal()

    try:
        # Check if any admin user exists
        existing_admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        if existing_admin:
            print(f"Admin user already exists: {existing_admin.username}")
            return False

        # Check if username is already in use
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            print(f"User with username '{username}' already exists (role: {existing_user.role})")
            print("You can change their role to admin via the API or database.")
            return False

        # Create the admin user
        admin_user = User(
            username=username,
            name=name,
            password_hash=get_password_hash(password),
            role=UserRole.ADMIN,
            must_change_password=True
        )

        db.add(admin_user)
        db.commit()

        print("=" * 60)
        print("Admin user created successfully!")
        print("=" * 60)
        print(f"  Username: {username}")
        print(f"  Password: {password}")
        print(f"  Name:     {name}")
        print("=" * 60)
        print()
        print("IMPORTANT: Change this password after first login!")
        print()
        print("Next steps:")
        print("  1. Log in at http://localhost:3000/login")
        print("  2. Go to Admin > Settings to set your venue name")
        print("  3. Go to Admin > Arenas to create your arenas")
        print("  4. Go to Admin > Users to manage user roles")
        print("=" * 60)

        return True

    except Exception as e:
        db.rollback()
        print(f"Error creating admin user: {e}")
        return False
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Create initial admin user for Equestrian Venue Manager"
    )
    parser.add_argument(
        "--username",
        required=True,
        help="Admin username (required)"
    )
    parser.add_argument(
        "--password",
        required=True,
        help="Admin password (required)"
    )
    parser.add_argument(
        "--name",
        default="System Admin",
        help="Admin display name (default: System Admin)"
    )

    args = parser.parse_args()

    print()
    print("Equestrian Venue Manager - Admin User Setup")
    print("-" * 40)
    print()

    success = create_admin_user(
        username=args.username,
        password=args.password,
        name=args.name
    )

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
