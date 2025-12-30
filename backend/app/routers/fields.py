from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.horse import Horse
from app.models.field import (
    Field, FieldCondition, FieldUsageLog, FieldUsageHorse,
    HorseCompanion, CompanionRelationship, TurnoutGroup, TurnoutGroupHorse
)
from app.schemas.field import (
    FieldCreate, FieldUpdate, FieldResponse, FieldSummary,
    FieldConditionUpdate, FieldRestRequest,
    HorseCompanionCreate, HorseCompanionResponse, HorseCompanionSummary,
    TurnoutGroupCreate, TurnoutGroupUpdate, TurnoutGroupResponse,
    TurnoutGroupHorseResponse, DailyTurnoutSummary,
    FieldUsageLogCreate, FieldUsageLogResponse,
    FieldRotationEntry, FieldRotationReport
)
from app.utils.auth import get_current_user, require_roles

router = APIRouter(prefix="/fields", tags=["fields"])


# ============== Field CRUD ==============

@router.get("/", response_model=List[FieldResponse])
async def get_fields(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get all fields."""
    query = db.query(Field)
    if not include_inactive:
        query = query.filter(Field.is_active == True)
    fields = query.order_by(Field.display_order, Field.name).all()
    return fields


@router.get("/summary", response_model=List[FieldSummary])
async def get_fields_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get field summaries with current horse counts."""
    today = date.today()
    fields = db.query(Field).filter(Field.is_active == True).order_by(Field.display_order).all()

    summaries = []
    for field in fields:
        # Count horses currently in this field today
        current_count = db.query(func.count(TurnoutGroupHorse.id)).join(TurnoutGroup).filter(
            TurnoutGroup.field_id == field.id,
            TurnoutGroup.turnout_date == today,
            TurnoutGroupHorse.turned_out_at.isnot(None),
            TurnoutGroupHorse.brought_in_at.is_(None)
        ).scalar()

        summaries.append(FieldSummary(
            id=field.id,
            name=field.name,
            current_condition=field.current_condition,
            is_resting=field.is_resting,
            max_horses=field.max_horses,
            current_horse_count=current_count or 0
        ))

    return summaries


@router.get("/{field_id}", response_model=FieldResponse)
async def get_field(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get a specific field."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


@router.post("/", response_model=FieldResponse)
async def create_field(
    field_data: FieldCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Create a new field."""
    field = Field(**field_data.model_dump())
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.put("/{field_id}", response_model=FieldResponse)
async def update_field(
    field_id: int,
    update: FieldUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Update a field."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    update_data = update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(field, key, value)

    db.commit()
    db.refresh(field)
    return field


@router.put("/{field_id}/condition", response_model=FieldResponse)
async def update_field_condition(
    field_id: int,
    condition: FieldConditionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Update field condition."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    field.current_condition = condition.current_condition
    field.condition_notes = condition.condition_notes
    field.last_condition_update = datetime.utcnow()

    # If marking as resting
    if condition.current_condition == FieldCondition.RESTING:
        field.is_resting = True
        if not field.rest_start_date:
            field.rest_start_date = date.today()
    elif field.is_resting:
        # Coming off rest
        field.is_resting = False
        field.rest_end_date = date.today()

    db.commit()
    db.refresh(field)
    return field


@router.post("/{field_id}/rest", response_model=FieldResponse)
async def start_field_rest(
    field_id: int,
    rest: FieldRestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Start a rest period for a field."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    field.is_resting = True
    field.rest_start_date = rest.rest_start_date
    field.rest_end_date = rest.rest_end_date
    field.current_condition = FieldCondition.RESTING
    if rest.reason:
        field.condition_notes = rest.reason
    field.last_condition_update = datetime.utcnow()

    db.commit()
    db.refresh(field)
    return field


@router.post("/{field_id}/end-rest", response_model=FieldResponse)
async def end_field_rest(
    field_id: int,
    new_condition: FieldCondition = FieldCondition.GOOD,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """End a rest period for a field."""
    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    field.is_resting = False
    field.rest_end_date = date.today()
    field.current_condition = new_condition
    field.last_condition_update = datetime.utcnow()

    db.commit()
    db.refresh(field)
    return field


# ============== Field Rotation Report ==============

@router.get("/rotation-report", response_model=FieldRotationReport)
async def get_rotation_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get field rotation report."""
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    fields = db.query(Field).filter(Field.is_active == True).order_by(Field.display_order).all()

    entries = []
    for field in fields:
        # Get last usage date
        last_usage = db.query(func.max(TurnoutGroup.turnout_date)).filter(
            TurnoutGroup.field_id == field.id
        ).scalar()

        # Count usage in last 7 days
        usage_7d = db.query(func.count(TurnoutGroup.id)).filter(
            TurnoutGroup.field_id == field.id,
            TurnoutGroup.turnout_date >= week_ago
        ).scalar()

        # Count usage in last 30 days
        usage_30d = db.query(func.count(TurnoutGroup.id)).filter(
            TurnoutGroup.field_id == field.id,
            TurnoutGroup.turnout_date >= month_ago
        ).scalar()

        days_since = (today - last_usage).days if last_usage else None

        entries.append(FieldRotationEntry(
            field_id=field.id,
            field_name=field.name,
            current_condition=field.current_condition,
            is_resting=field.is_resting,
            last_used_date=last_usage,
            days_since_use=days_since,
            usage_count_last_7_days=usage_7d or 0,
            usage_count_last_30_days=usage_30d or 0
        ))

    return FieldRotationReport(
        generated_at=datetime.utcnow(),
        fields=entries
    )


# ============== Turnout Groups ==============

@router.get("/turnout/groups/{target_date}", response_model=List[TurnoutGroupResponse])
async def get_turnout_groups(
    target_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Get all turnout groups for a given date."""
    groups = db.query(TurnoutGroup).filter(
        TurnoutGroup.turnout_date == target_date
    ).all()

    return [_group_to_response(group) for group in groups]


@router.post("/turnout/groups", response_model=TurnoutGroupResponse)
async def create_turnout_group(
    group_data: TurnoutGroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Create a new turnout group."""
    # Verify field exists and not resting
    field = db.query(Field).filter(Field.id == group_data.field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    if field.is_resting:
        raise HTTPException(status_code=400, detail="Cannot use field that is resting")

    # Check capacity
    if field.max_horses and len(group_data.horse_ids) > field.max_horses:
        raise HTTPException(
            status_code=400,
            detail=f"Too many horses for field (max {field.max_horses})"
        )

    # Check for incompatible companions
    if len(group_data.horse_ids) > 1:
        incompatible = db.query(HorseCompanion).filter(
            HorseCompanion.horse_id.in_(group_data.horse_ids),
            HorseCompanion.companion_horse_id.in_(group_data.horse_ids),
            HorseCompanion.relationship_type == CompanionRelationship.INCOMPATIBLE
        ).first()
        if incompatible:
            raise HTTPException(
                status_code=400,
                detail="Group contains incompatible horses"
            )

    # Check for horses that must go out alone
    if len(group_data.horse_ids) > 1:
        alone_horse = db.query(Horse).filter(
            Horse.id.in_(group_data.horse_ids),
            Horse.turnout_alone == True
        ).first()
        if alone_horse:
            raise HTTPException(
                status_code=400,
                detail=f"{alone_horse.name} must go out alone"
            )

    group = TurnoutGroup(
        turnout_date=group_data.turnout_date,
        field_id=group_data.field_id,
        notes=group_data.notes,
        assigned_by_id=current_user.id
    )
    db.add(group)
    db.flush()

    # Add horses
    for horse_id in group_data.horse_ids:
        horse_entry = TurnoutGroupHorse(
            group_id=group.id,
            horse_id=horse_id
        )
        db.add(horse_entry)

    db.commit()
    db.refresh(group)
    return _group_to_response(group)


@router.post("/turnout/groups/{group_id}/turn-out", response_model=TurnoutGroupResponse)
async def mark_group_turned_out(
    group_id: int,
    horse_ids: Optional[List[int]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Mark horses in a group as turned out."""
    group = db.query(TurnoutGroup).filter(TurnoutGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    now = datetime.utcnow()

    if horse_ids:
        # Mark specific horses
        for horse in group.horses:
            if horse.horse_id in horse_ids:
                horse.turned_out_at = now
                horse.turned_out_by_id = current_user.id
    else:
        # Mark all horses
        for horse in group.horses:
            if not horse.turned_out_at:
                horse.turned_out_at = now
                horse.turned_out_by_id = current_user.id

    db.commit()
    db.refresh(group)
    return _group_to_response(group)


@router.post("/turnout/groups/{group_id}/bring-in", response_model=TurnoutGroupResponse)
async def mark_group_brought_in(
    group_id: int,
    horse_ids: Optional[List[int]] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Mark horses in a group as brought in."""
    group = db.query(TurnoutGroup).filter(TurnoutGroup.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    now = datetime.utcnow()

    if horse_ids:
        # Mark specific horses
        for horse in group.horses:
            if horse.horse_id in horse_ids:
                horse.brought_in_at = now
                horse.brought_in_by_id = current_user.id
    else:
        # Mark all horses that are out
        for horse in group.horses:
            if horse.turned_out_at and not horse.brought_in_at:
                horse.brought_in_at = now
                horse.brought_in_by_id = current_user.id

    db.commit()
    db.refresh(group)
    return _group_to_response(group)


def _group_to_response(group: TurnoutGroup) -> TurnoutGroupResponse:
    """Convert TurnoutGroup to response schema."""
    return TurnoutGroupResponse(
        id=group.id,
        turnout_date=group.turnout_date,
        field_id=group.field_id,
        notes=group.notes,
        assigned_by_id=group.assigned_by_id,
        created_at=group.created_at,
        field_name=group.field.name if group.field else None,
        assigned_by_name=group.assigned_by.name if group.assigned_by else None,
        horses=[
            TurnoutGroupHorseResponse(
                id=h.id,
                group_id=h.group_id,
                horse_id=h.horse_id,
                turned_out_at=h.turned_out_at,
                brought_in_at=h.brought_in_at,
                turned_out_by_id=h.turned_out_by_id,
                brought_in_by_id=h.brought_in_by_id,
                horse_name=h.horse.name if h.horse else None,
                turned_out_by_name=h.turned_out_by.name if h.turned_out_by else None,
                brought_in_by_name=h.brought_in_by.name if h.brought_in_by else None
            )
            for h in group.horses
        ]
    )


# ============== Horse Companions ==============

@router.get("/horses/{horse_id}/companions", response_model=List[HorseCompanionResponse])
async def get_horse_companions(
    horse_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get companions for a horse."""
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")

    # Check access
    if current_user.role == "livery" and horse.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    companions = db.query(HorseCompanion).filter(
        HorseCompanion.horse_id == horse_id
    ).all()

    return [
        HorseCompanionResponse(
            id=c.id,
            horse_id=c.horse_id,
            companion_horse_id=c.companion_horse_id,
            relationship_type=c.relationship_type,
            notes=c.notes,
            created_by_id=c.created_by_id,
            created_at=c.created_at,
            horse_name=horse.name,
            companion_name=c.companion.name if c.companion else None,
            created_by_name=c.created_by.name if c.created_by else None
        )
        for c in companions
    ]


@router.post("/horses/{horse_id}/companions", response_model=HorseCompanionResponse)
async def add_horse_companion(
    horse_id: int,
    companion_data: HorseCompanionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Add a companion relationship for a horse."""
    horse = db.query(Horse).filter(Horse.id == horse_id).first()
    if not horse:
        raise HTTPException(status_code=404, detail="Horse not found")

    companion_horse = db.query(Horse).filter(Horse.id == companion_data.companion_horse_id).first()
    if not companion_horse:
        raise HTTPException(status_code=404, detail="Companion horse not found")

    if horse_id == companion_data.companion_horse_id:
        raise HTTPException(status_code=400, detail="Horse cannot be its own companion")

    # Check if relationship already exists
    existing = db.query(HorseCompanion).filter(
        HorseCompanion.horse_id == horse_id,
        HorseCompanion.companion_horse_id == companion_data.companion_horse_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Relationship already exists")

    companion = HorseCompanion(
        horse_id=horse_id,
        companion_horse_id=companion_data.companion_horse_id,
        relationship_type=companion_data.relationship_type,
        notes=companion_data.notes,
        created_by_id=current_user.id
    )
    db.add(companion)

    # Add reciprocal relationship
    reciprocal = HorseCompanion(
        horse_id=companion_data.companion_horse_id,
        companion_horse_id=horse_id,
        relationship_type=companion_data.relationship_type,
        notes=companion_data.notes,
        created_by_id=current_user.id
    )
    db.add(reciprocal)

    db.commit()
    db.refresh(companion)

    return HorseCompanionResponse(
        id=companion.id,
        horse_id=companion.horse_id,
        companion_horse_id=companion.companion_horse_id,
        relationship_type=companion.relationship_type,
        notes=companion.notes,
        created_by_id=companion.created_by_id,
        created_at=companion.created_at,
        horse_name=horse.name,
        companion_name=companion_horse.name,
        created_by_name=current_user.name
    )


@router.delete("/horses/{horse_id}/companions/{companion_id}")
async def remove_horse_companion(
    horse_id: int,
    companion_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin", "staff"]))
):
    """Remove a companion relationship."""
    companion = db.query(HorseCompanion).filter(
        HorseCompanion.id == companion_id,
        HorseCompanion.horse_id == horse_id
    ).first()

    if not companion:
        raise HTTPException(status_code=404, detail="Companion relationship not found")

    # Also remove reciprocal
    reciprocal = db.query(HorseCompanion).filter(
        HorseCompanion.horse_id == companion.companion_horse_id,
        HorseCompanion.companion_horse_id == horse_id
    ).first()

    db.delete(companion)
    if reciprocal:
        db.delete(reciprocal)

    db.commit()

    return {"message": "Companion relationship removed"}


# ============== Field Usage Analytics ==============

@router.get("/analytics/yearly/{year}")
async def get_yearly_analytics(
    year: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get yearly field usage analytics."""
    from app.models.land_management import FieldUsageAnalytics, FeatureCondition as LandFeatureCondition

    fields = db.query(Field).filter(Field.is_active == True).order_by(Field.display_order).all()

    result = []
    total_field_days = 0
    busiest_usage = 0
    least_usage = float('inf')
    busiest_field = None
    least_used_field = None

    for field in fields:
        # Get analytics for this field for the year
        analytics = db.query(FieldUsageAnalytics).filter(
            FieldUsageAnalytics.field_id == field.id,
            FieldUsageAnalytics.year == year
        ).order_by(FieldUsageAnalytics.month).all()

        total_days = sum(a.total_days_used for a in analytics)
        total_horse_days = sum(a.total_horse_days for a in analytics)
        total_rest = sum(a.rest_days_taken for a in analytics)
        avg_monthly = total_days / 12 if analytics else 0

        total_field_days += total_days

        if total_days > busiest_usage:
            busiest_usage = total_days
            busiest_field = field.name
        if total_days < least_usage:
            least_usage = total_days
            least_used_field = field.name

        # Get conditions at start and end of year
        jan = next((a for a in analytics if a.month == 1), None)
        dec = next((a for a in analytics if a.month == 12), None)

        month_names = ["", "January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"]

        months_data = [
            {
                "id": a.id,
                "field_id": a.field_id,
                "field_name": field.name,
                "year": a.year,
                "month": a.month,
                "month_name": month_names[a.month],
                "total_days_used": a.total_days_used,
                "total_horse_days": a.total_horse_days,
                "average_horses_per_day": a.average_horses_per_day,
                "usage_percentage": a.usage_percentage,
                "condition_at_start": a.condition_at_start.value if a.condition_at_start else None,
                "condition_at_end": a.condition_at_end.value if a.condition_at_end else None,
                "condition_trend": a.condition_trend,
                "rest_days_taken": a.rest_days_taken,
                "calculated_at": a.calculated_at.isoformat() if a.calculated_at else None
            }
            for a in analytics
        ]

        result.append({
            "field_id": field.id,
            "field_name": field.name,
            "year": year,
            "total_days_used": total_days,
            "total_horse_days": total_horse_days,
            "average_monthly_usage": round(avg_monthly, 1),
            "condition_start_of_year": jan.condition_at_start.value if jan and jan.condition_at_start else None,
            "condition_end_of_year": dec.condition_at_end.value if dec and dec.condition_at_end else None,
            "total_rest_days": total_rest,
            "months": months_data
        })

    return {
        "year": year,
        "fields": result,
        "total_field_days_used": total_field_days,
        "busiest_field": busiest_field,
        "least_used_field": least_used_field
    }


@router.get("/analytics/{field_id}/history")
async def get_field_analytics_history(
    field_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get historical analytics for a specific field."""
    from app.models.land_management import FieldUsageAnalytics

    field = db.query(Field).filter(Field.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")

    analytics = db.query(FieldUsageAnalytics).filter(
        FieldUsageAnalytics.field_id == field_id
    ).order_by(
        FieldUsageAnalytics.year.desc(),
        FieldUsageAnalytics.month.desc()
    ).all()

    month_names = ["", "January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]

    return {
        "field_id": field.id,
        "field_name": field.name,
        "analytics": [
            {
                "year": a.year,
                "month": a.month,
                "month_name": month_names[a.month],
                "total_days_used": a.total_days_used,
                "total_horse_days": a.total_horse_days,
                "average_horses_per_day": a.average_horses_per_day,
                "usage_percentage": a.usage_percentage,
                "condition_trend": a.condition_trend,
                "rest_days_taken": a.rest_days_taken
            }
            for a in analytics
        ]
    }


@router.post("/analytics/calculate")
async def calculate_analytics(
    year: Optional[int] = None,
    month: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """
    Manually trigger analytics calculation.

    If no year/month provided, calculates for current month.
    """
    from app.models.land_management import FieldUsageAnalytics
    from calendar import monthrange

    target_year = year or date.today().year
    target_month = month or date.today().month

    days_in_month = monthrange(target_year, target_month)[1]
    month_start = date(target_year, target_month, 1)
    month_end = date(target_year, target_month, days_in_month)

    fields = db.query(Field).filter(Field.is_active == True).all()
    calculated = 0

    for field in fields:
        # Count usage days
        usage_days = db.query(func.count(func.distinct(TurnoutGroup.turnout_date))).filter(
            TurnoutGroup.field_id == field.id,
            TurnoutGroup.turnout_date >= month_start,
            TurnoutGroup.turnout_date <= month_end
        ).scalar() or 0

        # Count horse-days
        horse_days = db.query(func.count(TurnoutGroupHorse.id)).join(TurnoutGroup).filter(
            TurnoutGroup.field_id == field.id,
            TurnoutGroup.turnout_date >= month_start,
            TurnoutGroup.turnout_date <= month_end
        ).scalar() or 0

        # Calculate averages
        avg_horses = horse_days / usage_days if usage_days > 0 else 0
        usage_pct = (usage_days / days_in_month) * 100

        # Determine condition trend (simplified)
        # This would be more sophisticated in a real implementation
        condition_trend = "stable"
        if field.current_condition == FieldCondition.POOR:
            condition_trend = "declining"
        elif field.current_condition == FieldCondition.EXCELLENT:
            condition_trend = "improving"

        # Count rest days
        rest_days = 0
        if field.is_resting:
            if field.rest_start_date and field.rest_start_date <= month_end:
                rest_start = max(field.rest_start_date, month_start)
                rest_end = min(field.rest_end_date or month_end, month_end)
                rest_days = (rest_end - rest_start).days + 1

        # Upsert analytics record
        existing = db.query(FieldUsageAnalytics).filter(
            FieldUsageAnalytics.field_id == field.id,
            FieldUsageAnalytics.year == target_year,
            FieldUsageAnalytics.month == target_month
        ).first()

        if existing:
            existing.total_days_used = usage_days
            existing.total_horse_days = horse_days
            existing.average_horses_per_day = round(avg_horses, 2)
            existing.usage_percentage = round(usage_pct, 1)
            existing.condition_at_end = field.current_condition
            existing.condition_trend = condition_trend
            existing.rest_days_taken = rest_days
            existing.calculated_at = datetime.utcnow()
        else:
            from app.models.land_management import FeatureCondition as LandFeatureCondition
            analytics = FieldUsageAnalytics(
                field_id=field.id,
                year=target_year,
                month=target_month,
                total_days_used=usage_days,
                total_horse_days=horse_days,
                average_horses_per_day=round(avg_horses, 2),
                usage_percentage=round(usage_pct, 1),
                condition_at_start=field.current_condition,
                condition_at_end=field.current_condition,
                condition_trend=condition_trend,
                rest_days_taken=rest_days,
                calculated_at=datetime.utcnow()
            )
            db.add(analytics)

        calculated += 1

    db.commit()

    return {
        "message": f"Calculated analytics for {calculated} fields",
        "year": target_year,
        "month": target_month
    }


@router.get("/rotation/suggestions")
async def get_rotation_suggestions(
    acknowledged: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get field rotation suggestions."""
    from app.models.land_management import FieldRotationSuggestion

    query = db.query(FieldRotationSuggestion).filter(
        FieldRotationSuggestion.acknowledged == acknowledged
    )

    suggestions = query.order_by(
        FieldRotationSuggestion.priority.desc(),
        FieldRotationSuggestion.suggested_date
    ).all()

    result = []
    for s in suggestions:
        field = db.query(Field).filter(Field.id == s.field_id).first()
        result.append({
            "id": s.id,
            "field_id": s.field_id,
            "field_name": field.name if field else None,
            "suggested_date": s.suggested_date.isoformat(),
            "suggestion_type": s.suggestion_type.value,
            "priority": s.priority.value,
            "reason": s.reason,
            "acknowledged": s.acknowledged,
            "acknowledged_at": s.acknowledged_at.isoformat() if s.acknowledged_at else None,
            "notes": s.notes
        })

    return result


@router.post("/rotation/suggestions/{suggestion_id}/acknowledge")
async def acknowledge_suggestion(
    suggestion_id: int,
    notes: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Acknowledge a rotation suggestion."""
    from app.models.land_management import FieldRotationSuggestion

    suggestion = db.query(FieldRotationSuggestion).filter(
        FieldRotationSuggestion.id == suggestion_id
    ).first()

    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")

    suggestion.acknowledged = True
    suggestion.acknowledged_by_id = current_user.id
    suggestion.acknowledged_at = datetime.utcnow()
    if notes:
        suggestion.notes = notes

    db.commit()

    return {"message": "Suggestion acknowledged"}
