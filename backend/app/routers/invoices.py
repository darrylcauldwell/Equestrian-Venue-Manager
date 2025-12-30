import os
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.user import User
from app.models.invoice import Invoice, InvoiceLineItem, InvoiceStatus
from app.models.account import LedgerEntry, TransactionType
from app.schemas.invoice import (
    InvoiceGenerateRequest, InvoiceCreate, InvoiceUpdate,
    InvoiceResponse, InvoiceSummary, MyInvoiceSummary,
    InvoiceLineItemCreate, InvoiceLineItemResponse
)
from app.utils.pdf_generator import generate_invoice_pdf
from app.utils.auth import get_current_user, require_roles

router = APIRouter(prefix="/invoices", tags=["invoices"])

# Directory to store PDF files
PDF_STORAGE_DIR = os.environ.get("PDF_STORAGE_DIR", "/tmp/invoices")


def get_next_invoice_number(db: Session) -> str:
    """Generate next invoice number in format INV-YYYY-NNNN."""
    year = date.today().year
    prefix = f"INV-{year}-"

    # Get the highest invoice number for this year
    last_invoice = db.query(Invoice).filter(
        Invoice.invoice_number.like(f"{prefix}%")
    ).order_by(Invoice.invoice_number.desc()).first()

    if last_invoice:
        # Extract the number part and increment
        last_num = int(last_invoice.invoice_number.split('-')[-1])
        next_num = last_num + 1
    else:
        next_num = 1

    return f"{prefix}{next_num:04d}"


def _invoice_to_response(invoice: Invoice) -> InvoiceResponse:
    """Convert Invoice model to response schema."""
    return InvoiceResponse(
        id=invoice.id,
        user_id=invoice.user_id,
        invoice_number=invoice.invoice_number,
        period_start=invoice.period_start,
        period_end=invoice.period_end,
        subtotal=invoice.subtotal,
        payments_received=invoice.payments_received,
        balance_due=invoice.balance_due,
        status=invoice.status,
        issue_date=invoice.issue_date,
        due_date=invoice.due_date,
        paid_date=invoice.paid_date,
        pdf_filename=invoice.pdf_filename,
        notes=invoice.notes,
        created_by_id=invoice.created_by_id,
        created_at=invoice.created_at,
        updated_at=invoice.updated_at,
        user_name=invoice.user.name if invoice.user else None,
        user_email=invoice.user.email if invoice.user else None,
        created_by_name=invoice.created_by.name if invoice.created_by else None,
        line_items=[
            InvoiceLineItemResponse(
                id=item.id,
                invoice_id=item.invoice_id,
                ledger_entry_id=item.ledger_entry_id,
                description=item.description,
                quantity=item.quantity,
                unit_price=item.unit_price,
                amount=item.amount,
                category=item.category,
                item_date_start=item.item_date_start,
                item_date_end=item.item_date_end
            )
            for item in invoice.line_items
        ]
    )


# ============== Livery User Endpoints ==============

@router.get("/my", response_model=List[MyInvoiceSummary])
async def get_my_invoices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's invoices."""
    invoices = db.query(Invoice).filter(
        Invoice.user_id == current_user.id,
        Invoice.status != InvoiceStatus.DRAFT  # Don't show drafts to users
    ).order_by(Invoice.issue_date.desc()).all()

    return [
        MyInvoiceSummary(
            id=inv.id,
            invoice_number=inv.invoice_number,
            period_start=inv.period_start,
            period_end=inv.period_end,
            subtotal=inv.subtotal,
            balance_due=inv.balance_due,
            status=inv.status,
            issue_date=inv.issue_date,
            due_date=inv.due_date,
            has_pdf=inv.pdf_filename is not None
        )
        for inv in invoices
    ]


@router.get("/my/{invoice_id}", response_model=InvoiceResponse)
async def get_my_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific invoice for current user."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
        Invoice.status != InvoiceStatus.DRAFT
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return _invoice_to_response(invoice)


@router.get("/my/{invoice_id}/pdf")
async def download_my_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download PDF of user's own invoice."""
    invoice = db.query(Invoice).filter(
        Invoice.id == invoice_id,
        Invoice.user_id == current_user.id,
        Invoice.status != InvoiceStatus.DRAFT
    ).first()

    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Generate PDF on the fly
    pdf_bytes = generate_invoice_pdf(
        invoice_number=invoice.invoice_number,
        issue_date=invoice.issue_date or date.today(),
        due_date=invoice.due_date or date.today(),
        period_start=invoice.period_start,
        period_end=invoice.period_end,
        customer_name=invoice.user.name,
        customer_email=invoice.user.email,
        line_items=[
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'amount': item.amount
            }
            for item in invoice.line_items
        ],
        subtotal=invoice.subtotal,
        payments_received=invoice.payments_received,
        balance_due=invoice.balance_due,
        notes=invoice.notes
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'
        }
    )


# ============== Admin Endpoints ==============

@router.get("/", response_model=List[InvoiceSummary])
async def get_all_invoices(
    status_filter: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get all invoices (admin only)."""
    query = db.query(Invoice)

    if status_filter:
        query = query.filter(Invoice.status == InvoiceStatus(status_filter))
    if user_id:
        query = query.filter(Invoice.user_id == user_id)

    invoices = query.order_by(Invoice.created_at.desc()).all()

    return [
        InvoiceSummary(
            id=inv.id,
            invoice_number=inv.invoice_number,
            user_id=inv.user_id,
            user_name=inv.user.name if inv.user else "Unknown",
            period_start=inv.period_start,
            period_end=inv.period_end,
            subtotal=inv.subtotal,
            balance_due=inv.balance_due,
            status=inv.status,
            issue_date=inv.issue_date,
            due_date=inv.due_date
        )
        for inv in invoices
    ]


@router.get("/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get a specific invoice (admin only)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return _invoice_to_response(invoice)


@router.post("/generate", response_model=InvoiceResponse)
async def generate_invoice(
    request: InvoiceGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Generate a new invoice for a user."""
    # Verify user exists
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Create invoice
    invoice = Invoice(
        user_id=request.user_id,
        invoice_number=get_next_invoice_number(db),
        period_start=request.period_start,
        period_end=request.period_end,
        due_date=request.due_date,
        notes=request.notes,
        created_by_id=current_user.id,
        status=InvoiceStatus.DRAFT
    )
    db.add(invoice)
    db.flush()

    subtotal = Decimal("0")
    payments = Decimal("0")

    # Auto-populate from ledger entries if requested
    if request.auto_populate:
        # Get charges in period
        charges = db.query(LedgerEntry).filter(
            LedgerEntry.user_id == request.user_id,
            LedgerEntry.transaction_date >= request.period_start,
            LedgerEntry.transaction_date <= request.period_end,
            LedgerEntry.transaction_type.in_([
                TransactionType.LIVERY_FEE,
                TransactionType.SERVICE_CHARGE,
                TransactionType.BOOKING_FEE,
                TransactionType.LESSON_FEE,
                TransactionType.CLINIC_FEE,
                TransactionType.OTHER_CHARGE
            ])
        ).all()

        for charge in charges:
            amount = abs(charge.amount)  # Charges stored as positive
            line_item = InvoiceLineItem(
                invoice_id=invoice.id,
                ledger_entry_id=charge.id,
                description=charge.description,
                quantity=Decimal("1"),
                unit_price=amount,
                amount=amount,
                category=charge.transaction_type.value,
                item_date_start=charge.transaction_date,
                item_date_end=charge.transaction_date
            )
            db.add(line_item)
            subtotal += amount

        # Get payments in period
        payment_entries = db.query(LedgerEntry).filter(
            LedgerEntry.user_id == request.user_id,
            LedgerEntry.transaction_date >= request.period_start,
            LedgerEntry.transaction_date <= request.period_end,
            LedgerEntry.transaction_type.in_([
                TransactionType.PAYMENT,
                TransactionType.DIRECT_DEBIT,
                TransactionType.REFUND
            ])
        ).all()

        for payment in payment_entries:
            if payment.transaction_type == TransactionType.REFUND:
                payments -= abs(payment.amount)  # Refunds reduce payments
            else:
                payments += abs(payment.amount)

    # Add any manual line items
    for item in request.line_items:
        line_item = InvoiceLineItem(
            invoice_id=invoice.id,
            description=item.description,
            quantity=item.quantity,
            unit_price=item.unit_price,
            amount=item.amount,
            category=item.category,
            item_date_start=item.item_date_start,
            item_date_end=item.item_date_end
        )
        db.add(line_item)
        subtotal += item.amount

    # Update totals
    invoice.subtotal = subtotal
    invoice.payments_received = payments
    invoice.balance_due = subtotal - payments

    db.commit()
    db.refresh(invoice)

    return _invoice_to_response(invoice)


@router.post("/{invoice_id}/issue", response_model=InvoiceResponse)
async def issue_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Issue a draft invoice (make it visible to user)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft invoices can be issued")

    invoice.status = InvoiceStatus.ISSUED
    invoice.issue_date = date.today()

    db.commit()
    db.refresh(invoice)

    return _invoice_to_response(invoice)


@router.post("/{invoice_id}/mark-paid", response_model=InvoiceResponse)
async def mark_invoice_paid(
    invoice_id: int,
    paid_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Mark an invoice as paid."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    invoice.status = InvoiceStatus.PAID
    invoice.paid_date = paid_date or date.today()
    invoice.balance_due = Decimal("0")

    db.commit()
    db.refresh(invoice)

    return _invoice_to_response(invoice)


@router.post("/{invoice_id}/cancel", response_model=InvoiceResponse)
async def cancel_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Cancel an invoice."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(status_code=400, detail="Cannot cancel a paid invoice")

    invoice.status = InvoiceStatus.CANCELLED

    db.commit()
    db.refresh(invoice)

    return _invoice_to_response(invoice)


@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Delete a draft invoice."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status != InvoiceStatus.DRAFT:
        raise HTTPException(status_code=400, detail="Only draft invoices can be deleted")

    db.delete(invoice)
    db.commit()

    return {"message": "Invoice deleted"}


@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Download PDF of any invoice (admin only)."""
    invoice = db.query(Invoice).filter(Invoice.id == invoice_id).first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # Generate PDF on the fly
    pdf_bytes = generate_invoice_pdf(
        invoice_number=invoice.invoice_number,
        issue_date=invoice.issue_date or date.today(),
        due_date=invoice.due_date or date.today(),
        period_start=invoice.period_start,
        period_end=invoice.period_end,
        customer_name=invoice.user.name,
        customer_email=invoice.user.email,
        line_items=[
            {
                'description': item.description,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
                'amount': item.amount
            }
            for item in invoice.line_items
        ],
        subtotal=invoice.subtotal,
        payments_received=invoice.payments_received,
        balance_due=invoice.balance_due,
        notes=invoice.notes
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{invoice.invoice_number}.pdf"'
        }
    )
