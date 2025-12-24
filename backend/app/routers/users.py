import secrets
import string
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse, UserUpdate, AdminUserCreate, AdminUserCreateResponse, AdminUserUpdate
from app.utils.auth import get_current_user, get_password_hash, require_admin
from app.utils.crud import get_or_404

router = APIRouter()


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))




@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_data.name is not None:
        current_user.name = user_data.name
    if user_data.email is not None:
        # Check email uniqueness
        existing = db.query(User).filter(User.email == user_data.email, User.id != current_user.id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
        current_user.email = user_data.email
    if user_data.phone is not None:
        current_user.phone = user_data.phone
    if user_data.address_street is not None:
        current_user.address_street = user_data.address_street
    if user_data.address_town is not None:
        current_user.address_town = user_data.address_town
    if user_data.address_county is not None:
        current_user.address_county = user_data.address_county
    if user_data.address_postcode is not None:
        current_user.address_postcode = user_data.address_postcode
    if user_data.password is not None:
        current_user.password_hash = get_password_hash(user_data.password)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.get("/", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users


@router.post("/create", response_model=AdminUserCreateResponse)
def admin_create_user(
    user_data: AdminUserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin creates a new user with a temporary password"""
    # Check username uniqueness
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )

    # Check email uniqueness if provided
    if user_data.email:
        existing_email = db.query(User).filter(User.email == user_data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    # Only allow creating livery, coach, or admin roles
    if user_data.role not in [UserRole.LIVERY, UserRole.COACH, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be livery, coach, or admin"
        )

    # Generate temporary password
    temp_password = generate_temporary_password()

    user = User(
        username=user_data.username,
        email=user_data.email,
        name=user_data.name,
        phone=user_data.phone,
        password_hash=get_password_hash(temp_password),
        role=user_data.role,
        must_change_password=True,  # Force password change on first login
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return AdminUserCreateResponse(user=UserResponse.model_validate(user), temporary_password=temp_password)


@router.put("/{user_id}", response_model=UserResponse)
def admin_update_user(
    user_id: int,
    user_data: AdminUserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Admin updates a user's details including livery package assignment"""
    user = get_or_404(db, User, user_id, "User not found")

    if user_data.name is not None:
        user.name = user_data.name
    if user_data.email is not None:
        # Check email uniqueness
        existing = db.query(User).filter(User.email == user_data.email, User.id != user_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already in use")
        user.email = user_data.email
    if user_data.phone is not None:
        user.phone = user_data.phone
    if user_data.address_street is not None:
        user.address_street = user_data.address_street
    if user_data.address_town is not None:
        user.address_town = user_data.address_town
    if user_data.address_county is not None:
        user.address_county = user_data.address_county
    if user_data.address_postcode is not None:
        user.address_postcode = user_data.address_postcode
    if user_data.role is not None:
        user.role = user_data.role
    if user_data.is_active is not None:
        user.is_active = user_data.is_active
    if user_data.is_yard_staff is not None:
        user.is_yard_staff = user_data.is_yard_staff

    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role: UserRole,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    user = get_or_404(db, User, user_id, "User not found")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change your own role"
        )

    user.role = role
    db.commit()
    db.refresh(user)
    return user


@router.post("/{user_id}/reset-password")
def reset_user_password(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reset a user's password and generate a new temporary password"""
    user = get_or_404(db, User, user_id, "User not found")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot reset your own password here. Use the change password feature."
        )

    # Generate new temporary password
    temp_password = generate_temporary_password()
    user.password_hash = get_password_hash(temp_password)
    user.must_change_password = True

    db.commit()

    return {"temporary_password": temp_password, "message": "Password reset successfully"}


@router.put("/{user_id}/toggle-active", response_model=UserResponse)
def toggle_user_active(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Enable or disable a user account"""
    user = get_or_404(db, User, user_id, "User not found")

    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot disable your own account"
        )

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user
