from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.professional import Professional, ProfessionalCategory
from app.models.user import User
from app.schemas.professional import (
    ProfessionalCreate,
    ProfessionalUpdate,
    ProfessionalResponse,
    ProfessionalPublicResponse,
    ProfessionalCategoryInfo,
    ProfessionalDirectoryResponse,
)
from app.utils.auth import get_current_user
from app.utils.crud import CRUDFactory, require_admin

router = APIRouter()

# CRUD factory for professionals
crud = CRUDFactory(model=Professional, name="professional")


CATEGORY_LABELS = {
    ProfessionalCategory.FARRIER: "Farrier",
    ProfessionalCategory.VET: "Veterinarian",
    ProfessionalCategory.DENTIST: "Equine Dentist",
    ProfessionalCategory.PHYSIO: "Physiotherapist",
    ProfessionalCategory.CHIROPRACTOR: "Chiropractor",
    ProfessionalCategory.SADDLER: "Saddler",
    ProfessionalCategory.NUTRITIONIST: "Nutritionist",
    ProfessionalCategory.INSTRUCTOR: "Instructor/Trainer",
    ProfessionalCategory.TRANSPORTER: "Horse Transport",
    ProfessionalCategory.OTHER: "Other",
}


@router.get("/categories", response_model=List[ProfessionalCategoryInfo])
def get_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all categories with counts."""
    # Get counts per category
    counts = db.query(
        Professional.category,
        func.count(Professional.id)
    ).filter(
        Professional.is_active == True
    ).group_by(Professional.category).all()

    count_map = {cat: cnt for cat, cnt in counts}

    return [
        ProfessionalCategoryInfo(
            value=cat.value,
            label=CATEGORY_LABELS.get(cat, cat.value.title()),
            count=count_map.get(cat, 0)
        )
        for cat in ProfessionalCategory
    ]


@router.get("/", response_model=ProfessionalDirectoryResponse)
def list_professionals(
    category: Optional[ProfessionalCategory] = None,
    recommended_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all professionals in the directory."""
    query = db.query(Professional).filter(Professional.is_active == True)

    if category:
        query = query.filter(Professional.category == category)

    if recommended_only:
        query = query.filter(Professional.yard_recommended == True)

    # Order by: recommended first, then by business name
    professionals = query.order_by(
        Professional.yard_recommended.desc(),
        Professional.business_name
    ).all()

    # Get category counts
    counts = db.query(
        Professional.category,
        func.count(Professional.id)
    ).filter(
        Professional.is_active == True
    ).group_by(Professional.category).all()

    count_map = {cat: cnt for cat, cnt in counts}

    categories = [
        ProfessionalCategoryInfo(
            value=cat.value,
            label=CATEGORY_LABELS.get(cat, cat.value.title()),
            count=count_map.get(cat, 0)
        )
        for cat in ProfessionalCategory
        if count_map.get(cat, 0) > 0
    ]

    return ProfessionalDirectoryResponse(
        categories=categories,
        professionals=professionals,
        total=len(professionals)
    )


@router.get("/{professional_id}", response_model=ProfessionalPublicResponse)
def get_professional(
    professional_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific professional's details."""
    professional = db.query(Professional).filter(
        Professional.id == professional_id,
        Professional.is_active == True
    ).first()

    if not professional:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Professional not found"
        )

    return professional


# ============== Staff/Manager Routes ==============

@router.post("/", response_model=ProfessionalResponse, status_code=status.HTTP_201_CREATED)
def create_professional(
    data: ProfessionalCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new professional entry (admin only)."""
    return crud.create_admin_only(db, data, current_user)


@router.put("/{professional_id}", response_model=ProfessionalResponse)
def update_professional(
    professional_id: int,
    data: ProfessionalUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a professional entry (admin only)."""
    return crud.update_admin_only(db, professional_id, data, current_user)


@router.delete("/{professional_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_professional(
    professional_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete (deactivate) a professional entry (admin only)."""
    crud.soft_delete_admin_only(db, professional_id, current_user)


@router.get("/admin/all", response_model=List[ProfessionalResponse])
def list_all_professionals_admin(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all professionals including inactive (admin only)."""
    require_admin(current_user, "view all professionals")

    query = db.query(Professional)
    if not include_inactive:
        query = query.filter(Professional.is_active == True)

    return query.order_by(Professional.category, Professional.business_name).all()
