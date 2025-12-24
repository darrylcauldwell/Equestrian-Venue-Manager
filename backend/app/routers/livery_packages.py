import json
from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.livery_package import LiveryPackage
from app.models.user import User
from app.schemas.livery_package import (
    LiveryPackageCreate,
    LiveryPackageUpdate,
    LiveryPackageResponse,
)
from app.utils.auth import get_current_user
from app.utils.crud import CRUDFactory, require_admin

router = APIRouter()


def package_to_response(package: LiveryPackage) -> LiveryPackageResponse:
    """Convert a LiveryPackage model to response, parsing JSON features."""
    features = None
    if package.features:
        try:
            features = json.loads(package.features)
        except json.JSONDecodeError:
            features = []

    return LiveryPackageResponse(
        id=package.id,
        name=package.name,
        price_display=package.price_display,
        monthly_price=package.monthly_price,
        weekly_price=package.weekly_price,
        billing_type=package.billing_type.value if package.billing_type else "monthly",
        description=package.description,
        features=features,
        additional_note=package.additional_note,
        is_featured=package.is_featured,
        display_order=package.display_order,
        is_active=package.is_active,
        is_insurance_claimable=package.is_insurance_claimable,
        created_at=package.created_at,
        updated_at=package.updated_at,
    )


def transform_features(data: dict) -> dict:
    """Convert features list to JSON string for storage."""
    if 'features' in data:
        data['features'] = json.dumps(data['features']) if data['features'] else None
    return data


# Create CRUD factory for livery packages
crud = CRUDFactory(
    model=LiveryPackage,
    name="livery package",
    name_plural="livery packages",
    response_transform=package_to_response
)


@router.get("/", response_model=List[LiveryPackageResponse])
def list_livery_packages(
    active_only: bool = True,
    db: Session = Depends(get_db)
):
    """List livery packages (public)."""
    if active_only:
        return crud.list_active(db, order_by=(LiveryPackage.display_order, LiveryPackage.name))
    return crud.list_all(db, order_by=(LiveryPackage.display_order, LiveryPackage.name))


@router.get("/{package_id}", response_model=LiveryPackageResponse)
def get_livery_package(package_id: int, db: Session = Depends(get_db)):
    """Get a specific livery package (public)."""
    return crud.get(db, package_id)


@router.post("/", response_model=LiveryPackageResponse, status_code=status.HTTP_201_CREATED)
def create_livery_package(
    data: LiveryPackageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new livery package (admin only)."""
    require_admin(current_user, "create livery packages")

    # Transform features to JSON before creating
    item_data = data.model_dump()
    item_data = transform_features(item_data)

    package = LiveryPackage(**item_data)
    db.add(package)
    db.commit()
    db.refresh(package)
    return package_to_response(package)


@router.put("/{package_id}", response_model=LiveryPackageResponse)
def update_livery_package(
    package_id: int,
    data: LiveryPackageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a livery package (admin only)."""
    return crud.update_admin_only(
        db, package_id, data, current_user,
        transform_data=transform_features
    )


@router.delete("/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_livery_package(
    package_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a livery package (admin only)."""
    crud.delete_admin_only(db, package_id, current_user)
