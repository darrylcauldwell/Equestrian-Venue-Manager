from datetime import date
from typing import Optional
from pydantic import BaseModel, ConfigDict


class HorseCreate(BaseModel):
    name: str
    owner_id: Optional[int] = None  # Admin can specify owner; if None, uses current user
    passport_name: Optional[str] = None
    colour: Optional[str] = None
    birth_year: Optional[int] = None
    feed_notes: Optional[str] = None
    # Personality traits - Farrier
    farrier_friendly: bool = True
    farrier_notes: Optional[str] = None
    # Personality traits - Dentist
    dentist_friendly: bool = True
    needs_sedation_dentist: bool = False
    dentist_notes: Optional[str] = None
    # Personality traits - Clipping
    clipping_friendly: bool = True
    needs_sedation_clipping: bool = False
    clipping_notes: Optional[str] = None
    # Personality traits - General handling
    kicks: bool = False
    bites: bool = False
    handling_notes: Optional[str] = None
    # Personality traits - Loading & Catching
    loads_well: bool = True
    loading_notes: Optional[str] = None
    difficult_to_catch: bool = False
    catching_notes: Optional[str] = None
    # Personality traits - Vet
    vet_friendly: bool = True
    needle_shy: bool = False
    vet_notes: Optional[str] = None
    # Personality traits - Tying & Sedation risks
    can_be_tied: bool = True
    tying_notes: Optional[str] = None
    has_sedation_risk: bool = False
    sedation_notes: Optional[str] = None
    # Personality traits - Headshyness
    headshy: bool = False
    headshy_notes: Optional[str] = None


class HorseUpdate(BaseModel):
    name: Optional[str] = None
    passport_name: Optional[str] = None
    colour: Optional[str] = None
    birth_year: Optional[int] = None
    feed_notes: Optional[str] = None
    stable_id: Optional[int] = None
    # Livery package assignment
    livery_package_id: Optional[int] = None
    livery_start_date: Optional[date] = None
    livery_end_date: Optional[date] = None
    # Personality traits - Farrier
    farrier_friendly: Optional[bool] = None
    farrier_notes: Optional[str] = None
    # Personality traits - Dentist
    dentist_friendly: Optional[bool] = None
    needs_sedation_dentist: Optional[bool] = None
    dentist_notes: Optional[str] = None
    # Personality traits - Clipping
    clipping_friendly: Optional[bool] = None
    needs_sedation_clipping: Optional[bool] = None
    clipping_notes: Optional[str] = None
    # Personality traits - General handling
    kicks: Optional[bool] = None
    bites: Optional[bool] = None
    handling_notes: Optional[str] = None
    # Personality traits - Loading & Catching
    loads_well: Optional[bool] = None
    loading_notes: Optional[str] = None
    difficult_to_catch: Optional[bool] = None
    catching_notes: Optional[str] = None
    # Personality traits - Vet
    vet_friendly: Optional[bool] = None
    needle_shy: Optional[bool] = None
    vet_notes: Optional[str] = None
    # Personality traits - Tying & Sedation risks
    can_be_tied: Optional[bool] = None
    tying_notes: Optional[str] = None
    has_sedation_risk: Optional[bool] = None
    sedation_notes: Optional[str] = None
    # Personality traits - Headshyness
    headshy: Optional[bool] = None
    headshy_notes: Optional[str] = None


class HorseResponse(BaseModel):
    id: int
    owner_id: int
    name: str
    passport_name: Optional[str] = None
    colour: Optional[str]
    birth_year: Optional[int]
    feed_notes: Optional[str] = None
    stable_id: Optional[int] = None
    stable_name: Optional[str] = None
    # Livery package assignment
    livery_package_id: Optional[int] = None
    livery_start_date: Optional[date] = None
    livery_end_date: Optional[date] = None
    livery_package_name: Optional[str] = None  # Populated from relationship
    # Personality traits - Farrier
    farrier_friendly: bool = True
    farrier_notes: Optional[str] = None
    # Personality traits - Dentist
    dentist_friendly: bool = True
    needs_sedation_dentist: bool = False
    dentist_notes: Optional[str] = None
    # Personality traits - Clipping
    clipping_friendly: bool = True
    needs_sedation_clipping: bool = False
    clipping_notes: Optional[str] = None
    # Personality traits - General handling
    kicks: bool = False
    bites: bool = False
    handling_notes: Optional[str] = None
    # Personality traits - Loading & Catching
    loads_well: bool = True
    loading_notes: Optional[str] = None
    difficult_to_catch: bool = False
    catching_notes: Optional[str] = None
    # Personality traits - Vet
    vet_friendly: bool = True
    needle_shy: bool = False
    vet_notes: Optional[str] = None
    # Personality traits - Tying & Sedation risks
    can_be_tied: bool = True
    tying_notes: Optional[str] = None
    has_sedation_risk: bool = False
    sedation_notes: Optional[str] = None
    # Personality traits - Headshyness
    headshy: bool = False
    headshy_notes: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class HorseWithStable(HorseResponse):
    """Horse response with stable information for feed list ordering."""
    stable_sequence: Optional[int] = None
