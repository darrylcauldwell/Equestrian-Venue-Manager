from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models.land_management import (
    Grant,
    GrantPaymentSchedule,
    GrantFieldLink,
    GrantFeatureLink,
    LandFeature,
    GrantSchemeType,
    GrantStatus,
    GrantPaymentStatus,
)
from app.models.field import Field
from app.models.user import User
from app.schemas.land_management import (
    GrantCreate,
    GrantUpdate,
    GrantResponse,
    GrantDetailResponse,
    GrantPaymentScheduleCreate,
    GrantPaymentScheduleUpdate,
    GrantPaymentScheduleResponse,
    GrantFieldLinkCreate,
    GrantFieldLinkResponse,
    GrantFeatureLinkCreate,
    GrantFeatureLinkResponse,
)
from app.utils.auth import get_current_user, require_admin
from app.utils.crud import get_or_404

router = APIRouter()


def grant_query(db: Session):
    """Create a query with eager loading for grants."""
    return db.query(Grant).options(
        joinedload(Grant.payment_schedules),
        joinedload(Grant.field_links),
        joinedload(Grant.feature_links),
    )


def enrich_grant(grant: Grant) -> GrantResponse:
    """Add computed fields to a grant response."""
    response = GrantResponse.model_validate(grant)
    response.field_count = len(grant.field_links) if grant.field_links else 0
    response.feature_count = len(grant.feature_links) if grant.feature_links else 0
    return response


def enrich_grant_detail(grant: Grant, db: Session) -> GrantDetailResponse:
    """Add detailed linked information to a grant response."""
    response = GrantDetailResponse.model_validate(grant)
    response.field_count = len(grant.field_links) if grant.field_links else 0
    response.feature_count = len(grant.feature_links) if grant.feature_links else 0

    # Enrich field links
    response.linked_fields = []
    for link in (grant.field_links or []):
        field = db.query(Field).filter(Field.id == link.field_id).first()
        link_response = GrantFieldLinkResponse.model_validate(link)
        if field:
            link_response.field_name = field.name
        response.linked_fields.append(link_response)

    # Enrich feature links
    response.linked_features = []
    for link in (grant.feature_links or []):
        feature = db.query(LandFeature).filter(LandFeature.id == link.feature_id).first()
        link_response = GrantFeatureLinkResponse.model_validate(link)
        if feature:
            link_response.feature_name = feature.name
            link_response.feature_type = feature.feature_type
        response.linked_features.append(link_response)

    # Payment schedules
    response.payment_schedules = [
        GrantPaymentScheduleResponse.model_validate(p)
        for p in (grant.payment_schedules or [])
    ]

    return response


# ============================================================================
# Grant CRUD
# ============================================================================

@router.get("/", response_model=List[GrantResponse])
def list_grants(
    scheme_type: Optional[GrantSchemeType] = None,
    status: Optional[GrantStatus] = None,
    active_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all grants with optional filtering."""
    query = grant_query(db)

    if scheme_type:
        query = query.filter(Grant.scheme_type == scheme_type)
    if status:
        query = query.filter(Grant.status == status)
    if active_only:
        query = query.filter(Grant.status == GrantStatus.ACTIVE)

    grants = query.order_by(Grant.name).all()
    return [enrich_grant(g) for g in grants]


@router.post("/", response_model=GrantResponse, status_code=status.HTTP_201_CREATED)
def create_grant(
    grant_data: GrantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Create a new grant application."""
    grant = Grant(
        **grant_data.model_dump(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(grant)
    db.commit()
    db.refresh(grant)
    return enrich_grant(grant)


@router.get("/{grant_id}", response_model=GrantDetailResponse)
def get_grant(
    grant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get a grant with full details."""
    grant = grant_query(db).filter(Grant.id == grant_id).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")
    return enrich_grant_detail(grant, db)


@router.put("/{grant_id}", response_model=GrantResponse)
def update_grant(
    grant_id: int,
    grant_data: GrantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a grant."""
    grant = db.query(Grant).filter(Grant.id == grant_id).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")

    for key, value in grant_data.model_dump(exclude_unset=True).items():
        setattr(grant, key, value)

    grant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(grant)
    return enrich_grant(grant)


@router.delete("/{grant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grant(
    grant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a grant."""
    grant = db.query(Grant).filter(Grant.id == grant_id).first()
    if not grant:
        raise HTTPException(status_code=404, detail="Grant not found")

    db.delete(grant)
    db.commit()


# ============================================================================
# Grant Deadlines & Upcoming
# ============================================================================

@router.get("/upcoming/deadlines", response_model=List[GrantResponse])
def get_upcoming_deadlines(
    days_ahead: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get grants with submission deadlines in the next N days."""
    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    grants = grant_query(db).filter(
        Grant.submission_deadline >= today,
        Grant.submission_deadline <= end_date,
        Grant.status.in_([GrantStatus.DRAFT, GrantStatus.SUBMITTED, GrantStatus.UNDER_REVIEW])
    ).order_by(Grant.submission_deadline).all()

    return [enrich_grant(g) for g in grants]


@router.get("/upcoming/inspections", response_model=List[GrantResponse])
def get_upcoming_inspections(
    days_ahead: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get grants with inspections due in the next N days."""
    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    grants = grant_query(db).filter(
        Grant.next_inspection_date >= today,
        Grant.next_inspection_date <= end_date,
        Grant.status == GrantStatus.ACTIVE
    ).order_by(Grant.next_inspection_date).all()

    return [enrich_grant(g) for g in grants]


# ============================================================================
# Payment Schedule
# ============================================================================

@router.get("/{grant_id}/payments", response_model=List[GrantPaymentScheduleResponse])
def list_grant_payments(
    grant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """List all payment schedules for a grant."""
    grant = get_or_404(db, Grant, grant_id)

    payments = db.query(GrantPaymentSchedule).filter(
        GrantPaymentSchedule.grant_id == grant_id
    ).order_by(GrantPaymentSchedule.due_date).all()

    return [GrantPaymentScheduleResponse.model_validate(p) for p in payments]


@router.post("/{grant_id}/payments", response_model=GrantPaymentScheduleResponse, status_code=status.HTTP_201_CREATED)
def add_grant_payment(
    grant_id: int,
    payment_data: GrantPaymentScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Add a payment schedule entry for a grant."""
    grant = get_or_404(db, Grant, grant_id)

    payment = GrantPaymentSchedule(
        grant_id=grant_id,
        **payment_data.model_dump(),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return GrantPaymentScheduleResponse.model_validate(payment)


@router.put("/{grant_id}/payments/{payment_id}", response_model=GrantPaymentScheduleResponse)
def update_grant_payment(
    grant_id: int,
    payment_id: int,
    payment_data: GrantPaymentScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Update a payment schedule entry."""
    payment = db.query(GrantPaymentSchedule).filter(
        GrantPaymentSchedule.id == payment_id,
        GrantPaymentSchedule.grant_id == grant_id
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    for key, value in payment_data.model_dump(exclude_unset=True).items():
        setattr(payment, key, value)

    payment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(payment)
    return GrantPaymentScheduleResponse.model_validate(payment)


@router.delete("/{grant_id}/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_grant_payment(
    grant_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Delete a payment schedule entry."""
    payment = db.query(GrantPaymentSchedule).filter(
        GrantPaymentSchedule.id == payment_id,
        GrantPaymentSchedule.grant_id == grant_id
    ).first()

    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    db.delete(payment)
    db.commit()


@router.get("/payments/upcoming", response_model=List[GrantPaymentScheduleResponse])
def get_upcoming_payments(
    days_ahead: int = 90,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Get all upcoming grant payments across all grants."""
    today = date.today()
    end_date = today + timedelta(days=days_ahead)

    payments = db.query(GrantPaymentSchedule).join(Grant).filter(
        GrantPaymentSchedule.due_date >= today,
        GrantPaymentSchedule.due_date <= end_date,
        GrantPaymentSchedule.status == GrantPaymentStatus.SCHEDULED,
        Grant.status == GrantStatus.ACTIVE
    ).order_by(GrantPaymentSchedule.due_date).all()

    return [GrantPaymentScheduleResponse.model_validate(p) for p in payments]


# ============================================================================
# Field & Feature Links
# ============================================================================

@router.post("/{grant_id}/link-field/{field_id}", response_model=GrantFieldLinkResponse, status_code=status.HTTP_201_CREATED)
def link_grant_to_field(
    grant_id: int,
    field_id: int,
    link_data: GrantFieldLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Link a grant to a field."""
    grant = get_or_404(db, Grant, grant_id)
    field = get_or_404(db, Field, field_id)

    # Check if link already exists
    existing = db.query(GrantFieldLink).filter(
        GrantFieldLink.grant_id == grant_id,
        GrantFieldLink.field_id == field_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Grant is already linked to this field"
        )

    link = GrantFieldLink(
        grant_id=grant_id,
        field_id=field_id,
        notes=link_data.notes,
        created_at=datetime.utcnow()
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    response = GrantFieldLinkResponse.model_validate(link)
    response.field_name = field.name
    return response


@router.delete("/{grant_id}/unlink-field/{field_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_grant_from_field(
    grant_id: int,
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Remove link between grant and field."""
    link = db.query(GrantFieldLink).filter(
        GrantFieldLink.grant_id == grant_id,
        GrantFieldLink.field_id == field_id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()


@router.post("/{grant_id}/link-feature/{feature_id}", response_model=GrantFeatureLinkResponse, status_code=status.HTTP_201_CREATED)
def link_grant_to_feature(
    grant_id: int,
    feature_id: int,
    link_data: GrantFeatureLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Link a grant to a land feature."""
    grant = get_or_404(db, Grant, grant_id)
    feature = get_or_404(db, LandFeature, feature_id)

    # Check if link already exists
    existing = db.query(GrantFeatureLink).filter(
        GrantFeatureLink.grant_id == grant_id,
        GrantFeatureLink.feature_id == feature_id
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Grant is already linked to this feature"
        )

    link = GrantFeatureLink(
        grant_id=grant_id,
        feature_id=feature_id,
        notes=link_data.notes,
        created_at=datetime.utcnow()
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    response = GrantFeatureLinkResponse.model_validate(link)
    response.feature_name = feature.name
    response.feature_type = feature.feature_type
    return response


@router.delete("/{grant_id}/unlink-feature/{feature_id}", status_code=status.HTTP_204_NO_CONTENT)
def unlink_grant_from_feature(
    grant_id: int,
    feature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """Remove link between grant and feature."""
    link = db.query(GrantFeatureLink).filter(
        GrantFeatureLink.grant_id == grant_id,
        GrantFeatureLink.feature_id == feature_id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="Link not found")

    db.delete(link)
    db.commit()


# ============================================================================
# Enums
# ============================================================================

@router.get("/enums/scheme-types")
def get_scheme_types():
    """Get all grant scheme types."""
    return [
        {"value": t.value, "label": t.value.replace("_", " ").title()}
        for t in GrantSchemeType
    ]


@router.get("/enums/statuses")
def get_grant_statuses():
    """Get all grant statuses."""
    return [
        {"value": s.value, "label": s.value.replace("_", " ").title()}
        for s in GrantStatus
    ]
