from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict, field_validator
from app.models.professional import ProfessionalCategory
from app.utils.validators import validate_uk_phone


class ProfessionalCreate(BaseModel):
    category: ProfessionalCategory
    business_name: str
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    coverage_area: Optional[str] = None
    services: Optional[str] = None
    specialties: Optional[str] = None
    qualifications: Optional[str] = None
    typical_rates: Optional[str] = None
    booking_notes: Optional[str] = None
    yard_recommended: bool = False
    yard_notes: Optional[str] = None

    @field_validator('phone', 'mobile')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_uk_phone(v)


class ProfessionalUpdate(BaseModel):
    category: Optional[ProfessionalCategory] = None
    business_name: Optional[str] = None
    contact_name: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    coverage_area: Optional[str] = None
    services: Optional[str] = None
    specialties: Optional[str] = None
    qualifications: Optional[str] = None
    typical_rates: Optional[str] = None
    booking_notes: Optional[str] = None
    yard_recommended: Optional[bool] = None
    yard_notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('phone', 'mobile')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_uk_phone(v)


class ProfessionalResponse(BaseModel):
    id: int
    category: ProfessionalCategory
    business_name: str
    contact_name: Optional[str]
    phone: Optional[str]
    mobile: Optional[str]
    email: Optional[str]
    website: Optional[str]
    address: Optional[str]
    coverage_area: Optional[str]
    services: Optional[str]
    specialties: Optional[str]
    qualifications: Optional[str]
    typical_rates: Optional[str]
    booking_notes: Optional[str]
    yard_recommended: bool
    yard_notes: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ProfessionalPublicResponse(BaseModel):
    """Public view - excludes yard_notes."""
    id: int
    category: ProfessionalCategory
    business_name: str
    contact_name: Optional[str]
    phone: Optional[str]
    mobile: Optional[str]
    email: Optional[str]
    website: Optional[str]
    address: Optional[str]
    coverage_area: Optional[str]
    services: Optional[str]
    specialties: Optional[str]
    qualifications: Optional[str]
    typical_rates: Optional[str]
    booking_notes: Optional[str]
    yard_recommended: bool

    model_config = ConfigDict(from_attributes=True)


class ProfessionalCategoryInfo(BaseModel):
    value: str
    label: str
    count: int


class ProfessionalDirectoryResponse(BaseModel):
    categories: List[ProfessionalCategoryInfo]
    professionals: List[ProfessionalPublicResponse]
    total: int
