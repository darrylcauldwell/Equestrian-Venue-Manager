"""Schemas for livery billing."""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel


class HorseChargeResponse(BaseModel):
    """A charge for a single horse."""
    horse_id: int
    horse_name: str
    package_id: int
    package_name: str
    monthly_price: Decimal
    days_in_month: int
    billable_days: int
    charge_amount: Decimal
    period_start: date
    period_end: date
    is_partial: bool
    notes: str


class OwnerBillingSummaryResponse(BaseModel):
    """Summary of charges for a single owner."""
    owner_id: int
    owner_name: str
    owner_email: str
    horses: List[HorseChargeResponse]
    total_amount: Decimal
    period_start: date
    period_end: date


class BillingRunResponse(BaseModel):
    """Result of a billing run."""
    billing_month: date
    billing_month_display: str
    owner_summaries: List[OwnerBillingSummaryResponse]
    total_amount: Decimal
    total_horses: int
    total_owners: int
    ledger_entries_created: int
    is_preview: bool


class BillingRunRequest(BaseModel):
    """Request to run billing."""
    year: int
    month: int  # 1-12
    preview_only: bool = True


class MonthOption(BaseModel):
    """A month option for the billing selector."""
    year: int
    month: int
    display: str
    is_current: bool = False
    is_future: bool = False
