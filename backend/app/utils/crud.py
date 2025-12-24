"""
CRUD Factory utilities for generating standard API endpoints.

This module provides factory functions to eliminate repetitive CRUD endpoint code
across routers while remaining flexible enough to handle variations.
"""
from typing import Any, Callable, List, Optional, Type, TypeVar
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session, Query
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User, UserRole
from app.utils.auth import get_current_user, has_staff_access

# Type variables for generic typing
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)
ResponseSchemaType = TypeVar("ResponseSchemaType", bound=BaseModel)


def get_or_404(
    db: Session,
    model: Type[ModelType],
    id: int,
    detail: str = "Item not found"
) -> ModelType:
    """Get an item by ID or raise 404."""
    item = db.query(model).filter(model.id == id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )
    return item


def require_admin(current_user: User, action: str = "perform this action") -> None:
    """Raise 403 if user is not admin."""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Only admin can {action}"
        )


def check_owner_or_staff(
    current_user: User,
    owner_id: Optional[int]
) -> bool:
    """Check if user is owner or staff. Returns True if authorized."""
    return owner_id == current_user.id or has_staff_access(current_user)


def check_owner_or_admin(
    current_user: User,
    owner_id: Optional[int]
) -> bool:
    """Check if user is owner or admin. Returns True if authorized."""
    return owner_id == current_user.id or current_user.role == UserRole.ADMIN


def apply_update(item: Any, update_data: dict) -> None:
    """Apply update data to an item."""
    for field, value in update_data.items():
        setattr(item, field, value)


class CRUDFactory:
    """
    Factory for creating standard CRUD endpoint handlers.

    Example usage:
        crud = CRUDFactory(
            model=Arena,
            create_schema=ArenaCreate,
            update_schema=ArenaUpdate,
            response_schema=ArenaResponse,
            name="arena"
        )

        # Then in router:
        @router.get("/", response_model=List[ArenaResponse])
        def list_arenas(db: Session = Depends(get_db)):
            return crud.list_active(db)
    """

    def __init__(
        self,
        model: Type[ModelType],
        name: str,
        name_plural: Optional[str] = None,
        response_transform: Optional[Callable[[ModelType], Any]] = None,
    ):
        """
        Initialize CRUD factory.

        Args:
            model: SQLAlchemy model class
            name: Singular name for error messages (e.g., "arena")
            name_plural: Plural name (defaults to name + "s")
            response_transform: Optional function to transform items before returning
        """
        self.model = model
        self.name = name
        self.name_plural = name_plural or f"{name}s"
        self.transform = response_transform or (lambda x: x)

    def get_or_404(self, db: Session, id: int) -> ModelType:
        """Get item by ID or raise 404."""
        return get_or_404(db, self.model, id, f"{self.name.title()} not found")

    def list_all(self, db: Session, order_by: Optional[Any] = None) -> List[ModelType]:
        """List all items."""
        query = db.query(self.model)
        if order_by is not None:
            if isinstance(order_by, tuple):
                query = query.order_by(*order_by)
            else:
                query = query.order_by(order_by)
        return [self.transform(item) for item in query.all()]

    def list_active(self, db: Session, order_by: Optional[Any] = None) -> List[ModelType]:
        """List only active items (assumes is_active column exists)."""
        query = db.query(self.model).filter(self.model.is_active == True)
        if order_by is not None:
            if isinstance(order_by, tuple):
                query = query.order_by(*order_by)
            else:
                query = query.order_by(order_by)
        return [self.transform(item) for item in query.all()]

    def list_by_owner(
        self,
        db: Session,
        current_user: User,
        owner_field: str = "owner_id",
        eager_load: Optional[List[Any]] = None
    ) -> List[ModelType]:
        """List items - staff see all, others see only owned."""
        query = db.query(self.model)

        if eager_load:
            from sqlalchemy.orm import joinedload
            for relationship in eager_load:
                query = query.options(joinedload(relationship))

        if not has_staff_access(current_user):
            query = query.filter(getattr(self.model, owner_field) == current_user.id)

        return [self.transform(item) for item in query.all()]

    def get(self, db: Session, id: int) -> ModelType:
        """Get single item by ID."""
        item = self.get_or_404(db, id)
        return self.transform(item)

    def get_with_owner_check(
        self,
        db: Session,
        id: int,
        current_user: User,
        owner_field: str = "owner_id"
    ) -> ModelType:
        """Get item with owner/staff access check. Returns 404 if not authorized."""
        item = db.query(self.model).filter(self.model.id == id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.name.title()} not found"
            )

        owner_id = getattr(item, owner_field, None)
        if not check_owner_or_staff(current_user, owner_id):
            # Return 404 to not leak resource existence
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.name.title()} not found"
            )

        return self.transform(item)

    def create(
        self,
        db: Session,
        data: BaseModel,
        extra_fields: Optional[dict] = None
    ) -> ModelType:
        """Create new item."""
        item_data = data.model_dump()
        if extra_fields:
            item_data.update(extra_fields)

        item = self.model(**item_data)
        db.add(item)
        db.commit()
        db.refresh(item)
        return self.transform(item)

    def create_admin_only(
        self,
        db: Session,
        data: BaseModel,
        current_user: User,
        extra_fields: Optional[dict] = None
    ) -> ModelType:
        """Create new item (admin only)."""
        require_admin(current_user, f"create {self.name_plural}")
        return self.create(db, data, extra_fields)

    def create_with_owner(
        self,
        db: Session,
        data: BaseModel,
        current_user: User,
        owner_field: str = "owner_id"
    ) -> ModelType:
        """Create new item with current user as owner."""
        return self.create(db, data, {owner_field: current_user.id})

    def update(
        self,
        db: Session,
        id: int,
        data: BaseModel,
        transform_data: Optional[Callable[[dict], dict]] = None
    ) -> ModelType:
        """Update item."""
        item = self.get_or_404(db, id)
        update_data = data.model_dump(exclude_unset=True)

        if transform_data:
            update_data = transform_data(update_data)

        apply_update(item, update_data)
        db.commit()
        db.refresh(item)
        return self.transform(item)

    def update_admin_only(
        self,
        db: Session,
        id: int,
        data: BaseModel,
        current_user: User,
        transform_data: Optional[Callable[[dict], dict]] = None
    ) -> ModelType:
        """Update item (admin only)."""
        require_admin(current_user, f"update {self.name_plural}")
        return self.update(db, id, data, transform_data)

    def update_with_owner_check(
        self,
        db: Session,
        id: int,
        data: BaseModel,
        current_user: User,
        owner_field: str = "owner_id",
        allow_admin: bool = True,
        transform_data: Optional[Callable[[dict], dict]] = None
    ) -> ModelType:
        """Update item with owner/admin check. Returns 404 if not authorized."""
        item = db.query(self.model).filter(self.model.id == id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.name.title()} not found"
            )

        owner_id = getattr(item, owner_field, None)
        check_fn = check_owner_or_admin if allow_admin else check_owner_or_staff
        if not check_fn(current_user, owner_id):
            # Return 404 to not leak resource existence
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.name.title()} not found"
            )

        update_data = data.model_dump(exclude_unset=True)
        if transform_data:
            update_data = transform_data(update_data)

        apply_update(item, update_data)
        db.commit()
        db.refresh(item)
        return self.transform(item)

    def delete(
        self,
        db: Session,
        id: int,
        pre_delete_check: Optional[Callable[[Session, ModelType], None]] = None
    ) -> None:
        """Delete item."""
        item = self.get_or_404(db, id)

        if pre_delete_check:
            pre_delete_check(db, item)

        db.delete(item)
        db.commit()

    def delete_admin_only(
        self,
        db: Session,
        id: int,
        current_user: User,
        pre_delete_check: Optional[Callable[[Session, ModelType], None]] = None
    ) -> None:
        """Delete item (admin only)."""
        require_admin(current_user, f"delete {self.name_plural}")
        self.delete(db, id, pre_delete_check)

    def delete_owner_only(
        self,
        db: Session,
        id: int,
        current_user: User,
        owner_field: str = "owner_id"
    ) -> None:
        """Delete item (owner only)."""
        item = db.query(self.model).filter(
            self.model.id == id,
            getattr(self.model, owner_field) == current_user.id
        ).first()

        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.name.title()} not found"
            )

        db.delete(item)
        db.commit()

    def soft_delete_admin_only(
        self,
        db: Session,
        id: int,
        current_user: User
    ) -> None:
        """Soft delete item by setting is_active=False (admin only)."""
        require_admin(current_user, f"delete {self.name_plural}")
        item = self.get_or_404(db, id)
        item.is_active = False
        db.commit()

    def delete_with_owner_check(
        self,
        db: Session,
        id: int,
        current_user: User,
        owner_field: str = "owner_id"
    ) -> None:
        """Delete item if user is owner or admin. Returns 404 if not authorized."""
        item = db.query(self.model).filter(self.model.id == id).first()
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.name.title()} not found"
            )

        owner_id = getattr(item, owner_field, None)
        if not check_owner_or_admin(current_user, owner_id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{self.name.title()} not found"
            )

        db.delete(item)
        db.commit()
