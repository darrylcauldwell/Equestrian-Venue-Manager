"""Risk assessment management router."""
import json
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_

from app.database import get_db
from app.models.user import User, UserRole
from app.models.risk_assessment import (
    RiskAssessment,
    RiskAssessmentReview,
    RiskAssessmentAcknowledgement,
    RiskAssessmentCategory as CategoryModel,
    ReviewTrigger as TriggerModel,
)
from app.schemas.risk_assessment import (
    RiskAssessmentCategory,
    ReviewTrigger,
    RiskAssessmentCreate,
    RiskAssessmentUpdate,
    RiskAssessmentContentUpdate,
    RiskAssessmentResponse,
    RiskAssessmentSummary,
    ReviewCreate,
    ReviewResponse,
    AcknowledgementCreate,
    AcknowledgementResponse,
    AcknowledgementSummary,
    AssessmentStaffStatus,
    MyRiskAssessmentResponse,
    StaffAcknowledgementStatus,
    ComplianceSummary,
    AssessmentComplianceReport,
)
from app.utils.auth import get_current_user, require_roles

router = APIRouter(prefix="/risk-assessments", tags=["risk-assessments"])


def _get_applicable_staff(db: Session, assessment: RiskAssessment) -> List[User]:
    """Get staff members who need to acknowledge this assessment."""
    query = db.query(User).filter(User.is_active == True)

    # If roles are specified, filter to those roles
    if assessment.applies_to_roles:
        try:
            roles = json.loads(assessment.applies_to_roles)
            if roles:
                role_enums = [UserRole(r) for r in roles]
                query = query.filter(User.role.in_(role_enums))
        except (json.JSONDecodeError, ValueError):
            pass
    else:
        # Exclude public users - staff, livery, coaches and admins should acknowledge
        query = query.filter(User.role != UserRole.PUBLIC)

    return query.all()


def _get_acknowledgement_stats(db: Session, assessment: RiskAssessment) -> tuple:
    """Get acknowledgement statistics for an assessment."""
    applicable_staff = _get_applicable_staff(db, assessment)
    total_staff = len(applicable_staff)

    # Count staff with current version acknowledged
    acknowledged_count = 0
    for staff in applicable_staff:
        latest_ack = db.query(RiskAssessmentAcknowledgement).filter(
            RiskAssessmentAcknowledgement.risk_assessment_id == assessment.id,
            RiskAssessmentAcknowledgement.user_id == staff.id
        ).order_by(RiskAssessmentAcknowledgement.acknowledged_at.desc()).first()

        if latest_ack and latest_ack.assessment_version == assessment.version:
            acknowledged_count += 1

    return acknowledged_count, total_staff - acknowledged_count


def _assessment_to_response(assessment: RiskAssessment, db: Session) -> RiskAssessmentResponse:
    """Convert RiskAssessment model to response schema."""
    ack_count, pending_count = _get_acknowledgement_stats(db, assessment)

    roles = None
    if assessment.applies_to_roles:
        try:
            roles = json.loads(assessment.applies_to_roles)
        except json.JSONDecodeError:
            roles = None

    return RiskAssessmentResponse(
        id=assessment.id,
        title=assessment.title,
        category=RiskAssessmentCategory(assessment.category.value),
        summary=assessment.summary,
        content=assessment.content,
        version=assessment.version,
        review_period_months=assessment.review_period_months,
        required_for_induction=assessment.required_for_induction,
        applies_to_roles=roles,
        last_reviewed_at=assessment.last_reviewed_at,
        last_reviewed_by_id=assessment.last_reviewed_by_id,
        next_review_due=assessment.next_review_due,
        needs_review=assessment.needs_review,
        is_active=assessment.is_active,
        created_at=assessment.created_at,
        updated_at=assessment.updated_at,
        created_by_id=assessment.created_by_id,
        created_by_name=assessment.created_by.name if assessment.created_by else None,
        last_reviewed_by_name=assessment.last_reviewed_by.name if assessment.last_reviewed_by else None,
        acknowledgement_count=ack_count,
        staff_needing_acknowledgement=pending_count,
    )


def _assessment_to_summary(assessment: RiskAssessment, db: Session) -> RiskAssessmentSummary:
    """Convert RiskAssessment model to summary schema."""
    ack_count, pending_count = _get_acknowledgement_stats(db, assessment)

    return RiskAssessmentSummary(
        id=assessment.id,
        title=assessment.title,
        category=RiskAssessmentCategory(assessment.category.value),
        summary=assessment.summary,
        version=assessment.version,
        is_active=assessment.is_active,
        needs_review=assessment.needs_review,
        next_review_due=assessment.next_review_due,
        last_reviewed_at=assessment.last_reviewed_at,
        acknowledgement_count=ack_count,
        staff_needing_acknowledgement=pending_count,
        required_for_induction=assessment.required_for_induction,
    )


# ============== Admin Assessment Endpoints ==============

@router.get("", response_model=List[RiskAssessmentSummary])
async def list_assessments(
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    needs_review: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """List all risk assessments."""
    query = db.query(RiskAssessment)

    if category:
        query = query.filter(RiskAssessment.category == CategoryModel(category))
    if is_active is not None:
        query = query.filter(RiskAssessment.is_active == is_active)
    if needs_review is not None:
        query = query.filter(RiskAssessment.needs_review == needs_review)

    assessments = query.order_by(RiskAssessment.category, RiskAssessment.title).all()

    return [_assessment_to_summary(a, db) for a in assessments]


@router.get("/compliance", response_model=ComplianceSummary)
async def get_compliance_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get overall compliance summary."""
    # Get all active assessments
    assessments = db.query(RiskAssessment).filter(RiskAssessment.is_active == True).all()

    # Get all staff (non-clients)
    staff = db.query(User).filter(
        User.is_active == True,
        User.role != UserRole.PUBLIC
    ).all()

    total_staff = len(staff)
    fully_compliant = 0
    assessments_needing_review = 0

    for assessment in assessments:
        if assessment.needs_review or (assessment.next_review_due and assessment.next_review_due < datetime.utcnow()):
            assessments_needing_review += 1

    # Check each staff member's compliance
    for s in staff:
        is_compliant = True
        for assessment in assessments:
            # Check if assessment applies to this staff member
            if assessment.applies_to_roles:
                try:
                    roles = json.loads(assessment.applies_to_roles)
                    if roles and s.role.value not in roles:
                        continue  # Skip - doesn't apply to this role
                except (json.JSONDecodeError, ValueError):
                    pass

            # Check for current version acknowledgement
            latest_ack = db.query(RiskAssessmentAcknowledgement).filter(
                RiskAssessmentAcknowledgement.risk_assessment_id == assessment.id,
                RiskAssessmentAcknowledgement.user_id == s.id,
                RiskAssessmentAcknowledgement.assessment_version == assessment.version
            ).first()

            if not latest_ack:
                is_compliant = False
                break

        if is_compliant:
            fully_compliant += 1

    return ComplianceSummary(
        total_staff=total_staff,
        fully_compliant_staff=fully_compliant,
        non_compliant_staff=total_staff - fully_compliant,
        compliance_percentage=(fully_compliant / total_staff * 100) if total_staff > 0 else 100.0,
        assessments_needing_review=assessments_needing_review,
    )


@router.get("/staff-status", response_model=List[StaffAcknowledgementStatus])
async def get_staff_acknowledgement_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get acknowledgement status for all staff members."""
    # Get all active assessments
    assessments = db.query(RiskAssessment).filter(RiskAssessment.is_active == True).all()

    # Get all staff
    staff = db.query(User).filter(
        User.is_active == True,
        User.role != UserRole.PUBLIC
    ).all()

    result = []
    for s in staff:
        applicable_count = 0
        acknowledged_count = 0

        for assessment in assessments:
            # Check if assessment applies
            if assessment.applies_to_roles:
                try:
                    roles = json.loads(assessment.applies_to_roles)
                    if roles and s.role.value not in roles:
                        continue
                except (json.JSONDecodeError, ValueError):
                    pass

            applicable_count += 1

            # Check for current version acknowledgement
            latest_ack = db.query(RiskAssessmentAcknowledgement).filter(
                RiskAssessmentAcknowledgement.risk_assessment_id == assessment.id,
                RiskAssessmentAcknowledgement.user_id == s.id,
                RiskAssessmentAcknowledgement.assessment_version == assessment.version
            ).first()

            if latest_ack:
                acknowledged_count += 1

        result.append(StaffAcknowledgementStatus(
            user_id=s.id,
            user_name=s.name,
            total_assessments=applicable_count,
            acknowledged_count=acknowledged_count,
            pending_count=applicable_count - acknowledged_count,
            is_compliant=acknowledged_count == applicable_count,
        ))

    return result


@router.get("/{assessment_id}", response_model=RiskAssessmentResponse)
async def get_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get a specific risk assessment."""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    return _assessment_to_response(assessment, db)


@router.post("", response_model=RiskAssessmentResponse)
async def create_assessment(
    data: RiskAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Create a new risk assessment."""
    # Calculate next review date
    next_review = datetime.utcnow() + relativedelta(months=data.review_period_months)

    assessment = RiskAssessment(
        title=data.title,
        category=CategoryModel(data.category.value),
        summary=data.summary,
        content=data.content,
        version=1,
        review_period_months=data.review_period_months,
        required_for_induction=data.required_for_induction,
        applies_to_roles=json.dumps(data.applies_to_roles) if data.applies_to_roles else None,
        last_reviewed_at=datetime.utcnow(),
        last_reviewed_by_id=current_user.id,
        next_review_due=next_review,
        created_by_id=current_user.id,
    )

    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    # Create initial review record
    review = RiskAssessmentReview(
        risk_assessment_id=assessment.id,
        reviewed_by_id=current_user.id,
        trigger=TriggerModel.INITIAL,
        version_before=1,
        version_after=1,
        changes_made=False,
        notes="Initial creation",
    )
    db.add(review)
    db.commit()

    return _assessment_to_response(assessment, db)


@router.put("/{assessment_id}", response_model=RiskAssessmentResponse)
async def update_assessment(
    assessment_id: int,
    data: RiskAssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Update risk assessment metadata (not content)."""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    if data.title is not None:
        assessment.title = data.title
    if data.category is not None:
        assessment.category = CategoryModel(data.category.value)
    if data.summary is not None:
        assessment.summary = data.summary
    if data.review_period_months is not None:
        assessment.review_period_months = data.review_period_months
    if data.required_for_induction is not None:
        assessment.required_for_induction = data.required_for_induction
    if data.applies_to_roles is not None:
        assessment.applies_to_roles = json.dumps(data.applies_to_roles) if data.applies_to_roles else None
    if data.is_active is not None:
        assessment.is_active = data.is_active
    if data.needs_review is not None:
        assessment.needs_review = data.needs_review
    if data.next_review_due is not None:
        assessment.next_review_due = data.next_review_due

    assessment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(assessment)

    return _assessment_to_response(assessment, db)


@router.put("/{assessment_id}/content", response_model=RiskAssessmentResponse)
async def update_assessment_content(
    assessment_id: int,
    data: RiskAssessmentContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Update risk assessment content (increments version, requires re-acknowledgement)."""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    old_version = assessment.version
    new_version = old_version + 1

    # Update content and version
    assessment.content = data.content
    assessment.version = new_version
    assessment.last_reviewed_at = datetime.utcnow()
    assessment.last_reviewed_by_id = current_user.id
    assessment.needs_review = False
    assessment.next_review_due = datetime.utcnow() + relativedelta(months=assessment.review_period_months)
    assessment.updated_at = datetime.utcnow()

    # Create review record
    review = RiskAssessmentReview(
        risk_assessment_id=assessment.id,
        reviewed_by_id=current_user.id,
        trigger=TriggerModel(data.review_trigger.value),
        trigger_details=data.trigger_details,
        version_before=old_version,
        version_after=new_version,
        changes_made=True,
        changes_summary=data.changes_summary,
    )
    db.add(review)

    db.commit()
    db.refresh(assessment)

    return _assessment_to_response(assessment, db)


@router.post("/{assessment_id}/review", response_model=ReviewResponse)
async def record_review(
    assessment_id: int,
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Record a review of the assessment (no content changes)."""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    # Update review tracking
    assessment.last_reviewed_at = datetime.utcnow()
    assessment.last_reviewed_by_id = current_user.id
    assessment.needs_review = False
    assessment.next_review_due = datetime.utcnow() + relativedelta(months=assessment.review_period_months)
    assessment.updated_at = datetime.utcnow()

    # Create review record
    review = RiskAssessmentReview(
        risk_assessment_id=assessment.id,
        reviewed_by_id=current_user.id,
        trigger=TriggerModel(data.trigger.value),
        trigger_details=data.trigger_details,
        version_before=assessment.version,
        version_after=assessment.version,
        changes_made=False,
        notes=data.notes,
    )
    db.add(review)

    db.commit()
    db.refresh(review)

    return ReviewResponse(
        id=review.id,
        risk_assessment_id=review.risk_assessment_id,
        reviewed_at=review.reviewed_at,
        reviewed_by_id=review.reviewed_by_id,
        trigger=ReviewTrigger(review.trigger.value),
        trigger_details=review.trigger_details,
        version_before=review.version_before,
        version_after=review.version_after,
        changes_made=review.changes_made,
        changes_summary=review.changes_summary,
        notes=review.notes,
        reviewed_by_name=review.reviewed_by.name if review.reviewed_by else None,
    )


@router.post("/{assessment_id}/require-reacknowledgement", response_model=RiskAssessmentResponse)
async def require_reacknowledgement(
    assessment_id: int,
    data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """
    Require all staff to re-acknowledge this assessment.

    Use this after an incident, near-miss, or when you want to ensure
    everyone re-reads the assessment. This increments the version number,
    which invalidates all existing acknowledgements.

    The trigger should typically be 'incident', 'new_hazard', or 'change'.
    """
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    old_version = assessment.version
    new_version = old_version + 1

    # Increment version (this invalidates all existing acknowledgements)
    assessment.version = new_version
    assessment.last_reviewed_at = datetime.utcnow()
    assessment.last_reviewed_by_id = current_user.id
    assessment.needs_review = False
    assessment.next_review_due = datetime.utcnow() + relativedelta(months=assessment.review_period_months)
    assessment.updated_at = datetime.utcnow()

    # Create review record documenting why re-acknowledgement was required
    review = RiskAssessmentReview(
        risk_assessment_id=assessment.id,
        reviewed_by_id=current_user.id,
        trigger=TriggerModel(data.trigger.value),
        trigger_details=data.trigger_details,
        version_before=old_version,
        version_after=new_version,
        changes_made=True,  # Version changed = requires action
        changes_summary="Version incremented to require re-acknowledgement from all staff",
        notes=data.notes,
    )
    db.add(review)

    db.commit()
    db.refresh(assessment)

    return _assessment_to_response(assessment, db)


@router.get("/{assessment_id}/reviews", response_model=List[ReviewResponse])
async def get_review_history(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get review history for an assessment."""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    reviews = db.query(RiskAssessmentReview).filter(
        RiskAssessmentReview.risk_assessment_id == assessment_id
    ).order_by(RiskAssessmentReview.reviewed_at.desc()).all()

    return [
        ReviewResponse(
            id=r.id,
            risk_assessment_id=r.risk_assessment_id,
            reviewed_at=r.reviewed_at,
            reviewed_by_id=r.reviewed_by_id,
            trigger=ReviewTrigger(r.trigger.value),
            trigger_details=r.trigger_details,
            version_before=r.version_before,
            version_after=r.version_after,
            changes_made=r.changes_made,
            changes_summary=r.changes_summary,
            notes=r.notes,
            reviewed_by_name=r.reviewed_by.name if r.reviewed_by else None,
        )
        for r in reviews
    ]


@router.get("/{assessment_id}/acknowledgements", response_model=List[AcknowledgementSummary])
async def get_acknowledgements(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get all acknowledgements for an assessment."""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    # Get latest acknowledgement per user
    acks = db.query(RiskAssessmentAcknowledgement).filter(
        RiskAssessmentAcknowledgement.risk_assessment_id == assessment_id
    ).order_by(RiskAssessmentAcknowledgement.acknowledged_at.desc()).all()

    # Group by user - only show latest per user
    seen_users = set()
    result = []
    for ack in acks:
        if ack.user_id in seen_users:
            continue
        seen_users.add(ack.user_id)

        result.append(AcknowledgementSummary(
            id=ack.id,
            user_id=ack.user_id,
            user_name=ack.user.name if ack.user else "Unknown",
            acknowledged_at=ack.acknowledged_at,
            assessment_version=ack.assessment_version,
            is_current_version=ack.assessment_version == assessment.version,
        ))

    return result


@router.get("/{assessment_id}/staff-status", response_model=List[AssessmentStaffStatus])
async def get_assessment_staff_status(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get all staff members and their acknowledgement status for a specific assessment."""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    # Get all applicable staff for this assessment
    applicable_staff = _get_applicable_staff(db, assessment)

    # Get all acknowledgements for this assessment
    acks = db.query(RiskAssessmentAcknowledgement).filter(
        RiskAssessmentAcknowledgement.risk_assessment_id == assessment_id
    ).order_by(RiskAssessmentAcknowledgement.acknowledged_at.desc()).all()

    # Build a map of user_id -> latest acknowledgement
    ack_map = {}
    for ack in acks:
        if ack.user_id not in ack_map:
            ack_map[ack.user_id] = ack

    # Build result with all staff
    result = []
    for staff in applicable_staff:
        ack = ack_map.get(staff.id)
        if ack:
            is_current = ack.assessment_version == assessment.version
            result.append(AssessmentStaffStatus(
                user_id=staff.id,
                user_name=staff.name,
                status='acknowledged' if is_current else 'outdated',
                acknowledged_at=ack.acknowledged_at,
                acknowledged_version=ack.assessment_version,
                is_current_version=is_current,
            ))
        else:
            result.append(AssessmentStaffStatus(
                user_id=staff.id,
                user_name=staff.name,
                status='pending',
                acknowledged_at=None,
                acknowledged_version=None,
                is_current_version=False,
            ))

    # Sort: pending first, then outdated, then acknowledged
    status_order = {'pending': 0, 'outdated': 1, 'acknowledged': 2}
    result.sort(key=lambda x: (status_order.get(x.status, 3), x.user_name))

    return result


@router.delete("/{assessment_id}")
async def delete_assessment(
    assessment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Delete a risk assessment."""
    assessment = db.query(RiskAssessment).filter(RiskAssessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    db.delete(assessment)
    db.commit()

    return {"message": "Risk assessment deleted"}


# ============== Staff Endpoints ==============

@router.get("/my/assessments", response_model=List[MyRiskAssessmentResponse])
async def get_my_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get risk assessments applicable to the current user."""
    assessments = db.query(RiskAssessment).filter(RiskAssessment.is_active == True).all()

    result = []
    for assessment in assessments:
        # Check if applies to this user's role
        if assessment.applies_to_roles:
            try:
                roles = json.loads(assessment.applies_to_roles)
                if roles and current_user.role.value not in roles:
                    continue
            except (json.JSONDecodeError, ValueError):
                pass
        elif current_user.role == UserRole.PUBLIC:
            # Clients only see assessments specifically for clients
            continue

        # Get latest acknowledgement
        latest_ack = db.query(RiskAssessmentAcknowledgement).filter(
            RiskAssessmentAcknowledgement.risk_assessment_id == assessment.id,
            RiskAssessmentAcknowledgement.user_id == current_user.id
        ).order_by(RiskAssessmentAcknowledgement.acknowledged_at.desc()).first()

        needs_ack = True
        if latest_ack and latest_ack.assessment_version == assessment.version:
            needs_ack = False

        result.append(MyRiskAssessmentResponse(
            id=assessment.id,
            title=assessment.title,
            category=RiskAssessmentCategory(assessment.category.value),
            summary=assessment.summary,
            content=assessment.content,
            version=assessment.version,
            required_for_induction=assessment.required_for_induction,
            last_acknowledged_at=latest_ack.acknowledged_at if latest_ack else None,
            last_acknowledged_version=latest_ack.assessment_version if latest_ack else None,
            needs_acknowledgement=needs_ack,
        ))

    # Sort: needs acknowledgement first, then by title
    result.sort(key=lambda x: (not x.needs_acknowledgement, x.title))

    return result


@router.post("/my/acknowledge", response_model=AcknowledgementResponse)
async def acknowledge_assessment(
    data: AcknowledgementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Acknowledge reading a risk assessment."""
    assessment = db.query(RiskAssessment).filter(
        RiskAssessment.id == data.risk_assessment_id,
        RiskAssessment.is_active == True
    ).first()

    if not assessment:
        raise HTTPException(status_code=404, detail="Risk assessment not found")

    # Check if applies to this user
    if assessment.applies_to_roles:
        try:
            roles = json.loads(assessment.applies_to_roles)
            if roles and current_user.role.value not in roles:
                raise HTTPException(status_code=403, detail="This assessment does not apply to your role")
        except (json.JSONDecodeError, ValueError):
            pass
    elif current_user.role == UserRole.PUBLIC:
        raise HTTPException(status_code=403, detail="This assessment does not apply to clients")

    # Create acknowledgement
    ack = RiskAssessmentAcknowledgement(
        risk_assessment_id=assessment.id,
        assessment_version=assessment.version,
        user_id=current_user.id,
        notes=data.notes,
    )

    db.add(ack)
    db.commit()
    db.refresh(ack)

    return AcknowledgementResponse(
        id=ack.id,
        risk_assessment_id=ack.risk_assessment_id,
        assessment_version=ack.assessment_version,
        user_id=ack.user_id,
        acknowledged_at=ack.acknowledged_at,
        notes=ack.notes,
        user_name=current_user.name,
        assessment_title=assessment.title,
    )


@router.get("/my/pending-count")
async def get_pending_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get count of assessments needing acknowledgement."""
    assessments = db.query(RiskAssessment).filter(RiskAssessment.is_active == True).all()

    pending_count = 0
    for assessment in assessments:
        # Check if applies
        if assessment.applies_to_roles:
            try:
                roles = json.loads(assessment.applies_to_roles)
                if roles and current_user.role.value not in roles:
                    continue
            except (json.JSONDecodeError, ValueError):
                pass
        elif current_user.role == UserRole.PUBLIC:
            continue

        # Check for current version acknowledgement
        latest_ack = db.query(RiskAssessmentAcknowledgement).filter(
            RiskAssessmentAcknowledgement.risk_assessment_id == assessment.id,
            RiskAssessmentAcknowledgement.user_id == current_user.id,
            RiskAssessmentAcknowledgement.assessment_version == assessment.version
        ).first()

        if not latest_ack:
            pending_count += 1

    return {"pending_count": pending_count}
