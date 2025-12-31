from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.models.emergency_contact import ContactType


class EmergencyContactCreate(BaseModel):
    contact_type: ContactType
    name: str
    phone: str
    phone_alt: Optional[str] = None
    email: Optional[str] = None
    practice_name: Optional[str] = None
    address: Optional[str] = None
    available_24h: bool = False
    availability_notes: Optional[str] = None
    is_primary: bool = False
    notes: Optional[str] = None


class EmergencyContactUpdate(BaseModel):
    contact_type: Optional[ContactType] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    phone_alt: Optional[str] = None
    email: Optional[str] = None
    practice_name: Optional[str] = None
    address: Optional[str] = None
    available_24h: Optional[bool] = None
    availability_notes: Optional[str] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = None


class EmergencyContactResponse(BaseModel):
    id: int
    horse_id: int
    contact_type: ContactType
    name: str
    phone: str
    phone_alt: Optional[str]
    email: Optional[str]
    practice_name: Optional[str]
    address: Optional[str]
    available_24h: bool
    availability_notes: Optional[str]
    is_primary: bool
    notes: Optional[str]
    created_by_id: int
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EmergencyContactSummary(BaseModel):
    """Quick view of emergency contacts by type"""
    horse_id: int
    horse_name: str
    primary_vet: Optional[EmergencyContactResponse] = None
    backup_vet: Optional[EmergencyContactResponse] = None
    primary_farrier: Optional[EmergencyContactResponse] = None
    backup_owner: Optional[EmergencyContactResponse] = None
    all_contacts: list[EmergencyContactResponse]

    model_config = ConfigDict(from_attributes=True)
