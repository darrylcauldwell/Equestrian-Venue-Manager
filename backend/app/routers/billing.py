"""
Admin Billing Router

Endpoints for managing livery billing including:
- Preview billing for a month
- Run billing (create ledger entries)
- View billing history
"""

from datetime import date
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.utils.auth import get_current_user
from app.services.billing_service import BillingService
from app.schemas.billing import (
    BillingRunRequest,
    BillingRunResponse,
    HorseChargeResponse,
    OwnerBillingSummaryResponse,
    MonthOption
)

router = APIRouter(prefix="/billing", tags=["billing"])


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.get("/months", response_model=List[MonthOption])
def get_billing_months(
    current_user: User = Depends(require_admin)
):
    """
    Get list of months available for billing.
    Returns previous 12 months plus current and next month.
    """
    today = date.today()
    months = []

    # Previous 12 months
    for i in range(12, 0, -1):
        year = today.year
        month = today.month - i
        while month <= 0:
            month += 12
            year -= 1

        month_date = date(year, month, 1)
        months.append(MonthOption(
            year=year,
            month=month,
            display=month_date.strftime("%B %Y"),
            is_current=False,
            is_future=False
        ))

    # Current month
    months.append(MonthOption(
        year=today.year,
        month=today.month,
        display=date(today.year, today.month, 1).strftime("%B %Y"),
        is_current=True,
        is_future=False
    ))

    # Next month (for advance billing if needed)
    next_year = today.year
    next_month = today.month + 1
    if next_month > 12:
        next_month = 1
        next_year += 1

    months.append(MonthOption(
        year=next_year,
        month=next_month,
        display=date(next_year, next_month, 1).strftime("%B %Y"),
        is_current=False,
        is_future=True
    ))

    return months


@router.post("/preview", response_model=BillingRunResponse)
def preview_billing(
    request: BillingRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Preview billing for a specific month.
    Shows what charges would be created without actually creating them.
    """
    if request.month < 1 or request.month > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be between 1 and 12"
        )

    billing_service = BillingService(db, current_user.id)

    result = billing_service.generate_billing(
        billing_year=request.year,
        billing_month=request.month,
        preview_only=True,
        skip_already_billed=True
    )

    # Convert to response model
    owner_summaries = [
        OwnerBillingSummaryResponse(
            owner_id=s.owner_id,
            owner_name=s.owner_name,
            owner_email=s.owner_email,
            horses=[
                HorseChargeResponse(
                    horse_id=h.horse_id,
                    horse_name=h.horse_name,
                    package_id=h.package_id,
                    package_name=h.package_name,
                    monthly_price=h.monthly_price,
                    days_in_month=h.days_in_month,
                    billable_days=h.billable_days,
                    charge_amount=h.charge_amount,
                    period_start=h.period_start,
                    period_end=h.period_end,
                    is_partial=h.is_partial,
                    notes=h.notes
                )
                for h in s.horses
            ],
            total_amount=s.total_amount,
            period_start=s.period_start,
            period_end=s.period_end
        )
        for s in result.owner_summaries
    ]

    return BillingRunResponse(
        billing_month=result.billing_month,
        billing_month_display=result.billing_month.strftime("%B %Y"),
        owner_summaries=owner_summaries,
        total_amount=result.total_amount,
        total_horses=result.total_horses,
        total_owners=result.total_owners,
        ledger_entries_created=result.ledger_entries_created,
        is_preview=result.is_preview
    )


@router.post("/run", response_model=BillingRunResponse)
def run_billing(
    request: BillingRunRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Run billing for a specific month.
    Creates ledger entries for all horses with livery packages.
    Skips horses that have already been billed for the period.
    """
    if request.month < 1 or request.month > 12:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be between 1 and 12"
        )

    billing_service = BillingService(db, current_user.id)

    result = billing_service.generate_billing(
        billing_year=request.year,
        billing_month=request.month,
        preview_only=False,
        skip_already_billed=True
    )

    # Convert to response model
    owner_summaries = [
        OwnerBillingSummaryResponse(
            owner_id=s.owner_id,
            owner_name=s.owner_name,
            owner_email=s.owner_email,
            horses=[
                HorseChargeResponse(
                    horse_id=h.horse_id,
                    horse_name=h.horse_name,
                    package_id=h.package_id,
                    package_name=h.package_name,
                    monthly_price=h.monthly_price,
                    days_in_month=h.days_in_month,
                    billable_days=h.billable_days,
                    charge_amount=h.charge_amount,
                    period_start=h.period_start,
                    period_end=h.period_end,
                    is_partial=h.is_partial,
                    notes=h.notes
                )
                for h in s.horses
            ],
            total_amount=s.total_amount,
            period_start=s.period_start,
            period_end=s.period_end
        )
        for s in result.owner_summaries
    ]

    return BillingRunResponse(
        billing_month=result.billing_month,
        billing_month_display=result.billing_month.strftime("%B %Y"),
        owner_summaries=owner_summaries,
        total_amount=result.total_amount,
        total_horses=result.total_horses,
        total_owners=result.total_owners,
        ledger_entries_created=result.ledger_entries_created,
        is_preview=result.is_preview
    )
