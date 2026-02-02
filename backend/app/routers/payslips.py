import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models.payslip import Payslip, PayslipDocumentType
from app.models.user import User, UserRole
from app.schemas.payslip import PayslipResponse, PayslipListResponse
from app.utils.auth import get_current_user

router = APIRouter()

# Configure upload directory for payslips
PAYSLIP_UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads", "payslips"
)
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


def ensure_payslip_dir():
    """Ensure the payslip upload directory exists."""
    os.makedirs(PAYSLIP_UPLOAD_DIR, exist_ok=True)


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def _payslip_to_response(payslip: Payslip) -> PayslipResponse:
    """Convert a Payslip model to a response with staff/uploader names."""
    return PayslipResponse(
        id=payslip.id,
        staff_id=payslip.staff_id,
        document_type=payslip.document_type.value,
        year=payslip.year,
        month=payslip.month,
        pdf_filename=payslip.pdf_filename,
        original_filename=payslip.original_filename,
        notes=payslip.notes,
        uploaded_by_id=payslip.uploaded_by_id,
        created_at=payslip.created_at,
        staff_name=payslip.staff.name if payslip.staff else None,
        uploaded_by_name=payslip.uploaded_by.name if payslip.uploaded_by else None,
    )


@router.post("/upload", response_model=PayslipResponse, status_code=status.HTTP_201_CREATED)
async def upload_payslip(
    file: UploadFile = File(...),
    staff_id: int = Query(...),
    document_type: str = Query(...),
    year: int = Query(...),
    month: Optional[int] = Query(None),
    notes: Optional[str] = Query(None),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Upload a payslip PDF for a staff member (admin only)."""
    # Validate file is PDF
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext != ".pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Validate document type
    try:
        doc_type = PayslipDocumentType(document_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid document type. Use 'payslip' or 'annual_summary'")

    # Validate month
    if doc_type == PayslipDocumentType.PAYSLIP:
        if month is None or month < 1 or month > 12:
            raise HTTPException(status_code=400, detail="Month (1-12) is required for payslips")
        effective_month = month
    else:
        effective_month = 0  # Annual summaries use month=0

    # Validate staff exists
    staff = db.query(User).filter(User.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="Staff member not found")

    # Check for duplicate
    existing = db.query(Payslip).filter(
        Payslip.staff_id == staff_id,
        Payslip.document_type == doc_type,
        Payslip.year == year,
        Payslip.month == effective_month,
    ).first()
    if existing:
        period_label = f"{year}" if doc_type == PayslipDocumentType.ANNUAL_SUMMARY else f"{month}/{year}"
        raise HTTPException(
            status_code=409,
            detail=f"A {document_type} already exists for this staff member for {period_label}. Delete it first to re-upload."
        )

    # Read and validate file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large. Maximum size is {MAX_FILE_SIZE // 1024 // 1024}MB")

    # Save file
    ensure_payslip_dir()
    safe_filename = f"payslip_{staff_id}_{year}_{effective_month}_{uuid.uuid4().hex[:8]}.pdf"
    filepath = os.path.join(PAYSLIP_UPLOAD_DIR, safe_filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    # Create database record
    payslip = Payslip(
        staff_id=staff_id,
        document_type=doc_type,
        year=year,
        month=effective_month,
        pdf_filename=safe_filename,
        original_filename=file.filename,
        notes=notes,
        uploaded_by_id=current_user.id,
    )
    db.add(payslip)
    db.commit()
    db.refresh(payslip)

    return _payslip_to_response(payslip)


@router.get("/", response_model=PayslipListResponse)
def list_payslips(
    staff_id: Optional[int] = None,
    year: Optional[int] = None,
    document_type: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """List all payslips with optional filters (admin only)."""
    query = db.query(Payslip)
    if staff_id:
        query = query.filter(Payslip.staff_id == staff_id)
    if year:
        query = query.filter(Payslip.year == year)
    if document_type:
        try:
            doc_type = PayslipDocumentType(document_type)
            query = query.filter(Payslip.document_type == doc_type)
        except ValueError:
            pass

    payslips = query.order_by(Payslip.year.desc(), Payslip.month.desc()).all()
    return PayslipListResponse(
        payslips=[_payslip_to_response(p) for p in payslips],
        total=len(payslips),
    )


@router.get("/my", response_model=PayslipListResponse)
def list_my_payslips(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List current user's own payslips."""
    payslips = db.query(Payslip).filter(
        Payslip.staff_id == current_user.id,
    ).order_by(Payslip.year.desc(), Payslip.month.desc()).all()

    return PayslipListResponse(
        payslips=[_payslip_to_response(p) for p in payslips],
        total=len(payslips),
    )


@router.get("/{payslip_id}/download")
def download_payslip(
    payslip_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Download a payslip PDF (admin or payslip owner)."""
    payslip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    # Authorization: admin or payslip owner
    is_admin = current_user.role == UserRole.ADMIN
    is_owner = current_user.id == payslip.staff_id
    if not (is_admin or is_owner):
        raise HTTPException(status_code=403, detail="Access denied")

    filepath = os.path.join(PAYSLIP_UPLOAD_DIR, payslip.pdf_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="PDF file not found on server")

    with open(filepath, "rb") as f:
        pdf_bytes = f.read()

    display_name = payslip.original_filename or payslip.pdf_filename
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{display_name}"'},
    )


@router.delete("/{payslip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payslip(
    payslip_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a payslip record and its PDF file (admin only)."""
    payslip = db.query(Payslip).filter(Payslip.id == payslip_id).first()
    if not payslip:
        raise HTTPException(status_code=404, detail="Payslip not found")

    # Delete the file from disk
    filepath = os.path.join(PAYSLIP_UPLOAD_DIR, payslip.pdf_filename)
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except OSError:
            pass

    db.delete(payslip)
    db.commit()
