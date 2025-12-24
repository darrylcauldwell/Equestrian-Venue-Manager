"""
Livery Billing Service

Handles automated monthly billing for livery packages including:
- Pro-rata calculation for partial months (arrival/departure)
- Holiday livery short stays
- Grouping charges by owner
- Ledger entry creation
"""

import logging
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from calendar import monthrange
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.horse import Horse
from app.models.user import User
from app.models.livery_package import LiveryPackage, BillingType
from app.models.account import LedgerEntry, TransactionType

logger = logging.getLogger(__name__)


@dataclass
class HorseCharge:
    """Represents a charge for a single horse."""
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


@dataclass
class OwnerBillingSummary:
    """Summary of charges for a single owner."""
    owner_id: int
    owner_name: str
    owner_email: str
    horses: List[HorseCharge]
    total_amount: Decimal
    period_start: date
    period_end: date


@dataclass
class BillingRunResult:
    """Result of a billing run."""
    billing_month: date
    owner_summaries: List[OwnerBillingSummary]
    total_amount: Decimal
    total_horses: int
    total_owners: int
    ledger_entries_created: int
    is_preview: bool


class BillingService:
    """Service for calculating and generating livery billing."""

    def __init__(self, db: Session, created_by_id: int):
        self.db = db
        self.created_by_id = created_by_id

    def calculate_billable_days(
        self,
        billing_year: int,
        billing_month: int,
        livery_start: Optional[date],
        livery_end: Optional[date]
    ) -> Tuple[int, int, date, date, str]:
        """
        Calculate billable days for a horse in a given month.

        Returns: (billable_days, days_in_month, period_start, period_end, notes)
        """
        days_in_month = monthrange(billing_year, billing_month)[1]
        month_start = date(billing_year, billing_month, 1)
        month_end = date(billing_year, billing_month, days_in_month)

        # Default to full month
        period_start = month_start
        period_end = month_end
        notes_parts = []

        # Adjust for arrival date
        if livery_start and livery_start > month_start:
            if livery_start > month_end:
                # Horse hasn't arrived yet this month
                return 0, days_in_month, month_start, month_end, "Not yet arrived"
            period_start = livery_start
            notes_parts.append(f"Arrived {livery_start.strftime('%d %b')}")

        # Adjust for departure date
        if livery_end and livery_end < month_end:
            if livery_end < month_start:
                # Horse already left before this month
                return 0, days_in_month, month_start, month_end, "Already departed"
            period_end = livery_end
            notes_parts.append(f"Departing {livery_end.strftime('%d %b')}")

        # Calculate billable days (inclusive of both start and end dates)
        billable_days = (period_end - period_start).days + 1

        notes = ", ".join(notes_parts) if notes_parts else "Full month"

        return billable_days, days_in_month, period_start, period_end, notes

    def calculate_pro_rata_charge(
        self,
        monthly_price: Decimal,
        billable_days: int,
        days_in_month: int
    ) -> Decimal:
        """Calculate pro-rata charge based on billable days for monthly packages."""
        if billable_days >= days_in_month:
            return monthly_price

        daily_rate = monthly_price / Decimal(days_in_month)
        charge = daily_rate * Decimal(billable_days)

        # Round to 2 decimal places
        return charge.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def calculate_weekly_charge(
        self,
        weekly_price: Decimal,
        billable_days: int
    ) -> Decimal:
        """Calculate charge for weekly packages (holiday livery) - charged per day."""
        daily_rate = weekly_price / Decimal(7)
        charge = daily_rate * Decimal(billable_days)

        # Round to 2 decimal places
        return charge.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def get_billable_horses(self, billing_year: int, billing_month: int) -> List[Horse]:
        """
        Get all horses that should be billed for the given month.

        Includes horses that:
        - Have a livery package assigned
        - Package has a monthly_price (for monthly billing) OR weekly_price (for weekly/holiday billing)
        - Were present for at least part of the month
        """
        from sqlalchemy import or_

        days_in_month = monthrange(billing_year, billing_month)[1]
        month_start = date(billing_year, billing_month, 1)
        month_end = date(billing_year, billing_month, days_in_month)

        horses = self.db.query(Horse).join(LiveryPackage).filter(
            Horse.livery_package_id.isnot(None),
            # Package has either monthly_price OR weekly_price set
            or_(
                and_(LiveryPackage.monthly_price.isnot(None), LiveryPackage.monthly_price > 0),
                and_(LiveryPackage.weekly_price.isnot(None), LiveryPackage.weekly_price > 0)
            ),
            # Horse was present for at least part of the month
            # Started before or during the month
            (Horse.livery_start_date.is_(None) | (Horse.livery_start_date <= month_end)),
            # Ended after or during the month (or hasn't ended)
            (Horse.livery_end_date.is_(None) | (Horse.livery_end_date >= month_start))
        ).all()

        return horses

    def check_already_billed(
        self,
        horse_id: int,
        package_id: int,
        period_start: date,
        period_end: date
    ) -> bool:
        """Check if a horse has already been billed for this period."""
        existing = self.db.query(LedgerEntry).filter(
            LedgerEntry.livery_package_id == package_id,
            LedgerEntry.transaction_type == TransactionType.PACKAGE_CHARGE,
            LedgerEntry.period_start == datetime.combine(period_start, datetime.min.time()),
            LedgerEntry.period_end == datetime.combine(period_end, datetime.min.time()),
            LedgerEntry.description.contains(f"Horse ID: {horse_id}")
        ).first()

        return existing is not None

    def generate_billing(
        self,
        billing_year: int,
        billing_month: int,
        preview_only: bool = True,
        skip_already_billed: bool = True
    ) -> BillingRunResult:
        """
        Generate billing for all livery horses for a given month.

        Args:
            billing_year: Year to bill for
            billing_month: Month to bill for (1-12)
            preview_only: If True, don't create ledger entries
            skip_already_billed: If True, skip horses already billed for this period

        Returns:
            BillingRunResult with all charges and summaries
        """
        days_in_month = monthrange(billing_year, billing_month)[1]
        month_start = date(billing_year, billing_month, 1)
        month_end = date(billing_year, billing_month, days_in_month)

        horses = self.get_billable_horses(billing_year, billing_month)

        # Group charges by owner
        owner_charges: Dict[int, List[HorseCharge]] = {}
        owner_info: Dict[int, User] = {}

        for horse in horses:
            package = horse.livery_package
            if not package:
                continue

            # Determine billing type and get appropriate price
            billing_type = package.billing_type or BillingType.MONTHLY
            if billing_type == BillingType.WEEKLY:
                if not package.weekly_price or package.weekly_price <= 0:
                    continue
                base_price = Decimal(str(package.weekly_price))
            else:
                if not package.monthly_price or package.monthly_price <= 0:
                    continue
                base_price = Decimal(str(package.monthly_price))

            # Calculate billable days
            billable_days, total_days, period_start, period_end, notes = self.calculate_billable_days(
                billing_year,
                billing_month,
                horse.livery_start_date,
                horse.livery_end_date
            )

            if billable_days <= 0:
                continue

            # Check if already billed
            if skip_already_billed and self.check_already_billed(
                horse.id,
                horse.livery_package_id,
                period_start,
                period_end
            ):
                logger.info(f"Skipping {horse.name} - already billed for this period")
                continue

            # Calculate charge based on billing type
            if billing_type == BillingType.WEEKLY:
                # Weekly packages: weekly_price / 7 * days
                charge_amount = self.calculate_weekly_charge(base_price, billable_days)
                # For display, show daily rate
                display_notes = f"{notes} @ £{base_price}/week"
            else:
                # Monthly packages: monthly_price / days_in_month * days
                charge_amount = self.calculate_pro_rata_charge(base_price, billable_days, total_days)
                display_notes = notes

            horse_charge = HorseCharge(
                horse_id=horse.id,
                horse_name=horse.name,
                package_id=horse.livery_package_id,
                package_name=package.name,
                monthly_price=base_price,  # This is the base price (monthly or weekly)
                days_in_month=total_days,
                billable_days=billable_days,
                charge_amount=charge_amount,
                period_start=period_start,
                period_end=period_end,
                is_partial=billable_days < total_days,
                notes=display_notes
            )

            # Add to owner's charges
            owner_id = horse.owner_id
            if owner_id not in owner_charges:
                owner_charges[owner_id] = []
                owner_info[owner_id] = horse.owner

            owner_charges[owner_id].append(horse_charge)

        # Build owner summaries
        owner_summaries: List[OwnerBillingSummary] = []
        total_amount = Decimal('0.00')
        total_horses = 0
        ledger_entries_created = 0

        for owner_id, charges in owner_charges.items():
            owner = owner_info[owner_id]
            owner_total = sum(c.charge_amount for c in charges)
            total_amount += owner_total
            total_horses += len(charges)

            summary = OwnerBillingSummary(
                owner_id=owner_id,
                owner_name=owner.name,
                owner_email=owner.email,
                horses=charges,
                total_amount=owner_total,
                period_start=month_start,
                period_end=month_end
            )
            owner_summaries.append(summary)

            # Create ledger entries if not preview
            if not preview_only:
                for charge in charges:
                    description = (
                        f"{charge.package_name} - {charge.horse_name} "
                        f"(Horse ID: {charge.horse_id})"
                    )
                    if charge.is_partial:
                        description += f" [{charge.billable_days}/{charge.days_in_month} days]"

                    entry = LedgerEntry(
                        user_id=owner_id,
                        transaction_type=TransactionType.PACKAGE_CHARGE,
                        amount=charge.charge_amount,
                        description=description,
                        notes=charge.notes,
                        livery_package_id=charge.package_id,
                        period_start=datetime.combine(charge.period_start, datetime.min.time()),
                        period_end=datetime.combine(charge.period_end, datetime.min.time()),
                        transaction_date=datetime.utcnow(),
                        created_by_id=self.created_by_id
                    )
                    self.db.add(entry)
                    ledger_entries_created += 1

                self.db.commit()

        # Sort by owner name
        owner_summaries.sort(key=lambda x: x.owner_name)

        return BillingRunResult(
            billing_month=month_start,
            owner_summaries=owner_summaries,
            total_amount=total_amount,
            total_horses=total_horses,
            total_owners=len(owner_summaries),
            ledger_entries_created=ledger_entries_created,
            is_preview=preview_only
        )
