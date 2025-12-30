"""Feature Flags API Router

Endpoints for managing system capability toggles.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.utils.auth import get_current_user, require_admin
from app.models.user import User
from app.schemas.feature_flags import (
    FeatureFlagsResponse,
    FeatureFlagInfo,
    FeatureGroupInfo,
    FeatureFlagUpdate,
    BulkFeatureFlagUpdate,
    FeatureFlagValidationResult,
    EnabledFeaturesResponse,
)
from app.services.feature_flags_service import (
    get_feature_flags_with_info,
    update_feature_flag,
    bulk_update_feature_flags,
    get_enabled_features,
    is_feature_enabled,
)

router = APIRouter(prefix="/feature-flags", tags=["Feature Flags"])


@router.get("", response_model=FeatureFlagsResponse)
def get_all_feature_flags(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Get all feature flags with full metadata (admin only).

    Returns all features grouped by category with dependency information.
    """
    data = get_feature_flags_with_info(db)

    # Convert to response model
    flags = {}
    for key, flag_data in data["flags"].items():
        flags[key] = FeatureFlagInfo(**flag_data)

    groups = {}
    for key, group_data in data["groups"].items():
        groups[key] = FeatureGroupInfo(**group_data)

    return FeatureFlagsResponse(flags=flags, groups=groups)


@router.get("/enabled", response_model=EnabledFeaturesResponse)
def get_enabled_feature_list(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of enabled feature keys (authenticated users).

    Returns only the keys of features that are currently enabled.
    Used by frontend for navigation filtering and route protection.
    """
    features = get_enabled_features(db)
    return EnabledFeaturesResponse(features=features)


@router.get("/check/{feature_key}")
def check_feature_enabled(
    feature_key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check if a specific feature is enabled (authenticated users).

    Returns {"enabled": true/false} for the specified feature.
    """
    enabled = is_feature_enabled(db, feature_key)
    return {"feature": feature_key, "enabled": enabled}


@router.put("/{feature_key}", response_model=FeatureFlagValidationResult)
def update_single_feature_flag(
    feature_key: str,
    update: FeatureFlagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Update a single feature flag (admin only).

    Validates dependencies before updating:
    - Cannot enable a feature if its dependencies are disabled
    - Disabling a feature will cascade-disable its dependents

    Returns validation result with any warnings about cascaded changes.
    """
    success, errors, warnings = update_feature_flag(
        db, feature_key, update.enabled, cascade=True
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0] if errors else "Failed to update feature flag",
        )

    updated_features = [feature_key]
    # If there were warnings about cascade, those features were also updated
    for warning in warnings:
        if "will also disable" in warning:
            # Extract feature name from warning
            parts = warning.split("will also disable ")
            if len(parts) > 1:
                updated_features.append(parts[1])

    return FeatureFlagValidationResult(
        success=True,
        errors=[],
        warnings=warnings,
        updated_features=updated_features,
    )


@router.put("", response_model=FeatureFlagValidationResult)
def bulk_update_feature_flags_endpoint(
    update: BulkFeatureFlagUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Update multiple feature flags at once (admin only).

    Validates all dependencies before applying any updates.
    If any update fails validation, no changes are made.

    Returns validation result with any warnings about cascaded changes.
    """
    success, errors, warnings = bulk_update_feature_flags(
        db, update.updates, cascade=True
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(errors),
        )

    return FeatureFlagValidationResult(
        success=True,
        errors=[],
        warnings=warnings,
        updated_features=list(update.updates.keys()),
    )
