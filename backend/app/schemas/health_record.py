from typing import Optional
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.health_record import VaccineType


# Farrier Records
class FarrierRecordCreate(BaseModel):
    visit_date: date
    farrier_name: Optional[str] = None
    work_done: str
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class FarrierRecordUpdate(BaseModel):
    visit_date: Optional[date] = None
    farrier_name: Optional[str] = None
    work_done: Optional[str] = None
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class FarrierRecordResponse(BaseModel):
    id: int
    horse_id: int
    visit_date: date
    farrier_name: Optional[str]
    work_done: str
    cost: Optional[Decimal]
    next_due: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Dentist Records
class DentistRecordCreate(BaseModel):
    visit_date: date
    dentist_name: Optional[str] = None
    treatment: str
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class DentistRecordUpdate(BaseModel):
    visit_date: Optional[date] = None
    dentist_name: Optional[str] = None
    treatment: Optional[str] = None
    cost: Optional[Decimal] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class DentistRecordResponse(BaseModel):
    id: int
    horse_id: int
    visit_date: date
    dentist_name: Optional[str]
    treatment: str
    cost: Optional[Decimal]
    next_due: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Vaccination Records
class VaccinationRecordCreate(BaseModel):
    vaccination_date: date
    vaccine_type: VaccineType
    vaccine_name: Optional[str] = None
    batch_number: Optional[str] = None
    administered_by: Optional[str] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class VaccinationRecordUpdate(BaseModel):
    vaccination_date: Optional[date] = None
    vaccine_type: Optional[VaccineType] = None
    vaccine_name: Optional[str] = None
    batch_number: Optional[str] = None
    administered_by: Optional[str] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class VaccinationRecordResponse(BaseModel):
    id: int
    horse_id: int
    vaccination_date: date
    vaccine_type: VaccineType
    vaccine_name: Optional[str]
    batch_number: Optional[str]
    administered_by: Optional[str]
    next_due: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Worming Records
class WormingRecordCreate(BaseModel):
    treatment_date: date
    product: str
    worm_count_date: Optional[date] = None
    worm_count_result: Optional[int] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class WormingRecordUpdate(BaseModel):
    treatment_date: Optional[date] = None
    product: Optional[str] = None
    worm_count_date: Optional[date] = None
    worm_count_result: Optional[int] = None
    next_due: Optional[date] = None
    notes: Optional[str] = None


class WormingRecordResponse(BaseModel):
    id: int
    horse_id: int
    treatment_date: date
    product: str
    worm_count_date: Optional[date]
    worm_count_result: Optional[int]
    next_due: Optional[date]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Summary response for all health records
class HealthRecordsSummary(BaseModel):
    horse_id: int
    horse_name: str
    farrier_records: list[FarrierRecordResponse]
    dentist_records: list[DentistRecordResponse]
    vaccination_records: list[VaccinationRecordResponse]
    worming_records: list[WormingRecordResponse]
    next_farrier_due: Optional[date] = None
    next_dentist_due: Optional[date] = None
    next_vaccination_due: Optional[date] = None
    next_worming_due: Optional[date] = None

    class Config:
        from_attributes = True
