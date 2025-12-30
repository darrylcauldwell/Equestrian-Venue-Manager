from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal
from io import BytesIO
import csv
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, case, extract

from app.database import get_db
from app.models.account import LedgerEntry, TransactionType, PaymentMethod
from app.models.service import ServiceRequest, RequestStatus
from app.models.user import User, UserRole
from app.models.invoice import Invoice, InvoiceStatus
from app.utils.auth import get_current_user, has_staff_access
from app.schemas.account import (
    LedgerEntryCreate,
    LedgerEntryUpdate,
    LedgerEntryResponse,
    VoidTransactionRequest,
    AccountBalance,
    AccountSummary,
    UserAccountSummary,
    TransactionEnums,
    RecordPayment,
    PaymentResponse,
    AgedDebtItem,
    AgedDebtReport,
    IncomeByType,
    MonthlyIncome,
    IncomeSummaryReport,
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
    if entry.voided_by:
        response.voided_by_name = entry.voided_by.name
    if entry.service_request:
        response.service_description = f"Service: {entry.service_request.service.name if entry.service_request.service else 'Unknown'}"
    if entry.livery_package:
        response.package_name = entry.livery_package.name

    return response


def generate_receipt_number(db: Session) -> str:
    """Generate a unique receipt number in format REC-YYYY-NNNN."""
    year = datetime.utcnow().year
    prefix = f"REC-{year}-"

    # Find highest existing receipt number for this year
    last_receipt = db.query(LedgerEntry).filter(
        LedgerEntry.receipt_number.like(f"{prefix}%")
    ).order_by(LedgerEntry.receipt_number.desc()).first()

    if last_receipt and last_receipt.receipt_number:
        try:
            last_num = int(last_receipt.receipt_number.split("-")[-1])
            next_num = last_num + 1
        except (ValueError, IndexError):
            next_num = 1
    else:
        next_num = 1

    return f"{prefix}{next_num:04d}"


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
        payment_method=data.payment_method,
        payment_reference=data.payment_reference,
        transaction_date=data.transaction_date or datetime.utcnow(),
        created_by_id=current_user.id,
    )

    db.add(entry)
    db.commit()
    db.refresh(entry)

    return enrich_ledger_entry(entry)


@router.put("/transactions/{entry_id}", response_model=LedgerEntryResponse)
def update_transaction(
    entry_id: int,
    data: LedgerEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a ledger entry (admin only). Only allows updating description, notes, payment method/reference."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    if entry.voided:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot edit a voided transaction")

    # Update allowed fields
    if data.description is not None:
        entry.description = data.description
    if data.notes is not None:
        entry.notes = data.notes
    if data.payment_method is not None:
        entry.payment_method = data.payment_method
    if data.payment_reference is not None:
        entry.payment_reference = data.payment_reference

    db.commit()
    db.refresh(entry)

    return enrich_ledger_entry(entry)


@router.post("/transactions/{entry_id}/void", response_model=LedgerEntryResponse)
def void_transaction(
    entry_id: int,
    data: VoidTransactionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Void a ledger entry and create a reversal entry (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    entry = db.query(LedgerEntry).filter(LedgerEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    if entry.voided:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transaction is already voided")

    # Mark the original entry as voided
    entry.voided = True
    entry.voided_at = datetime.utcnow()
    entry.voided_by_id = current_user.id
    entry.void_reason = data.reason

    # Create a reversal entry
    reversal = LedgerEntry(
        user_id=entry.user_id,
        transaction_type=TransactionType.ADJUSTMENT,
        amount=-entry.amount,  # Reverse the amount
        description=f"VOID: {entry.description}",
        notes=f"Reversal of transaction #{entry.id}. Reason: {data.reason}",
        original_entry_id=entry.id,
        transaction_date=datetime.utcnow(),
        created_by_id=current_user.id,
    )

    db.add(reversal)
    db.commit()
    db.refresh(entry)

    return enrich_ledger_entry(entry)


# ============== Payment Recording ==============

@router.post("/payments", response_model=LedgerEntryResponse, status_code=status.HTTP_201_CREATED)
def record_payment(
    data: RecordPayment,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a payment with auto-generated receipt number (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    # Verify target user exists
    target_user = db.query(User).filter(User.id == data.user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Generate receipt number
    receipt_number = generate_receipt_number(db)

    # Create payment entry (amount stored as negative)
    entry = LedgerEntry(
        user_id=data.user_id,
        transaction_type=TransactionType.PAYMENT,
        amount=-abs(data.amount),  # Ensure negative for payment
        description=data.description or f"Payment received - {data.payment_method.value.replace('_', ' ').title()}",
        notes=data.notes,
        payment_method=data.payment_method,
        payment_reference=data.payment_reference,
        receipt_number=receipt_number,
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
    """Get enum values for transaction types and payment methods."""
    type_labels = {
        TransactionType.PACKAGE_CHARGE: "Livery Package",
        TransactionType.SERVICE_CHARGE: "Service Charge",
        TransactionType.PAYMENT: "Payment",
        TransactionType.CREDIT: "Credit/Refund",
        TransactionType.ADJUSTMENT: "Adjustment",
    }
    payment_method_labels = {
        PaymentMethod.CASH: "Cash",
        PaymentMethod.BANK_TRANSFER: "Bank Transfer",
        PaymentMethod.CARD: "Card",
        PaymentMethod.CHEQUE: "Cheque",
        PaymentMethod.DIRECT_DEBIT: "Direct Debit",
        PaymentMethod.OTHER: "Other",
    }
    return TransactionEnums(
        types=[
            {"value": t.value, "label": type_labels.get(t, t.value.replace("_", " ").title())}
            for t in TransactionType
        ],
        payment_methods=[
            {"value": m.value, "label": payment_method_labels.get(m, m.value.replace("_", " ").title())}
            for m in PaymentMethod
        ]
    )


# ============== Statements ==============

@router.get("/my/statement/pdf")
def download_my_statement(
    from_date: date = Query(...),
    to_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download account statement PDF for current user."""
    from app.utils.pdf_generator import generate_account_statement_pdf
    from app.models.settings import SiteSettings

    # Get transactions for the period
    transactions = db.query(LedgerEntry).filter(
        LedgerEntry.user_id == current_user.id,
        LedgerEntry.transaction_date >= datetime.combine(from_date, datetime.min.time()),
        LedgerEntry.transaction_date <= datetime.combine(to_date, datetime.max.time()),
        LedgerEntry.voided == False
    ).order_by(LedgerEntry.transaction_date.asc()).all()

    # Calculate opening balance (sum of all transactions before from_date)
    opening_result = db.query(
        func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00"))
    ).filter(
        LedgerEntry.user_id == current_user.id,
        LedgerEntry.transaction_date < datetime.combine(from_date, datetime.min.time()),
        LedgerEntry.voided == False
    ).scalar()
    opening_balance = opening_result or Decimal("0.00")

    # Get site settings for venue details
    settings = db.query(SiteSettings).first()

    # Generate PDF
    pdf_buffer = generate_account_statement_pdf(
        user=current_user,
        transactions=transactions,
        from_date=from_date,
        to_date=to_date,
        opening_balance=opening_balance,
        settings=settings
    )

    filename = f"statement_{current_user.name.replace(' ', '_')}_{from_date}_{to_date}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/users/{user_id}/statement/pdf")
def download_user_statement(
    user_id: int,
    from_date: date = Query(...),
    to_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download account statement PDF for a user (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    from app.utils.pdf_generator import generate_account_statement_pdf
    from app.models.settings import SiteSettings

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Get transactions for the period
    transactions = db.query(LedgerEntry).filter(
        LedgerEntry.user_id == user_id,
        LedgerEntry.transaction_date >= datetime.combine(from_date, datetime.min.time()),
        LedgerEntry.transaction_date <= datetime.combine(to_date, datetime.max.time()),
        LedgerEntry.voided == False
    ).order_by(LedgerEntry.transaction_date.asc()).all()

    # Calculate opening balance
    opening_result = db.query(
        func.coalesce(func.sum(LedgerEntry.amount), Decimal("0.00"))
    ).filter(
        LedgerEntry.user_id == user_id,
        LedgerEntry.transaction_date < datetime.combine(from_date, datetime.min.time()),
        LedgerEntry.voided == False
    ).scalar()
    opening_balance = opening_result or Decimal("0.00")

    settings = db.query(SiteSettings).first()

    pdf_buffer = generate_account_statement_pdf(
        user=user,
        transactions=transactions,
        from_date=from_date,
        to_date=to_date,
        opening_balance=opening_balance,
        settings=settings
    )

    filename = f"statement_{user.name.replace(' ', '_')}_{from_date}_{to_date}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/users/{user_id}/transactions/csv")
def download_user_transactions_csv(
    user_id: int,
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download user transactions as CSV (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    query = db.query(LedgerEntry).filter(LedgerEntry.user_id == user_id)
    if from_date:
        query = query.filter(LedgerEntry.transaction_date >= datetime.combine(from_date, datetime.min.time()))
    if to_date:
        query = query.filter(LedgerEntry.transaction_date <= datetime.combine(to_date, datetime.max.time()))

    transactions = query.order_by(LedgerEntry.transaction_date.asc()).all()

    # Generate CSV
    output = BytesIO()
    writer = csv.writer(output.__class__(output, 'w', newline='', encoding='utf-8'))

    # Write header
    writer.writerow(['Date', 'Type', 'Description', 'Amount', 'Payment Method', 'Reference', 'Voided'])

    # Write data
    for t in transactions:
        writer.writerow([
            t.transaction_date.strftime('%Y-%m-%d'),
            t.transaction_type.value,
            t.description,
            str(t.amount),
            t.payment_method.value if t.payment_method else '',
            t.payment_reference or '',
            'Yes' if t.voided else 'No'
        ])

    output.seek(0)
    filename = f"transactions_{user.name.replace(' ', '_')}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============== Reports ==============

@router.get("/reports/aged-debt", response_model=AgedDebtReport)
def get_aged_debt_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get aged debt report with monthly brackets (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    today = date.today()
    one_month_ago = today - timedelta(days=30)
    two_months_ago = today - timedelta(days=60)
    three_months_ago = today - timedelta(days=90)

    # Get all livery users with balances
    livery_users = db.query(User).filter(
        User.role == UserRole.LIVERY,
        User.is_active == True
    ).all()

    accounts = []
    totals = AgedDebtItem(user_id=0, user_name="TOTALS")

    for user in livery_users:
        # Get transactions grouped by age
        entries = db.query(LedgerEntry).filter(
            LedgerEntry.user_id == user.id,
            LedgerEntry.voided == False
        ).all()

        current = Decimal("0.00")
        month_1 = Decimal("0.00")
        month_2 = Decimal("0.00")
        month_3_plus = Decimal("0.00")
        last_payment = None

        for entry in entries:
            entry_date = entry.transaction_date.date() if isinstance(entry.transaction_date, datetime) else entry.transaction_date

            # Track last payment
            if entry.transaction_type == TransactionType.PAYMENT and entry.amount < 0:
                if last_payment is None or entry_date > last_payment:
                    last_payment = entry_date

            # Only count positive amounts (debts) for aging
            if entry.amount > 0:
                if entry_date >= one_month_ago:
                    current += entry.amount
                elif entry_date >= two_months_ago:
                    month_1 += entry.amount
                elif entry_date >= three_months_ago:
                    month_2 += entry.amount
                else:
                    month_3_plus += entry.amount
            else:
                # Payments reduce from oldest first
                payment = abs(entry.amount)
                if month_3_plus > 0:
                    reduction = min(payment, month_3_plus)
                    month_3_plus -= reduction
                    payment -= reduction
                if payment > 0 and month_2 > 0:
                    reduction = min(payment, month_2)
                    month_2 -= reduction
                    payment -= reduction
                if payment > 0 and month_1 > 0:
                    reduction = min(payment, month_1)
                    month_1 -= reduction
                    payment -= reduction
                if payment > 0:
                    current -= payment

        total = current + month_1 + month_2 + month_3_plus

        # Only include users with non-zero balance
        if total != 0:
            item = AgedDebtItem(
                user_id=user.id,
                user_name=user.name,
                user_email=user.email,
                current=current,
                month_1=month_1,
                month_2=month_2,
                month_3_plus=month_3_plus,
                total=total,
                last_payment_date=last_payment
            )
            accounts.append(item)

            # Add to totals
            totals.current += current
            totals.month_1 += month_1
            totals.month_2 += month_2
            totals.month_3_plus += month_3_plus
            totals.total += total

    # Sort by total descending
    accounts.sort(key=lambda x: x.total, reverse=True)

    return AgedDebtReport(
        as_of_date=today,
        accounts=accounts,
        totals=totals
    )


@router.get("/reports/aged-debt/csv")
def download_aged_debt_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download aged debt report as CSV (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    report = get_aged_debt_report(current_user, db)

    output = BytesIO()
    import io
    text_output = io.StringIO()
    writer = csv.writer(text_output)

    # Write header
    writer.writerow(['User', 'Email', 'Current', '1 Month', '2 Months', '3+ Months', 'Total', 'Last Payment'])

    # Write data
    for item in report.accounts:
        writer.writerow([
            item.user_name,
            item.user_email or '',
            str(item.current),
            str(item.month_1),
            str(item.month_2),
            str(item.month_3_plus),
            str(item.total),
            item.last_payment_date.isoformat() if item.last_payment_date else ''
        ])

    # Write totals
    writer.writerow([
        'TOTALS', '',
        str(report.totals.current),
        str(report.totals.month_1),
        str(report.totals.month_2),
        str(report.totals.month_3_plus),
        str(report.totals.total),
        ''
    ])

    csv_content = text_output.getvalue().encode('utf-8')
    output = BytesIO(csv_content)

    filename = f"aged_debt_{date.today().isoformat()}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/reports/income-summary", response_model=IncomeSummaryReport)
def get_income_summary(
    from_date: date = Query(...),
    to_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get income summary report for a date range (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    type_labels = {
        TransactionType.PACKAGE_CHARGE: "Livery Package",
        TransactionType.SERVICE_CHARGE: "Service Charge",
        TransactionType.PAYMENT: "Payment",
        TransactionType.CREDIT: "Credit/Refund",
        TransactionType.ADJUSTMENT: "Adjustment",
    }

    # Get all transactions in period
    entries = db.query(LedgerEntry).filter(
        LedgerEntry.transaction_date >= datetime.combine(from_date, datetime.min.time()),
        LedgerEntry.transaction_date <= datetime.combine(to_date, datetime.max.time()),
        LedgerEntry.voided == False
    ).all()

    # Calculate by type
    by_type_dict = {}
    for entry in entries:
        t_type = entry.transaction_type.value
        if t_type not in by_type_dict:
            by_type_dict[t_type] = {"amount": Decimal("0.00"), "count": 0}
        by_type_dict[t_type]["amount"] += entry.amount
        by_type_dict[t_type]["count"] += 1

    by_type = [
        IncomeByType(
            transaction_type=t_type,
            type_label=type_labels.get(TransactionType(t_type), t_type.replace("_", " ").title()),
            amount=data["amount"],
            count=data["count"]
        )
        for t_type, data in by_type_dict.items()
    ]

    # Calculate by month
    by_month_dict = {}
    for entry in entries:
        year = entry.transaction_date.year
        month = entry.transaction_date.month
        key = (year, month)
        if key not in by_month_dict:
            by_month_dict[key] = {"total": Decimal("0.00"), "by_type": {}}
        by_month_dict[key]["total"] += entry.amount
        t_type = entry.transaction_type.value
        if t_type not in by_month_dict[key]["by_type"]:
            by_month_dict[key]["by_type"][t_type] = {"amount": Decimal("0.00"), "count": 0}
        by_month_dict[key]["by_type"][t_type]["amount"] += entry.amount
        by_month_dict[key]["by_type"][t_type]["count"] += 1

    by_month = []
    for (year, month), data in sorted(by_month_dict.items()):
        month_label = date(year, month, 1).strftime("%B %Y")
        month_by_type = [
            IncomeByType(
                transaction_type=t_type,
                type_label=type_labels.get(TransactionType(t_type), t_type.replace("_", " ").title()),
                amount=type_data["amount"],
                count=type_data["count"]
            )
            for t_type, type_data in data["by_type"].items()
        ]
        by_month.append(MonthlyIncome(
            year=year,
            month=month,
            month_label=month_label,
            total=data["total"],
            by_type=month_by_type
        ))

    # Calculate totals
    total_charges = sum(e.amount for e in entries if e.amount > 0)
    total_payments = sum(abs(e.amount) for e in entries if e.amount < 0)
    total_income = total_charges - total_payments

    return IncomeSummaryReport(
        from_date=from_date,
        to_date=to_date,
        total_income=total_income,
        total_charges=total_charges,
        total_payments=total_payments,
        by_type=by_type,
        by_month=by_month
    )


@router.get("/reports/income-summary/csv")
def download_income_summary_csv(
    from_date: date = Query(...),
    to_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download income summary as CSV (admin only)."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")

    report = get_income_summary(from_date, to_date, current_user, db)

    import io
    text_output = io.StringIO()
    writer = csv.writer(text_output)

    # Summary section
    writer.writerow(['Income Summary Report'])
    writer.writerow(['Period', f"{from_date} to {to_date}"])
    writer.writerow(['Total Charges', str(report.total_charges)])
    writer.writerow(['Total Payments', str(report.total_payments)])
    writer.writerow(['Net Income', str(report.total_income)])
    writer.writerow([])

    # By type section
    writer.writerow(['By Transaction Type'])
    writer.writerow(['Type', 'Amount', 'Count'])
    for item in report.by_type:
        writer.writerow([item.type_label, str(item.amount), item.count])
    writer.writerow([])

    # By month section
    writer.writerow(['By Month'])
    writer.writerow(['Month', 'Total'])
    for month in report.by_month:
        writer.writerow([month.month_label, str(month.total)])

    csv_content = text_output.getvalue().encode('utf-8')
    output = BytesIO(csv_content)

    filename = f"income_summary_{from_date}_{to_date}.csv"
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ============================================
# Stripe Payment for Account Balance
# ============================================

from pydantic import BaseModel


class AccountPaymentRequest(BaseModel):
    amount: Decimal


class AccountPaymentResponse(BaseModel):
    checkout_url: str
    session_id: str


@router.post("/my/payment/checkout", response_model=AccountPaymentResponse)
def create_account_payment_checkout(
    request: AccountPaymentRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a Stripe checkout session for account balance payment."""
    from app.models.settings import SiteSettings

    # Validate amount
    if request.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment amount must be greater than zero"
        )

    # Get Stripe config from settings
    site_settings = db.query(SiteSettings).first()
    if not site_settings or not site_settings.stripe_enabled or not site_settings.stripe_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment processing is not configured. Please contact the venue."
        )

    try:
        import stripe
        stripe.api_key = site_settings.stripe_secret_key
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Payment processing is not available"
        )

    # Get frontend URL
    from app.config import get_app_config
    app_config = get_app_config(db)
    frontend_url = app_config['frontend_url']

    # Convert to pence
    amount_pence = int(request.amount * 100)

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'gbp',
                    'product_data': {
                        'name': 'Account Balance Payment',
                        'description': f'Payment towards account balance at {site_settings.venue_name or "Equestrian Venue"}',
                    },
                    'unit_amount': amount_pence,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f"{frontend_url}/book/my-account?payment=success",
            cancel_url=f"{frontend_url}/book/my-account?payment=cancelled",
            customer_email=current_user.email,
            metadata={
                'user_id': str(current_user.id),
                'payment_type': 'account_balance',
            },
            expires_at=int((datetime.utcnow().timestamp()) + 1800),  # 30 minutes
        )

        return AccountPaymentResponse(
            checkout_url=checkout_session.url,
            session_id=checkout_session.id
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create payment session: {str(e)}"
        )
