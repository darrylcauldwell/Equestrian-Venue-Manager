from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.arena import Arena
from app.models.user import User
from app.schemas.arena import ArenaCreate, ArenaUpdate, ArenaResponse
from app.utils.auth import require_staff_or_admin
from app.utils.crud import CRUDFactory

router = APIRouter()

# Create CRUD factory for arenas
crud = CRUDFactory(model=Arena, name="arena")


def check_arena_bookings(db: Session, arena: Arena) -> None:
    """Prevent deletion if arena has bookings."""
    from app.models.booking import Booking
    booking_count = db.query(Booking).filter(Booking.arena_id == arena.id).count()
    if booking_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete arena with {booking_count} existing bookings. Deactivate it instead."
        )


@router.get("/", response_model=List[ArenaResponse])
def list_arenas(db: Session = Depends(get_db)):
    """List active arenas (public)."""
    return crud.list_active(db)


@router.get("/all", response_model=List[ArenaResponse])
def list_all_arenas(
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    """List all arenas including inactive (staff only)."""
    return crud.list_all(db)


@router.get("/{arena_id}", response_model=ArenaResponse)
def get_arena(arena_id: int, db: Session = Depends(get_db)):
    """Get arena by ID (public)."""
    return crud.get(db, arena_id)


@router.post("/", response_model=ArenaResponse, status_code=status.HTTP_201_CREATED)
def create_arena(
    arena_data: ArenaCreate,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    """Create new arena (staff only)."""
    return crud.create(db, arena_data)


@router.put("/{arena_id}", response_model=ArenaResponse)
def update_arena(
    arena_id: int,
    arena_data: ArenaUpdate,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    """Update arena (staff only)."""
    return crud.update(db, arena_id, arena_data)


@router.delete("/{arena_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_arena(
    arena_id: int,
    current_user: User = Depends(require_staff_or_admin),
    db: Session = Depends(get_db)
):
    """Delete arena (staff only). Fails if arena has bookings."""
    crud.delete(db, arena_id, pre_delete_check=check_arena_bookings)
