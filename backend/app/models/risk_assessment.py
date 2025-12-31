"""
Health & Safety Risk Assessment models.

Tracks risk assessments, their content, staff acknowledgements, and review history.
"""
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.database import Base, EnumColumn


class RiskAssessmentCategory(str, enum.Enum):
    """Categories of risk assessments for a livery yard."""
    GENERAL_WORKPLACE = "general_workplace"
    HORSE_HANDLING = "horse_handling"
    YARD_ENVIRONMENT = "yard_environment"
    FIRE_EMERGENCY = "fire_emergency"
    BIOSECURITY = "biosecurity"
    FIRST_AID = "first_aid"
    PPE_MANUAL_HANDLING = "ppe_manual_handling"
    OTHER = "other"


class ReviewTrigger(str, enum.Enum):
    """What triggered a risk assessment review."""
    SCHEDULED = "scheduled"  # Regular annual/periodic review
    INCIDENT = "incident"  # Following accident or near miss
    CHANGE = "change"  # New equipment, layout change, new procedures
    NEW_HAZARD = "new_hazard"  # New hazard identified
    LEGISLATION = "legislation"  # Change in regulations/legislation
    INITIAL = "initial"  # First version of assessment
    OTHER = "other"


class RiskAssessment(Base):
    """
    A health & safety risk assessment document.

    Admin creates and maintains these. Staff must acknowledge reading them
    periodically (typically annually) or when updated.
    """
    __tablename__ = "risk_assessments"

    id = Column(Integer, primary_key=True, index=True)

    # Document details
    title = Column(String(200), nullable=False)
    category = EnumColumn(RiskAssessmentCategory, nullable=False)
    summary = Column(Text, nullable=True)  # Brief description
    content = Column(Text, nullable=False)  # Full risk assessment text (supports markdown)

    # Versioning - increment when content is updated substantively
    version = Column(Integer, default=1, nullable=False)

    # Staff acknowledgement requirements
    review_period_months = Column(Integer, default=12, nullable=False)  # How often staff must re-read
    required_for_induction = Column(Boolean, default=True, nullable=False)  # Must be read by new starters
    applies_to_roles = Column(Text, nullable=True)  # JSON array of roles this applies to (null = all staff)

    # Admin review tracking
    last_reviewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)  # When admin last reviewed
    last_reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    next_review_due = Column(DateTime, nullable=True)  # Suggested next admin review date
    needs_review = Column(Boolean, default=False, nullable=False)  # Flag for urgent review needed

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Audit
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Relationships
    created_by = relationship("User", foreign_keys=[created_by_id])
    last_reviewed_by = relationship("User", foreign_keys=[last_reviewed_by_id])
    acknowledgements = relationship("RiskAssessmentAcknowledgement", back_populates="risk_assessment", cascade="all, delete-orphan")
    review_history = relationship("RiskAssessmentReview", back_populates="risk_assessment", cascade="all, delete-orphan", order_by="desc(RiskAssessmentReview.reviewed_at)")


class RiskAssessmentReview(Base):
    """
    Record of an admin reviewing/updating a risk assessment.

    Provides audit trail of when and why assessments were reviewed.
    Required legally to demonstrate due diligence.
    """
    __tablename__ = "risk_assessment_reviews"

    id = Column(Integer, primary_key=True, index=True)

    risk_assessment_id = Column(Integer, ForeignKey("risk_assessments.id", ondelete="CASCADE"), nullable=False)

    # Review details
    reviewed_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # What triggered this review
    trigger = EnumColumn(ReviewTrigger, default=ReviewTrigger.SCHEDULED, nullable=False)
    trigger_details = Column(Text, nullable=True)  # Details about incident, change, etc.

    # What version resulted from this review
    version_before = Column(Integer, nullable=False)
    version_after = Column(Integer, nullable=False)  # Same if no changes made

    # Review outcome
    changes_made = Column(Boolean, default=False, nullable=False)
    changes_summary = Column(Text, nullable=True)  # What was changed

    # Notes
    notes = Column(Text, nullable=True)

    # Relationships
    risk_assessment = relationship("RiskAssessment", back_populates="review_history")
    reviewed_by = relationship("User")


class RiskAssessmentAcknowledgement(Base):
    """
    Record of a staff member acknowledging they have read a risk assessment.

    A new record is created each time staff acknowledge reading.
    This provides a full audit trail for compliance.
    """
    __tablename__ = "risk_assessment_acknowledgements"

    id = Column(Integer, primary_key=True, index=True)

    # What was acknowledged
    risk_assessment_id = Column(Integer, ForeignKey("risk_assessments.id", ondelete="CASCADE"), nullable=False)
    assessment_version = Column(Integer, nullable=False)  # Version at time of acknowledgement

    # Who acknowledged
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    # When
    acknowledged_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Optional notes from staff
    notes = Column(Text, nullable=True)

    # Relationships
    risk_assessment = relationship("RiskAssessment", back_populates="acknowledgements")
    user = relationship("User")
