from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


class ContractType(str, PyEnum):
    """Type of contract template."""
    LIVERY = "livery"
    EMPLOYMENT = "employment"
    CUSTOM = "custom"


class SignatureStatus(str, PyEnum):
    """Status of a contract signature request."""
    PENDING = "pending"      # Created but not yet sent to DocuSign
    SENT = "sent"            # Envelope created in DocuSign, awaiting signature
    SIGNED = "signed"        # Successfully signed
    DECLINED = "declined"    # Signer declined to sign
    VOIDED = "voided"        # Admin cancelled the signature request


class ContractTemplate(Base):
    """Template for contracts that can have multiple versions."""
    __tablename__ = "contract_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    contract_type = EnumColumn(ContractType, nullable=False)
    livery_package_id = Column(Integer, ForeignKey("livery_packages.id"), nullable=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    livery_package = relationship("LiveryPackage", backref="contract_templates")
    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_contract_templates")
    versions = relationship("ContractVersion", back_populates="template", order_by="desc(ContractVersion.version_number)")


class ContractVersion(Base):
    """A specific version of a contract template with its content."""
    __tablename__ = "contract_versions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("contract_templates.id"), nullable=False)
    version_number = Column(Integer, nullable=False)
    html_content = Column(Text, nullable=False)  # Contract content in HTML format
    change_summary = Column(Text, nullable=True)  # Description of changes from previous version
    is_current = Column(Boolean, default=True, nullable=False)  # Only one version per template should be current
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    template = relationship("ContractTemplate", back_populates="versions")
    created_by = relationship("User", foreign_keys=[created_by_id], backref="created_contract_versions")
    signatures = relationship("ContractSignature", back_populates="contract_version")


class ContractSignature(Base):
    """A signature request/record for a specific contract version."""
    __tablename__ = "contract_signatures"

    id = Column(Integer, primary_key=True, index=True)
    contract_version_id = Column(Integer, ForeignKey("contract_versions.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # The signer
    docusign_envelope_id = Column(String(100), nullable=True)  # DocuSign envelope ID
    status = EnumColumn(SignatureStatus, default=SignatureStatus.PENDING, nullable=False)
    requested_at = Column(DateTime, default=datetime.utcnow)
    signed_at = Column(DateTime, nullable=True)
    signed_pdf_filename = Column(String(255), nullable=True)  # Filename of saved signed PDF
    requested_by_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Admin who requested
    previous_signature_id = Column(Integer, ForeignKey("contract_signatures.id"), nullable=True)  # For re-signing chain
    notes = Column(Text, nullable=True)  # Re-sign reason, etc.

    # Relationships
    contract_version = relationship("ContractVersion", back_populates="signatures")
    user = relationship("User", foreign_keys=[user_id], backref="contract_signatures")
    requested_by = relationship("User", foreign_keys=[requested_by_id], backref="requested_contract_signatures")
    previous_signature = relationship("ContractSignature", remote_side=[id], backref="subsequent_signatures")
