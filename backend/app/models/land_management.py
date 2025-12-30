import enum
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Date, Text, Numeric, JSON, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from app.database import Base, EnumColumn


# ============================================================================
# Grant & Scheme Enums
# ============================================================================

class GrantSchemeType(str, enum.Enum):
    COUNTRYSIDE_STEWARDSHIP_MID = "countryside_stewardship_mid"
    COUNTRYSIDE_STEWARDSHIP_HIGHER = "countryside_stewardship_higher"
    HEDGEROW_BOUNDARY = "hedgerow_boundary"
    WOODLAND_PLANTING = "woodland_planting"
    TREE_HEALTH = "tree_health"
    ENVIRONMENTAL_LAND_MANAGEMENT = "environmental_land_management"
    SFI = "sfi"  # Sustainable Farming Incentive
    OTHER = "other"


class GrantStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    COMPLETED = "completed"
    WITHDRAWN = "withdrawn"


class GrantPaymentStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    RECEIVED = "received"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


# ============================================================================
# Land Feature Enums
# ============================================================================

class LandFeatureType(str, enum.Enum):
    HEDGEROW = "hedgerow"
    TREE = "tree"
    TREE_GROUP = "tree_group"
    POND = "pond"
    WATERCOURSE = "watercourse"
    BOUNDARY_FENCE = "boundary_fence"
    ELECTRIC_FENCE = "electric_fence"
    POST_AND_RAIL = "post_and_rail"
    WATER_TROUGH = "water_trough"
    GATE = "gate"
    OTHER = "other"


class FeatureCondition(str, enum.Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    CRITICAL = "critical"


class WaterSourceType(str, enum.Enum):
    MAINS_FEED = "mains_feed"
    NATURAL_SPRING = "natural_spring"
    MANUAL_FILL = "manual_fill"
    RAINWATER = "rainwater"


class MaintenanceType(str, enum.Enum):
    CUTTING = "cutting"
    TRIMMING = "trimming"
    REPAIR = "repair"
    REPLACEMENT = "replacement"
    INSPECTION = "inspection"
    FILL = "fill"
    VOLTAGE_CHECK = "voltage_check"
    CLEANING = "cleaning"
    TREATMENT = "treatment"
    OTHER = "other"


# ============================================================================
# Flood Monitoring Enums
# ============================================================================

class FloodRiskLevel(str, enum.Enum):
    VERY_LOW = "very_low"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    SEVERE = "severe"


# ============================================================================
# Analytics Enums
# ============================================================================

class SuggestionType(str, enum.Enum):
    REST_FIELD = "rest_field"
    ROTATE_HORSES = "rotate_horses"
    REDUCE_USAGE = "reduce_usage"
    CONDITION_CHECK = "condition_check"


class SuggestionPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


# ============================================================================
# Grant Models
# ============================================================================

class Grant(Base):
    """Track government grants and environmental schemes."""
    __tablename__ = "grants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    scheme_type = EnumColumn(GrantSchemeType, nullable=False)
    status = EnumColumn(GrantStatus, default=GrantStatus.DRAFT)
    reference_number = Column(String(100), nullable=True, unique=True)

    # Key dates
    application_date = Column(Date, nullable=True)
    submission_deadline = Column(Date, nullable=True)
    decision_date = Column(Date, nullable=True)
    agreement_start_date = Column(Date, nullable=True)
    agreement_end_date = Column(Date, nullable=True)

    # Financial
    total_value = Column(Numeric(10, 2), nullable=True)
    annual_payment = Column(Numeric(10, 2), nullable=True)
    scheme_provider = Column(String(200), nullable=True)  # e.g., "Rural Payments Agency"

    # Compliance
    next_inspection_date = Column(Date, nullable=True)
    inspection_notes = Column(Text, nullable=True)
    compliance_requirements = Column(JSON, nullable=True)  # List of requirements

    # Documents and notes
    documents = Column(JSON, nullable=True)  # List of document references
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payment_schedules = relationship("GrantPaymentSchedule", back_populates="grant", cascade="all, delete-orphan")
    field_links = relationship("GrantFieldLink", back_populates="grant", cascade="all, delete-orphan")
    feature_links = relationship("GrantFeatureLink", back_populates="grant", cascade="all, delete-orphan")


class GrantPaymentSchedule(Base):
    """Track expected and received grant payments."""
    __tablename__ = "grant_payment_schedules"

    id = Column(Integer, primary_key=True, index=True)
    grant_id = Column(Integer, ForeignKey("grants.id", ondelete="CASCADE"), nullable=False)

    due_date = Column(Date, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    status = EnumColumn(GrantPaymentStatus, default=GrantPaymentStatus.SCHEDULED)

    received_date = Column(Date, nullable=True)
    reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    grant = relationship("Grant", back_populates="payment_schedules")


class GrantFieldLink(Base):
    """Link grants to fields they cover."""
    __tablename__ = "grant_field_links"

    id = Column(Integer, primary_key=True, index=True)
    grant_id = Column(Integer, ForeignKey("grants.id", ondelete="CASCADE"), nullable=False)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    grant = relationship("Grant", back_populates="field_links")
    field = relationship("Field")

    __table_args__ = (
        UniqueConstraint('grant_id', 'field_id', name='unique_grant_field'),
    )


class GrantFeatureLink(Base):
    """Link grants to land features they cover."""
    __tablename__ = "grant_feature_links"

    id = Column(Integer, primary_key=True, index=True)
    grant_id = Column(Integer, ForeignKey("grants.id", ondelete="CASCADE"), nullable=False)
    feature_id = Column(Integer, ForeignKey("land_features.id", ondelete="CASCADE"), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    grant = relationship("Grant", back_populates="feature_links")
    feature = relationship("LandFeature", back_populates="grant_links")

    __table_args__ = (
        UniqueConstraint('grant_id', 'feature_id', name='unique_grant_feature'),
    )


# ============================================================================
# Land Feature Models
# ============================================================================

class LandFeature(Base):
    """Track hedgerows, trees, fences, water troughs, and other land features."""
    __tablename__ = "land_features"

    id = Column(Integer, primary_key=True, index=True)
    feature_type = EnumColumn(LandFeatureType, nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Location
    field_id = Column(Integer, ForeignKey("fields.id"), nullable=True)  # Nullable for features not in specific field
    location_description = Column(Text, nullable=True)

    # Dimensions
    length_meters = Column(Float, nullable=True)
    area_sqm = Column(Float, nullable=True)

    # Condition tracking
    current_condition = EnumColumn(FeatureCondition, default=FeatureCondition.GOOD)
    last_inspection_date = Column(Date, nullable=True)

    # Maintenance scheduling
    maintenance_frequency_days = Column(Integer, nullable=True)  # How often maintenance needed
    last_maintenance_date = Column(Date, nullable=True)
    next_maintenance_due = Column(Date, nullable=True)

    # Tree-specific fields
    tpo_protected = Column(Boolean, default=False)  # Tree Preservation Order
    tpo_reference = Column(String(100), nullable=True)
    tree_species = Column(String(100), nullable=True)

    # Hedgerow-specific fields
    hedgerow_species_mix = Column(String(500), nullable=True)

    # Fence-specific fields
    fence_type = Column(String(100), nullable=True)
    fence_height_cm = Column(Integer, nullable=True)

    # Water trough-specific fields
    water_source_type = EnumColumn(WaterSourceType, nullable=True)
    fill_frequency_days = Column(Integer, nullable=True)  # For manual fill troughs
    last_fill_date = Column(Date, nullable=True)

    # Electric fence-specific fields
    electric_fence_voltage_check_date = Column(Date, nullable=True)
    electric_fence_working = Column(Boolean, default=True)
    electric_fence_voltage = Column(Float, nullable=True)  # Last recorded voltage

    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    field = relationship("Field")
    maintenance_logs = relationship("FeatureMaintenanceLog", back_populates="feature", cascade="all, delete-orphan")
    grant_links = relationship("GrantFeatureLink", back_populates="feature", cascade="all, delete-orphan")


class FeatureMaintenanceLog(Base):
    """Log maintenance activities on land features."""
    __tablename__ = "feature_maintenance_logs"

    id = Column(Integer, primary_key=True, index=True)
    feature_id = Column(Integer, ForeignKey("land_features.id", ondelete="CASCADE"), nullable=False)

    maintenance_date = Column(Date, nullable=False)
    maintenance_type = EnumColumn(MaintenanceType, nullable=False)
    description = Column(Text, nullable=True)

    condition_before = EnumColumn(FeatureCondition, nullable=True)
    condition_after = EnumColumn(FeatureCondition, nullable=True)

    performed_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    contractor_name = Column(String(200), nullable=True)  # If external contractor

    cost = Column(Numeric(10, 2), nullable=True)
    photos = Column(JSON, nullable=True)  # List of photo URLs
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    feature = relationship("LandFeature", back_populates="maintenance_logs")
    performed_by = relationship("User")


# ============================================================================
# Flood Monitoring Models
# ============================================================================

class FloodMonitoringStation(Base):
    """Environment Agency monitoring stations to track for flood warnings."""
    __tablename__ = "flood_monitoring_stations"

    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(String(100), nullable=False, unique=True)  # Environment Agency station ID
    station_name = Column(String(200), nullable=False)
    river_name = Column(String(200), nullable=True)

    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Warning thresholds (can override defaults)
    warning_threshold_meters = Column(Float, nullable=True)
    severe_threshold_meters = Column(Float, nullable=True)

    # Caching
    last_reading = Column(Float, nullable=True)  # Latest water level in meters
    last_reading_time = Column(DateTime, nullable=True)
    last_fetched = Column(DateTime, nullable=True)

    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    field_flood_risks = relationship("FieldFloodRisk", back_populates="monitoring_station", cascade="all, delete-orphan")


class FieldFloodRisk(Base):
    """Link fields to flood monitoring stations with risk assessment."""
    __tablename__ = "field_flood_risks"

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    monitoring_station_id = Column(Integer, ForeignKey("flood_monitoring_stations.id", ondelete="CASCADE"), nullable=False)

    distance_km = Column(Float, nullable=True)  # Distance from station to field
    risk_level_override = EnumColumn(FloodRiskLevel, nullable=True)  # Manual override

    flood_history = Column(JSON, nullable=True)  # List of past flood events
    evacuation_notes = Column(Text, nullable=True)  # Instructions for moving horses

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    field = relationship("Field")
    monitoring_station = relationship("FloodMonitoringStation", back_populates="field_flood_risks")

    __table_args__ = (
        UniqueConstraint('field_id', 'monitoring_station_id', name='unique_field_station'),
    )


# ============================================================================
# Field Usage Analytics Models
# ============================================================================

class FieldUsageAnalytics(Base):
    """Pre-calculated field usage metrics by month."""
    __tablename__ = "field_usage_analytics"

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)  # 1-12

    # Usage metrics
    total_days_used = Column(Integer, default=0)
    total_horse_days = Column(Integer, default=0)  # Sum of horses across all days
    average_horses_per_day = Column(Float, nullable=True)

    # Utilization
    usage_percentage = Column(Float, nullable=True)  # Days used / days in month

    # Condition tracking
    condition_at_start = EnumColumn(FeatureCondition, nullable=True)
    condition_at_end = EnumColumn(FeatureCondition, nullable=True)
    condition_trend = Column(String(20), nullable=True)  # 'improving', 'stable', 'declining'

    rest_days_taken = Column(Integer, default=0)

    calculated_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    field = relationship("Field")

    __table_args__ = (
        UniqueConstraint('field_id', 'year', 'month', name='unique_field_analytics_period'),
    )


class FieldRotationSuggestion(Base):
    """AI/rule-based suggestions for field rotation."""
    __tablename__ = "field_rotation_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    field_id = Column(Integer, ForeignKey("fields.id", ondelete="CASCADE"), nullable=False)

    suggested_date = Column(Date, nullable=False)
    suggestion_type = EnumColumn(SuggestionType, nullable=False)
    priority = EnumColumn(SuggestionPriority, default=SuggestionPriority.MEDIUM)
    reason = Column(Text, nullable=False)

    acknowledged = Column(Boolean, default=False)
    acknowledged_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    field = relationship("Field")
    acknowledged_by = relationship("User")
