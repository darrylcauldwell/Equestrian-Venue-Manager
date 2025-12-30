"""Contract management schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from enum import Enum


class ContractType(str, Enum):
    LIVERY = "livery"
    EMPLOYMENT = "employment"
    CUSTOM = "custom"


class SignatureStatus(str, Enum):
    PENDING = "pending"
    SENT = "sent"
    SIGNED = "signed"
    DECLINED = "declined"
    VOIDED = "voided"


# ============ Contract Template Schemas ============

class ContractTemplateCreate(BaseModel):
    """Create a new contract template."""
    name: str = Field(..., min_length=1, max_length=200)
    contract_type: ContractType
    livery_package_id: Optional[int] = None
    description: Optional[str] = None
    html_content: str = Field(..., min_length=1)  # Initial version content


class ContractTemplateUpdate(BaseModel):
    """Update a contract template (metadata only, not content)."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    livery_package_id: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ContractTemplateResponse(BaseModel):
    """Contract template response."""
    id: int
    name: str
    contract_type: ContractType
    livery_package_id: Optional[int]
    description: Optional[str]
    is_active: bool
    created_by_id: int
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    # Enriched fields
    created_by_name: Optional[str] = None
    livery_package_name: Optional[str] = None
    current_version_number: Optional[int] = None
    total_signatures: int = 0

    class Config:
        from_attributes = True


class ContractTemplateSummary(BaseModel):
    """Contract template summary for list views."""
    id: int
    name: str
    contract_type: ContractType
    is_active: bool
    livery_package_name: Optional[str] = None
    current_version_number: Optional[int] = None
    pending_signatures: int = 0
    signed_count: int = 0


# ============ Contract Version Schemas ============

class ContractVersionCreate(BaseModel):
    """Create a new version of a contract template."""
    html_content: str = Field(..., min_length=1)
    change_summary: Optional[str] = None


class ContractVersionResponse(BaseModel):
    """Contract version response."""
    id: int
    template_id: int
    version_number: int
    html_content: str
    change_summary: Optional[str]
    is_current: bool
    created_by_id: int
    created_at: Optional[datetime]
    # Enriched fields
    created_by_name: Optional[str] = None

    class Config:
        from_attributes = True


class ContractVersionSummary(BaseModel):
    """Contract version summary for list views."""
    id: int
    version_number: int
    change_summary: Optional[str]
    is_current: bool
    created_by_name: Optional[str] = None
    created_at: Optional[datetime]
    signatures_count: int = 0


class ContractVersionDiff(BaseModel):
    """Diff between two contract versions."""
    template_id: int
    template_name: str
    old_version: int
    new_version: int
    diff_html: str  # HTML with highlighted changes


# ============ Contract Signature Schemas ============

class SignatureRequestCreate(BaseModel):
    """Request a user to sign a contract."""
    user_id: int
    notes: Optional[str] = None


class BulkResignRequest(BaseModel):
    """Request to trigger re-signing for multiple users."""
    user_ids: List[int]
    notes: Optional[str] = None


class ContractSignatureResponse(BaseModel):
    """Contract signature response."""
    id: int
    contract_version_id: int
    user_id: int
    docusign_envelope_id: Optional[str]
    status: SignatureStatus
    requested_at: Optional[datetime]
    signed_at: Optional[datetime]
    signed_pdf_filename: Optional[str]
    requested_by_id: int
    previous_signature_id: Optional[int]
    notes: Optional[str]
    # Enriched fields
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    requested_by_name: Optional[str] = None
    template_name: Optional[str] = None
    version_number: Optional[int] = None
    contract_type: Optional[ContractType] = None

    class Config:
        from_attributes = True


class ContractSignatureSummary(BaseModel):
    """Contract signature summary for list views."""
    id: int
    user_name: str
    user_email: str
    template_name: str
    version_number: int
    contract_type: ContractType
    status: SignatureStatus
    requested_at: Optional[datetime]
    signed_at: Optional[datetime]


# ============ User-facing Schemas ============

class MyContractResponse(BaseModel):
    """Contract information for the logged-in user."""
    signature_id: int
    template_name: str
    contract_type: ContractType
    version_number: int
    status: SignatureStatus
    requested_at: Optional[datetime]
    signed_at: Optional[datetime]
    has_signed_pdf: bool
    can_sign: bool  # True if status is PENDING or SENT
    previous_version_signed: bool  # True if this is a re-sign request


class ContractContentResponse(BaseModel):
    """Contract content for viewing."""
    signature_id: int
    template_name: str
    version_number: int
    html_content: str
    status: SignatureStatus
    # If this is a re-sign, include diff from previous version
    is_resign: bool
    diff_html: Optional[str] = None
    previous_version_number: Optional[int] = None


class InitiateSigningResponse(BaseModel):
    """Response when initiating a signing session."""
    success: bool
    signing_url: Optional[str] = None
    envelope_id: Optional[str] = None
    error: Optional[str] = None
    test_mode: bool = False


class CompleteSigningRequest(BaseModel):
    """Request to complete signing after DocuSign callback."""
    event: str  # DocuSign event: signing_complete, decline, cancel, etc.
    envelope_id: Optional[str] = None


class CompleteSigningResponse(BaseModel):
    """Response after completing signing."""
    success: bool
    status: SignatureStatus
    message: str


# ============ DocuSign Settings Schemas ============

class DocuSignSettingsUpdate(BaseModel):
    """Update DocuSign settings."""
    docusign_enabled: Optional[bool] = None
    docusign_integration_key: Optional[str] = None
    docusign_account_id: Optional[str] = None
    docusign_user_id: Optional[str] = None
    docusign_private_key: Optional[str] = None
    docusign_test_mode: Optional[bool] = None


class DocuSignSettingsResponse(BaseModel):
    """DocuSign settings response (sensitive data masked)."""
    docusign_enabled: bool
    docusign_integration_key: Optional[str]  # Masked
    docusign_account_id: Optional[str]
    docusign_user_id: Optional[str]
    docusign_test_mode: bool
    has_private_key: bool  # Boolean indicator instead of actual key
    is_configured: bool  # Whether all required settings are present


class DocuSignTestResponse(BaseModel):
    """Response from testing DocuSign connection."""
    success: bool
    message: str
    test_mode: bool
