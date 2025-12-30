from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.horse import Horse
from app.models.user import User
from app.schemas.horse import HorseCreate, HorseUpdate, HorseResponse
from app.utils.auth import get_current_user
from app.utils.crud import CRUDFactory

router = APIRouter()


def enrich_horse(horse: Horse) -> Horse:
    """Add computed fields to horse response."""
    if horse.stable:
        horse.stable_name = horse.stable.name
    if horse.livery_package:
        horse.livery_package_name = horse.livery_package.name
    return horse


# Create CRUD factory for horses with enrichment
crud = CRUDFactory(
    model=Horse,
    name="horse",
    response_transform=enrich_horse
)


@router.get("/", response_model=List[HorseResponse])
def list_horses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List horses. Staff see all, others see only their own."""
    return crud.list_by_owner(
        db,
        current_user,
        owner_field="owner_id",
        eager_load=[Horse.stable, Horse.livery_package]
    )


@router.get("/{horse_id}", response_model=HorseResponse)
def get_horse(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a horse by ID. Owner or staff can view."""
    return crud.get_with_owner_check(db, horse_id, current_user, owner_field="owner_id")


@router.post("/", response_model=HorseResponse, status_code=status.HTTP_201_CREATED)
def create_horse(
    horse_data: HorseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new horse. Admin can specify owner_id, others create for themselves."""
    # If admin specifies owner_id, use it; otherwise use current user
    if horse_data.owner_id and current_user.role == "admin":
        # Create horse with specified owner
        data_dict = horse_data.model_dump(exclude={"owner_id"})
        horse = Horse(**data_dict, owner_id=horse_data.owner_id)
        db.add(horse)
        db.commit()
        db.refresh(horse)
        return enrich_horse(horse)
    else:
        return crud.create_with_owner(db, horse_data, current_user, owner_field="owner_id")


@router.put("/{horse_id}", response_model=HorseResponse)
def update_horse(
    horse_id: int,
    horse_data: HorseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a horse. Owner or admin can update."""
    return crud.update_with_owner_check(
        db, horse_id, horse_data, current_user,
        owner_field="owner_id",
        allow_admin=True
    )


@router.delete("/{horse_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_horse(
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a horse. Only the owner can delete."""
    crud.delete_owner_only(db, horse_id, current_user, owner_field="owner_id")
