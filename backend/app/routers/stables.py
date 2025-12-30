from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.database import get_db
from app.models.stable import Stable, StableBlock
from app.models.horse import Horse
from app.models.user import User
from app.schemas.stable import (
    StableCreate, StableUpdate, StableResponse, StableWithHorseCount,
    StableBlockCreate, StableBlockUpdate, StableBlockResponse, StableBlockWithStables
)
from app.utils.auth import get_current_user
from app.utils.crud import CRUDFactory, get_or_404

router = APIRouter()

# CRUD factories
block_crud = CRUDFactory(model=StableBlock, name="stable block")
stable_crud = CRUDFactory(model=Stable, name="stable")


def check_block_has_stables(db: Session, block: StableBlock) -> None:
    """Prevent deletion if block has stables."""
    stable_count = db.query(Stable).filter(Stable.block_id == block.id).count()
    if stable_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete block with {stable_count} stable(s). Remove stables first."
        )


def check_stable_has_horses(db: Session, stable: Stable) -> None:
    """Prevent deletion if stable has horses."""
    horse_count = db.query(Horse).filter(Horse.stable_id == stable.id).count()
    if horse_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete stable with {horse_count} horse(s) assigned. Remove horses first."
        )


# ============== Stable Block Endpoints ==============

@router.get("/blocks", response_model=List[StableBlockResponse])
def list_stable_blocks(
    active_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all stable blocks, ordered by sequence."""
    if active_only:
        return block_crud.list_active(db, order_by=StableBlock.sequence)
    return block_crud.list_all(db, order_by=StableBlock.sequence)


@router.get("/blocks/{block_id}", response_model=StableBlockWithStables)
def get_stable_block(
    block_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific stable block with its stables."""
    block = db.query(StableBlock).options(
        joinedload(StableBlock.stables)
    ).filter(StableBlock.id == block_id).first()
    if not block:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Stable block not found"
        )
    return block


@router.post("/blocks", response_model=StableBlockResponse, status_code=status.HTTP_201_CREATED)
def create_stable_block(
    block_data: StableBlockCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new stable block (admin only)."""
    return block_crud.create_admin_only(db, block_data, current_user)


@router.put("/blocks/{block_id}", response_model=StableBlockResponse)
def update_stable_block(
    block_id: int,
    block_data: StableBlockUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a stable block (admin only)."""
    return block_crud.update_admin_only(db, block_id, block_data, current_user)


@router.delete("/blocks/{block_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stable_block(
    block_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a stable block (admin only). Cannot delete if stables are assigned."""
    block_crud.delete_admin_only(db, block_id, current_user, pre_delete_check=check_block_has_stables)


# ============== Stable Endpoints ==============

@router.get("/", response_model=List[StableWithHorseCount])
def list_stables(
    active_only: bool = False,
    block_id: Optional[int] = Query(None, description="Filter by block ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all stables with horse counts, ordered by sequence."""
    # Custom query with horse count - can't use CRUD factory for this
    query = db.query(
        Stable,
        func.count(Horse.id).label('horse_count')
    ).outerjoin(Horse).outerjoin(StableBlock).group_by(Stable.id)

    if active_only:
        query = query.filter(Stable.is_active == True)

    if block_id is not None:
        query = query.filter(Stable.block_id == block_id)

    results = query.order_by(Stable.sequence).all()

    # Get blocks for each stable
    stable_ids = [stable.id for stable, _ in results]
    stables_with_blocks = db.query(Stable).options(
        joinedload(Stable.block)
    ).filter(Stable.id.in_(stable_ids)).all()
    block_map = {s.id: s.block for s in stables_with_blocks}

    return [
        StableWithHorseCount(
            id=stable.id,
            name=stable.name,
            block_id=stable.block_id,
            number=stable.number,
            sequence=stable.sequence,
            is_active=stable.is_active,
            horse_count=count,
            block=block_map.get(stable.id)
        )
        for stable, count in results
    ]


@router.get("/{stable_id}", response_model=StableResponse)
def get_stable(
    stable_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific stable."""
    return stable_crud.get(db, stable_id)


@router.post("/", response_model=StableResponse, status_code=status.HTTP_201_CREATED)
def create_stable(
    stable_data: StableCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new stable (admin only)."""
    return stable_crud.create_admin_only(db, stable_data, current_user)


@router.put("/{stable_id}", response_model=StableResponse)
def update_stable(
    stable_id: int,
    stable_data: StableUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a stable (admin only)."""
    return stable_crud.update_admin_only(db, stable_id, stable_data, current_user)


@router.delete("/{stable_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stable(
    stable_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a stable (admin only). Cannot delete if horses are assigned."""
    stable_crud.delete_admin_only(db, stable_id, current_user, pre_delete_check=check_stable_has_horses)


# ============== Horse Assignment Endpoints ==============

@router.put("/{stable_id}/assign/{horse_id}", response_model=dict)
def assign_horse_to_stable(
    stable_id: int,
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Assign a horse to a stable (admin only)."""
    from app.utils.crud import require_admin
    require_admin(current_user, "assign horses to stables")

    stable = get_or_404(db, Stable, stable_id, "Stable not found")
    horse = get_or_404(db, Horse, horse_id, "Horse not found")

    horse.stable_id = stable_id
    db.commit()

    return {"message": f"{horse.name} assigned to {stable.name}"}


@router.delete("/{stable_id}/unassign/{horse_id}", response_model=dict)
def unassign_horse_from_stable(
    stable_id: int,
    horse_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a horse from a stable (admin only)."""
    from app.utils.crud import require_admin
    require_admin(current_user, "unassign horses from stables")

    horse = db.query(Horse).filter(
        Horse.id == horse_id,
        Horse.stable_id == stable_id
    ).first()
    if not horse:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Horse not found in this stable"
        )

    horse.stable_id = None
    db.commit()

    return {"message": f"{horse.name} removed from stable"}
