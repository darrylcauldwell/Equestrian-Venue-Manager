"""Staff profiles API endpoints."""
import json
import logging
import secrets
import string
from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.staff_profile import StaffProfile, HourlyRateHistory
from app.models.user import User, UserRole, StaffType
from app.schemas.staff_profile import (
    StaffProfileCreate,
    StaffProfileUpdate,
    StaffProfileAdminUpdate,
    StaffProfileSelfUpdate,
    StaffProfileResponse,
    StaffProfileSelfResponse,
    StaffProfileListResponse,
    StaffProfileSummary,
    StaffMilestone,
    StaffMilestonesResponse,
    StaffMemberCreate,
    StaffMemberCreateResponse,
    HourlyRateHistoryCreate,
    HourlyRateHistoryResponse,
)
from app.utils.auth import get_current_user, require_admin, has_staff_access, get_password_hash

logger = logging.getLogger(__name__)
router = APIRouter()


def generate_temporary_password(length: int = 12) -> str:
    """Generate a secure temporary password."""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))


def enrich_profile(profile: StaffProfile, include_notes: bool = True) -> dict:
    """Add computed fields to profile response."""
    user = profile.user
    data = {
        "id": profile.id,
        "user_id": profile.user_id,
        "date_of_birth": profile.date_of_birth,
        "bio": profile.bio,
        "start_date": profile.start_date,
        "job_title": profile.job_title,
        "personal_email": profile.personal_email,
        "personal_phone": profile.personal_phone,
        "address_street": profile.address_street,
        "address_town": profile.address_town,
        "address_county": profile.address_county,
        "address_postcode": profile.address_postcode,
        "emergency_contact_name": profile.emergency_contact_name,
        "emergency_contact_phone": profile.emergency_contact_phone,
        "emergency_contact_relationship": profile.emergency_contact_relationship,
        "qualifications": profile.qualifications,
        "dbs_check_date": profile.dbs_check_date,
        "dbs_certificate_number": profile.dbs_certificate_number,
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
        # User info
        "user_name": user.name if user else None,
        "user_email": user.email if user else None,
        "user_role": user.role.value if user and user.role else None,
        "is_yard_staff": user.is_yard_staff if user else None,
        "staff_type": user.staff_type.value if user and user.staff_type else None,
        "annual_leave_entitlement": user.annual_leave_entitlement if user else None,
        "leaving_date": user.leaving_date if user else None,
    }
    if include_notes:
        data["notes"] = profile.notes
        data["hourly_rate"] = profile.hourly_rate
    return data


def get_profile_summary(profile: StaffProfile) -> dict:
    """Get summary for list view."""
    user = profile.user
    # Check DBS expiry (typically every 3 years)
    dbs_expiring_soon = False
    if profile.dbs_check_date:
        expiry_date = profile.dbs_check_date.replace(year=profile.dbs_check_date.year + 3)
        dbs_expiring_soon = (expiry_date - date.today()).days <= 90

    # Check for missing payroll fields (essential for paying staff)
    missing_payroll = []
    payroll_field_labels = {
        'national_insurance_number': 'NI Number',
        'bank_account_number': 'Account Number',
        'bank_sort_code': 'Sort Code',
        'bank_account_name': 'Account Name',
    }
    for field, label in payroll_field_labels.items():
        if not getattr(profile, field, None):
            missing_payroll.append(label)

    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "user_name": user.name if user else "Unknown",
        "job_title": profile.job_title,
        "start_date": profile.start_date,
        "user_role": user.role.value if user and user.role else None,
        "is_yard_staff": user.is_yard_staff if user else False,
        "has_dbs_check": profile.dbs_check_date is not None,
        "dbs_expiring_soon": dbs_expiring_soon,
        "missing_payroll_fields": missing_payroll,
    }


# ============================================================================
# Admin endpoints
# ============================================================================

@router.get("", response_model=StaffProfileListResponse)
def list_staff_profiles(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all staff profiles (admin only)."""
    query = db.query(StaffProfile).options(joinedload(StaffProfile.user))

    if not include_inactive:
        # Only include profiles for active users with staff access
        query = query.join(User).filter(User.is_active == True)

    profiles = query.order_by(StaffProfile.id).all()

    return StaffProfileListResponse(
        profiles=[StaffProfileResponse(**enrich_profile(p)) for p in profiles],
        total=len(profiles)
    )


@router.get("/summaries", response_model=List[StaffProfileSummary])
def list_staff_profile_summaries(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get staff profile summaries for list view (admin only)."""
    profiles = db.query(StaffProfile).options(
        joinedload(StaffProfile.user)
    ).join(User).filter(User.is_active == True).all()

    return [StaffProfileSummary(**get_profile_summary(p)) for p in profiles]


@router.get("/milestones", response_model=StaffMilestonesResponse)
def get_upcoming_milestones(
    days: int = 7,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get upcoming birthdays and work anniversaries (admin only)."""
    today = date.today()
    end_date = today + timedelta(days=days)

    profiles = db.query(StaffProfile).options(
        joinedload(StaffProfile.user)
    ).join(User).filter(User.is_active == True).all()

    birthdays = []
    anniversaries = []

    for profile in profiles:
        user = profile.user
        if not user:
            continue

        # Check birthday
        if profile.date_of_birth:
            this_year_birthday = profile.date_of_birth.replace(year=today.year)
            # Handle if birthday already passed this year
            if this_year_birthday < today:
                this_year_birthday = this_year_birthday.replace(year=today.year + 1)

            if today <= this_year_birthday <= end_date:
                days_until = (this_year_birthday - today).days
                birthdays.append(StaffMilestone(
                    user_id=profile.user_id,
                    user_name=user.name,
                    milestone_type="birthday",
                    milestone_date=this_year_birthday,
                    years=None,
                    days_until=days_until
                ))

        # Check work anniversary
        if profile.start_date:
            this_year_anniversary = profile.start_date.replace(year=today.year)
            # Handle if anniversary already passed this year
            if this_year_anniversary < today:
                this_year_anniversary = this_year_anniversary.replace(year=today.year + 1)

            if today <= this_year_anniversary <= end_date:
                years = this_year_anniversary.year - profile.start_date.year
                days_until = (this_year_anniversary - today).days
                anniversaries.append(StaffMilestone(
                    user_id=profile.user_id,
                    user_name=user.name,
                    milestone_type="anniversary",
                    milestone_date=this_year_anniversary,
                    years=years,
                    days_until=days_until
                ))

    # Sort by days_until
    birthdays.sort(key=lambda x: x.days_until)
    anniversaries.sort(key=lambda x: x.days_until)

    return StaffMilestonesResponse(
        birthdays=birthdays,
        anniversaries=anniversaries,
        has_upcoming=len(birthdays) > 0 or len(anniversaries) > 0
    )


@router.post("", response_model=StaffProfileResponse, status_code=status.HTTP_201_CREATED)
def create_staff_profile(
    profile_data: StaffProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a staff profile for a user (admin only)."""
    # Check user exists
    user = db.query(User).filter(User.id == profile_data.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if profile already exists
    existing = db.query(StaffProfile).filter(
        StaffProfile.user_id == profile_data.user_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Staff profile already exists for this user"
        )

    profile = StaffProfile(
        **profile_data.model_dump(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return StaffProfileResponse(**enrich_profile(profile))


@router.post("/with-user", response_model=StaffMemberCreateResponse, status_code=status.HTTP_201_CREATED)
def create_staff_member(
    data: StaffMemberCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new staff member (user account + profile in one step).

    This is a convenience endpoint that creates both the user account
    with staff role and their staff profile in a single transaction.
    Returns the created profile along with the temporary password.
    """
    # Check username uniqueness (case-insensitive)
    existing_user = db.query(User).filter(func.lower(User.username) == func.lower(data.username)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken"
        )

    # Check email uniqueness if provided
    if data.email:
        existing_email = db.query(User).filter(User.email == data.email).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    # Generate temporary password
    temp_password = generate_temporary_password()

    # Parse staff_type if provided
    staff_type = None
    if data.staff_type:
        staff_type = StaffType(data.staff_type)

    # Create the user with staff role and yard staff flag
    user = User(
        username=data.username,
        email=data.email,
        name=data.name,
        phone=data.phone,
        password_hash=get_password_hash(temp_password),
        role=UserRole.STAFF,
        is_yard_staff=True,  # Staff members created here are yard staff
        must_change_password=True,
        staff_type=staff_type,
        annual_leave_entitlement=data.annual_leave_entitlement if data.annual_leave_entitlement else 28,
    )
    db.add(user)
    db.flush()  # Get the user ID without committing

    # Extract profile fields from the data (exclude user fields and User model fields)
    profile_fields = data.model_dump(exclude={'username', 'email', 'name', 'phone', 'staff_type', 'annual_leave_entitlement'})

    # Create the staff profile
    profile = StaffProfile(
        user_id=user.id,
        date_of_birth=profile_fields.get('date_of_birth'),
        bio=profile_fields.get('bio'),
        start_date=profile_fields.get('start_date'),
        job_title=profile_fields.get('job_title'),
        personal_email=profile_fields.get('personal_email'),
        personal_phone=profile_fields.get('personal_phone'),
        address_street=profile_fields.get('address_street'),
        address_town=profile_fields.get('address_town'),
        address_county=profile_fields.get('address_county'),
        address_postcode=profile_fields.get('address_postcode'),
        emergency_contact_name=profile_fields.get('emergency_contact_name'),
        emergency_contact_phone=profile_fields.get('emergency_contact_phone'),
        emergency_contact_relationship=profile_fields.get('emergency_contact_relationship'),
        qualifications=profile_fields.get('qualifications'),
        dbs_check_date=profile_fields.get('dbs_check_date'),
        dbs_certificate_number=profile_fields.get('dbs_certificate_number'),
        notes=profile_fields.get('notes'),
        # Payroll fields
        hourly_rate=profile_fields.get('hourly_rate'),
        national_insurance_number=profile_fields.get('national_insurance_number'),
        bank_account_number=profile_fields.get('bank_account_number'),
        bank_sort_code=profile_fields.get('bank_sort_code'),
        bank_account_name=profile_fields.get('bank_account_name'),
        tax_code=profile_fields.get('tax_code'),
        student_loan_plan=profile_fields.get('student_loan_plan'),
        p45_date_left_previous=profile_fields.get('p45_date_left_previous'),
        p45_tax_paid_previous=profile_fields.get('p45_tax_paid_previous'),
        p45_pay_to_date_previous=profile_fields.get('p45_pay_to_date_previous'),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)

    return StaffMemberCreateResponse(
        profile=StaffProfileResponse(**enrich_profile(profile)),
        temporary_password=temp_password
    )


# ============================================================================
# Self-service endpoints (must be before /{user_id} to avoid route collision)
# ============================================================================

@router.get("/me", response_model=StaffProfileSelfResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the current user's staff profile."""
    # User must have staff access
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required"
        )

    profile = db.query(StaffProfile).options(
        joinedload(StaffProfile.user)
    ).filter(StaffProfile.user_id == current_user.id).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You don't have a staff profile yet"
        )

    return StaffProfileSelfResponse(**enrich_profile(profile, include_notes=False))


@router.put("/me", response_model=StaffProfileSelfResponse)
def update_my_profile(
    profile_data: StaffProfileSelfUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update the current user's staff profile (limited fields)."""
    # User must have staff access
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required"
        )

    profile = db.query(StaffProfile).filter(
        StaffProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You don't have a staff profile yet"
        )

    # Only update allowed fields
    for key, value in profile_data.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    return StaffProfileSelfResponse(**enrich_profile(profile, include_notes=False))


@router.get("/me/rate-history", response_model=List[HourlyRateHistoryResponse])
def get_my_rate_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the current user's hourly rate history (read-only)."""
    # User must have staff access
    if not has_staff_access(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Staff access required"
        )

    # Verify they have a staff profile
    profile = db.query(StaffProfile).filter(
        StaffProfile.user_id == current_user.id
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="You don't have a staff profile yet"
        )

    # Get rate history for this user
    history = db.query(HourlyRateHistory).filter(
        HourlyRateHistory.staff_id == current_user.id
    ).order_by(HourlyRateHistory.effective_date.desc()).all()

    # Enrich with created_by names
    result = []
    for entry in history:
        created_by = db.query(User).filter(User.id == entry.created_by_id).first()
        result.append(HourlyRateHistoryResponse(
            id=entry.id,
            staff_id=entry.staff_id,
            hourly_rate=float(entry.hourly_rate),
            effective_date=entry.effective_date,
            notes=entry.notes,
            created_by_id=entry.created_by_id,
            created_by_name=created_by.name if created_by else "Unknown",
            created_at=entry.created_at,
        ))

    return result


# ============================================================================
# Parameterized routes (must be after /me, /summaries, /milestones, etc.)
# ============================================================================

@router.get("/{user_id}", response_model=StaffProfileResponse)
def get_staff_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a staff profile by user ID (admin or own profile)."""
    # Check authorization
    is_own_profile = current_user.id == user_id
    is_admin = current_user.role == UserRole.ADMIN

    if not is_own_profile and not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own profile"
        )

    profile = db.query(StaffProfile).options(
        joinedload(StaffProfile.user)
    ).filter(StaffProfile.user_id == user_id).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff profile not found"
        )

    # Include notes only for admin
    return StaffProfileResponse(**enrich_profile(profile, include_notes=is_admin))


@router.put("/{user_id}", response_model=StaffProfileResponse)
def update_staff_profile(
    user_id: int,
    profile_data: StaffProfileAdminUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a staff profile (admin only)."""
    profile = db.query(StaffProfile).options(
        joinedload(StaffProfile.user)
    ).filter(
        StaffProfile.user_id == user_id
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff profile not found"
        )

    # Fields that belong on User model, not StaffProfile
    user_fields = {'staff_type', 'annual_leave_entitlement', 'leaving_date'}

    update_data = profile_data.model_dump(exclude_unset=True)

    # Update User model fields
    user = profile.user
    if user:
        if 'staff_type' in update_data:
            staff_type_value = update_data.pop('staff_type')
            if staff_type_value:
                user.staff_type = StaffType(staff_type_value)
            else:
                user.staff_type = None
        if 'annual_leave_entitlement' in update_data:
            user.annual_leave_entitlement = update_data.pop('annual_leave_entitlement')
        if 'leaving_date' in update_data:
            user.leaving_date = update_data.pop('leaving_date')

    # Update StaffProfile fields
    for key, value in update_data.items():
        setattr(profile, key, value)

    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)

    return StaffProfileResponse(**enrich_profile(profile))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_staff_profile(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a staff profile and deactivate the user (admin only)."""
    profile = db.query(StaffProfile).filter(
        StaffProfile.user_id == user_id
    ).first()

    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Staff profile not found"
        )

    # Also mark the user as inactive so they don't appear in rota/timesheets
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        user.is_active = False
        user.is_yard_staff = False  # Remove staff access

    db.delete(profile)
    db.commit()


# ============================================================================
# Hourly Rate History endpoints
# ============================================================================

@router.get("/{user_id}/rate-history", response_model=List[HourlyRateHistoryResponse])
def get_rate_history(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get hourly rate history for a staff member (admin only)."""
    # Check user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    history = db.query(HourlyRateHistory).filter(
        HourlyRateHistory.staff_id == user_id
    ).order_by(HourlyRateHistory.effective_date.desc()).all()

    # Enrich with created_by name
    result = []
    for entry in history:
        created_by = db.query(User).filter(User.id == entry.created_by_id).first()
        result.append(HourlyRateHistoryResponse(
            id=entry.id,
            staff_id=entry.staff_id,
            hourly_rate=float(entry.hourly_rate),
            effective_date=entry.effective_date,
            notes=entry.notes,
            created_by_id=entry.created_by_id,
            created_by_name=created_by.name if created_by else "Unknown",
            created_at=entry.created_at
        ))

    return result


@router.post("/{user_id}/rate-history", response_model=HourlyRateHistoryResponse, status_code=status.HTTP_201_CREATED)
def add_rate_history(
    user_id: int,
    data: HourlyRateHistoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Add a new hourly rate for a staff member (admin only).

    If the effective date is today or in the past, the current hourly_rate
    on the staff profile will also be updated.
    """
    # Check user exists and has staff access
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Create the history entry
    entry = HourlyRateHistory(
        staff_id=user_id,
        hourly_rate=data.hourly_rate,
        effective_date=data.effective_date,
        notes=data.notes,
        created_by_id=current_user.id,
        created_at=datetime.utcnow()
    )
    db.add(entry)

    # If effective date is today or in the past, update the current rate
    today = date.today()
    if data.effective_date <= today:
        profile = db.query(StaffProfile).filter(
            StaffProfile.user_id == user_id
        ).first()
        if profile:
            # Only update if this is the most recent effective rate
            latest_rate = db.query(HourlyRateHistory).filter(
                HourlyRateHistory.staff_id == user_id,
                HourlyRateHistory.effective_date <= today
            ).order_by(HourlyRateHistory.effective_date.desc()).first()

            # If no existing rate or new rate is more recent
            if not latest_rate or data.effective_date >= latest_rate.effective_date:
                profile.hourly_rate = data.hourly_rate
                profile.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(entry)

    return HourlyRateHistoryResponse(
        id=entry.id,
        staff_id=entry.staff_id,
        hourly_rate=float(entry.hourly_rate),
        effective_date=entry.effective_date,
        notes=entry.notes,
        created_by_id=entry.created_by_id,
        created_by_name=current_user.name,
        created_at=entry.created_at
    )
