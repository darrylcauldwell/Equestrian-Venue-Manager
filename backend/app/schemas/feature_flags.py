"""Feature Flags Schemas

Pydantic models for feature flag API requests and responses.
"""
from typing import Dict, List, Optional
from pydantic import BaseModel


class FeatureFlagInfo(BaseModel):
    """Information about a single feature flag."""
    enabled: bool
    group: str
    locked: bool = False
    label: Optional[str] = None
    description: Optional[str] = None
    dependencies: List[str] = []
    dependents: List[str] = []


class FeatureGroupInfo(BaseModel):
    """Information about a feature group."""
    label: str
    description: str
    features: List[str]


class FeatureFlagsResponse(BaseModel):
    """Response containing all feature flags with metadata."""
    flags: Dict[str, FeatureFlagInfo]
    groups: Dict[str, FeatureGroupInfo]


class FeatureFlagUpdate(BaseModel):
    """Request to update a single feature flag."""
    enabled: bool


class BulkFeatureFlagUpdate(BaseModel):
    """Request to update multiple feature flags at once."""
    updates: Dict[str, bool]  # feature_key -> enabled


class FeatureFlagValidationResult(BaseModel):
    """Result of a feature flag update with validation info."""
    success: bool
    errors: List[str] = []
    warnings: List[str] = []
    updated_features: List[str] = []  # Features that were updated (including cascade)


class EnabledFeaturesResponse(BaseModel):
    """Response containing list of enabled feature keys."""
    features: List[str]
