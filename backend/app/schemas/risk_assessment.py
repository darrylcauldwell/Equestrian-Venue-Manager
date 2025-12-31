"""Risk assessment schemas."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field
from enum import Enum


class RiskAssessmentCategory(str, Enum):
    GENERAL_WORKPLACE = "general_workplace"
    HORSE_HANDLING = "horse_handling"
    YARD_ENVIRONMENT = "yard_environment"
    FIRE_EMERGENCY = "fire_emergency"
    BIOSECURITY = "biosecurity"
    FIRST_AID = "first_aid"
    PPE_MANUAL_HANDLING = "ppe_manual_handling"
    OTHER = "other"


class ReviewTrigger(str, Enum):
    SCHEDULED = "scheduled"
    INCIDENT = "incident"
    CHANGE = "change"
    NEW_HAZARD = "new_hazard"
    LEGISLATION = "legislation"
    INITIAL = "initial"
    OTHER = "other"


# ============ Risk Assessment Schemas ============

class RiskAssessmentCreate(BaseModel):
    """Create a new risk assessment."""
    title: str = Field(..., min_length=1, max_length=200)
    category: RiskAssessmentCategory
    summary: Optional[str] = None
    content: str = Field(..., min_length=1)
    review_period_months: int = Field(default=12, ge=1, le=60)
    required_for_induction: bool = True
    applies_to_roles: Optional[List[str]] = None  # JSON serialized to text


class RiskAssessmentUpdate(BaseModel):
    """Update a risk assessment (non-versioning fields)."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[RiskAssessmentCategory] = None
    summary: Optional[str] = None
    review_period_months: Optional[int] = Field(None, ge=1, le=60)
    required_for_induction: Optional[bool] = None
    applies_to_roles: Optional[List[str]] = None
    is_active: Optional[bool] = None
    needs_review: Optional[bool] = None
    next_review_due: Optional[datetime] = None


class RiskAssessmentContentUpdate(BaseModel):
    """Update risk assessment content (increments version)."""
    content: str = Field(..., min_length=1)
    review_trigger: ReviewTrigger = ReviewTrigger.CHANGE
    trigger_details: Optional[str] = None
    changes_summary: str = Field(..., min_length=1, description="Summary of what changed")


class RiskAssessmentResponse(BaseModel):
    """Risk assessment response."""
    id: int
    title: str
    category: RiskAssessmentCategory
    summary: Optional[str]
    content: str
    version: int
    review_period_months: int
    required_for_induction: bool
    applies_to_roles: Optional[List[str]]
    last_reviewed_at: datetime
    last_reviewed_by_id: Optional[int]
    next_review_due: Optional[datetime]
    needs_review: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by_id: int
    # Enriched fields
    created_by_name: Optional[str] = None
    last_reviewed_by_name: Optional[str] = None
    acknowledgement_count: int = 0
    staff_needing_acknowledgement: int = 0

    model_config = ConfigDict(from_attributes=True)


class RiskAssessmentSummary(BaseModel):
    """Risk assessment summary for list views."""
    id: int
    title: str
    category: RiskAssessmentCategory
    summary: Optional[str]
    version: int
    is_active: bool
    needs_review: bool
    next_review_due: Optional[datetime]
    last_reviewed_at: datetime
    acknowledgement_count: int = 0
    staff_needing_acknowledgement: int = 0
    required_for_induction: bool


# ============ Review History Schemas ============

class ReviewCreate(BaseModel):
    """Record a review of a risk assessment (without content change)."""
    trigger: ReviewTrigger = ReviewTrigger.SCHEDULED
    trigger_details: Optional[str] = None
    notes: Optional[str] = None


class ReviewResponse(BaseModel):
    """Risk assessment review response."""
    id: int
    risk_assessment_id: int
    reviewed_at: datetime
    reviewed_by_id: int
    trigger: ReviewTrigger
    trigger_details: Optional[str]
    version_before: int
    version_after: int
    changes_made: bool
    changes_summary: Optional[str]
    notes: Optional[str]
    # Enriched fields
    reviewed_by_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ============ Acknowledgement Schemas ============

class AcknowledgementCreate(BaseModel):
    """Staff acknowledges reading a risk assessment."""
    risk_assessment_id: int
    notes: Optional[str] = None


class AcknowledgementResponse(BaseModel):
    """Acknowledgement response."""
    id: int
    risk_assessment_id: int
    assessment_version: int
    user_id: int
    acknowledged_at: datetime
    notes: Optional[str]
    # Enriched fields
    user_name: Optional[str] = None
    assessment_title: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AcknowledgementSummary(BaseModel):
    """Acknowledgement summary for list views."""
    id: int
    user_id: int
    user_name: str
    acknowledged_at: datetime
    assessment_version: int
    is_current_version: bool  # Whether they've acknowledged the current version


class AssessmentStaffStatus(BaseModel):
    """Staff member's status for a specific assessment."""
    user_id: int
    user_name: str
    status: str  # 'acknowledged', 'outdated', 'pending'
    acknowledged_at: Optional[datetime] = None
    acknowledged_version: Optional[int] = None
    is_current_version: bool = False


# ============ Staff-facing Schemas ============

class MyRiskAssessmentResponse(BaseModel):
    """Risk assessment info for staff member."""
    id: int
    title: str
    category: RiskAssessmentCategory
    summary: Optional[str]
    content: str
    version: int
    required_for_induction: bool
    # Acknowledgement status
    last_acknowledged_at: Optional[datetime] = None
    last_acknowledged_version: Optional[int] = None
    needs_acknowledgement: bool  # True if never acknowledged, or acknowledged old version


class StaffAcknowledgementStatus(BaseModel):
    """Staff member's acknowledgement status across all assessments."""
    user_id: int
    user_name: str
    total_assessments: int
    acknowledged_count: int
    pending_count: int
    is_compliant: bool  # All required assessments acknowledged with current versions


class ComplianceSummary(BaseModel):
    """Overall compliance summary for admin."""
    total_staff: int
    fully_compliant_staff: int
    non_compliant_staff: int
    compliance_percentage: float
    assessments_needing_review: int


# ============ Dashboard/Report Schemas ============

class AssessmentComplianceReport(BaseModel):
    """Compliance report for a specific risk assessment."""
    assessment_id: int
    assessment_title: str
    category: RiskAssessmentCategory
    total_applicable_staff: int
    acknowledged_count: int
    pending_count: int
    compliance_percentage: float
    staff_pending: List[dict]  # List of staff who need to acknowledge
