from typing import List, Optional
from datetime import datetime, date
from urllib.parse import quote
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.clinic import (
    ClinicRequest, ClinicParticipant, ClinicSlot,
    Discipline, LessonFormat, ClinicStatus
)
from app.models.booking import Booking
from app.models.notice import Notice, NoticeCategory, NoticePriority
from app.models.user import User, UserRole
from app.schemas.clinic import (
    ClinicRequestCreate, ClinicRequestUpdate, ClinicRequestResponse,
    ClinicRequestDetailResponse, ClinicRequestsListResponse, PublicClinicsResponse,
    ClinicParticipantCreate, ClinicParticipantUpdate, ClinicParticipantResponse,
    ClinicSlotCreate, ClinicSlotUpdate, ClinicSlotResponse, ClinicSlotWithParticipants,
    SocialShareLinks, ConflictInfo, ClinicEnums, EnumInfo
)
from app.models.arena import Arena
from app.utils.auth import get_current_user, get_current_user_optional
from app.config import get_settings
from app.models.account import LedgerEntry, TransactionType

router = APIRouter()


# Label mappings
DISCIPLINE_LABELS = {
    Discipline.DRESSAGE: "Dressage",
    Discipline.SHOW_JUMPING: "Show Jumping",
    Discipline.CROSS_COUNTRY: "Cross Country",
    Discipline.EVENTING: "Eventing",
    Discipline.FLATWORK: "Flatwork",
    Discipline.POLEWORK: "Polework",
    Discipline.HACKING: "Hacking",
    Discipline.GROUNDWORK: "Groundwork",
    Discipline.LUNGING: "Lunging",
    Discipline.NATURAL_HORSEMANSHIP: "Natural Horsemanship",
    Discipline.OTHER: "Other",
}

FORMAT_LABELS = {
    LessonFormat.PRIVATE: "Private",
    LessonFormat.SEMI_PRIVATE: "Semi-Private",
    LessonFormat.GROUP: "Group",
    LessonFormat.MIXED: "Mixed",
}

STATUS_LABELS = {
    ClinicStatus.PENDING: "Pending Review",
    ClinicStatus.APPROVED: "Approved",
    ClinicStatus.REJECTED: "Rejected",
    ClinicStatus.CHANGES_REQUESTED: "Changes Requested",
    ClinicStatus.CANCELLED: "Cancelled",
    ClinicStatus.COMPLETED: "Completed",
}


def require_admin(current_user: User):
    """Require user to be admin."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


def enrich_clinic(clinic: ClinicRequest) -> dict:
    """Add computed fields to clinic response."""
    return {
        "id": clinic.id,
        "coach_name": clinic.coach_name,
        "coach_email": clinic.coach_email,
        "coach_phone": clinic.coach_phone,
        "coach_bio": clinic.coach_bio,
        "discipline": clinic.discipline,
        "title": clinic.title,
        "description": clinic.description,
        "proposed_date": clinic.proposed_date,
        "proposed_end_date": clinic.proposed_end_date,
        "proposed_start_time": clinic.proposed_start_time,
        "proposed_end_time": clinic.proposed_end_time,
        "arena_required": clinic.arena_required,
        "lesson_format": clinic.lesson_format,
        "lesson_duration_minutes": clinic.lesson_duration_minutes,
        "max_participants": clinic.max_participants,
        "max_group_size": clinic.max_group_size,
        "coach_fee_private": clinic.coach_fee_private,
        "coach_fee_group": clinic.coach_fee_group,
        "venue_fee_private": clinic.venue_fee_private,
        "venue_fee_group": clinic.venue_fee_group,
        "livery_venue_fee_private": clinic.livery_venue_fee_private,
        "livery_venue_fee_group": clinic.livery_venue_fee_group,
        "special_requirements": clinic.special_requirements,
        "status": clinic.status,
        "proposed_by_id": clinic.proposed_by_id,
        "reviewed_by_id": clinic.reviewed_by_id,
        "reviewed_at": clinic.reviewed_at,
        "review_notes": clinic.review_notes,
        "rejection_reason": clinic.rejection_reason,
        "booking_id": clinic.booking_id,
        "notice_id": clinic.notice_id,
        "created_at": clinic.created_at,
        "updated_at": clinic.updated_at,
        "proposed_by_name": clinic.proposed_by.name if clinic.proposed_by else None,
        "reviewed_by_name": clinic.reviewed_by.name if clinic.reviewed_by else None,
        "participant_count": len(clinic.participants) if clinic.participants else 0,
    }


def enrich_participant(participant: ClinicParticipant) -> dict:
    """Add computed fields to participant response."""
    result = {
        "id": participant.id,
        "clinic_id": participant.clinic_id,
        "user_id": participant.user_id,
        "slot_id": participant.slot_id,
        "horse_id": participant.horse_id,
        "participant_name": participant.participant_name or (participant.user.name if participant.user else None),
        "participant_email": participant.participant_email or (participant.user.email if participant.user else None),
        "participant_phone": participant.participant_phone,
        "lesson_time": participant.lesson_time,
        "notes": participant.notes,
        "is_confirmed": participant.is_confirmed,
        "slot_notified_at": participant.slot_notified_at,
        "created_at": participant.created_at,
        "updated_at": participant.updated_at,
        "user_name": participant.user.name if participant.user else None,
        "horse_name": participant.horse.name if participant.horse else None,
        # Slot info if assigned
        "slot_start_time": None,
        "slot_end_time": None,
        "slot_group_name": None,
        "slot_arena_name": None,
    }
    # Add slot details if assigned
    if participant.slot:
        result["slot_start_time"] = participant.slot.start_time
        result["slot_end_time"] = participant.slot.end_time
        result["slot_group_name"] = participant.slot.group_name
        if participant.slot.arena:
            result["slot_arena_name"] = participant.slot.arena.name
    return result


def enrich_slot(slot: ClinicSlot) -> dict:
    """Add computed fields to slot response."""
    return {
        "id": slot.id,
        "clinic_id": slot.clinic_id,
        "slot_date": slot.slot_date,
        "start_time": slot.start_time,
        "end_time": slot.end_time,
        "group_name": slot.group_name,
        "description": slot.description,
        "arena_id": slot.arena_id,
        "is_group_slot": slot.is_group_slot,
        "max_participants": slot.max_participants,
        "sequence": slot.sequence,
        "created_at": slot.created_at,
        "updated_at": slot.updated_at,
        "arena_name": slot.arena.name if slot.arena else None,
        "participant_count": len(slot.participants) if slot.participants else 0,
    }


def enrich_slot_with_participants(slot: ClinicSlot) -> dict:
    """Add computed fields and participants to slot response."""
    result = enrich_slot(slot)
    result["participants"] = [enrich_participant(p) for p in slot.participants]
    return result


def generate_share_text(clinic: ClinicRequest) -> str:
    """Generate shareable text for social media."""
    discipline = DISCIPLINE_LABELS.get(clinic.discipline, clinic.discipline.value)
    title = clinic.title or f"{discipline} Clinic"
    date_str = clinic.proposed_date.strftime("%d %B %Y")

    text = f"{title} with {clinic.coach_name}\n"
    text += f"Date: {date_str}\n"
    if clinic.price_per_lesson:
        text += f"Price: £{clinic.price_per_lesson} per lesson\n"
    if clinic.max_participants:
        text += f"Spaces: {clinic.max_participants} available\n"
    text += "\nBook your space now!"

    return text


# ============== Enum Routes ==============

@router.get("/enums", response_model=ClinicEnums)
def get_enums():
    """Get enum options for forms."""
    return ClinicEnums(
        disciplines=[
            EnumInfo(value=d.value, label=DISCIPLINE_LABELS.get(d, d.value.title()))
            for d in Discipline
        ],
        lesson_formats=[
            EnumInfo(value=f.value, label=FORMAT_LABELS.get(f, f.value.title()))
            for f in LessonFormat
        ],
        statuses=[
            EnumInfo(value=s.value, label=STATUS_LABELS.get(s, s.value.title()))
            for s in ClinicStatus
        ],
    )


# ============== Public Routes ==============

@router.get("/public", response_model=PublicClinicsResponse)
def list_public_clinics(
    discipline: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List approved upcoming clinics (public view)."""
    today = date.today()

    upcoming_query = db.query(ClinicRequest).filter(
        ClinicRequest.status == ClinicStatus.APPROVED,
        ClinicRequest.proposed_date >= today
    )

    past_query = db.query(ClinicRequest).filter(
        ClinicRequest.status.in_([ClinicStatus.APPROVED, ClinicStatus.COMPLETED]),
        ClinicRequest.proposed_date < today
    )

    # Apply discipline filter if provided
    if discipline:
        try:
            disc_enum = Discipline(discipline)
            upcoming_query = upcoming_query.filter(ClinicRequest.discipline == disc_enum)
            past_query = past_query.filter(ClinicRequest.discipline == disc_enum)
        except ValueError:
            pass  # Invalid discipline, ignore filter

    upcoming = upcoming_query.order_by(ClinicRequest.proposed_date).all()
    past = past_query.order_by(ClinicRequest.proposed_date.desc()).limit(10).all()

    return PublicClinicsResponse(
        upcoming=[enrich_clinic(c) for c in upcoming],
        past=[enrich_clinic(c) for c in past],
    )


@router.get("/public/{clinic_id}", response_model=ClinicRequestDetailResponse)
def get_public_clinic_detail(
    clinic_id: int,
    db: Session = Depends(get_db)
):
    """Get public clinic details (no authentication required, approved clinics only)."""
    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Only allow viewing approved or completed clinics publicly
    if clinic.status not in [ClinicStatus.APPROVED, ClinicStatus.COMPLETED]:
        raise HTTPException(status_code=404, detail="Clinic not found")

    result = enrich_clinic(clinic)
    result["participants"] = [enrich_participant(p) for p in clinic.participants]

    return result


@router.post("/request", response_model=ClinicRequestResponse, status_code=status.HTTP_201_CREATED)
def submit_clinic_request(
    data: ClinicRequestCreate,
    db: Session = Depends(get_db)
):
    """Submit a clinic request (public - no auth required)."""
    clinic = ClinicRequest(
        **data.model_dump(),
        status=ClinicStatus.PENDING
    )
    db.add(clinic)
    db.commit()
    db.refresh(clinic)

    return enrich_clinic(clinic)


@router.get("/request/{clinic_id}/share", response_model=SocialShareLinks)
def get_share_links(
    clinic_id: int,
    db: Session = Depends(get_db)
):
    """Get social media share links for a clinic."""
    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    if clinic.status != ClinicStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Can only share approved clinics")

    text = generate_share_text(clinic)
    encoded_text = quote(text)

    # Generate URLs for social sharing
    settings = get_settings()
    clinic_url = f"{settings.frontend_url}/clinics/{clinic_id}"
    encoded_url = quote(clinic_url)

    return SocialShareLinks(
        facebook=f"https://www.facebook.com/sharer/sharer.php?u={encoded_url}&quote={encoded_text}",
        twitter=f"https://twitter.com/intent/tweet?text={encoded_text}&url={encoded_url}",
        whatsapp=f"https://wa.me/?text={encoded_text}%20{encoded_url}",
        copy_text=text + f"\n\n{clinic_url}",
    )


# ============== Coach Routes ==============

@router.post("/propose", response_model=ClinicRequestResponse, status_code=status.HTTP_201_CREATED)
def propose_clinic(
    data: ClinicRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Propose a clinic (coach role - links to their account)."""
    if current_user.role != UserRole.COACH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can propose clinics"
        )

    clinic = ClinicRequest(
        **data.model_dump(),
        proposed_by_id=current_user.id,
        status=ClinicStatus.PENDING
    )
    db.add(clinic)
    db.commit()
    db.refresh(clinic)

    return enrich_clinic(clinic)


@router.get("/my-proposals", response_model=List[ClinicRequestResponse])
def list_my_proposals(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List clinic proposals submitted by the current coach."""
    if current_user.role != UserRole.COACH:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only coaches can view their proposals"
        )

    clinics = db.query(ClinicRequest).filter(
        ClinicRequest.proposed_by_id == current_user.id
    ).order_by(ClinicRequest.created_at.desc()).all()

    return [enrich_clinic(c) for c in clinics]


@router.get("/my-registrations")
def get_my_registrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's clinic registrations with slot details."""
    participants = db.query(ClinicParticipant).filter(
        ClinicParticipant.user_id == current_user.id
    ).all()

    # Build response with clinic and slot info
    registrations = []
    for p in participants:
        clinic = p.clinic
        reg = {
            "id": p.id,
            "clinic_id": clinic.id,
            "clinic_title": clinic.title or f"{clinic.coach_name} Clinic",
            "clinic_date": str(clinic.proposed_date),
            "discipline": clinic.discipline.value if clinic.discipline else None,
            "coach_name": clinic.coach_name,
            "status": clinic.status.value if clinic.status else None,
            "is_confirmed": p.is_confirmed,
            "notes": p.notes,
            "horse_name": p.horse.name if p.horse else None,
            # Slot details
            "slot_id": p.slot_id,
            "slot_date": str(p.slot.slot_date) if p.slot else None,
            "slot_start_time": str(p.slot.start_time) if p.slot else None,
            "slot_end_time": str(p.slot.end_time) if p.slot else None,
            "slot_group_name": p.slot.group_name if p.slot else None,
            "slot_arena_name": p.slot.arena.name if p.slot and p.slot.arena else None,
        }
        registrations.append(reg)

    return registrations


# ============== Authenticated Routes ==============

@router.get("/", response_model=ClinicRequestsListResponse)
def list_clinic_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List clinic requests (admin sees all, others see approved only)."""
    is_admin = current_user.role == UserRole.ADMIN
    today = date.today()

    if is_admin:
        pending = db.query(ClinicRequest).filter(
            ClinicRequest.status.in_([ClinicStatus.PENDING, ClinicStatus.CHANGES_REQUESTED])
        ).order_by(ClinicRequest.created_at.desc()).all()
    else:
        pending = []

    approved = db.query(ClinicRequest).filter(
        ClinicRequest.status == ClinicStatus.APPROVED,
        ClinicRequest.proposed_date >= today
    ).order_by(ClinicRequest.proposed_date).all()

    past = db.query(ClinicRequest).filter(
        ClinicRequest.status.in_([ClinicStatus.APPROVED, ClinicStatus.COMPLETED]),
        ClinicRequest.proposed_date < today
    ).order_by(ClinicRequest.proposed_date.desc()).limit(20).all()

    return ClinicRequestsListResponse(
        pending=[enrich_clinic(c) for c in pending],
        approved=[enrich_clinic(c) for c in approved],
        past=[enrich_clinic(c) for c in past],
    )


@router.get("/{clinic_id}", response_model=ClinicRequestDetailResponse)
def get_clinic_detail(
    clinic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed clinic information."""
    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Non-admins can only see approved clinics (but coaches can see their own)
    is_admin = current_user.role == UserRole.ADMIN
    is_proposer = clinic.proposed_by_id == current_user.id
    if not is_admin and not is_proposer and clinic.status != ClinicStatus.APPROVED:
        raise HTTPException(status_code=403, detail="Access denied")

    result = enrich_clinic(clinic)
    result["participants"] = [enrich_participant(p) for p in clinic.participants]
    result["slots"] = [enrich_slot_with_participants(s) for s in clinic.slots]

    return result


@router.get("/{clinic_id}/conflicts", response_model=ConflictInfo)
def check_conflicts(
    clinic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check for booking conflicts (manager only)."""
    require_admin(current_user)

    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Find conflicting bookings
    conflicts = db.query(Booking).filter(
        Booking.start_time >= clinic.proposed_date,
        Booking.start_time < (clinic.proposed_end_date or clinic.proposed_date)
    ).all()

    return ConflictInfo(
        has_conflicts=len(conflicts) > 0,
        conflicting_bookings=[
            {
                "id": b.id,
                "title": b.title,
                "start_time": b.start_time.isoformat(),
                "end_time": b.end_time.isoformat(),
                "user_name": b.user.name if b.user else "Guest",
            }
            for b in conflicts
        ]
    )


@router.put("/{clinic_id}/approve", response_model=ClinicRequestResponse)
def approve_clinic(
    clinic_id: int,
    notes: Optional[str] = None,
    create_notice: bool = True,
    venue_fee_private: Optional[float] = None,
    venue_fee_group: Optional[float] = None,
    livery_venue_fee_private: Optional[float] = 0,
    livery_venue_fee_group: Optional[float] = 0,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Approve a clinic request (manager only). Set venue fees during approval."""
    require_admin(current_user)

    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    if clinic.status not in [ClinicStatus.PENDING, ClinicStatus.CHANGES_REQUESTED]:
        raise HTTPException(status_code=400, detail="Can only approve pending requests")

    clinic.status = ClinicStatus.APPROVED
    clinic.reviewed_by_id = current_user.id
    clinic.reviewed_at = datetime.utcnow()
    clinic.review_notes = notes

    # Set venue fees
    if venue_fee_private is not None:
        clinic.venue_fee_private = venue_fee_private
    if venue_fee_group is not None:
        clinic.venue_fee_group = venue_fee_group
    clinic.livery_venue_fee_private = livery_venue_fee_private
    clinic.livery_venue_fee_group = livery_venue_fee_group

    # Create noticeboard post if requested
    if create_notice:
        discipline = DISCIPLINE_LABELS.get(clinic.discipline, clinic.discipline.value)
        title = clinic.title or f"{discipline} Clinic with {clinic.coach_name}"
        date_str = clinic.proposed_date.strftime("%d %B %Y")

        content = f"**{discipline} Clinic**\n\n"
        content += f"**Coach:** {clinic.coach_name}\n"
        content += f"**Date:** {date_str}\n"
        if clinic.proposed_start_time:
            content += f"**Time:** {clinic.proposed_start_time.strftime('%H:%M')}"
            if clinic.proposed_end_time:
                content += f" - {clinic.proposed_end_time.strftime('%H:%M')}"
            content += "\n"
        # Show total price (coach + venue fee)
        if clinic.coach_fee_private:
            total_price = float(clinic.coach_fee_private) + float(clinic.venue_fee_private or 0)
            content += f"**Price:** £{total_price:.2f} per lesson\n"
        if clinic.max_participants:
            content += f"**Spaces:** {clinic.max_participants}\n"
        if clinic.lesson_format:
            content += f"**Format:** {FORMAT_LABELS.get(clinic.lesson_format, clinic.lesson_format.value)}\n"
        if clinic.coach_bio:
            content += f"\n**About the coach:**\n{clinic.coach_bio}\n"
        if clinic.description:
            content += f"\n{clinic.description}\n"
        content += f"\n**To book:** Contact {clinic.coach_email}"
        if clinic.coach_phone:
            content += f" or {clinic.coach_phone}"

        notice = Notice(
            title=title,
            content=content,
            category=NoticeCategory.EVENT,
            priority=NoticePriority.HIGH,
            is_pinned=True,
            expires_at=clinic.proposed_date,
            created_by_id=current_user.id,
        )
        db.add(notice)
        db.flush()
        clinic.notice_id = notice.id

    db.commit()
    db.refresh(clinic)

    return enrich_clinic(clinic)


@router.put("/{clinic_id}/reject", response_model=ClinicRequestResponse)
def reject_clinic(
    clinic_id: int,
    reason: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject a clinic request (manager only)."""
    require_admin(current_user)

    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    if clinic.status not in [ClinicStatus.PENDING, ClinicStatus.CHANGES_REQUESTED]:
        raise HTTPException(status_code=400, detail="Can only reject pending requests")

    clinic.status = ClinicStatus.REJECTED
    clinic.reviewed_by_id = current_user.id
    clinic.reviewed_at = datetime.utcnow()
    clinic.rejection_reason = reason

    db.commit()
    db.refresh(clinic)

    return enrich_clinic(clinic)


@router.put("/{clinic_id}/request-changes", response_model=ClinicRequestResponse)
def request_changes(
    clinic_id: int,
    notes: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Request changes to a clinic submission (manager only)."""
    require_admin(current_user)

    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    if clinic.status != ClinicStatus.PENDING:
        raise HTTPException(status_code=400, detail="Can only request changes on pending requests")

    clinic.status = ClinicStatus.CHANGES_REQUESTED
    clinic.reviewed_by_id = current_user.id
    clinic.reviewed_at = datetime.utcnow()
    clinic.review_notes = notes

    db.commit()
    db.refresh(clinic)

    return enrich_clinic(clinic)


@router.delete("/{clinic_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_clinic(
    clinic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a clinic (manager only)."""
    require_admin(current_user)

    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    clinic.status = ClinicStatus.CANCELLED
    db.commit()


# ============== Participant Routes ==============

@router.post("/{clinic_id}/register", response_model=ClinicParticipantResponse, status_code=status.HTTP_201_CREATED)
def register_for_clinic(
    clinic_id: int,
    data: ClinicParticipantCreate,
    current_user: Optional[User] = Depends(get_current_user_optional),
    db: Session = Depends(get_db)
):
    """Register for a clinic (authenticated users or guests).

    For guests: Creates a public user account linked to their registration.
    """
    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    if clinic.status != ClinicStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Can only register for approved clinics")

    # Check max participants
    if clinic.max_participants:
        current_count = len(clinic.participants)
        if current_count >= clinic.max_participants:
            raise HTTPException(status_code=400, detail="Clinic is full")

    user_id = current_user.id if current_user else None

    # For guests, create or find a public user account
    if not current_user and data.participant_email:
        # Check if user with this email already exists
        existing_user = db.query(User).filter(User.email == data.participant_email).first()

        if existing_user:
            # Link to existing user
            user_id = existing_user.id
        else:
            # Create a new public user account
            import secrets
            from passlib.context import CryptContext

            pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

            # Generate username from email
            base_username = data.participant_email.split('@')[0].lower()
            username = base_username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                username = f"{base_username}{counter}"
                counter += 1

            # Generate temporary password
            temp_password = secrets.token_urlsafe(8)

            new_user = User(
                username=username,
                email=data.participant_email,
                name=data.participant_name or data.participant_email.split('@')[0],
                phone=data.participant_phone,
                password_hash=pwd_context.hash(temp_password),
                role=UserRole.PUBLIC,
                must_change_password=True
            )
            db.add(new_user)
            db.flush()  # Get the user ID
            user_id = new_user.id

            # Store temp password in response for display (will be shown once)
            # Note: In production, this should be emailed instead

    participant = ClinicParticipant(
        clinic_id=clinic_id,
        user_id=user_id,
        **data.model_dump()
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)

    return enrich_participant(participant)


@router.put("/{clinic_id}/participants/{participant_id}/confirm", response_model=ClinicParticipantResponse)
def confirm_participant(
    clinic_id: int,
    participant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm a participant (manager only)."""
    require_admin(current_user)

    participant = db.query(ClinicParticipant).filter(
        ClinicParticipant.id == participant_id,
        ClinicParticipant.clinic_id == clinic_id
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    participant.is_confirmed = True

    # Create ledger entry for livery users
    if participant.user_id:
        user = db.query(User).filter(User.id == participant.user_id).first()
        if user and user.role == UserRole.LIVERY:
            clinic = participant.clinic
            # Determine pricing based on slot type (private vs group)
            is_group = participant.slot and participant.slot.is_group_slot
            if is_group:
                coach_fee = float(clinic.coach_fee_group or 0)
                venue_fee = float(clinic.livery_venue_fee_group or 0)
            else:
                coach_fee = float(clinic.coach_fee_private or 0)
                venue_fee = float(clinic.livery_venue_fee_private or 0)

            total_price = coach_fee + venue_fee
            if total_price > 0:
                discipline = DISCIPLINE_LABELS.get(clinic.discipline, clinic.discipline.value if clinic.discipline else "Clinic")
                clinic_title = clinic.title or f"{discipline} with {clinic.coach_name}"
                description = f"Clinic: {clinic_title}"
                if clinic.proposed_date:
                    description += f" on {clinic.proposed_date.strftime('%d %b')}"

                ledger_entry = LedgerEntry(
                    user_id=participant.user_id,
                    transaction_type=TransactionType.SERVICE_CHARGE,
                    amount=total_price,
                    description=description,
                    created_by_id=current_user.id,
                )
                db.add(ledger_entry)

    db.commit()
    db.refresh(participant)

    return enrich_participant(participant)


@router.delete("/{clinic_id}/participants/{participant_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_participant(
    clinic_id: int,
    participant_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a participant (own registration or manager)."""
    participant = db.query(ClinicParticipant).filter(
        ClinicParticipant.id == participant_id,
        ClinicParticipant.clinic_id == clinic_id
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    is_admin = current_user.role == UserRole.ADMIN
    is_own = participant.user_id == current_user.id

    if not (is_own or is_admin):
        raise HTTPException(status_code=403, detail="Cannot remove this registration")

    db.delete(participant)
    db.commit()


# ============== Slot Management Routes (Admin/Coach) ==============

@router.get("/{clinic_id}/slots", response_model=List[ClinicSlotWithParticipants])
def list_clinic_slots(
    clinic_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all slots for a clinic with their participants."""
    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Allow admin and the coach who proposed the clinic
    is_admin = current_user.role == UserRole.ADMIN
    is_proposer = clinic.proposed_by_id == current_user.id

    if not (is_admin or is_proposer):
        raise HTTPException(status_code=403, detail="Access denied")

    slots = db.query(ClinicSlot).filter(
        ClinicSlot.clinic_id == clinic_id
    ).order_by(ClinicSlot.slot_date, ClinicSlot.start_time).all()

    return [enrich_slot_with_participants(s) for s in slots]


@router.post("/{clinic_id}/slots", response_model=ClinicSlotResponse, status_code=status.HTTP_201_CREATED)
def create_clinic_slot(
    clinic_id: int,
    data: ClinicSlotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new slot for a clinic (admin only)."""
    require_admin(current_user)

    clinic = db.query(ClinicRequest).filter(ClinicRequest.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    # Verify arena exists if provided
    if data.arena_id:
        arena = db.query(Arena).filter(Arena.id == data.arena_id).first()
        if not arena:
            raise HTTPException(status_code=400, detail="Arena not found")

    slot = ClinicSlot(
        clinic_id=clinic_id,
        **data.model_dump()
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)

    return enrich_slot(slot)


@router.put("/{clinic_id}/slots/{slot_id}", response_model=ClinicSlotResponse)
def update_clinic_slot(
    clinic_id: int,
    slot_id: int,
    data: ClinicSlotUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a clinic slot (admin only)."""
    require_admin(current_user)

    slot = db.query(ClinicSlot).filter(
        ClinicSlot.id == slot_id,
        ClinicSlot.clinic_id == clinic_id
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Verify arena exists if being updated
    if data.arena_id:
        arena = db.query(Arena).filter(Arena.id == data.arena_id).first()
        if not arena:
            raise HTTPException(status_code=400, detail="Arena not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(slot, key, value)

    db.commit()
    db.refresh(slot)

    return enrich_slot(slot)


@router.delete("/{clinic_id}/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_clinic_slot(
    clinic_id: int,
    slot_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a clinic slot (admin only). Unassigns any participants."""
    require_admin(current_user)

    slot = db.query(ClinicSlot).filter(
        ClinicSlot.id == slot_id,
        ClinicSlot.clinic_id == clinic_id
    ).first()
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Unassign participants from this slot
    for participant in slot.participants:
        participant.slot_id = None

    db.delete(slot)
    db.commit()


@router.put("/{clinic_id}/participants/{participant_id}/assign-slot", response_model=ClinicParticipantResponse)
def assign_participant_to_slot(
    clinic_id: int,
    participant_id: int,
    slot_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign a participant to a slot (admin only). Pass slot_id=null to unassign."""
    require_admin(current_user)

    participant = db.query(ClinicParticipant).filter(
        ClinicParticipant.id == participant_id,
        ClinicParticipant.clinic_id == clinic_id
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    if slot_id:
        slot = db.query(ClinicSlot).filter(
            ClinicSlot.id == slot_id,
            ClinicSlot.clinic_id == clinic_id
        ).first()
        if not slot:
            raise HTTPException(status_code=400, detail="Slot not found")

        # Check slot capacity
        if slot.max_participants:
            current_count = len([p for p in slot.participants if p.id != participant_id])
            if current_count >= slot.max_participants:
                raise HTTPException(status_code=400, detail="Slot is full")

    participant.slot_id = slot_id
    db.commit()
    db.refresh(participant)

    return enrich_participant(participant)


@router.put("/{clinic_id}/participants/{participant_id}", response_model=ClinicParticipantResponse)
def update_participant(
    clinic_id: int,
    participant_id: int,
    data: ClinicParticipantUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a participant (assign slot, confirm, etc.) - admin only."""
    require_admin(current_user)

    participant = db.query(ClinicParticipant).filter(
        ClinicParticipant.id == participant_id,
        ClinicParticipant.clinic_id == clinic_id
    ).first()
    if not participant:
        raise HTTPException(status_code=404, detail="Participant not found")

    # Validate slot if being assigned
    if data.slot_id:
        slot = db.query(ClinicSlot).filter(
            ClinicSlot.id == data.slot_id,
            ClinicSlot.clinic_id == clinic_id
        ).first()
        if not slot:
            raise HTTPException(status_code=400, detail="Slot not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(participant, key, value)

    db.commit()
    db.refresh(participant)

    return enrich_participant(participant)
