"""Feature Guard Decorator

Provides a decorator for protecting API endpoints based on feature flags.
"""
from functools import wraps
from typing import Callable, Any

from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.feature_flags_service import is_feature_enabled


class FeatureDisabledError(HTTPException):
    """Exception raised when a feature is disabled."""

    def __init__(self, feature_key: str):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This feature is currently disabled: {feature_key}",
        )


def require_feature(feature_key: str) -> Callable:
    """
    Dependency that checks if a feature is enabled.

    Usage:
        @router.get("/some-endpoint")
        def some_endpoint(
            db: Session = Depends(get_db),
            _: None = Depends(require_feature("feature_key")),
        ):
            ...

    Args:
        feature_key: The feature flag key to check

    Returns:
        A dependency function that raises FeatureDisabledError if the feature is disabled
    """
    def dependency(db: Session = Depends(get_db)) -> None:
        if not is_feature_enabled(db, feature_key):
            raise FeatureDisabledError(feature_key)
        return None

    return dependency


def feature_guard(feature_key: str):
    """
    Decorator that checks if a feature is enabled before executing the endpoint.

    Note: This decorator approach requires the decorated function to have a 'db' parameter.
    For most cases, prefer using the require_feature dependency instead.

    Usage:
        @router.get("/some-endpoint")
        @feature_guard("feature_key")
        def some_endpoint(db: Session = Depends(get_db)):
            ...

    Args:
        feature_key: The feature flag key to check

    Returns:
        Decorator function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def async_wrapper(*args: Any, **kwargs: Any) -> Any:
            db = kwargs.get('db')
            if db and not is_feature_enabled(db, feature_key):
                raise FeatureDisabledError(feature_key)
            return await func(*args, **kwargs)

        @wraps(func)
        def sync_wrapper(*args: Any, **kwargs: Any) -> Any:
            db = kwargs.get('db')
            if db and not is_feature_enabled(db, feature_key):
                raise FeatureDisabledError(feature_key)
            return func(*args, **kwargs)

        # Return appropriate wrapper based on whether function is async
        import asyncio
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator
