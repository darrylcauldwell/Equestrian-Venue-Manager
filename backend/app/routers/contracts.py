"""Contract management router with DocuSign integration."""
import os
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models.user import User, UserRole
from app.models.contract import (
    ContractTemplate,
    ContractVersion,
    ContractSignature,
    ContractType as ContractTypeModel,
    SignatureStatus as SignatureStatusModel,
)
from app.models.livery_package import LiveryPackage
from app.models.settings import SiteSettings
from app.schemas.contract import (
    ContractType,
    SignatureStatus,
    ContractTemplateCreate,
    ContractTemplateUpdate,
    ContractTemplateResponse,
    ContractTemplateSummary,
    ContractVersionCreate,
    ContractVersionResponse,
    ContractVersionSummary,
    ContractVersionDiff,
    SignatureRequestCreate,
    BulkResignRequest,
    ContractSignatureResponse,
    ContractSignatureSummary,
    MyContractResponse,
    ContractContentResponse,
    InitiateSigningResponse,
    CompleteSigningRequest,
    CompleteSigningResponse,
    DocuSignSettingsUpdate,
    DocuSignSettingsResponse,
    DocuSignTestResponse,
)
from app.services.docusign_service import get_docusign_service
from app.utils.contract_pdf import generate_contract_pdf, generate_inline_diff_html
from app.utils.auth import get_current_user, require_roles

router = APIRouter(prefix="/contracts", tags=["contracts"])

# Directory to store signed PDFs
SIGNED_PDF_DIR = os.environ.get("SIGNED_PDF_DIR", "/tmp/contracts/signed")


def _get_settings(db: Session) -> SiteSettings:
    """Get site settings or create default if not exists."""
    settings = db.query(SiteSettings).first()
    if not settings:
        settings = SiteSettings()
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def _template_to_response(template: ContractTemplate, db: Session) -> ContractTemplateResponse:
    """Convert ContractTemplate model to response schema."""
    current_version = db.query(ContractVersion).filter(
        ContractVersion.template_id == template.id,
        ContractVersion.is_current == True
    ).first()

    total_sigs = db.query(func.count(ContractSignature.id)).join(ContractVersion).filter(
        ContractVersion.template_id == template.id
    ).scalar() or 0

    return ContractTemplateResponse(
        id=template.id,
        name=template.name,
        contract_type=ContractType(template.contract_type.value),
        livery_package_id=template.livery_package_id,
        description=template.description,
        is_active=template.is_active,
        created_by_id=template.created_by_id,
        created_at=template.created_at,
        updated_at=template.updated_at,
        created_by_name=template.created_by.name if template.created_by else None,
        livery_package_name=template.livery_package.name if template.livery_package else None,
        current_version_number=current_version.version_number if current_version else None,
        total_signatures=total_sigs,
    )


def _version_to_response(version: ContractVersion) -> ContractVersionResponse:
    """Convert ContractVersion model to response schema."""
    return ContractVersionResponse(
        id=version.id,
        template_id=version.template_id,
        version_number=version.version_number,
        html_content=version.html_content,
        change_summary=version.change_summary,
        is_current=version.is_current,
        created_by_id=version.created_by_id,
        created_at=version.created_at,
        created_by_name=version.created_by.name if version.created_by else None,
    )


def _signature_to_response(sig: ContractSignature) -> ContractSignatureResponse:
    """Convert ContractSignature model to response schema."""
    return ContractSignatureResponse(
        id=sig.id,
        contract_version_id=sig.contract_version_id,
        user_id=sig.user_id,
        docusign_envelope_id=sig.docusign_envelope_id,
        status=SignatureStatus(sig.status.value),
        requested_at=sig.requested_at,
        signed_at=sig.signed_at,
        signed_pdf_filename=sig.signed_pdf_filename,
        requested_by_id=sig.requested_by_id,
        previous_signature_id=sig.previous_signature_id,
        notes=sig.notes,
        user_name=sig.user.name if sig.user else None,
        user_email=sig.user.email if sig.user else None,
        requested_by_name=sig.requested_by.name if sig.requested_by else None,
        template_name=sig.contract_version.template.name if sig.contract_version else None,
        version_number=sig.contract_version.version_number if sig.contract_version else None,
        contract_type=ContractType(sig.contract_version.template.contract_type.value) if sig.contract_version else None,
    )


# ============== Admin Template Endpoints ==============

@router.get("/templates", response_model=List[ContractTemplateSummary])
async def list_templates(
    contract_type: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """List all contract templates."""
    query = db.query(ContractTemplate)

    if contract_type:
        query = query.filter(ContractTemplate.contract_type == ContractTypeModel(contract_type))
    if is_active is not None:
        query = query.filter(ContractTemplate.is_active == is_active)

    templates = query.order_by(ContractTemplate.name).all()

    result = []
    for t in templates:
        current_version = db.query(ContractVersion).filter(
            ContractVersion.template_id == t.id,
            ContractVersion.is_current == True
        ).first()

        pending = db.query(func.count(ContractSignature.id)).join(ContractVersion).filter(
            ContractVersion.template_id == t.id,
            ContractSignature.status.in_([SignatureStatusModel.PENDING, SignatureStatusModel.SENT])
        ).scalar() or 0

        signed = db.query(func.count(ContractSignature.id)).join(ContractVersion).filter(
            ContractVersion.template_id == t.id,
            ContractSignature.status == SignatureStatusModel.SIGNED
        ).scalar() or 0

        result.append(ContractTemplateSummary(
            id=t.id,
            name=t.name,
            contract_type=ContractType(t.contract_type.value),
            is_active=t.is_active,
            livery_package_name=t.livery_package.name if t.livery_package else None,
            current_version_number=current_version.version_number if current_version else None,
            pending_signatures=pending,
            signed_count=signed,
        ))

    return result


@router.post("/templates", response_model=ContractTemplateResponse)
async def create_template(
    data: ContractTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Create a new contract template with initial version."""
    # Validate livery package if specified
    if data.livery_package_id:
        package = db.query(LiveryPackage).filter(LiveryPackage.id == data.livery_package_id).first()
        if not package:
            raise HTTPException(status_code=404, detail="Livery package not found")

    # Create template
    template = ContractTemplate(
        name=data.name,
        contract_type=ContractTypeModel(data.contract_type.value),
        livery_package_id=data.livery_package_id,
        description=data.description,
        is_active=True,
        created_by_id=current_user.id,
    )
    db.add(template)
    db.flush()

    # Create initial version
    version = ContractVersion(
        template_id=template.id,
        version_number=1,
        html_content=data.html_content,
        change_summary="Initial version",
        is_current=True,
        created_by_id=current_user.id,
    )
    db.add(version)

    db.commit()
    db.refresh(template)

    return _template_to_response(template, db)


@router.get("/templates/{template_id}", response_model=ContractTemplateResponse)
async def get_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get a specific contract template."""
    template = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    return _template_to_response(template, db)


@router.put("/templates/{template_id}", response_model=ContractTemplateResponse)
async def update_template(
    template_id: int,
    data: ContractTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Update a contract template (metadata only)."""
    template = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if data.name is not None:
        template.name = data.name
    if data.livery_package_id is not None:
        # Validate livery package
        if data.livery_package_id > 0:
            package = db.query(LiveryPackage).filter(LiveryPackage.id == data.livery_package_id).first()
            if not package:
                raise HTTPException(status_code=404, detail="Livery package not found")
        template.livery_package_id = data.livery_package_id if data.livery_package_id > 0 else None
    if data.description is not None:
        template.description = data.description
    if data.is_active is not None:
        template.is_active = data.is_active

    db.commit()
    db.refresh(template)

    return _template_to_response(template, db)


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Delete a contract template (only if no signatures exist)."""
    template = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check for any signatures
    sig_count = db.query(func.count(ContractSignature.id)).join(ContractVersion).filter(
        ContractVersion.template_id == template_id
    ).scalar()

    if sig_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete template with existing signatures. Deactivate instead."
        )

    # Delete versions first
    db.query(ContractVersion).filter(ContractVersion.template_id == template_id).delete()
    db.delete(template)
    db.commit()

    return {"message": "Template deleted"}


# ============== Version Endpoints ==============

@router.get("/templates/{template_id}/versions", response_model=List[ContractVersionSummary])
async def list_versions(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """List all versions of a contract template."""
    template = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    versions = db.query(ContractVersion).filter(
        ContractVersion.template_id == template_id
    ).order_by(ContractVersion.version_number.desc()).all()

    result = []
    for v in versions:
        sig_count = db.query(func.count(ContractSignature.id)).filter(
            ContractSignature.contract_version_id == v.id
        ).scalar() or 0

        result.append(ContractVersionSummary(
            id=v.id,
            version_number=v.version_number,
            change_summary=v.change_summary,
            is_current=v.is_current,
            created_by_name=v.created_by.name if v.created_by else None,
            created_at=v.created_at,
            signatures_count=sig_count,
        ))

    return result


@router.post("/templates/{template_id}/versions", response_model=ContractVersionResponse)
async def create_version(
    template_id: int,
    data: ContractVersionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Create a new version of a contract template."""
    template = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Get current version number
    current_version = db.query(ContractVersion).filter(
        ContractVersion.template_id == template_id,
        ContractVersion.is_current == True
    ).first()

    next_version = (current_version.version_number + 1) if current_version else 1

    # Mark all existing versions as not current
    db.query(ContractVersion).filter(
        ContractVersion.template_id == template_id
    ).update({"is_current": False})

    # Create new version
    version = ContractVersion(
        template_id=template_id,
        version_number=next_version,
        html_content=data.html_content,
        change_summary=data.change_summary,
        is_current=True,
        created_by_id=current_user.id,
    )
    db.add(version)
    db.commit()
    db.refresh(version)

    return _version_to_response(version)


@router.get("/templates/{template_id}/versions/{version_id}", response_model=ContractVersionResponse)
async def get_version(
    template_id: int,
    version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get a specific version of a contract template."""
    version = db.query(ContractVersion).filter(
        ContractVersion.id == version_id,
        ContractVersion.template_id == template_id
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    return _version_to_response(version)


@router.get("/templates/{template_id}/versions/{version_id}/diff", response_model=ContractVersionDiff)
async def get_version_diff(
    template_id: int,
    version_id: int,
    compare_to: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get diff between two versions of a contract template."""
    template = db.query(ContractTemplate).filter(ContractTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    new_version = db.query(ContractVersion).filter(
        ContractVersion.id == version_id,
        ContractVersion.template_id == template_id
    ).first()
    if not new_version:
        raise HTTPException(status_code=404, detail="Version not found")

    # Default to comparing with previous version
    if compare_to:
        old_version = db.query(ContractVersion).filter(
            ContractVersion.id == compare_to,
            ContractVersion.template_id == template_id
        ).first()
    else:
        old_version = db.query(ContractVersion).filter(
            ContractVersion.template_id == template_id,
            ContractVersion.version_number == new_version.version_number - 1
        ).first()

    if not old_version:
        raise HTTPException(status_code=404, detail="Previous version not found for comparison")

    diff_html = generate_inline_diff_html(old_version.html_content, new_version.html_content)

    return ContractVersionDiff(
        template_id=template_id,
        template_name=template.name,
        old_version=old_version.version_number,
        new_version=new_version.version_number,
        diff_html=diff_html,
    )


# ============== Signature Management Endpoints (Admin) ==============

@router.get("/signatures", response_model=List[ContractSignatureSummary])
async def list_signatures(
    template_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """List all contract signatures."""
    query = db.query(ContractSignature).join(ContractVersion).join(ContractTemplate)

    if template_id:
        query = query.filter(ContractVersion.template_id == template_id)
    if status_filter:
        query = query.filter(ContractSignature.status == SignatureStatusModel(status_filter))
    if user_id:
        query = query.filter(ContractSignature.user_id == user_id)

    signatures = query.order_by(ContractSignature.requested_at.desc()).all()

    return [
        ContractSignatureSummary(
            id=sig.id,
            user_name=sig.user.name if sig.user else "Unknown",
            user_email=sig.user.email if sig.user else "",
            template_name=sig.contract_version.template.name,
            version_number=sig.contract_version.version_number,
            contract_type=ContractType(sig.contract_version.template.contract_type.value),
            status=SignatureStatus(sig.status.value),
            requested_at=sig.requested_at,
            signed_at=sig.signed_at,
        )
        for sig in signatures
    ]


@router.post("/templates/{template_id}/request-signature", response_model=ContractSignatureResponse)
async def request_signature(
    template_id: int,
    data: SignatureRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Request a user to sign the current version of a contract."""
    template = db.query(ContractTemplate).filter(
        ContractTemplate.id == template_id,
        ContractTemplate.is_active == True
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Active template not found")

    # Get current version
    current_version = db.query(ContractVersion).filter(
        ContractVersion.template_id == template_id,
        ContractVersion.is_current == True
    ).first()
    if not current_version:
        raise HTTPException(status_code=400, detail="Template has no current version")

    # Validate user
    user = db.query(User).filter(User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check for existing pending/sent signature for this version
    existing = db.query(ContractSignature).filter(
        ContractSignature.contract_version_id == current_version.id,
        ContractSignature.user_id == data.user_id,
        ContractSignature.status.in_([SignatureStatusModel.PENDING, SignatureStatusModel.SENT])
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already has a pending signature request for this version")

    # Check for previous signed version (for re-signing)
    previous_signature = db.query(ContractSignature).join(ContractVersion).filter(
        ContractVersion.template_id == template_id,
        ContractSignature.user_id == data.user_id,
        ContractSignature.status == SignatureStatusModel.SIGNED
    ).order_by(ContractSignature.signed_at.desc()).first()

    # Create signature request
    signature = ContractSignature(
        contract_version_id=current_version.id,
        user_id=data.user_id,
        status=SignatureStatusModel.PENDING,
        requested_by_id=current_user.id,
        previous_signature_id=previous_signature.id if previous_signature else None,
        notes=data.notes,
    )
    db.add(signature)
    db.commit()
    db.refresh(signature)

    return _signature_to_response(signature)


@router.post("/templates/{template_id}/trigger-resign", response_model=List[ContractSignatureResponse])
async def trigger_resign(
    template_id: int,
    data: BulkResignRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Trigger re-signing for multiple users when contract is updated."""
    template = db.query(ContractTemplate).filter(
        ContractTemplate.id == template_id,
        ContractTemplate.is_active == True
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Active template not found")

    current_version = db.query(ContractVersion).filter(
        ContractVersion.template_id == template_id,
        ContractVersion.is_current == True
    ).first()
    if not current_version:
        raise HTTPException(status_code=400, detail="Template has no current version")

    created_signatures = []
    for user_id in data.user_ids:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            continue

        # Check for existing pending signature
        existing = db.query(ContractSignature).filter(
            ContractSignature.contract_version_id == current_version.id,
            ContractSignature.user_id == user_id,
            ContractSignature.status.in_([SignatureStatusModel.PENDING, SignatureStatusModel.SENT])
        ).first()
        if existing:
            continue

        # Get previous signature
        previous_signature = db.query(ContractSignature).join(ContractVersion).filter(
            ContractVersion.template_id == template_id,
            ContractSignature.user_id == user_id,
            ContractSignature.status == SignatureStatusModel.SIGNED
        ).order_by(ContractSignature.signed_at.desc()).first()

        signature = ContractSignature(
            contract_version_id=current_version.id,
            user_id=user_id,
            status=SignatureStatusModel.PENDING,
            requested_by_id=current_user.id,
            previous_signature_id=previous_signature.id if previous_signature else None,
            notes=data.notes or "Contract updated - re-signing required",
        )
        db.add(signature)
        db.flush()
        created_signatures.append(signature)

    db.commit()

    return [_signature_to_response(sig) for sig in created_signatures]


@router.post("/signatures/{signature_id}/void", response_model=ContractSignatureResponse)
async def void_signature(
    signature_id: int,
    reason: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Void (cancel) a pending signature request."""
    signature = db.query(ContractSignature).filter(ContractSignature.id == signature_id).first()
    if not signature:
        raise HTTPException(status_code=404, detail="Signature not found")

    if signature.status == SignatureStatusModel.SIGNED:
        raise HTTPException(status_code=400, detail="Cannot void a signed contract")

    if signature.status == SignatureStatusModel.VOIDED:
        raise HTTPException(status_code=400, detail="Signature already voided")

    # If there's a DocuSign envelope, void it
    if signature.docusign_envelope_id:
        docusign = get_docusign_service(db)
        docusign.void_envelope(signature.docusign_envelope_id, reason)

    signature.status = SignatureStatusModel.VOIDED
    signature.notes = (signature.notes or "") + f"\nVoided: {reason}"

    db.commit()
    db.refresh(signature)

    return _signature_to_response(signature)


@router.get("/signatures/{signature_id}/pdf")
async def download_signed_pdf(
    signature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Download the signed PDF for a contract signature."""
    signature = db.query(ContractSignature).filter(ContractSignature.id == signature_id).first()
    if not signature:
        raise HTTPException(status_code=404, detail="Signature not found")

    if signature.status != SignatureStatusModel.SIGNED:
        raise HTTPException(status_code=400, detail="Contract has not been signed")

    if not signature.signed_pdf_filename:
        raise HTTPException(status_code=404, detail="Signed PDF not available")

    pdf_path = os.path.join(SIGNED_PDF_DIR, signature.signed_pdf_filename)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Signed PDF file not found")

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{signature.signed_pdf_filename}"'
        }
    )


# ============== User Endpoints (My Contracts) ==============

@router.get("/my-contracts", response_model=List[MyContractResponse])
async def get_my_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current user's contracts and signature status."""
    signatures = db.query(ContractSignature).filter(
        ContractSignature.user_id == current_user.id
    ).order_by(ContractSignature.requested_at.desc()).all()

    return [
        MyContractResponse(
            signature_id=sig.id,
            template_name=sig.contract_version.template.name,
            contract_type=ContractType(sig.contract_version.template.contract_type.value),
            version_number=sig.contract_version.version_number,
            status=SignatureStatus(sig.status.value),
            requested_at=sig.requested_at,
            signed_at=sig.signed_at,
            has_signed_pdf=sig.signed_pdf_filename is not None,
            can_sign=sig.status in [SignatureStatusModel.PENDING, SignatureStatusModel.SENT],
            previous_version_signed=sig.previous_signature_id is not None,
        )
        for sig in signatures
    ]


@router.get("/my-contracts/{signature_id}/content", response_model=ContractContentResponse)
async def get_my_contract_content(
    signature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get contract content for viewing."""
    signature = db.query(ContractSignature).filter(
        ContractSignature.id == signature_id,
        ContractSignature.user_id == current_user.id
    ).first()
    if not signature:
        raise HTTPException(status_code=404, detail="Contract not found")

    version = signature.contract_version
    is_resign = signature.previous_signature_id is not None
    diff_html = None
    prev_version_num = None

    # If this is a re-sign, generate diff from previous version
    if is_resign and signature.previous_signature:
        prev_version = signature.previous_signature.contract_version
        prev_version_num = prev_version.version_number
        diff_html = generate_inline_diff_html(prev_version.html_content, version.html_content)

    return ContractContentResponse(
        signature_id=signature.id,
        template_name=version.template.name,
        version_number=version.version_number,
        html_content=version.html_content,
        status=SignatureStatus(signature.status.value),
        is_resign=is_resign,
        diff_html=diff_html,
        previous_version_number=prev_version_num,
    )


@router.post("/signatures/{signature_id}/initiate", response_model=InitiateSigningResponse)
async def initiate_signing(
    signature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initiate the DocuSign signing process for a contract."""
    signature = db.query(ContractSignature).filter(
        ContractSignature.id == signature_id,
        ContractSignature.user_id == current_user.id
    ).first()
    if not signature:
        raise HTTPException(status_code=404, detail="Contract not found")

    if signature.status not in [SignatureStatusModel.PENDING, SignatureStatusModel.SENT]:
        raise HTTPException(status_code=400, detail="Contract cannot be signed in current state")

    settings = _get_settings(db)
    docusign = get_docusign_service(db)

    if not docusign.is_configured:
        raise HTTPException(status_code=500, detail="DocuSign is not configured")

    version = signature.contract_version
    template = version.template

    # Generate PDF from contract HTML
    try:
        pdf_bytes = generate_contract_pdf(
            html_content=version.html_content,
            contract_name=template.name,
            version_number=version.version_number,
            venue_name=settings.venue_name or "Equestrian Venue",
            signer_name=current_user.name,
            include_signature_placeholder=True,
        )
    except ImportError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Build return URL for after signing
    frontend_url = settings.frontend_url or "http://localhost:3000"
    return_url = f"{frontend_url}/contracts/signing-complete?signature_id={signature_id}"

    # Create DocuSign envelope
    result = docusign.create_envelope_for_signature(
        pdf_bytes=pdf_bytes,
        pdf_filename=f"{template.name}_v{version.version_number}.pdf",
        signer_email=current_user.email,
        signer_name=current_user.name,
        subject=f"Please sign: {template.name}",
        message=f"Please review and sign the {template.name} contract.",
        return_url=return_url,
    )

    if not result.get("success"):
        return InitiateSigningResponse(
            success=False,
            error=result.get("error", "Failed to create signing session"),
            test_mode=result.get("test_mode", False),
        )

    # Update signature with envelope ID
    signature.docusign_envelope_id = result.get("envelope_id")
    signature.status = SignatureStatusModel.SENT
    db.commit()

    return InitiateSigningResponse(
        success=True,
        signing_url=result.get("signing_url"),
        envelope_id=result.get("envelope_id"),
        test_mode=result.get("test_mode", False),
    )


@router.post("/signatures/{signature_id}/complete", response_model=CompleteSigningResponse)
async def complete_signing(
    signature_id: int,
    data: CompleteSigningRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Complete the signing process after DocuSign callback."""
    signature = db.query(ContractSignature).filter(
        ContractSignature.id == signature_id,
        ContractSignature.user_id == current_user.id
    ).first()
    if not signature:
        raise HTTPException(status_code=404, detail="Contract not found")

    if signature.status == SignatureStatusModel.SIGNED:
        return CompleteSigningResponse(
            success=True,
            status=SignatureStatus.SIGNED,
            message="Contract already signed",
        )

    docusign = get_docusign_service(db)

    # Update status based on event
    new_status = docusign.update_signature_status_from_event(signature, data.event)

    # If signed, try to download the signed PDF
    if new_status == SignatureStatusModel.SIGNED and signature.docusign_envelope_id:
        pdf_result = docusign.download_signed_document(signature.docusign_envelope_id)
        if pdf_result.get("success") and pdf_result.get("pdf_bytes"):
            # Save signed PDF
            os.makedirs(SIGNED_PDF_DIR, exist_ok=True)
            filename = f"signed_{signature.id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
            pdf_path = os.path.join(SIGNED_PDF_DIR, filename)
            with open(pdf_path, "wb") as f:
                f.write(pdf_result["pdf_bytes"])
            signature.signed_pdf_filename = filename

    db.commit()

    status_messages = {
        SignatureStatusModel.SIGNED: "Contract signed successfully",
        SignatureStatusModel.DECLINED: "Signing was declined",
        SignatureStatusModel.VOIDED: "Signing was cancelled",
    }

    return CompleteSigningResponse(
        success=new_status == SignatureStatusModel.SIGNED,
        status=SignatureStatus(new_status.value),
        message=status_messages.get(new_status, f"Status updated to {new_status.value}"),
    )


@router.get("/my-contracts/{signature_id}/pdf")
async def download_my_signed_pdf(
    signature_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Download user's own signed PDF."""
    signature = db.query(ContractSignature).filter(
        ContractSignature.id == signature_id,
        ContractSignature.user_id == current_user.id
    ).first()
    if not signature:
        raise HTTPException(status_code=404, detail="Contract not found")

    if signature.status != SignatureStatusModel.SIGNED:
        raise HTTPException(status_code=400, detail="Contract has not been signed")

    if not signature.signed_pdf_filename:
        raise HTTPException(status_code=404, detail="Signed PDF not available")

    pdf_path = os.path.join(SIGNED_PDF_DIR, signature.signed_pdf_filename)
    if not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="Signed PDF file not found")

    with open(pdf_path, "rb") as f:
        pdf_bytes = f.read()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{signature.signed_pdf_filename}"'
        }
    )


# ============== DocuSign Settings Endpoints (Admin) ==============

@router.get("/docusign/settings", response_model=DocuSignSettingsResponse)
async def get_docusign_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Get DocuSign settings (sensitive data masked)."""
    settings = _get_settings(db)

    # Mask integration key
    masked_key = None
    if settings.docusign_integration_key:
        key = settings.docusign_integration_key
        masked_key = f"{key[:8]}...{key[-4:]}" if len(key) > 12 else "***"

    docusign = get_docusign_service(db)

    return DocuSignSettingsResponse(
        docusign_enabled=settings.docusign_enabled or False,
        docusign_integration_key=masked_key,
        docusign_account_id=settings.docusign_account_id,
        docusign_user_id=settings.docusign_user_id,
        docusign_test_mode=settings.docusign_test_mode if settings.docusign_test_mode is not None else True,
        has_private_key=bool(settings.docusign_private_key),
        is_configured=docusign.is_configured,
    )


@router.put("/docusign/settings", response_model=DocuSignSettingsResponse)
async def update_docusign_settings(
    data: DocuSignSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Update DocuSign settings."""
    settings = _get_settings(db)

    if data.docusign_enabled is not None:
        settings.docusign_enabled = data.docusign_enabled
    if data.docusign_integration_key is not None:
        settings.docusign_integration_key = data.docusign_integration_key
    if data.docusign_account_id is not None:
        settings.docusign_account_id = data.docusign_account_id
    if data.docusign_user_id is not None:
        settings.docusign_user_id = data.docusign_user_id
    if data.docusign_private_key is not None:
        settings.docusign_private_key = data.docusign_private_key
    if data.docusign_test_mode is not None:
        settings.docusign_test_mode = data.docusign_test_mode
        # Update base URL based on mode
        settings.docusign_base_url = (
            "https://demo.docusign.net/restapi" if data.docusign_test_mode
            else "https://na4.docusign.net/restapi"
        )

    db.commit()

    # Return updated settings
    return await get_docusign_settings(db, current_user)


@router.post("/docusign/test", response_model=DocuSignTestResponse)
async def test_docusign_connection(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["admin"]))
):
    """Test DocuSign connection and authentication."""
    docusign = get_docusign_service(db)

    if not docusign.is_configured:
        return DocuSignTestResponse(
            success=False,
            message="DocuSign is not fully configured. Please provide all required settings.",
            test_mode=docusign.is_test_mode,
        )

    if docusign.is_test_mode:
        return DocuSignTestResponse(
            success=True,
            message="DocuSign is in test mode. Authentication will be simulated.",
            test_mode=True,
        )

    try:
        # Try to get a JWT token to test authentication
        docusign._get_jwt_token()
        return DocuSignTestResponse(
            success=True,
            message="Successfully authenticated with DocuSign API.",
            test_mode=False,
        )
    except ImportError as e:
        return DocuSignTestResponse(
            success=False,
            message=f"DocuSign library not installed: {str(e)}",
            test_mode=False,
        )
    except Exception as e:
        return DocuSignTestResponse(
            success=False,
            message=f"Authentication failed: {str(e)}",
            test_mode=False,
        )
