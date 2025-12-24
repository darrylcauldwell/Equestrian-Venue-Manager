from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models.account import LedgerEntry, TransactionType
from app.models.service import ServiceRequest, RequestStatus
from app.models.user import User, UserRole
from app.models.invoice import Invoice, InvoiceStatus
from app.utils.auth import get_current_user, has_staff_access
from app.schemas.account import (
    LedgerEntryCreate,
    LedgerEntryResponse,
    AccountBalance,
    AccountSummary,
    UserAccountSummary,
    TransactionEnums,
)

router = APIRouter()


def get_last_invoice_date(user_id: int, db: Session) -> Optional[date]:
    """Get the end date of the most recent issued invoice for a user."""
    last_invoice = db.query(Invoice).filter(
        Invoice.user_id == user_id,
        Invoice.status.in_([InvoiceStatus.ISSUED, InvoiceStatus.PAID, InvoiceStatus.OVERDUE])
    ).order_by(Invoice.period_end.desc()).first()

    if last_invoice:
        return last_invoice.period_end
    return None


def enrich_ledger_entry(entry: LedgerEntry) -> LedgerEntryResponse:
    """Add related names to ledger entry response."""
    response = LedgerEntryResponse.model_validate(entry)

    if entry.user:
        response.user_name = entry.user.name
    if entry.created_by:
        response.created_by_name = entry.created_by.name
    if entry.service_request:
        response.service_description = f"Service: {entry.service_request.service.name if entry.service_request.service else 'Unknown'}"
    if entry.livery_package:
        response.package_name = entry.livery_package.name

    return response


def calculate_balance(user_id: int, db: Session) -> AccountBalance:
    """Calculate account balance for a user."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Sum all transactions
    result = db.query(
        func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")).label("balance"),
        func.coalesce(
            func.sum(
                case(
                    (LedgerEntry.amount > 0, LedgerEntry.amount),
                    else_=Decimal("0.00")
                )
            ),
            Decimal("0.00")
        ).label("total_charges"),
        func.coalesce(
            func.sum(
                case(
                    (LedgerEntry.amount < 0, func.abs(LedgerEntry.amount)),
                    else_=Decimal("0.00")
                )
            ),
            Decimal("0.00")
        ).label("total_payments"),
    ).filter(LedgerEntry.user_id == user_id).first()

    return AccountBalance(
        user_id=user_id,
        user_name=user.name,
        balance=result.balance if result else Decimal("0.00"),
        total_charges=result.total_charges if result else Decimal("0.00"),
        total_payments=result.total_payments if result else Decimal("0.00"),
    )


# ============== User Endpoints ==============

@router.get("/my", response_model=AccountSummary)
def get_my_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's account summary with transactions since last invoice."""
    # Get the last invoice date
    last_invoice_date = get_last_invoice_date(current_user.id, db)

    # Current billing period starts the day after the last invoice ended
    current_period_start = None
    if last_invoice_date:
        current_period_start = last_invoice_date + timedelta(days=1)

    # Build query for current period transactions
    query = db.query(LedgerEntry).filter(
        LedgerEntry.user_id == current_user.id
    )

    if last_invoice_date:
        # Filter to transactions after the last invoice period
        query = query.filter(
            LedgerEntry.transaction_date > datetime.combine(last_invoice_date, datetime.max.time())
        )

    recent = query.order_by(LedgerEntry.transaction_date.desc()).limit(50).all()

    # Calculate balance for CURRENT PERIOD only (matching displayed transactions)
    user = db.query(User).filter(User.id == current_user.id).first()
    balance_query = db.query(
        func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")).label("balance"),
        func.coalesce(
            func.sum(
                case(
                    (LedgerEntry.amount > 0, LedgerEntry.amount),
                    else_=Decimal("0.00")
                )
            ),
            Decimal("0.00")
        ).label("total_charges"),
        func.coalesce(
            func.sum(
                case(
                    (LedgerEntry.amount < 0, func.abs(LedgerEntry.amount)),
                    else_=Decimal("0.00")
                )
            ),
            Decimal("0.00")
        ).label("total_payments"),
    ).filter(LedgerEntry.user_id == current_user.id)

    if last_invoice_date:
        balance_query = balance_query.filter(
            LedgerEntry.transaction_date > datetime.combine(last_invoice_date, datetime.max.time())
        )

    result = balance_query.first()

    balance = AccountBalance(
        user_id=current_user.id,
        user_name=user.name if user else "",
        balance=result.balance if result else Decimal("0.00"),
        total_charges=result.total_charges if result else Decimal("0.00"),
        total_payments=result.total_payments if result else Decimal("0.00"),
    )

    # Count pending service requests not yet billed
    pending_charges = db.query(ServiceRequest).filter(
        ServiceRequest.requested_by_id == current_user.id,
        ServiceRequest.status == RequestStatus.COMPLETED,
        ~ServiceRequest.id.in_(
            db.query(LedgerEntry.service_request_id).filter(
                LedgerEntry.service_request_id.isnot(None)
            )
        )
    ).count()

    return AccountSummary(
        balance=balance,
        recent_transactions=[enrich_ledger_entry(e) for e in recent],
        pending_service_charges=pending_charges,
        last_invoice_date=last_invoice_date,
        current_period_start=current_period_start,
    )


@router.get("/my/transactions", response_model=List[LedgerEntryResponse])
def get_my_transactions(
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    transaction_type: Optional[TransactionType] = Query(None),
    since_last_invoice: bool = Query(True, description="Filter to transactions since last invoice"),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's transaction history. By default only shows transactions since last invoice."""
    query = db.query(LedgerEntry).filter(LedgerEntry.user_id == current_user.id)

    # Apply last invoice filter if requested and no explicit date range given
    if since_last_invoice and not from_date:
        last_invoice_date = get_last_invoice_date(current_user.id, db)
        if last_invoice_date:
            query = query.filter(
                LedgerEntry.transaction_date > datetime.combine(last_invoice_date, datetime.max.time())
            )

    if from_date:
        query = query.filter(LedgerEntry.transaction_date >= from_date)
    if to_date:
        query = query.filter(LedgerEntry.transaction_date <= to_date)
    if transaction_type:
        query = query.filter(LedgerEntry.transaction_type == transaction_type)

    entries = query.order_by(
        LedgerEntry.transaction_date.desc()
    ).offset(offset).limit(limit).all()

    return [enrich_ledger_entry(e) for e in entries]


# ============== Admin/Staff Endpoints ==============

@router.get("/users", response_model=List[UserAccountSummary])
def list_user_accounts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all user accounts with balances (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    # Get all livery users
    livery_users = db.query(User).filter(
        User.role == UserRole.LIVERY,
        User.is_active == True
    ).all()

    summaries = []
    for user in livery_users:
        result = db.query(
            func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00")).label("balance"),
            func.count(LedgerEntry.id).label("count"),
        ).filter(LedgerEntry.user_id == user.id).first()

        summaries.append(UserAccountSummary(
            user_id=user.id,
            user_name=user.name,
            balance=result.balance if result else Decimal("0.00"),
            transaction_count=result.count if result else 0,
        ))

    # Sort by balance descending (highest owed first)
    summaries.sort(key=lambda x: x.balance, reverse=True)
    return summaries


@router.get("/users/{user_id}", response_model=AccountSummary)
def get_user_account(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific user's account (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    balance = calculate_balance(user_id, db)

    recent = db.query(LedgerEntry).filter(
        LedgerEntry.user_id == user_id
    ).order_by(LedgerEntry.transaction_date.desc()).limit(20).all()

    pending_charges = db.query(ServiceRequest).filter(
        ServiceRequest.requested_by_id == user_id,
        ServiceRequest.status == RequestStatus.COMPLETED,
        ~ServiceRequest.id.in_(
            db.query(LedgerEntry.service_request_id).filter(
                LedgerEntry.service_request_id.isnot(None)
            )
        )
    ).count()

    return AccountSummary(
        balance=balance,
        recent_transactions=[enrich_ledger_entry(e) for e in recent],
        pending_service_charges=pending_charges,
    )


@router.get("/users/{user_id}/transactions", response_model=List[LedgerEntryResponse])
def get_user_transactions(
    user_id: int,
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    transaction_type: Optional[TransactionType] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a user's transaction history (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    query = db.query(LedgerEntry).filter(LedgerEntry.user_id == user_id)

    if from_date:
        query = query.filter(LedgerEntry.transaction_date >= from_date)
    if to_date:
        query = query.filter(LedgerEntry.transaction_date <= to_date)
    if transaction_type:
        query = query.filter(LedgerEntry.transaction_type == transaction_type)

    entries = query.order_by(
        LedgerEntry.transaction_date.desc()
    ).offset(offset).limit(limit).all()

    return [enrich_ledger_entry(e) for e in entries]


@router.post("/transactions", response_model=LedgerEntryResponse, status_code=status.HTTP_201_CREATED)
def create_transaction(
    data: LedgerEntryCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new ledger entry (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    # Verify target user exists
    target_user = db.query(User).filter(User.id == data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    entry = LedgerEntry(
        user_id=data.user_id,
        transaction_type=data.transaction_type,
        amount=data.amount,
        description=data.description,
        notes=data.notes,
        service_request_id=data.service_request_id,
        livery_package_id=data.livery_package_id,
        period_start=data.period_start,
        period_end=data.period_end,
        transaction_date=data.transaction_date or datetime.utcnow(),
        created_by_id=current_user.id,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    return enrich_ledger_entry(entry)


@router.delete("/transactions/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a ledger entry (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    db.delete(entry)
    db.commit()


# ============== Enums ==============

@router.get("/enums", response_model=TransactionEnums)
def get_transaction_enums():
    """Get enum values for transaction types."""
    type_labels = {
        TransactionType.PACKAGE_CHARGE: "Livery Package",
        TransactionType.SERVICE_CHARGE: "Service Charge",
        TransactionType.PAYMENT: "Payment",
        TransactionType.CREDIT: "Credit/Refund",
        TransactionType.ADJUSTMENT: "Adjustment",
    }
    return TransactionEnums(
        types=[
            {"value": t.value, "label": type_labels.get(t, t.value.replace("_", " ").title())}
            for t in TransactionType
        ]
    )
