from typing import Optional, List
from pydantic import BaseModel, ConfigDict


# ============== Stable Block Schemas ==============

class StableBlockCreate(BaseModel):
    name: str
    sequence: int = 0


class StableBlockUpdate(BaseModel):
    name: Optional[str] = None
    sequence: Optional[int] = None
    is_active: Optional[bool] = None


class StableBlockResponse(BaseModel):
    id: int
    name: str
    sequence: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


# ============== Stable Schemas ==============

class StableCreate(BaseModel):
    name: str
    block_id: Optional[int] = None
    number: Optional[int] = None
    sequence: int = 0


class StableUpdate(BaseModel):
    name: Optional[str] = None
    block_id: Optional[int] = None
    number: Optional[int] = None
    sequence: Optional[int] = None
    is_active: Optional[bool] = None


class StableResponse(BaseModel):
    id: int
    name: str
    block_id: Optional[int] = None
    number: Optional[int] = None
    sequence: int
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class StableWithBlock(StableResponse):
    block: Optional[StableBlockResponse] = None


class StableWithHorseCount(StableResponse):
    horse_count: int = 0
    block: Optional[StableBlockResponse] = None


class StableBlockWithStables(StableBlockResponse):
    stables: List[StableResponse] = []
