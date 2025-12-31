from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, ConfigDict


class ArenaCreate(BaseModel):
    name: str
    description: Optional[str] = None
    size: Optional[str] = None
    surface_type: Optional[str] = None
    price_per_hour: Optional[Decimal] = None
    has_lights: bool = False
    jumps_type: Optional[str] = None
    free_for_livery: bool = False
    image_url: Optional[str] = None


class ArenaUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    size: Optional[str] = None
    surface_type: Optional[str] = None
    price_per_hour: Optional[Decimal] = None
    has_lights: Optional[bool] = None
    jumps_type: Optional[str] = None
    free_for_livery: Optional[bool] = None
    image_url: Optional[str] = None


class ArenaResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    is_active: bool
    size: Optional[str] = None
    surface_type: Optional[str] = None
    price_per_hour: Optional[Decimal] = None
    has_lights: bool = False
    jumps_type: Optional[str] = None
    free_for_livery: bool = False
    image_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
