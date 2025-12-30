"""
Base Service Layer - Generic CRUD operations for SQLAlchemy models

This module provides a base class that implements common CRUD operations,
reducing boilerplate in router files and ensuring consistent patterns.

Usage:
    from app.services.base_service import BaseService
    from app.models.horse import Horse
    from app.schemas.horse import HorseCreate, HorseUpdate

    class HorseService(BaseService[Horse, HorseCreate, HorseUpdate]):
        pass

    # In router:
    horse_service = HorseService(Horse)
    horse = horse_service.get(db, horse_id)
    horses = horse_service.list(db, owner_id=user.id)
    new_horse = horse_service.create(db, horse_data)
"""

from typing import TypeVar, Generic, Type, Optional, List, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from fastapi import HTTPException
from pydantic import BaseModel

# Type variables for generic model and schema types
ModelType = TypeVar("ModelType")
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseService(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Generic base service with CRUD operations.

    Attributes:
        model: The SQLAlchemy model class
    """

    def __init__(self, model: Type[ModelType]):
        """
        Initialize the service with a model class.

        Args:
            model: The SQLAlchemy model class to operate on
        """
        self.model = model

    def get(self, db: Session, id: int) -> ModelType:
        """
        Get a single record by ID.

        Args:
            db: Database session
            id: Record ID

        Returns:
            The model instance

        Raises:
            HTTPException: If record not found (404)
        """
        item = db.query(self.model).filter(self.model.id == id).first()
        if not item:
            model_name = self.model.__name__
            raise HTTPException(status_code=404, detail=f"{model_name} not found")
        return item

    def get_or_none(self, db: Session, id: int) -> Optional[ModelType]:
        """
        Get a single record by ID, returning None if not found.

        Args:
            db: Database session
            id: Record ID

        Returns:
            The model instance or None
        """
        return db.query(self.model).filter(self.model.id == id).first()

    def list(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        order_by: Optional[str] = None,
        order_desc: bool = False,
        filters: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> List[ModelType]:
        """
        List records with optional filtering and pagination.

        Args:
            db: Database session
            skip: Number of records to skip (offset)
            limit: Maximum number of records to return
            order_by: Column name to order by
            order_desc: If True, order descending
            filters: Dictionary of column_name: value pairs for exact matching
            **kwargs: Additional column filters (column_name=value)

        Returns:
            List of model instances
        """
        query = db.query(self.model)

        # Apply explicit filters dict
        if filters:
            for key, value in filters.items():
                if hasattr(self.model, key) and value is not None:
                    query = query.filter(getattr(self.model, key) == value)

        # Apply kwargs filters
        for key, value in kwargs.items():
            if hasattr(self.model, key) and value is not None:
                query = query.filter(getattr(self.model, key) == value)

        # Apply ordering
        if order_by and hasattr(self.model, order_by):
            column = getattr(self.model, order_by)
            query = query.order_by(desc(column) if order_desc else asc(column))

        return query.offset(skip).limit(limit).all()

    def list_all(
        self,
        db: Session,
        *,
        order_by: Optional[str] = None,
        order_desc: bool = False,
        **kwargs
    ) -> List[ModelType]:
        """
        List all records (no pagination).

        Args:
            db: Database session
            order_by: Column name to order by
            order_desc: If True, order descending
            **kwargs: Column filters

        Returns:
            List of all matching model instances
        """
        return self.list(db, skip=0, limit=10000, order_by=order_by, order_desc=order_desc, **kwargs)

    def create(self, db: Session, data: CreateSchemaType) -> ModelType:
        """
        Create a new record.

        Args:
            db: Database session
            data: Pydantic schema with create data

        Returns:
            The created model instance
        """
        # Convert pydantic model to dict, excluding unset values
        obj_data = data.model_dump(exclude_unset=True) if hasattr(data, 'model_dump') else data.dict(exclude_unset=True)
        db_obj = self.model(**obj_data)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(
        self,
        db: Session,
        id: int,
        data: UpdateSchemaType,
        partial: bool = True
    ) -> ModelType:
        """
        Update an existing record.

        Args:
            db: Database session
            id: Record ID
            data: Pydantic schema with update data
            partial: If True, only update provided fields

        Returns:
            The updated model instance

        Raises:
            HTTPException: If record not found (404)
        """
        db_obj = self.get(db, id)

        # Convert to dict, optionally excluding unset values for partial updates
        if partial:
            update_data = data.model_dump(exclude_unset=True) if hasattr(data, 'model_dump') else data.dict(exclude_unset=True)
        else:
            update_data = data.model_dump() if hasattr(data, 'model_dump') else data.dict()

        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)

        db.commit()
        db.refresh(db_obj)
        return db_obj

    def delete(self, db: Session, id: int) -> bool:
        """
        Delete a record by ID.

        Args:
            db: Database session
            id: Record ID

        Returns:
            True if deleted successfully

        Raises:
            HTTPException: If record not found (404)
        """
        db_obj = self.get(db, id)
        db.delete(db_obj)
        db.commit()
        return True

    def count(self, db: Session, **kwargs) -> int:
        """
        Count records matching the given filters.

        Args:
            db: Database session
            **kwargs: Column filters

        Returns:
            Count of matching records
        """
        query = db.query(self.model)
        for key, value in kwargs.items():
            if hasattr(self.model, key) and value is not None:
                query = query.filter(getattr(self.model, key) == value)
        return query.count()

    def exists(self, db: Session, id: int) -> bool:
        """
        Check if a record exists.

        Args:
            db: Database session
            id: Record ID

        Returns:
            True if exists, False otherwise
        """
        return db.query(self.model).filter(self.model.id == id).first() is not None

    def get_by_field(
        self,
        db: Session,
        field_name: str,
        value: Any,
        raise_not_found: bool = True
    ) -> Optional[ModelType]:
        """
        Get a record by a specific field value.

        Args:
            db: Database session
            field_name: Column name to filter by
            value: Value to match
            raise_not_found: If True, raise 404 if not found

        Returns:
            The model instance or None

        Raises:
            HTTPException: If raise_not_found is True and record not found
        """
        if not hasattr(self.model, field_name):
            raise ValueError(f"Model {self.model.__name__} has no field {field_name}")

        item = db.query(self.model).filter(getattr(self.model, field_name) == value).first()

        if not item and raise_not_found:
            model_name = self.model.__name__
            raise HTTPException(status_code=404, detail=f"{model_name} not found")

        return item

    def bulk_create(self, db: Session, data_list: List[CreateSchemaType]) -> List[ModelType]:
        """
        Create multiple records at once.

        Args:
            db: Database session
            data_list: List of Pydantic schemas with create data

        Returns:
            List of created model instances
        """
        db_objects = []
        for data in data_list:
            obj_data = data.model_dump(exclude_unset=True) if hasattr(data, 'model_dump') else data.dict(exclude_unset=True)
            db_obj = self.model(**obj_data)
            db.add(db_obj)
            db_objects.append(db_obj)

        db.commit()
        for obj in db_objects:
            db.refresh(obj)

        return db_objects


class SoftDeleteService(BaseService[ModelType, CreateSchemaType, UpdateSchemaType]):
    """
    Base service for models with soft delete (is_active field).

    Override list methods to filter by is_active by default.
    """

    def list(
        self,
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        include_inactive: bool = False,
        order_by: Optional[str] = None,
        order_desc: bool = False,
        **kwargs
    ) -> List[ModelType]:
        """List records, filtering inactive by default."""
        query = db.query(self.model)

        # Filter by is_active unless explicitly including inactive
        if not include_inactive and hasattr(self.model, 'is_active'):
            query = query.filter(self.model.is_active == True)

        # Apply kwargs filters
        for key, value in kwargs.items():
            if hasattr(self.model, key) and value is not None:
                query = query.filter(getattr(self.model, key) == value)

        # Apply ordering
        if order_by and hasattr(self.model, order_by):
            column = getattr(self.model, order_by)
            query = query.order_by(desc(column) if order_desc else asc(column))

        return query.offset(skip).limit(limit).all()

    def soft_delete(self, db: Session, id: int) -> ModelType:
        """
        Soft delete a record by setting is_active to False.

        Args:
            db: Database session
            id: Record ID

        Returns:
            The updated model instance
        """
        db_obj = self.get(db, id)
        if hasattr(db_obj, 'is_active'):
            db_obj.is_active = False
            db.commit()
            db.refresh(db_obj)
        return db_obj

    def restore(self, db: Session, id: int) -> ModelType:
        """
        Restore a soft-deleted record.

        Args:
            db: Database session
            id: Record ID

        Returns:
            The updated model instance
        """
        db_obj = self.get(db, id)
        if hasattr(db_obj, 'is_active'):
            db_obj.is_active = True
            db.commit()
            db.refresh(db_obj)
        return db_obj
