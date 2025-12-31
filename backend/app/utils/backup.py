"""Backup and restore utilities for database export/import."""
import json
import os
from datetime import datetime, date, timedelta, time as time_obj
from decimal import Decimal
from typing import Dict, Any, List, Tuple, Optional, Callable
from sqlalchemy.orm import Session
from sqlalchemy import text, inspect as sa_inspect
from enum import Enum


class SeedingError(Exception):
    """Raised when database seeding fails. All changes are rolled back."""
    pass

from app.models import (
    User, UserRole, Arena, Horse, Booking, BookingType, PaymentStatus, SiteSettings,
    Service, ServiceRequest, ServiceCategory, Notice, NoticeCategory, NoticePriority, Professional, ProfessionalCategory,
    YardTask, TaskComment, Shift, Timesheet, HolidayRequest, UnplannedAbsence,
    ClinicRequest, ClinicParticipant, Discipline, ClinicStatus, LiveryPackage, Stable, StableBlock,
    FarrierRecord, DentistRecord, VaccinationRecord, WormingRecord, WeightRecord, BodyConditionRecord, SaddleFitRecord,
    FeedRequirement, FeedAddition, FeedSupplyAlert, SupplyStatus,
    TurnoutRequest, LedgerEntry,
    EmergencyContact, ContactType,
    Field, FieldCondition, HorseCompanion, CompanionRelationship,
)
from app.models.health_record import VaccineType
from app.models.feed import FeedTime, AdditionStatus
from app.models.medication_log import (
    MedicationAdminLog, WoundCareLog, HealingStatus,
    HealthObservation, AppetiteStatus, DemeanorStatus,
    RehabProgram, RehabPhase, RehabTask, RehabTaskLog, RehabStatus, TaskFrequency
)
from app.models.invoice import Invoice, InvoiceLineItem, InvoiceStatus
from app.models.staff_management import ShiftType, ShiftRole
from app.models.field import TurnoutGroup, TurnoutGroupHorse, FieldUsageLog, FieldUsageHorse
from app.models.staff_management import LeaveType, LeaveStatus
from app.models.task import TaskCategory, TaskPriority, TaskStatus, AssignmentType
from app.models.turnout import TurnoutStatus, TurnoutType
from app.models.compliance import ComplianceItem, ComplianceHistory
from app.models.coach import CoachProfile, CoachRecurringSchedule, CoachAvailabilitySlot, LessonRequest, AvailabilityMode, BookingMode, LessonRequestStatus
from app.models.holiday_livery import HolidayLiveryRequest, HolidayLiveryStatus
from app.models.booking import PaymentStatus, BookingStatus
from app.models.contract import ContractTemplate, ContractVersion, ContractSignature, ContractType, SignatureStatus
from app.models.land_management import (
    FloodMonitoringStation,
    LandFeature,
    LandFeatureType,
    FeatureCondition,
    WaterSourceType,
    Grant,
    GrantSchemeType,
    GrantStatus,
)
from app.models.staff_profile import StaffProfile
from app.models.risk_assessment import RiskAssessment, RiskAssessmentCategory, RiskAssessmentReview, RiskAssessmentAcknowledgement, ReviewTrigger
from app.utils.auth import get_password_hash
from app.utils.seed_validator import validate_seed_data, SeedValidationError


BACKUP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "backups")


def ensure_backup_dir():
    """Ensure the backups directory exists."""
    if not os.path.exists(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)


def serialize_datetime(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


def model_to_dict(obj, exclude: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Convert any SQLAlchemy model to a dictionary using introspection.

    This automatically handles:
    - All column attributes
    - Enum values (converts to string)
    - Datetime/date objects (converts to ISO format)
    - Decimal values (converts to float)
    - None values (preserved)

    Args:
        obj: SQLAlchemy model instance
        exclude: List of column names to exclude (e.g., ['password_hash'])

    Returns:
        Dictionary with all column values, suitable for JSON serialization
    """
    if exclude is None:
        exclude = []

    result = {}
    mapper = sa_inspect(obj.__class__)

    for column in mapper.columns:
        key = column.key
        if key in exclude:
            continue

        value = getattr(obj, key)

        # Handle various types
        if value is None:
            result[key] = None
        elif isinstance(value, Enum):
            result[key] = value.value
        elif isinstance(value, datetime):
            result[key] = value.isoformat()
        elif isinstance(value, date):
            result[key] = value.isoformat()
        elif isinstance(value, time_obj):
            result[key] = value.isoformat()
        elif isinstance(value, Decimal):
            result[key] = float(value)
        elif isinstance(value, bytes):
            result[key] = value.decode('utf-8', errors='replace')
        else:
            result[key] = value

    return result


def export_models(db: Session, model_class, exclude: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """
    Export all instances of a model using introspection.

    Args:
        db: SQLAlchemy session
        model_class: The SQLAlchemy model class to export
        exclude: List of column names to exclude from each record

    Returns:
        List of dictionaries representing all records
    """
    records = db.query(model_class).all()
    return [model_to_dict(record, exclude=exclude) for record in records]


def export_database(db: Session) -> Tuple[Dict[str, Any], Dict[str, int]]:
    """
    Export all database tables to a dictionary using model introspection.
    This automatically captures all fields from each model, so no manual
    field listing is required. When models change, backup automatically adapts.

    Returns (data_dict, entity_counts).
    """
    entity_counts = {}
    data = {}

    # Site Settings (single record)
    settings = db.query(SiteSettings).first()
    if settings:
        data["site_settings"] = model_to_dict(settings)
        entity_counts["site_settings"] = 1

    # Users (excluding password hashes for security - will need to reset on restore)
    data["users"] = export_models(db, User, exclude=["password_hash"])
    entity_counts["users"] = len(data["users"])

    # Staff Profiles
    data["staff_profiles"] = export_models(db, StaffProfile)
    entity_counts["staff_profiles"] = len(data["staff_profiles"])

    # Livery Packages
    data["livery_packages"] = export_models(db, LiveryPackage)
    entity_counts["livery_packages"] = len(data["livery_packages"])

    # Stable Blocks
    data["stable_blocks"] = export_models(db, StableBlock)
    entity_counts["stable_blocks"] = len(data["stable_blocks"])

    # Stables
    data["stables"] = export_models(db, Stable)
    entity_counts["stables"] = len(data["stables"])

    # Arenas
    data["arenas"] = export_models(db, Arena)
    entity_counts["arenas"] = len(data["arenas"])

    # Horses
    data["horses"] = export_models(db, Horse)
    entity_counts["horses"] = len(data["horses"])

    # Services
    data["services"] = export_models(db, Service)
    entity_counts["services"] = len(data["services"])

    # Professionals
    data["professionals"] = export_models(db, Professional)
    entity_counts["professionals"] = len(data["professionals"])

    # Compliance Items
    data["compliance_items"] = export_models(db, ComplianceItem)
    entity_counts["compliance_items"] = len(data["compliance_items"])

    # Notices
    data["notices"] = export_models(db, Notice)
    entity_counts["notices"] = len(data["notices"])

    # Bookings
    data["bookings"] = export_models(db, Booking)
    entity_counts["bookings"] = len(data["bookings"])

    # Emergency Contacts
    data["emergency_contacts"] = export_models(db, EmergencyContact)
    entity_counts["emergency_contacts"] = len(data["emergency_contacts"])

    # Fields
    data["fields"] = export_models(db, Field)
    entity_counts["fields"] = len(data["fields"])

    # Feed Requirements
    data["feed_requirements"] = export_models(db, FeedRequirement)
    entity_counts["feed_requirements"] = len(data["feed_requirements"])

    # Feed Additions
    data["feed_additions"] = export_models(db, FeedAddition)
    entity_counts["feed_additions"] = len(data["feed_additions"])

    # Feed Supply Alerts
    data["feed_supply_alerts"] = export_models(db, FeedSupplyAlert)
    entity_counts["feed_supply_alerts"] = len(data["feed_supply_alerts"])

    # Service Requests
    data["service_requests"] = export_models(db, ServiceRequest)
    entity_counts["service_requests"] = len(data["service_requests"])

    # Yard Tasks
    data["yard_tasks"] = export_models(db, YardTask)
    entity_counts["yard_tasks"] = len(data["yard_tasks"])

    # Clinic Requests
    data["clinic_requests"] = export_models(db, ClinicRequest)
    entity_counts["clinic_requests"] = len(data["clinic_requests"])

    # Clinic Participants
    data["clinic_participants"] = export_models(db, ClinicParticipant)
    entity_counts["clinic_participants"] = len(data["clinic_participants"])

    # Turnout Requests
    data["turnout_requests"] = export_models(db, TurnoutRequest)
    entity_counts["turnout_requests"] = len(data["turnout_requests"])

    # Ledger Entries
    data["ledger_entries"] = export_models(db, LedgerEntry)
    entity_counts["ledger_entries"] = len(data["ledger_entries"])

    # Coach Profiles
    data["coach_profiles"] = export_models(db, CoachProfile)
    entity_counts["coach_profiles"] = len(data["coach_profiles"])

    # Lesson Requests
    data["lesson_requests"] = export_models(db, LessonRequest)
    entity_counts["lesson_requests"] = len(data["lesson_requests"])

    # Holiday Livery Requests
    data["holiday_livery_requests"] = export_models(db, HolidayLiveryRequest)
    entity_counts["holiday_livery_requests"] = len(data["holiday_livery_requests"])

    # Shifts
    data["shifts"] = export_models(db, Shift)
    entity_counts["shifts"] = len(data["shifts"])

    # Timesheets
    data["timesheets"] = export_models(db, Timesheet)
    entity_counts["timesheets"] = len(data["timesheets"])

    # Holiday Requests
    data["holiday_requests"] = export_models(db, HolidayRequest)
    entity_counts["holiday_requests"] = len(data["holiday_requests"])

    # Unplanned Absences
    data["unplanned_absences"] = export_models(db, UnplannedAbsence)
    entity_counts["unplanned_absences"] = len(data["unplanned_absences"])

    # Invoices
    data["invoices"] = export_models(db, Invoice)
    entity_counts["invoices"] = len(data["invoices"])

    # Invoice Line Items
    data["invoice_line_items"] = export_models(db, InvoiceLineItem)
    entity_counts["invoice_line_items"] = len(data["invoice_line_items"])

    # Contract Templates
    data["contract_templates"] = export_models(db, ContractTemplate)
    entity_counts["contract_templates"] = len(data["contract_templates"])

    # Contract Versions
    data["contract_versions"] = export_models(db, ContractVersion)
    entity_counts["contract_versions"] = len(data["contract_versions"])

    # Contract Signatures
    data["contract_signatures"] = export_models(db, ContractSignature)
    entity_counts["contract_signatures"] = len(data["contract_signatures"])

    # Health Records
    data["farrier_records"] = export_models(db, FarrierRecord)
    entity_counts["farrier_records"] = len(data["farrier_records"])

    data["dentist_records"] = export_models(db, DentistRecord)
    entity_counts["dentist_records"] = len(data["dentist_records"])

    data["vaccination_records"] = export_models(db, VaccinationRecord)
    entity_counts["vaccination_records"] = len(data["vaccination_records"])

    data["worming_records"] = export_models(db, WormingRecord)
    entity_counts["worming_records"] = len(data["worming_records"])

    data["weight_records"] = export_models(db, WeightRecord)
    entity_counts["weight_records"] = len(data["weight_records"])

    data["body_condition_records"] = export_models(db, BodyConditionRecord)
    entity_counts["body_condition_records"] = len(data["body_condition_records"])

    data["saddle_fit_records"] = export_models(db, SaddleFitRecord)
    entity_counts["saddle_fit_records"] = len(data["saddle_fit_records"])

    # Rehab Programs and Tasks
    data["rehab_programs"] = export_models(db, RehabProgram)
    entity_counts["rehab_programs"] = len(data["rehab_programs"])

    data["rehab_tasks"] = export_models(db, RehabTask)
    entity_counts["rehab_tasks"] = len(data["rehab_tasks"])

    data["rehab_task_logs"] = export_models(db, RehabTaskLog)
    entity_counts["rehab_task_logs"] = len(data["rehab_task_logs"])

    # Health Observations
    data["health_observations"] = export_models(db, HealthObservation)
    entity_counts["health_observations"] = len(data["health_observations"])

    # Medication Logs
    data["medication_admin_logs"] = export_models(db, MedicationAdminLog)
    entity_counts["medication_admin_logs"] = len(data["medication_admin_logs"])

    data["wound_care_logs"] = export_models(db, WoundCareLog)
    entity_counts["wound_care_logs"] = len(data["wound_care_logs"])

    # Turnout Groups
    data["turnout_groups"] = export_models(db, TurnoutGroup)
    entity_counts["turnout_groups"] = len(data["turnout_groups"])

    data["turnout_group_horses"] = export_models(db, TurnoutGroupHorse)
    entity_counts["turnout_group_horses"] = len(data["turnout_group_horses"])

    # Compliance History
    data["compliance_history"] = export_models(db, ComplianceHistory)
    entity_counts["compliance_history"] = len(data["compliance_history"])

    # Flood Monitoring Stations
    data["flood_monitoring_stations"] = export_models(db, FloodMonitoringStation)
    entity_counts["flood_monitoring_stations"] = len(data["flood_monitoring_stations"])

    # Land Features (water troughs, hedgerows, trees, etc.)
    data["land_features"] = export_models(db, LandFeature)
    entity_counts["land_features"] = len(data["land_features"])

    # Grants and Environmental Schemes
    data["grants"] = export_models(db, Grant)
    entity_counts["grants"] = len(data["grants"])

    return data, entity_counts


def save_backup_file(data: Dict[str, Any], filename: str) -> str:
    """Save backup data to a JSON file. Returns the full filepath."""
    ensure_backup_dir()
    filepath = os.path.join(BACKUP_DIR, filename)
    with open(filepath, 'w') as f:
        json.dump(data, f, indent=2, default=serialize_datetime)
    return filepath


def get_backup_file_size(filename: str) -> int:
    """Get the size of a backup file in bytes."""
    filepath = os.path.join(BACKUP_DIR, filename)
    if os.path.exists(filepath):
        return os.path.getsize(filepath)
    return 0


def list_backup_files() -> List[Dict[str, Any]]:
    """List all backup files in the backup directory."""
    ensure_backup_dir()
    files = []
    for filename in os.listdir(BACKUP_DIR):
        if filename.endswith('.json'):
            filepath = os.path.join(BACKUP_DIR, filename)
            files.append({
                "filename": filename,
                "size": os.path.getsize(filepath),
                "modified": datetime.fromtimestamp(os.path.getmtime(filepath)),
            })
    return sorted(files, key=lambda x: x["modified"], reverse=True)


def load_backup_file(filename: str) -> Dict[str, Any]:
    """Load backup data from a JSON file."""
    filepath = os.path.join(BACKUP_DIR, filename)
    with open(filepath, 'r') as f:
        return json.load(f)


def validate_backup(data: Dict[str, Any]) -> Tuple[bool, List[str], List[str]]:
    """
    Validate backup data structure.
    Returns (is_valid, errors, warnings).
    """
    errors = []
    warnings = []

    required_keys = ["users", "arenas"]
    for key in required_keys:
        if key not in data:
            errors.append(f"Missing required key: {key}")

    if "site_settings" not in data:
        warnings.append("No site_settings found - defaults will be used")

    # Check user structure
    if "users" in data:
        for i, user in enumerate(data["users"]):
            if "email" not in user:
                errors.append(f"User at index {i} missing email")
            if "username" not in user:
                errors.append(f"User at index {i} missing username")

    is_valid = len(errors) == 0
    return is_valid, errors, warnings


def delete_backup_file(filename: str) -> bool:
    """Delete a backup file. Returns True if successful."""
    filepath = os.path.join(BACKUP_DIR, filename)
    if os.path.exists(filepath):
        os.remove(filepath)
        return True
    return False


def generate_backup_filename() -> str:
    """Generate a timestamped backup filename."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"backup_{timestamp}.json"


# =============================================================================
# UNIFIED IMPORT/RESTORE FUNCTION
# =============================================================================

def clear_database(db: Session, log: Callable[[str], None] = print, commit: bool = True):
    """Clear all data from the database (use with caution!).

    Args:
        db: SQLAlchemy database session
        log: Logging function
        commit: If True, commit immediately. If False, just flush (for transaction safety).
    """
    log("Clearing existing data...")

    tables_to_clear = [
        "lesson_requests", "coach_availability_slots", "coach_recurring_schedules", "coach_profiles",
        "clinic_registrations", "clinic_slots", "clinics",
        "compliance_history", "compliance_items",
        "ledger_entries", "notices",
        "feed_supply_alerts", "feed_additions", "feed_requirements",
        "farrier_records", "dentist_records", "vaccination_records", "worming_records",
        "service_requests", "turnout_requests",
        "bookings", "horses",
        "stables", "stable_blocks",
        "services", "professionals",
        "livery_packages", "site_settings",
        "backup_schedules", "backups",
        "users", "arenas",
        # Additional tables for medical/health data
        "medication_admin_logs", "wound_care_logs", "health_observations",
        "rehab_task_logs", "rehab_tasks", "rehab_phases", "rehab_programs",
        "field_usage_log_horses", "field_usage_logs", "turnout_group_horses", "turnout_groups",
        "horse_companions", "fields", "emergency_contacts",
        "holiday_requests", "timesheets", "shifts",
        "invoice_line_items", "invoices",
        "yard_tasks",
    ]

    for table in tables_to_clear:
        try:
            # Use savepoint so failed deletes don't abort the entire transaction
            savepoint = db.begin_nested()
            try:
                db.execute(text(f"DELETE FROM {table}"))
                savepoint.commit()
            except Exception as e:
                savepoint.rollback()
                # Table might not exist, that's OK
        except Exception:
            pass

    if commit:
        db.commit()
    else:
        db.flush()
    log("Data cleared.")


def import_database(
    db: Session,
    data: Dict[str, Any],
    clear_first: bool = False,
    validate: bool = True,
    log: Callable[[str], None] = print
) -> Dict[str, int]:
    """
    Import data into the database from backup or seed format.

    Supports both formats:
    - Backup format: Uses IDs for relationships, absolute dates
    - Seed format: Uses name references (owner_username), relative dates (days_from_now)

    All operations are performed in a single transaction. If any operation fails,
    the entire import is rolled back to prevent partial data.

    Args:
        db: SQLAlchemy database session
        data: The data to import (seed or backup format)
        clear_first: Whether to clear existing data before importing
        validate: Whether to validate seed data before importing (default: True)
        log: Logging function (default: print)

    Returns:
        dict of entity counts imported.

    Raises:
        SeedValidationError: If validation fails (when validate=True)
        SeedingError: If any part of the import fails. All changes are rolled back.
    """
    counts = {}

    # Validate seed data if requested
    if validate:
        log("Validating seed data...")
        validation_result = validate_seed_data(data)
        if not validation_result.is_valid:
            log(validation_result.get_report())
            raise SeedValidationError(validation_result)
        log("Validation passed.")
        if validation_result.warnings:
            for warning in validation_result.warnings:
                log(f"  Warning: {warning}")

    try:
        if clear_first:
            clear_database(db, log, commit=False)

        # Build lookup maps as we import
        user_map = {}  # username -> id
        user_id_map = {}  # old_id -> new_id (for backup format)
        arena_map = {}  # name -> id
        stable_map = {}  # name -> id
        package_map = {}  # name -> id

        # 1. Site Settings
        if "site_settings" in data:
            counts["site_settings"] = _import_site_settings(db, data["site_settings"], log)

        # 2. Users (needed for relationships)
        if "users" in data:
            user_map, user_id_map, counts["users"] = _import_users(db, data["users"], log)

        # 2b. Staff Profiles (depends on users)
        if "staff_profiles" in data:
            counts["staff_profiles"] = _import_staff_profiles(db, data["staff_profiles"], user_map, user_id_map, log)

        # 3. Livery Packages (before horses)
        if "livery_packages" in data:
            package_map, counts["livery_packages"] = _import_livery_packages(db, data["livery_packages"], log)

        # 4. Stable Blocks and Stables (before horses)
        if "stable_blocks" in data:
            stable_map, counts["stable_blocks"], counts["stables"] = _import_stable_blocks(db, data["stable_blocks"], log)

        # 5. Arenas
        if "arenas" in data:
            arena_map, counts["arenas"] = _import_arenas(db, data["arenas"], log)

        # 6. Horses
        if "horses" in data:
            counts["horses"] = _import_horses(db, data["horses"], user_map, stable_map, package_map, log)

        # 7. Services
        if "services" in data:
            counts["services"] = _import_services(db, data["services"], log)

        # 8. Professionals
        if "professionals" in data:
            counts["professionals"] = _import_professionals(db, data["professionals"], log)

        # 9. Compliance Items
        if "compliance_items" in data:
            counts["compliance_items"] = _import_compliance_items(db, data["compliance_items"], user_map, log)

        # 10. Feed Schedules
        if "feed_schedules" in data:
            counts["feed_schedules"] = _import_feed_schedules(db, data["feed_schedules"], user_map, log)

        # 11. Notices
        if "notices" in data:
            counts["notices"] = _import_notices(db, data["notices"], user_map, log)

        # 12. Bookings (uses relative dates in seed format)
        if "bookings" in data:
            counts["bookings"] = _import_bookings(db, data["bookings"], user_map, arena_map, log)

        # 13. Clinics (uses relative dates in seed format)
        if "clinics" in data:
            counts["clinics"] = _import_clinics(db, data["clinics"], user_map, log)

        # 14. Coach Profiles
        if "coach_profiles" in data:
            counts["coach_profiles"] = _import_coach_profiles(db, data["coach_profiles"], user_map, log)

        # 15. Lesson Requests (depends on coach_profiles, users, horses, arenas)
        if "lesson_requests" in data:
            counts["lesson_requests"] = _import_lesson_requests(db, data["lesson_requests"], user_map, arena_map, log)

        # 16. Yard Tasks
        if "yard_tasks" in data:
            counts["yard_tasks"] = _import_yard_tasks(db, data["yard_tasks"], user_map, log)

        # 17. Turnout Requests
        if "turnout_requests" in data:
            counts["turnout_requests"] = _import_turnout_requests(db, data["turnout_requests"], user_map, log)

        # 18. Service Requests
        if "service_requests" in data:
            counts["service_requests"] = _import_service_requests(db, data["service_requests"], user_map, log)

        # 19. Holiday Requests
        if "holiday_requests" in data:
            counts["holiday_requests"] = _import_holiday_requests(db, data["holiday_requests"], user_map, log)

        # 20. Unplanned Absences
        if "unplanned_absences" in data:
            counts["unplanned_absences"] = _import_unplanned_absences(db, data["unplanned_absences"], user_map, log)

        # 21. Timesheets
        if "timesheets" in data:
            counts["timesheets"] = _import_timesheets(db, data["timesheets"], user_map, log)

        # 22. Ledger Entries (account/billing data)
        if "ledger_entries" in data:
            counts["ledger_entries"] = _import_ledger_entries(db, data["ledger_entries"], user_map, log)

        # 23. Emergency Contacts
        if "emergency_contacts" in data:
            counts["emergency_contacts"] = _import_emergency_contacts(db, data["emergency_contacts"], user_map, log)

        # 24. Fields
        if "fields" in data:
            counts["fields"] = _import_fields(db, data["fields"], log)

        # 25. Horse Companions
        if "horse_companions" in data:
            counts["horse_companions"] = _import_horse_companions(db, data["horse_companions"], user_map, log)

        # 26. Health Records - Farrier
        if "farrier_records" in data:
            counts["farrier_records"] = _import_farrier_records(db, data["farrier_records"], user_map, log)

        # 27. Health Records - Dentist
        if "dentist_records" in data:
            counts["dentist_records"] = _import_dentist_records(db, data["dentist_records"], user_map, log)

        # 28. Health Records - Vaccinations
        if "vaccination_records" in data:
            counts["vaccination_records"] = _import_vaccination_records(db, data["vaccination_records"], user_map, log)

        # 29. Health Records - Worming
        if "worming_records" in data:
            counts["worming_records"] = _import_worming_records(db, data["worming_records"], user_map, log)

        # 29a. Health Records - Weight
        if "weight_records" in data:
            counts["weight_records"] = _import_weight_records(db, data["weight_records"], user_map, log)

        # 29b. Health Records - Body Condition
        if "body_condition_records" in data:
            counts["body_condition_records"] = _import_body_condition_records(db, data["body_condition_records"], user_map, log)

        # 29c. Health Records - Saddle Fit
        if "saddle_fit_records" in data:
            counts["saddle_fit_records"] = _import_saddle_fit_records(db, data["saddle_fit_records"], user_map, log)

        # 30. Feed Additions (medications/supplements)
        if "feed_additions" in data:
            counts["feed_additions"] = _import_feed_additions(db, data["feed_additions"], user_map, log)

        # 31. Wound Care Logs
        if "wound_care_logs" in data:
            counts["wound_care_logs"] = _import_wound_care_logs(db, data["wound_care_logs"], user_map, log)

        # 32. Health Observations
        if "health_observations" in data:
            counts["health_observations"] = _import_health_observations(db, data["health_observations"], user_map, log)

        # 33. Rehabilitation Programs (with phases and tasks)
        if "rehab_programs" in data:
            counts["rehab_programs"] = _import_rehab_programs(db, data["rehab_programs"], user_map, log)

        # 33b. Rehabilitation Task Logs
        if "rehab_task_logs" in data:
            counts["rehab_task_logs"] = _import_rehab_task_logs(db, data["rehab_task_logs"], user_map, log)

        # 34. Staff Shifts
        if "shifts" in data:
            counts["shifts"] = _import_shifts(db, data["shifts"], user_map, log)

        # 35. Invoices (with line items)
        if "invoices" in data:
            counts["invoices"] = _import_invoices(db, data["invoices"], user_map, log)

        # 36. Turnout Groups (daily field assignments)
        if "turnout_groups" in data:
            counts["turnout_groups"] = _import_turnout_groups(db, data["turnout_groups"], user_map, log)

        # 37. Field Usage Logs
        if "field_usage_logs" in data:
            counts["field_usage_logs"] = _import_field_usage_logs(db, data["field_usage_logs"], user_map, log)

        # 38. Coach Availability Slots
        if "coach_availability_slots" in data:
            counts["coach_availability_slots"] = _import_coach_availability_slots(db, data["coach_availability_slots"], user_map, log)

        # 39. Holiday Livery Requests
        if "holiday_livery_requests" in data:
            counts["holiday_livery_requests"] = _import_holiday_livery_requests(db, data["holiday_livery_requests"], user_map, log)

        # 40. Feed Supply Alerts
        if "feed_supply_alerts" in data:
            counts["feed_supply_alerts"] = _import_feed_supply_alerts(db, data["feed_supply_alerts"], user_map, log)

        # 41. Contract Templates (with versions and signatures)
        if "contract_templates" in data:
            counts["contract_templates"], counts["contract_versions"], counts["contract_signatures"] = _import_contracts(
                db, data["contract_templates"], user_map, user_id_map, package_map, log
            )

        # 42. Flood Monitoring Stations
        if "flood_monitoring_stations" in data:
            counts["flood_monitoring_stations"] = _import_flood_monitoring_stations(db, data["flood_monitoring_stations"], log)

        # 43. Land Features (hedgerows, trees, water troughs, fences, etc.)
        if "land_features" in data:
            counts["land_features"] = _import_land_features(db, data["land_features"], log)

        # 44. Grants
        if "grants" in data:
            counts["grants"] = _import_grants(db, data["grants"], log)

        # 45. Risk Assessments
        if "risk_assessments" in data:
            counts["risk_assessments"] = _import_risk_assessments(db, data["risk_assessments"], user_map, log)

        # 46. Risk Assessment Reviews (admin review history)
        if "risk_assessment_reviews" in data:
            counts["risk_assessment_reviews"] = _import_risk_assessment_reviews(db, data["risk_assessment_reviews"], user_map, log)

        # 47. Risk Assessment Acknowledgements (staff acknowledgements)
        if "risk_assessment_acknowledgements" in data:
            counts["risk_assessment_acknowledgements"] = _import_risk_assessment_acknowledgements(db, data["risk_assessment_acknowledgements"], user_map, log)

        # Single commit at the end - all or nothing
        db.commit()
        log("All data imported successfully.")
        return counts

    except Exception as e:
        db.rollback()
        log(f"ERROR: Import failed, all changes rolled back: {e}")
        raise SeedingError(f"Seeding failed, all changes rolled back: {e}") from e


def _import_site_settings(db: Session, settings_data: Dict, log: Callable) -> int:
    """Import site settings."""
    log("Importing site settings...")
    existing = db.query(SiteSettings).first()
    if existing:
        for key, value in settings_data.items():
            # Skip id and timestamp fields when updating existing records
            if key in ('id', 'created_at', 'updated_at'):
                continue
            if hasattr(existing, key):
                setattr(existing, key, value)
    else:
        # Remove id from data when creating new record to let DB assign it
        create_data = {k: v for k, v in settings_data.items() if k != 'id'}
        db.add(SiteSettings(**create_data))
    db.flush()
    log(f"  Site settings configured for: {settings_data.get('venue_name')}")
    return 1


def _import_users(db: Session, users_data: List[Dict], log: Callable) -> Tuple[Dict[str, int], Dict[int, int], int]:
    """Import users. Returns (username->id map, old_id->new_id map, count)."""
    log("Importing users...")
    user_map = {}  # username -> new_id
    user_id_map = {}  # old_id -> new_id (for backup format)
    count = 0

    for user_data in users_data:
        username = user_data.get("username")
        old_id = user_data.get("id")  # Original ID from backup
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            # Update existing user with seed data (name, email, phone, etc.)
            if user_data.get("name"):
                existing.name = user_data["name"]
            if user_data.get("email"):
                existing.email = user_data["email"]
            if user_data.get("phone"):
                existing.phone = user_data["phone"]
            log(f"  User '{username}' already exists, updated details")
            user_map[username] = existing.id
            if old_id:
                user_id_map[old_id] = existing.id
            continue

        # Handle password - seed format has 'password', backup format doesn't
        password = user_data.get("password", "changeme123")
        password_hash = get_password_hash(password)

        # Handle role enum
        role_str = user_data.get("role", "livery")
        role = UserRole(role_str) if isinstance(role_str, str) else role_str

        # Staff role users automatically get is_yard_staff = True
        is_yard_staff = user_data.get("is_yard_staff", False) or role == UserRole.STAFF

        # Handle staff_type enum
        staff_type = None
        if user_data.get("staff_type"):
            from app.models.user import StaffType
            staff_type = StaffType(user_data["staff_type"])

        user = User(
            username=username,
            email=user_data.get("email"),
            name=user_data.get("name", username),
            phone=user_data.get("phone"),
            address_street=user_data.get("address_street"),
            address_town=user_data.get("address_town"),
            address_county=user_data.get("address_county"),
            address_postcode=user_data.get("address_postcode"),
            password_hash=password_hash,
            role=role,
            is_yard_staff=is_yard_staff,
            staff_type=staff_type,
            annual_leave_entitlement=user_data.get("annual_leave_entitlement", 28 if is_yard_staff else None),
            is_active=user_data.get("is_active", True),
            must_change_password=user_data.get("must_change_password", "password" not in user_data),
        )
        db.add(user)
        db.flush()
        user_map[username] = user.id
        if old_id:
            user_id_map[old_id] = user.id
        count += 1
        log(f"  Created user: {username} ({role_str})")

    db.flush()
    return user_map, user_id_map, count


def _import_staff_profiles(db: Session, profiles_data: List[Dict], user_map: Dict, user_id_map: Dict, log: Callable) -> int:
    """Import staff profiles."""
    log("Importing staff profiles...")
    count = 0

    for profile_data in profiles_data:
        # Resolve user by ID or username
        old_user_id = profile_data.get("user_id")
        user_id = None

        # First try to map old_id -> new_id (backup format)
        if old_user_id and old_user_id in user_id_map:
            user_id = user_id_map[old_user_id]
        # Fall back to username lookup (seed format)
        elif "username" in profile_data:
            user_id = user_map.get(profile_data["username"])

        if not user_id:
            log(f"  Warning: User not found for staff profile (old_id={old_user_id}), skipping")
            continue

        # Check if profile already exists
        existing = db.query(StaffProfile).filter(StaffProfile.user_id == user_id).first()
        if existing:
            log(f"  Staff profile for user {user_id} already exists, skipping")
            continue

        # Parse date fields
        date_fields = ["date_of_birth", "start_date", "dbs_check_date"]
        for field in date_fields:
            if field in profile_data and profile_data[field]:
                if isinstance(profile_data[field], str):
                    profile_data[field] = datetime.fromisoformat(profile_data[field].replace('Z', '+00:00')).date()

        # Handle qualifications JSON
        qualifications = profile_data.get("qualifications")
        if qualifications and isinstance(qualifications, list):
            qualifications = json.dumps(qualifications)
        elif qualifications and isinstance(qualifications, str):
            # Already JSON string from backup
            pass
        else:
            qualifications = None

        profile = StaffProfile(
            user_id=user_id,
            date_of_birth=profile_data.get("date_of_birth"),
            bio=profile_data.get("bio"),
            start_date=profile_data.get("start_date"),
            job_title=profile_data.get("job_title"),
            personal_email=profile_data.get("personal_email"),
            personal_phone=profile_data.get("personal_phone"),
            address_street=profile_data.get("address_street"),
            address_town=profile_data.get("address_town"),
            address_county=profile_data.get("address_county"),
            address_postcode=profile_data.get("address_postcode"),
            emergency_contact_name=profile_data.get("emergency_contact_name"),
            emergency_contact_phone=profile_data.get("emergency_contact_phone"),
            emergency_contact_relationship=profile_data.get("emergency_contact_relationship"),
            qualifications=qualifications,
            dbs_check_date=profile_data.get("dbs_check_date"),
            dbs_certificate_number=profile_data.get("dbs_certificate_number"),
            notes=profile_data.get("notes"),
        )
        db.add(profile)
        count += 1
        log(f"  Created staff profile for user {user_id}")

    db.flush()
    return count


def _import_livery_packages(db: Session, packages_data: List[Dict], log: Callable) -> Tuple[Dict[str, int], int]:
    """Import livery packages. Returns (name->id map, count)."""
    log("Importing livery packages...")
    package_map = {}
    count = 0

    for pkg_data in packages_data:
        name = pkg_data.get("name")
        existing = db.query(LiveryPackage).filter(LiveryPackage.name == name).first()
        if existing:
            log(f"  Package '{name}' already exists, skipping")
            package_map[name] = existing.id
            continue

        # Handle features JSON
        features = pkg_data.get("features", [])
        if isinstance(features, list):
            features = json.dumps(features)

        # Handle billing_type
        from app.models.livery_package import BillingType
        billing_type_str = pkg_data.get("billing_type", "monthly")
        billing_type = BillingType.WEEKLY if billing_type_str == "weekly" else BillingType.MONTHLY

        package = LiveryPackage(
            name=name,
            description=pkg_data.get("description"),
            price_display=pkg_data.get("price_display", "Contact for price"),
            monthly_price=pkg_data.get("monthly_price"),
            weekly_price=pkg_data.get("weekly_price"),
            billing_type=billing_type,
            features=features if isinstance(features, str) else None,
            additional_note=pkg_data.get("additional_note"),
            is_featured=pkg_data.get("is_featured", False),
            display_order=pkg_data.get("display_order", 0),
            is_active=pkg_data.get("is_active", True),
        )
        db.add(package)
        db.flush()
        package_map[name] = package.id
        count += 1
        log(f"  Created livery package: {name}")

    db.flush()
    return package_map, count


def _import_stable_blocks(db: Session, blocks_data: List[Dict], log: Callable) -> Tuple[Dict[str, int], int, int]:
    """Import stable blocks and stables. Returns (stable_name->id map, block_count, stable_count)."""
    log("Importing stable blocks...")
    stable_map = {}
    block_count = 0
    stable_count = 0
    stable_sequence = 0

    for block_data in blocks_data:
        block_name = block_data.get("name")
        stables_data = block_data.get("stables", [])

        existing = db.query(StableBlock).filter(StableBlock.name == block_name).first()
        if existing:
            log(f"  Block '{block_name}' already exists, skipping")
            # Still map existing stables
            for stable in existing.stables:
                stable_map[stable.name] = stable.id
            continue

        block = StableBlock(
            name=block_name,
            sequence=block_data.get("sequence", 0),
            is_active=block_data.get("is_active", True),
        )
        db.add(block)
        db.flush()
        block_count += 1
        log(f"  Created block: {block_name}")

        for stable_data in stables_data:
            stable_number = stable_data.get("number", 1)
            stable_name = f"{block_name} {stable_number}"
            stable_sequence += 1

            stable = Stable(
                name=stable_name,
                block_id=block.id,
                number=stable_number,
                sequence=stable_sequence,
                is_active=True,
            )
            db.add(stable)
            db.flush()
            stable_map[stable_name] = stable.id
            stable_count += 1
            log(f"    Created stable: {stable_name}")

    db.flush()
    return stable_map, block_count, stable_count


def _import_arenas(db: Session, arenas_data: List[Dict], log: Callable) -> Tuple[Dict[str, int], int]:
    """Import arenas. Returns (name->id map, count)."""
    log("Importing arenas...")
    arena_map = {}
    count = 0

    for arena_data in arenas_data:
        name = arena_data.get("name")
        existing = db.query(Arena).filter(Arena.name == name).first()
        if existing:
            log(f"  Arena '{name}' already exists, skipping")
            arena_map[name] = existing.id
            continue

        arena = Arena(
            name=name,
            description=arena_data.get("description"),
            is_active=arena_data.get("is_active", True),
            size=arena_data.get("size"),
            surface_type=arena_data.get("surface_type"),
            price_per_hour=arena_data.get("price_per_hour"),
            has_lights=arena_data.get("has_lights", False),
            jumps_type=arena_data.get("jumps_type"),
            free_for_livery=arena_data.get("free_for_livery", False),
            image_url=arena_data.get("image_url"),
        )
        db.add(arena)
        db.flush()
        arena_map[name] = arena.id
        count += 1
        log(f"  Created arena: {name}")

    db.flush()
    return arena_map, count


def _import_horses(
    db: Session, horses_data: List[Dict], user_map: Dict, stable_map: Dict, package_map: Dict, log: Callable
) -> int:
    """Import horses."""
    log("Importing horses...")
    count = 0

    for horse_data in horses_data:
        name = horse_data.get("name")

        # Resolve owner - support both owner_id (backup) and owner_username (seed)
        owner_id = horse_data.get("owner_id")
        if not owner_id and "owner_username" in horse_data:
            owner_id = user_map.get(horse_data["owner_username"])

        if not owner_id:
            log(f"  Warning: Owner not found for horse '{name}', skipping")
            continue

        # Resolve stable - support both stable_id and stable_name
        stable_id = horse_data.get("stable_id")
        if not stable_id and "stable_name" in horse_data:
            stable_id = stable_map.get(horse_data["stable_name"])

        # Resolve livery package
        package_id = horse_data.get("livery_package_id")
        if not package_id and "livery_package_name" in horse_data:
            package_id = package_map.get(horse_data["livery_package_name"])

        # Handle livery dates (for holiday livery etc)
        from app.utils.date_helpers import calculate_date
        livery_start_date = None
        livery_end_date = None

        if "livery_start_date" in horse_data:
            livery_start_date = horse_data["livery_start_date"]
        elif "livery_start_days_ago" in horse_data:
            livery_start_date = calculate_date({"days_ago": horse_data["livery_start_days_ago"]})

        if "livery_end_date" in horse_data:
            livery_end_date = horse_data["livery_end_date"]
        elif "livery_end_days_from_now" in horse_data:
            livery_end_date = calculate_date({"days_from_now": horse_data["livery_end_days_from_now"]})

        # Check if exists
        existing = db.query(Horse).filter(Horse.name == name, Horse.owner_id == owner_id).first()
        if existing:
            log(f"  Horse '{name}' already exists, skipping")
            continue

        horse = Horse(
            name=name,
            passport_name=horse_data.get("passport_name"),
            colour=horse_data.get("colour"),
            birth_year=horse_data.get("birth_year"),
            owner_id=owner_id,
            stable_id=stable_id,
            livery_package_id=package_id,
            livery_start_date=livery_start_date,
            livery_end_date=livery_end_date,
            feed_notes=horse_data.get("feed_notes"),
            # Farrier traits
            farrier_friendly=horse_data.get("farrier_friendly", True),
            farrier_notes=horse_data.get("farrier_notes"),
            # Dentist traits
            dentist_friendly=horse_data.get("dentist_friendly", True),
            needs_sedation_dentist=horse_data.get("needs_sedation_dentist", False),
            dentist_notes=horse_data.get("dentist_notes"),
            # Clipping traits
            clipping_friendly=horse_data.get("clipping_friendly", True),
            needs_sedation_clipping=horse_data.get("needs_sedation_clipping", False),
            clipping_notes=horse_data.get("clipping_notes"),
            # Handling traits
            kicks=horse_data.get("kicks", False),
            bites=horse_data.get("bites", False),
            handling_notes=horse_data.get("handling_notes"),
            # Loading traits
            loads_well=horse_data.get("loads_well", True),
            loading_notes=horse_data.get("loading_notes"),
            difficult_to_catch=horse_data.get("difficult_to_catch", False),
            catching_notes=horse_data.get("catching_notes"),
            # Vet traits
            vet_friendly=horse_data.get("vet_friendly", True),
            needle_shy=horse_data.get("needle_shy", False),
            vet_notes=horse_data.get("vet_notes"),
            # Other traits
            can_be_tied=horse_data.get("can_be_tied", True),
            tying_notes=horse_data.get("tying_notes"),
            has_sedation_risk=horse_data.get("has_sedation_risk", False),
            sedation_notes=horse_data.get("sedation_notes"),
            headshy=horse_data.get("headshy", False),
            headshy_notes=horse_data.get("headshy_notes"),
        )
        db.add(horse)
        count += 1
        log(f"  Created horse: {name}")

    db.flush()
    return count


def _import_services(db: Session, services_data: List[Dict], log: Callable) -> int:
    """Import services."""
    log("Importing services...")
    count = 0

    for service_data in services_data:
        name = service_data.get("name")
        service_id = service_data.get("id")
        existing = db.query(Service).filter(
            (Service.id == service_id) | (Service.name == name)
        ).first()
        if existing:
            log(f"  Service '{name}' already exists, skipping")
            continue

        category_str = service_data.get("category", "general")
        category = ServiceCategory(category_str) if isinstance(category_str, str) else category_str

        service = Service(
            id=service_data.get("id"),
            name=name,
            description=service_data.get("description"),
            category=category,
            duration_minutes=service_data.get("duration_minutes"),
            price_gbp=service_data.get("price_gbp", 0),
            requires_approval=service_data.get("requires_approval", False),
            approval_reason=service_data.get("approval_reason"),
            advance_notice_hours=service_data.get("advance_notice_hours", 24),
            is_active=service_data.get("is_active", True),
            notes=service_data.get("notes"),
        )
        db.add(service)
        count += 1
        log(f"  Created service: {name}")

    db.flush()
    return count


def _import_professionals(db: Session, professionals_data: List[Dict], log: Callable) -> int:
    """Import professionals."""
    log("Importing professionals...")
    count = 0

    for prof_data in professionals_data:
        name = prof_data.get("business_name") or prof_data.get("name")
        existing = db.query(Professional).filter(Professional.business_name == name).first()
        if existing:
            log(f"  Professional '{name}' already exists, skipping")
            continue

        category_str = prof_data.get("category", "other")
        category = ProfessionalCategory(category_str) if isinstance(category_str, str) else category_str

        professional = Professional(
            business_name=name,
            contact_name=prof_data.get("contact_name"),
            category=category,
            phone=prof_data.get("phone"),
            mobile=prof_data.get("mobile"),
            email=prof_data.get("email"),
            address=prof_data.get("address"),
            website=prof_data.get("website"),
            coverage_area=prof_data.get("coverage_area"),
            services=prof_data.get("services"),
            specialties=prof_data.get("specialties"),
            qualifications=prof_data.get("qualifications"),
            typical_rates=prof_data.get("typical_rates"),
            booking_notes=prof_data.get("booking_notes"),
            yard_recommended=prof_data.get("yard_recommended", False),
            yard_notes=prof_data.get("yard_notes"),
            is_active=prof_data.get("is_active", True),
        )
        db.add(professional)
        count += 1
        log(f"  Created professional: {name}")

    db.flush()
    return count


def _import_compliance_items(db: Session, items_data: List[Dict], user_map: Dict, log: Callable) -> int:
    """Import compliance items."""
    log("Importing compliance items...")
    count = 0
    admin_id = user_map.get("admin")

    for item_data in items_data:
        name = item_data.get("name")
        existing = db.query(ComplianceItem).filter(ComplianceItem.name == name).first()
        if existing:
            log(f"  Compliance item '{name}' already exists, skipping")
            continue

        # Handle relative dates (days_until_due) or absolute dates (next_due_date)
        next_due_date = None
        if "days_until_due" in item_data:
            next_due_date = datetime.now() + timedelta(days=item_data["days_until_due"])
        elif "next_due_date" in item_data and item_data["next_due_date"]:
            next_due_date = datetime.fromisoformat(item_data["next_due_date"].replace('Z', '+00:00'))

        item = ComplianceItem(
            name=name,
            category=item_data.get("category", "other"),
            description=item_data.get("description"),
            reference_number=item_data.get("reference_number"),
            provider=item_data.get("provider"),
            renewal_frequency_months=item_data.get("renewal_frequency_months", 12),
            next_due_date=next_due_date,
            reminder_days_before=item_data.get("reminder_days_before", 30),
            responsible_user_id=item_data.get("responsible_user_id") or admin_id,
            is_active=item_data.get("is_active", True),
        )
        db.add(item)
        count += 1
        log(f"  Created compliance item: {name}")

    db.flush()
    return count


def _import_feed_schedules(db: Session, schedules_data: List[Dict], user_map: Dict, log: Callable) -> int:
    """Import feed schedules."""
    log("Importing feed schedules...")
    count = 0

    for schedule_data in schedules_data:
        horse_name = schedule_data.get("horse_name")
        owner_username = schedule_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping feed for '{horse_name}'")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping feed schedule")
            continue

        existing = db.query(FeedRequirement).filter(FeedRequirement.horse_id == horse.id).first()
        if existing:
            log(f"  Feed schedule for '{horse_name}' already exists, skipping")
            continue

        supply_status_str = schedule_data.get("supply_status", "adequate")
        try:
            supply_status = SupplyStatus(supply_status_str)
        except ValueError:
            supply_status = SupplyStatus.ADEQUATE

        feed_req = FeedRequirement(
            horse_id=horse.id,
            morning_feed=schedule_data.get("morning_feed"),
            evening_feed=schedule_data.get("evening_feed"),
            supplements=schedule_data.get("supplements"),
            special_instructions=schedule_data.get("special_instructions"),
            supply_status=supply_status,
            supply_notes=schedule_data.get("supply_notes"),
        )
        db.add(feed_req)
        count += 1
        log(f"  Created feed schedule for: {horse_name}")

    db.flush()
    return count


def _import_feed_supply_alerts(db: Session, alerts_data: List[Dict], user_map: Dict, log: Callable) -> int:
    """Import feed supply alerts."""
    log("Importing feed supply alerts...")
    count = 0

    for alert_data in alerts_data:
        horse_name = alert_data.get("horse_name")
        item = alert_data.get("item")

        # Find horse by name
        horse = db.query(Horse).filter(Horse.name == horse_name).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping alert")
            continue

        created_by_username = alert_data.get("created_by_username")
        created_by_id = user_map.get(created_by_username)
        if not created_by_id:
            log(f"  Warning: User '{created_by_username}' not found, skipping alert")
            continue

        # Check if similar alert already exists
        existing = db.query(FeedSupplyAlert).filter(
            FeedSupplyAlert.horse_id == horse.id,
            FeedSupplyAlert.item == item,
            FeedSupplyAlert.is_resolved == False
        ).first()
        if existing:
            log(f"  Alert for '{item}' on '{horse_name}' already exists, skipping")
            continue

        alert = FeedSupplyAlert(
            horse_id=horse.id,
            item=item,
            notes=alert_data.get("notes"),
            created_by_id=created_by_id,
            is_resolved=False,
        )
        db.add(alert)
        count += 1
        log(f"  Created feed supply alert: {item} for {horse_name}")

    db.flush()
    return count


def _import_notices(db: Session, notices_data: List[Dict], user_map: Dict, log: Callable) -> int:
    """Import notices."""
    log("Importing notices...")
    count = 0

    for notice_data in notices_data:
        title = notice_data.get("title")
        existing = db.query(Notice).filter(Notice.title == title).first()
        if existing:
            log(f"  Notice '{title}' already exists, skipping")
            continue

        author_id = notice_data.get("created_by_id")
        if not author_id and "author_username" in notice_data:
            author_id = user_map.get(notice_data["author_username"])

        category_str = notice_data.get("category", "general")
        priority_str = notice_data.get("priority", "normal")

        notice = Notice(
            title=title,
            content=notice_data.get("content"),
            category=NoticeCategory(category_str) if isinstance(category_str, str) else category_str,
            priority=NoticePriority(priority_str) if isinstance(priority_str, str) else priority_str,
            is_pinned=notice_data.get("is_pinned", False),
            is_active=True,
            created_by_id=author_id,
        )
        db.add(notice)
        count += 1
        log(f"  Created notice: {title}")

    db.flush()
    return count


def _import_bookings(db: Session, bookings_data: List[Dict], user_map: Dict, arena_map: Dict, log: Callable) -> int:
    """Import bookings."""
    log("Importing bookings...")
    count = 0

    for booking_data in bookings_data:
        # Resolve arena
        arena_id = booking_data.get("arena_id")
        if not arena_id and "arena_name" in booking_data:
            arena_id = arena_map.get(booking_data["arena_name"])

        if not arena_id:
            log(f"  Warning: Arena not found, skipping booking")
            continue

        # Resolve user
        user_id = booking_data.get("user_id")
        if not user_id and "user_username" in booking_data:
            user_id = user_map.get(booking_data["user_username"])

        if not user_id:
            log(f"  Warning: User not found, skipping booking")
            continue

        # Handle dates - relative (days_from_now) or absolute (start_time)
        if "days_from_now" in booking_data:
            hour = booking_data.get("hour", 10)
            duration = booking_data.get("duration_hours", 1)
            start_time = datetime.now().replace(hour=hour, minute=0, second=0, microsecond=0)
            start_time += timedelta(days=booking_data["days_from_now"])
            end_time = start_time + timedelta(hours=duration)
        else:
            start_time = datetime.fromisoformat(booking_data["start_time"].replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(booking_data["end_time"].replace('Z', '+00:00'))

        booking_type_str = booking_data.get("booking_type", "private_hire")
        booking_type = BookingType(booking_type_str) if isinstance(booking_type_str, str) else booking_type_str

        # Handle booking status
        booking_status_str = booking_data.get("booking_status", "confirmed")
        booking_status = BookingStatus(booking_status_str) if isinstance(booking_status_str, str) else booking_status_str

        booking = Booking(
            arena_id=arena_id,
            user_id=user_id,
            title=booking_data.get("title", "Booking"),
            booking_type=booking_type,
            booking_status=booking_status,
            start_time=start_time,
            end_time=end_time,
            payment_status=PaymentStatus.NOT_REQUIRED,
        )
        db.add(booking)
        count += 1
        log(f"  Created booking: {booking_data.get('title')} on {start_time.strftime('%Y-%m-%d %H:%M')}")

    db.flush()
    return count


def _import_clinics(db: Session, clinics_data: List[Dict], user_map: Dict, log: Callable) -> int:
    """Import clinics."""
    log("Importing clinic requests...")
    count = 0

    for clinic_data in clinics_data:
        # Resolve proposer
        proposer_id = clinic_data.get("proposed_by_id")
        if not proposer_id and "proposed_by_username" in clinic_data:
            proposer_id = user_map.get(clinic_data["proposed_by_username"])

        if not proposer_id:
            log(f"  Warning: Proposer not found, skipping clinic")
            continue

        # Handle dates
        if "days_from_now" in clinic_data:
            proposed_date = (datetime.now() + timedelta(days=clinic_data["days_from_now"])).date()
            hour = clinic_data.get("hour", 10)
            duration = clinic_data.get("duration_hours", 2)
            start_time = time_obj(hour=hour, minute=0)
            end_time = time_obj(hour=hour + duration, minute=0)
        else:
            proposed_date = datetime.fromisoformat(clinic_data["proposed_date"]).date() if isinstance(clinic_data["proposed_date"], str) else clinic_data["proposed_date"]
            start_time = time_obj.fromisoformat(clinic_data["start_time"]) if isinstance(clinic_data.get("start_time"), str) else clinic_data.get("start_time")
            end_time = time_obj.fromisoformat(clinic_data["end_time"]) if isinstance(clinic_data.get("end_time"), str) else clinic_data.get("end_time")

        discipline_str = clinic_data.get("discipline", "other")
        try:
            discipline = Discipline(discipline_str)
        except ValueError:
            discipline = Discipline.OTHER

        status_str = clinic_data.get("status", "pending")
        status = ClinicStatus(status_str) if isinstance(status_str, str) else status_str

        # Get pricing if available
        price = clinic_data.get("price_per_participant") or clinic_data.get("price_per_lesson")

        clinic = ClinicRequest(
            proposed_by_id=proposer_id,
            title=clinic_data.get("title"),
            description=clinic_data.get("description"),
            discipline=discipline,
            arena_required=clinic_data.get("arena_name", "").lower().replace(" ", "_") if clinic_data.get("arena_name") else clinic_data.get("arena_required"),
            coach_name=clinic_data.get("coach_name"),
            coach_email=clinic_data.get("coach_email", "coach@example.com"),
            proposed_date=proposed_date,
            proposed_start_time=start_time,
            proposed_end_time=end_time,
            max_participants=clinic_data.get("max_participants", 6),
            coach_fee_group=price,  # Use group fee as the main price
            status=status,
        )
        db.add(clinic)
        count += 1
        log(f"  Created clinic: {clinic_data.get('title')} on {proposed_date}")

    db.flush()
    return count


def _import_coach_profiles(db: Session, profiles_data: List[Dict], user_map: Dict, log: Callable) -> int:
    """Import coach profiles with their availability schedules."""
    log("Importing coach profiles...")
    count = 0

    for profile_data in profiles_data:
        # Resolve user
        user_id = profile_data.get("user_id")
        if not user_id and "username" in profile_data:
            user_id = user_map.get(profile_data["username"])

        if not user_id:
            log(f"  Warning: User not found for coach profile, skipping")
            continue

        # Check if profile already exists
        existing = db.query(CoachProfile).filter(CoachProfile.user_id == user_id).first()
        if existing:
            log(f"  Coach profile for user already exists, skipping")
            continue

        # Resolve approved_by
        approved_by_id = profile_data.get("approved_by_id")
        if not approved_by_id and "approved_by_username" in profile_data:
            approved_by_id = user_map.get(profile_data["approved_by_username"])

        # Parse availability mode
        availability_mode_str = profile_data.get("availability_mode", "always")
        try:
            availability_mode = AvailabilityMode(availability_mode_str)
        except ValueError:
            availability_mode = AvailabilityMode.ALWAYS

        # Parse booking mode
        booking_mode_str = profile_data.get("booking_mode", "request_first")
        try:
            booking_mode = BookingMode(booking_mode_str)
        except ValueError:
            booking_mode = BookingMode.REQUEST_FIRST

        profile = CoachProfile(
            user_id=user_id,
            disciplines=profile_data.get("disciplines"),
            teaching_description=profile_data.get("teaching_description"),
            bio=profile_data.get("bio"),
            availability_mode=availability_mode,
            booking_mode=booking_mode,
            lesson_duration_minutes=profile_data.get("lesson_duration_minutes", 45),
            coach_fee=profile_data.get("coach_fee", 0),
            venue_fee=profile_data.get("venue_fee"),
            livery_venue_fee=profile_data.get("livery_venue_fee", 0),
            is_active=profile_data.get("is_active", False),
            approved_by_id=approved_by_id,
            approved_at=datetime.now() if profile_data.get("is_active") else None,
        )
        db.add(profile)
        db.flush()

        # Add recurring schedules if present
        for schedule_data in profile_data.get("recurring_schedules", []):
            schedule = CoachRecurringSchedule(
                coach_profile_id=profile.id,
                day_of_week=schedule_data.get("day_of_week", 0),
                start_time=time_obj.fromisoformat(schedule_data.get("start_time", "09:00")),
                end_time=time_obj.fromisoformat(schedule_data.get("end_time", "17:00")),
                is_active=schedule_data.get("is_active", True),
            )
            db.add(schedule)

        count += 1
        user = db.query(User).filter(User.id == user_id).first()
        log(f"  Created coach profile for: {user.name if user else 'Unknown'}")

    db.flush()
    return count


def _import_lesson_requests(
    db: Session,
    lesson_requests_data: List[Dict],
    user_map: Dict[str, int],
    arena_map: Dict[str, int],
    log: Callable
) -> int:
    """Import lesson requests from seed data."""
    from app.models.clinic import Discipline
    from app.models.horse import Horse

    log("Importing lesson requests...")
    count = 0
    today = date.today()

    for req_data in lesson_requests_data:
        # Get coach profile by username
        coach_username = req_data.get("coach_username")
        coach_profile = db.query(CoachProfile).join(
            User, CoachProfile.user_id == User.id
        ).filter(User.username == coach_username).first()
        if not coach_profile:
            log(f"  Warning: Coach profile not found for {coach_username}, skipping lesson request")
            continue

        # Get user by username (if specified)
        user_id = None
        user_username = req_data.get("user_username")
        if user_username:
            user_id = user_map.get(user_username)
            if not user_id:
                log(f"  Warning: User not found for {user_username}, skipping lesson request")
                continue

        # Get horse by name (if specified)
        horse_id = None
        horse_name = req_data.get("horse_name")
        if horse_name and user_id:
            horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == user_id).first()
            if horse:
                horse_id = horse.id

        # Get arena (if specified)
        arena_id = None
        arena_name = req_data.get("arena_name")
        if arena_name:
            arena_id = arena_map.get(arena_name)

        # Calculate dates using relative days_from_now
        days_from_now = req_data.get("days_from_now", 7)
        requested_date = today + timedelta(days=days_from_now)

        # Parse times
        requested_time = None
        if req_data.get("requested_time"):
            requested_time = time_obj.fromisoformat(req_data.get("requested_time"))

        confirmed_start_time = None
        if req_data.get("confirmed_start_time"):
            confirmed_start_time = time_obj.fromisoformat(req_data.get("confirmed_start_time"))

        confirmed_end_time = None
        if req_data.get("confirmed_end_time"):
            confirmed_end_time = time_obj.fromisoformat(req_data.get("confirmed_end_time"))

        # Parse discipline
        discipline = None
        discipline_str = req_data.get("discipline")
        if discipline_str:
            try:
                discipline = Discipline(discipline_str)
            except ValueError:
                pass

        # Parse status
        status_str = req_data.get("status", "pending")
        try:
            status = LessonRequestStatus(status_str)
        except ValueError:
            status = LessonRequestStatus.PENDING

        # Parse payment status
        payment_status_str = req_data.get("payment_status", "pending")
        try:
            payment_status = PaymentStatus(payment_status_str)
        except ValueError:
            payment_status = PaymentStatus.PENDING

        # Calculate confirmed date
        confirmed_date = None
        if status in [LessonRequestStatus.ACCEPTED, LessonRequestStatus.CONFIRMED, LessonRequestStatus.COMPLETED]:
            confirmed_date = requested_date

        # Create lesson request
        lesson_request = LessonRequest(
            coach_profile_id=coach_profile.id,
            user_id=user_id,
            horse_id=horse_id,
            guest_name=req_data.get("guest_name"),
            guest_email=req_data.get("guest_email"),
            guest_phone=req_data.get("guest_phone"),
            requested_date=requested_date,
            requested_time=requested_time,
            alternative_dates=req_data.get("alternative_dates"),
            discipline=discipline,
            notes=req_data.get("notes"),
            coach_fee=req_data.get("coach_fee", coach_profile.coach_fee),
            venue_fee=req_data.get("venue_fee", coach_profile.venue_fee or 0),
            total_price=req_data.get("total_price", (req_data.get("coach_fee", coach_profile.coach_fee) + req_data.get("venue_fee", coach_profile.venue_fee or 0))),
            confirmed_date=confirmed_date,
            confirmed_start_time=confirmed_start_time,
            confirmed_end_time=confirmed_end_time,
            arena_id=arena_id,
            status=status,
            coach_response=req_data.get("coach_response"),
            declined_reason=req_data.get("declined_reason"),
            payment_status=payment_status,
            payment_ref=req_data.get("payment_ref"),
            responded_at=datetime.now() if status != LessonRequestStatus.PENDING else None,
        )
        db.add(lesson_request)
        count += 1

        # Get requester name for logging
        requester = req_data.get("guest_name") or user_username or "Unknown"
        log(f"  Created lesson request: {requester} -> {coach_username} ({status_str})")

    db.flush()
    return count


def _import_yard_tasks(db: Session, tasks_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import yard tasks from seed data."""
    from datetime import date
    log("Importing yard tasks...")
    count = 0
    today = date.today()

    for task_data in tasks_data:
        # Resolve users
        reported_by_username = task_data.get("reported_by_username", "admin")
        reported_by_id = user_map.get(reported_by_username)
        if not reported_by_id:
            log(f"  Warning: Reporter '{reported_by_username}' not found, skipping task")
            continue

        assigned_to_id = None
        assigned_to_username = task_data.get("assigned_to_username")
        if assigned_to_username:
            assigned_to_id = user_map.get(assigned_to_username)

        # Calculate scheduled date
        scheduled_date = None
        if "days_from_now" in task_data:
            scheduled_date = today + timedelta(days=task_data["days_from_now"])
        elif task_data.get("scheduled_date"):
            scheduled_date = datetime.fromisoformat(task_data["scheduled_date"]).date()

        # Parse enums
        try:
            category = TaskCategory(task_data.get("category", "maintenance"))
        except ValueError:
            category = TaskCategory.MAINTENANCE

        try:
            priority = TaskPriority(task_data.get("priority", "medium"))
        except ValueError:
            priority = TaskPriority.MEDIUM

        try:
            status = TaskStatus(task_data.get("status", "open"))
        except ValueError:
            status = TaskStatus.OPEN

        try:
            assignment_type = AssignmentType(task_data.get("assignment_type", "backlog"))
        except ValueError:
            assignment_type = AssignmentType.BACKLOG

        # Handle completed tasks
        completed_by_id = None
        completed_date = None
        if status == TaskStatus.COMPLETED:
            # Use assigned_to as completer, or admin if not assigned
            completed_by_username = task_data.get("completed_by_username", assigned_to_username or "admin")
            completed_by_id = user_map.get(completed_by_username, reported_by_id)
            # Set completed date based on scheduled_date or today
            completed_date = datetime.combine(scheduled_date or today, datetime.now().time())

        task = YardTask(
            title=task_data.get("title"),
            description=task_data.get("description"),
            category=category,
            priority=priority,
            location=task_data.get("location"),
            reported_by_id=reported_by_id,
            assignment_type=assignment_type,
            assigned_to_id=assigned_to_id,
            scheduled_date=scheduled_date,
            status=status,
            estimated_cost=task_data.get("estimated_cost"),
            is_recurring=task_data.get("is_recurring", False),
            completed_by_id=completed_by_id,
            completed_date=completed_date,
        )
        db.add(task)
        count += 1
        log(f"  Created task: {task_data.get('title')} ({assignment_type.value}, {status.value})")

    db.flush()
    return count


def _import_turnout_requests(db: Session, requests_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import turnout requests from seed data."""
    from datetime import date
    log("Importing turnout requests...")
    count = 0
    today = date.today()

    for req_data in requests_data:
        # Get horse by name and owner
        horse_name = req_data.get("horse_name")
        owner_username = req_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping turnout request")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping turnout request")
            continue

        # Resolve requested_by
        requested_by_username = req_data.get("requested_by_username", owner_username)
        requested_by_id = user_map.get(requested_by_username)
        if not requested_by_id:
            requested_by_id = owner_id

        # Calculate request date
        request_date = None
        if "days_from_now" in req_data:
            request_date = today + timedelta(days=req_data["days_from_now"])
        elif req_data.get("request_date"):
            request_date = datetime.fromisoformat(req_data["request_date"]).date()
        else:
            request_date = today + timedelta(days=1)

        # Parse enums
        try:
            turnout_type = TurnoutType(req_data.get("turnout_type", "out"))
        except ValueError:
            turnout_type = TurnoutType.OUT

        try:
            status = TurnoutStatus(req_data.get("status", "pending"))
        except ValueError:
            status = TurnoutStatus.PENDING

        # Resolve reviewed_by
        reviewed_by_id = None
        if req_data.get("reviewed_by_username"):
            reviewed_by_id = user_map.get(req_data["reviewed_by_username"])

        turnout_request = TurnoutRequest(
            horse_id=horse.id,
            requested_by_id=requested_by_id,
            request_date=request_date,
            turnout_type=turnout_type,
            field_preference=req_data.get("field_preference"),
            notes=req_data.get("notes"),
            status=status,
            reviewed_by_id=reviewed_by_id,
            reviewed_at=datetime.now() if status != TurnoutStatus.PENDING else None,
            response_message=req_data.get("response_message"),
        )
        db.add(turnout_request)
        count += 1
        log(f"  Created turnout request: {horse_name} ({turnout_type.value}) - {status.value}")

    db.flush()
    return count


def _import_service_requests(db: Session, requests_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import service requests from seed data."""
    from datetime import date
    from app.models.service import RequestStatus, PreferredTime, ChargeStatus, RecurringPattern
    from app.models.medication_log import RehabProgram
    log("Importing service requests...")
    count = 0
    today = date.today()

    for req_data in requests_data:
        # Get horse by name and owner
        horse_name = req_data.get("horse_name")
        owner_username = req_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping service request")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping service request")
            continue

        # Resolve requested_by
        requested_by_username = req_data.get("requested_by_username", owner_username)
        requested_by_id = user_map.get(requested_by_username)
        if not requested_by_id:
            requested_by_id = owner_id

        # Calculate requested date
        requested_date = None
        if "days_from_now" in req_data:
            requested_date = today + timedelta(days=req_data["days_from_now"])
        elif req_data.get("requested_date"):
            requested_date = datetime.fromisoformat(req_data["requested_date"]).date()
        else:
            requested_date = today + timedelta(days=1)

        # Parse enums
        try:
            status = RequestStatus(req_data.get("status", "scheduled"))
        except ValueError:
            status = RequestStatus.SCHEDULED

        try:
            preferred_time = PreferredTime(req_data.get("preferred_time", "any"))
        except ValueError:
            preferred_time = PreferredTime.ANY

        # Parse recurring pattern
        try:
            recurring_pattern = RecurringPattern(req_data.get("recurring_pattern", "none"))
        except ValueError:
            recurring_pattern = RecurringPattern.NONE

        # Calculate recurring end date
        recurring_end_date = None
        if "recurring_end_days_from_now" in req_data:
            recurring_end_date = today + timedelta(days=req_data["recurring_end_days_from_now"])
        elif req_data.get("recurring_end_date"):
            recurring_end_date = datetime.fromisoformat(req_data["recurring_end_date"]).date()

        # For rehab service requests, look up active rehab program
        rehab_program_id = None
        if req_data.get("service_id") == "rehab-assistance":
            active_program = db.query(RehabProgram).filter(
                RehabProgram.horse_id == horse.id,
                RehabProgram.status == "active"
            ).first()
            if active_program:
                rehab_program_id = active_program.id

        # Resolve assigned_to
        assigned_to_id = None
        if req_data.get("assigned_to_username"):
            assigned_to_id = user_map.get(req_data["assigned_to_username"])

        # Resolve completed_by
        completed_by_id = None
        if req_data.get("completed_by_username"):
            completed_by_id = user_map.get(req_data["completed_by_username"])

        # Resolve quoted_by
        quoted_by_id = None
        if req_data.get("quoted_by_username"):
            quoted_by_id = user_map.get(req_data["quoted_by_username"])

        # Calculate scheduled datetime
        scheduled_datetime = None
        if req_data.get("scheduled_hour") is not None:
            scheduled_datetime = datetime.combine(
                requested_date,
                time_obj(hour=req_data["scheduled_hour"], minute=0)
            )

        service_request = ServiceRequest(
            service_id=req_data.get("service_id"),
            horse_id=horse.id,
            requested_by_id=requested_by_id,
            requested_date=requested_date,
            preferred_time=preferred_time,
            status=status,
            assigned_to_id=assigned_to_id,
            completed_by_id=completed_by_id,
            scheduled_datetime=scheduled_datetime,
            special_instructions=req_data.get("special_instructions"),
            charge_amount=req_data.get("charge_amount"),
            charge_status=ChargeStatus.PENDING,
            notes=req_data.get("notes"),
            rehab_program_id=rehab_program_id,
            recurring_pattern=recurring_pattern,
            recurring_series_id=req_data.get("recurring_series_id"),
            recurring_end_date=recurring_end_date,
            quote_amount=req_data.get("quote_amount"),
            quote_notes=req_data.get("quote_notes"),
            quoted_at=datetime.now() if quoted_by_id else None,
            quoted_by_id=quoted_by_id,
        )
        db.add(service_request)
        db.flush()  # Flush to get service_request.id

        # Create linked YardTask for scheduled service requests
        if status == RequestStatus.SCHEDULED and assigned_to_id:
            from app.models.task import YardTask, TaskCategory, TaskPriority, TaskStatus, AssignmentType
            service = db.query(Service).filter(Service.id == req_data.get("service_id")).first()
            service_name_str = service.name if service else "Service"
            task_title = f"{service_name_str} for {horse_name}"
            task_description = f"Livery service request."
            if req_data.get("special_instructions"):
                task_description += f"\n\nSpecial instructions: {req_data.get('special_instructions')}"

            yard_task = YardTask(
                title=task_title,
                description=task_description,
                category=TaskCategory.LIVERY_SERVICE,
                priority=TaskPriority.MEDIUM,
                reported_by_id=requested_by_id,
                assignment_type=AssignmentType.SPECIFIC,
                assigned_to_id=assigned_to_id,
                scheduled_date=requested_date,
                status=TaskStatus.OPEN,
                service_request_id=service_request.id,
            )
            db.add(yard_task)
            log(f"    Created linked task: {task_title}")

        count += 1
        service_name = req_data.get("service_id", "Unknown")
        log(f"  Created service request: {horse_name} - {service_name} ({status.value})")

    db.flush()
    return count


def _import_holiday_requests(db: Session, requests_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import holiday requests from seed data."""
    from datetime import date
    log("Importing holiday requests...")
    count = 0
    today = date.today()

    for req_data in requests_data:
        # Get staff by username
        staff_username = req_data.get("staff_username")
        staff_id = user_map.get(staff_username)
        if not staff_id:
            log(f"  Warning: Staff '{staff_username}' not found, skipping holiday request")
            continue

        # Calculate dates
        start_days = req_data.get("start_date_days_from_now", 0)
        end_days = req_data.get("end_date_days_from_now", 0)
        start_date = today + timedelta(days=start_days)
        end_date = today + timedelta(days=end_days)

        # Parse leave type
        leave_type_str = req_data.get("leave_type", "annual")
        try:
            leave_type = LeaveType(leave_type_str)
        except ValueError:
            leave_type = LeaveType.ANNUAL

        # Parse status
        status_str = req_data.get("status", "pending")
        try:
            status = LeaveStatus(status_str)
        except ValueError:
            status = LeaveStatus.PENDING

        # Resolve approved_by
        approved_by_id = None
        approval_date = None
        if req_data.get("approved_by_username"):
            approved_by_id = user_map.get(req_data["approved_by_username"])
            if status == LeaveStatus.APPROVED:
                approval_date = datetime.now()

        holiday_request = HolidayRequest(
            staff_id=staff_id,
            start_date=start_date,
            end_date=end_date,
            leave_type=leave_type,
            days_requested=req_data.get("days_requested", 1),
            reason=req_data.get("reason"),
            status=status,
            approved_by_id=approved_by_id,
            approval_date=approval_date,
            approval_notes=req_data.get("approval_notes"),
        )
        db.add(holiday_request)
        count += 1
        log(f"  Created holiday request: {staff_username} ({leave_type_str}) - {status_str}")

    db.flush()
    return count


def _import_unplanned_absences(db: Session, absences_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import unplanned absences from seed data."""
    from datetime import date
    log("Importing unplanned absences...")
    count = 0
    today = date.today()

    for absence_data in absences_data:
        # Get staff by username
        staff_username = absence_data.get("staff_username")
        staff_id = user_map.get(staff_username)
        if not staff_id:
            log(f"  Warning: Staff '{staff_username}' not found, skipping unplanned absence")
            continue

        # Calculate date (days_ago means in the past)
        days_ago = absence_data.get("days_ago", 0)
        absence_date = today - timedelta(days=days_ago)

        # Parse reported time
        reported_time = None
        if absence_data.get("reported_time"):
            reported_time = time_obj.fromisoformat(absence_data.get("reported_time"))

        # Resolve reported_to
        reported_to_id = None
        if absence_data.get("reported_to_username"):
            reported_to_id = user_map.get(absence_data["reported_to_username"])

        # Calculate expected return date
        expected_return = None
        if absence_data.get("expected_return_days"):
            expected_return = absence_date + timedelta(days=absence_data["expected_return_days"])

        # Since these are historical, set actual return as expected return
        actual_return = expected_return

        unplanned_absence = UnplannedAbsence(
            staff_id=staff_id,
            date=absence_date,
            reported_time=reported_time,
            reported_to_id=reported_to_id,
            reason=absence_data.get("reason"),
            expected_return=expected_return,
            actual_return=actual_return,
            notes=absence_data.get("notes"),
            has_fit_note=absence_data.get("has_fit_note", False),
        )
        db.add(unplanned_absence)
        count += 1
        reason = absence_data.get("reason", "unknown")
        log(f"  Created unplanned absence: {staff_username} ({reason}) on {absence_date}")

    db.flush()
    return count


def _import_timesheets(db: Session, timesheets_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import timesheets from seed data."""
    from datetime import date, time
    from app.models.staff_management import TimesheetStatus, WorkType
    log("Importing timesheets...")
    count = 0
    today = date.today()

    for ts_data in timesheets_data:
        # Get staff by username
        staff_username = ts_data.get("staff_username")
        staff_id = user_map.get(staff_username)
        if not staff_id:
            log(f"  Warning: Staff '{staff_username}' not found, skipping timesheet")
            continue

        # Calculate date
        days_ago = ts_data.get("days_ago", 0)
        ts_date = today - timedelta(days=days_ago)

        # Parse times
        clock_in_str = ts_data.get("clock_in", "09:00")
        clock_out_str = ts_data.get("clock_out", "17:00")
        clock_in = time.fromisoformat(clock_in_str)
        clock_out = time.fromisoformat(clock_out_str) if clock_out_str else None

        # Parse work type
        work_type_str = ts_data.get("work_type", "yard_duties")
        try:
            work_type = WorkType(work_type_str)
        except ValueError:
            work_type = WorkType.YARD_DUTIES

        # Parse status
        status_str = ts_data.get("status", "draft")
        try:
            status = TimesheetStatus(status_str)
        except ValueError:
            status = TimesheetStatus.DRAFT

        # Handle approved_by for approved/rejected timesheets
        approved_by_id = None
        approved_at = None
        submitted_at = None
        if status in [TimesheetStatus.SUBMITTED, TimesheetStatus.APPROVED, TimesheetStatus.REJECTED]:
            submitted_at = datetime.now() - timedelta(hours=ts_data.get("hours_since_submitted", 24))
        if status in [TimesheetStatus.APPROVED, TimesheetStatus.REJECTED]:
            approved_by_username = ts_data.get("approved_by_username")
            approved_by_id = user_map.get(approved_by_username)
            approved_at = datetime.now() - timedelta(hours=ts_data.get("hours_since_approved", 12))

        timesheet = Timesheet(
            staff_id=staff_id,
            date=ts_date,
            clock_in=clock_in,
            clock_out=clock_out,
            break_minutes=ts_data.get("break_minutes", 0),
            work_type=work_type,
            notes=ts_data.get("notes"),
            status=status,
            submitted_at=submitted_at,
            approved_by_id=approved_by_id,
            approved_at=approved_at,
            rejection_reason=ts_data.get("rejection_reason"),
        )
        db.add(timesheet)
        count += 1
        log(f"  Created timesheet: {staff_username} on {ts_date} ({status_str})")

    db.flush()
    return count


def _import_ledger_entries(db: Session, entries_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import ledger entries for billing/account data."""
    from app.models.account import TransactionType
    log("Importing ledger entries...")
    count = 0
    today = date.today()

    for entry_data in entries_data:
        # Resolve user
        user_username = entry_data.get("user_username")
        user_id = entry_data.get("user_id") or user_map.get(user_username)
        if not user_id:
            log(f"  Warning: User '{user_username}' not found, skipping ledger entry")
            continue

        # Calculate transaction date
        if "days_ago" in entry_data:
            transaction_date = today - timedelta(days=entry_data["days_ago"])
        elif entry_data.get("transaction_date"):
            transaction_date = datetime.fromisoformat(entry_data["transaction_date"]).date() if isinstance(entry_data["transaction_date"], str) else entry_data["transaction_date"]
        else:
            transaction_date = today

        # Parse transaction type
        trans_type_str = entry_data.get("transaction_type", "adjustment")
        try:
            transaction_type = TransactionType(trans_type_str)
        except ValueError:
            transaction_type = TransactionType.ADJUSTMENT

        # Resolve created_by
        created_by_id = entry_data.get("created_by_id")
        if not created_by_id and entry_data.get("created_by_username"):
            created_by_id = user_map.get(entry_data["created_by_username"])

        entry = LedgerEntry(
            user_id=user_id,
            transaction_type=transaction_type,
            amount=entry_data.get("amount", 0),
            description=entry_data.get("description"),
            transaction_date=transaction_date,
            notes=entry_data.get("notes"),
            created_by_id=created_by_id or user_id,  # Fallback to user_id if no created_by
        )
        db.add(entry)
        count += 1
        log(f"  Created ledger entry: {entry_data.get('description', 'Unknown')} ({trans_type_str})")

    db.flush()
    return count


def _import_emergency_contacts(db: Session, contacts_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import emergency contacts for horses."""
    log("Importing emergency contacts...")
    count = 0

    for contact_data in contacts_data:
        # Get horse by name and owner
        horse_name = contact_data.get("horse_name")
        owner_username = contact_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping emergency contact")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping emergency contact")
            continue

        # Resolve created_by
        created_by_id = contact_data.get("created_by_id")
        if not created_by_id and contact_data.get("created_by_username"):
            created_by_id = user_map.get(contact_data["created_by_username"])
        if not created_by_id:
            created_by_id = owner_id

        # Parse contact type
        contact_type_str = contact_data.get("contact_type", "other")
        try:
            contact_type = ContactType(contact_type_str)
        except ValueError:
            contact_type = ContactType.OTHER

        contact = EmergencyContact(
            horse_id=horse.id,
            contact_type=contact_type,
            name=contact_data.get("name"),
            phone=contact_data.get("phone"),
            phone_alt=contact_data.get("phone_alt"),
            email=contact_data.get("email"),
            practice_name=contact_data.get("practice_name"),
            address=contact_data.get("address"),
            available_24h=contact_data.get("available_24h", False),
            availability_notes=contact_data.get("availability_notes"),
            is_primary=contact_data.get("is_primary", False),
            notes=contact_data.get("notes"),
            created_by_id=created_by_id,
        )
        db.add(contact)
        count += 1
        log(f"  Created emergency contact: {contact_data.get('name')} for {horse_name}")

    db.flush()
    return count


def _import_fields(db: Session, fields_data: List[Dict], log: Callable) -> int:
    """Import fields/paddocks."""
    log("Importing fields...")
    count = 0

    for field_data in fields_data:
        name = field_data.get("name")
        existing = db.query(Field).filter(Field.name == name).first()
        if existing:
            log(f"  Field '{name}' already exists, skipping")
            continue

        # Parse condition
        condition_str = field_data.get("current_condition", "good")
        try:
            condition = FieldCondition(condition_str)
        except ValueError:
            condition = FieldCondition.GOOD

        field = Field(
            name=name,
            description=field_data.get("description"),
            max_horses=field_data.get("max_horses"),
            size_acres=field_data.get("size_acres"),
            current_condition=condition,
            condition_notes=field_data.get("condition_notes"),
            is_resting=field_data.get("is_resting", False),
            has_shelter=field_data.get("has_shelter", False),
            has_water=field_data.get("has_water", True),
            is_electric_fenced=field_data.get("is_electric_fenced", False),
            is_active=field_data.get("is_active", True),
            display_order=field_data.get("display_order", 0),
        )
        db.add(field)
        count += 1
        log(f"  Created field: {name}")

    db.flush()
    return count


def _import_horse_companions(db: Session, companions_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import horse companion relationships."""
    log("Importing horse companions...")
    count = 0

    for comp_data in companions_data:
        # Get first horse
        horse_name = comp_data.get("horse_name")
        owner_username = comp_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping companion")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping companion")
            continue

        # Get companion horse
        companion_name = comp_data.get("companion_name")
        companion_owner_username = comp_data.get("companion_owner_username", owner_username)
        companion_owner_id = user_map.get(companion_owner_username)

        companion = db.query(Horse).filter(Horse.name == companion_name, Horse.owner_id == companion_owner_id).first()
        if not companion:
            log(f"  Warning: Companion horse '{companion_name}' not found, skipping")
            continue

        # Check if relationship already exists
        existing = db.query(HorseCompanion).filter(
            HorseCompanion.horse_id == horse.id,
            HorseCompanion.companion_horse_id == companion.id
        ).first()
        if existing:
            log(f"  Companion relationship already exists, skipping")
            continue

        # Resolve created_by
        created_by_id = comp_data.get("created_by_id")
        if not created_by_id and comp_data.get("created_by_username"):
            created_by_id = user_map.get(comp_data["created_by_username"])
        if not created_by_id:
            created_by_id = user_map.get("admin")

        # Parse relationship type
        rel_type_str = comp_data.get("relationship_type", "compatible")
        try:
            rel_type = CompanionRelationship(rel_type_str)
        except ValueError:
            rel_type = CompanionRelationship.COMPATIBLE

        companion_rel = HorseCompanion(
            horse_id=horse.id,
            companion_horse_id=companion.id,
            relationship_type=rel_type,
            notes=comp_data.get("notes"),
            created_by_id=created_by_id,
        )
        db.add(companion_rel)

        # Add reciprocal relationship
        reciprocal = HorseCompanion(
            horse_id=companion.id,
            companion_horse_id=horse.id,
            relationship_type=rel_type,
            notes=comp_data.get("notes"),
            created_by_id=created_by_id,
        )
        db.add(reciprocal)

        count += 1
        log(f"  Created companion relationship: {horse_name} <-> {companion_name} ({rel_type_str})")

    db.flush()
    return count


def _import_farrier_records(db: Session, records_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import farrier records from seed data."""
    log("Importing farrier records...")
    count = 0
    today = date.today()

    for record_data in records_data:
        # Get horse by name and owner
        horse_name = record_data.get("horse_name")
        owner_username = record_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping farrier record")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping farrier record")
            continue

        # Calculate dates
        visit_date = today
        if "days_ago" in record_data:
            visit_date = today - timedelta(days=record_data["days_ago"])
        elif record_data.get("visit_date"):
            visit_date = datetime.fromisoformat(record_data["visit_date"]).date()

        next_due = None
        if record_data.get("next_due_weeks"):
            next_due = visit_date + timedelta(weeks=record_data["next_due_weeks"])
        elif record_data.get("next_due"):
            next_due = datetime.fromisoformat(record_data["next_due"]).date()

        record = FarrierRecord(
            horse_id=horse.id,
            visit_date=visit_date,
            farrier_name=record_data.get("farrier_name"),
            work_done=record_data.get("work_done", "General trim"),
            cost=record_data.get("cost"),
            next_due=next_due,
            notes=record_data.get("notes"),
        )
        db.add(record)
        count += 1
        log(f"  Created farrier record for: {horse_name}")

    db.flush()
    return count


def _import_dentist_records(db: Session, records_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import dentist records from seed data."""
    log("Importing dentist records...")
    count = 0
    today = date.today()

    for record_data in records_data:
        # Get horse by name and owner
        horse_name = record_data.get("horse_name")
        owner_username = record_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping dentist record")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping dentist record")
            continue

        # Calculate dates
        visit_date = today
        if "days_ago" in record_data:
            visit_date = today - timedelta(days=record_data["days_ago"])
        elif record_data.get("visit_date"):
            visit_date = datetime.fromisoformat(record_data["visit_date"]).date()

        next_due = None
        if record_data.get("next_due_months"):
            next_due = visit_date + timedelta(days=record_data["next_due_months"] * 30)
        elif record_data.get("next_due"):
            next_due = datetime.fromisoformat(record_data["next_due"]).date()

        record = DentistRecord(
            horse_id=horse.id,
            visit_date=visit_date,
            dentist_name=record_data.get("dentist_name"),
            treatment=record_data.get("treatment", "Routine check"),
            cost=record_data.get("cost"),
            next_due=next_due,
            notes=record_data.get("notes"),
        )
        db.add(record)
        count += 1
        log(f"  Created dentist record for: {horse_name}")

    db.flush()
    return count


def _import_vaccination_records(db: Session, records_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import vaccination records from seed data."""
    log("Importing vaccination records...")
    count = 0
    today = date.today()

    for record_data in records_data:
        # Get horse by name and owner
        horse_name = record_data.get("horse_name")
        owner_username = record_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping vaccination record")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping vaccination record")
            continue

        # Calculate dates
        vaccination_date = today
        if "days_ago" in record_data:
            vaccination_date = today - timedelta(days=record_data["days_ago"])
        elif record_data.get("vaccination_date"):
            vaccination_date = datetime.fromisoformat(record_data["vaccination_date"]).date()

        next_due = None
        if record_data.get("next_due_months"):
            next_due = vaccination_date + timedelta(days=record_data["next_due_months"] * 30)
        elif record_data.get("next_due"):
            next_due = datetime.fromisoformat(record_data["next_due"]).date()

        # Parse vaccine type
        vaccine_type_str = record_data.get("vaccine_type", "flu_tetanus")
        try:
            vaccine_type = VaccineType(vaccine_type_str)
        except ValueError:
            vaccine_type = VaccineType.OTHER

        record = VaccinationRecord(
            horse_id=horse.id,
            vaccination_date=vaccination_date,
            vaccine_type=vaccine_type,
            vaccine_name=record_data.get("vaccine_name"),
            batch_number=record_data.get("batch_number"),
            administered_by=record_data.get("administered_by"),
            next_due=next_due,
            notes=record_data.get("notes"),
        )
        db.add(record)
        count += 1
        log(f"  Created vaccination record for: {horse_name}")

    db.flush()
    return count


def _import_worming_records(db: Session, records_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import worming records from seed data."""
    log("Importing worming records...")
    count = 0
    today = date.today()

    for record_data in records_data:
        # Get horse by name and owner
        horse_name = record_data.get("horse_name")
        owner_username = record_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping worming record")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping worming record")
            continue

        # Calculate dates
        treatment_date = today
        if "days_ago" in record_data:
            treatment_date = today - timedelta(days=record_data["days_ago"])
        elif record_data.get("treatment_date"):
            treatment_date = datetime.fromisoformat(record_data["treatment_date"]).date()

        next_due = None
        if record_data.get("next_due_weeks"):
            next_due = treatment_date + timedelta(weeks=record_data["next_due_weeks"])
        elif record_data.get("next_due"):
            next_due = datetime.fromisoformat(record_data["next_due"]).date()

        # Worm count date
        worm_count_date = None
        if record_data.get("worm_count_days_ago"):
            worm_count_date = today - timedelta(days=record_data["worm_count_days_ago"])

        record = WormingRecord(
            horse_id=horse.id,
            treatment_date=treatment_date,
            product=record_data.get("product", "Equest Pramox"),
            worm_count_date=worm_count_date,
            worm_count_result=record_data.get("worm_count_result"),
            next_due=next_due,
            notes=record_data.get("notes"),
        )
        db.add(record)
        count += 1
        log(f"  Created worming record for: {horse_name}")

    db.flush()
    return count


def _import_weight_records(db: Session, records_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import weight records from seed data."""
    log("Importing weight records...")
    count = 0
    today = date.today()

    for record_data in records_data:
        # Get horse by name and owner
        horse_name = record_data.get("horse_name")
        owner_username = record_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping weight record")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping weight record")
            continue

        # Calculate date
        record_date = today
        if "days_ago" in record_data:
            record_date = today - timedelta(days=record_data["days_ago"])
        elif record_data.get("record_date"):
            record_date = datetime.fromisoformat(record_data["record_date"]).date()

        record = WeightRecord(
            horse_id=horse.id,
            record_date=record_date,
            weight_kg=record_data.get("weight_kg"),
            unit_entered=record_data.get("unit_entered", "kg"),
            method=record_data.get("method"),
            notes=record_data.get("notes"),
        )
        db.add(record)
        count += 1
        log(f"  Created weight record for: {horse_name}")

    db.flush()
    return count


def _import_body_condition_records(db: Session, records_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import body condition records from seed data."""
    log("Importing body condition records...")
    count = 0
    today = date.today()

    for record_data in records_data:
        # Get horse by name and owner
        horse_name = record_data.get("horse_name")
        owner_username = record_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping body condition record")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping body condition record")
            continue

        # Calculate date
        record_date = today
        if "days_ago" in record_data:
            record_date = today - timedelta(days=record_data["days_ago"])
        elif record_data.get("record_date"):
            record_date = datetime.fromisoformat(record_data["record_date"]).date()

        record = BodyConditionRecord(
            horse_id=horse.id,
            record_date=record_date,
            score=record_data.get("score"),
            assessed_by=record_data.get("assessed_by"),
            notes=record_data.get("notes"),
        )
        db.add(record)
        count += 1
        log(f"  Created body condition record for: {horse_name}")

    db.flush()
    return count


def _import_saddle_fit_records(db: Session, records_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import saddle fit records from seed data."""
    log("Importing saddle fit records...")
    count = 0
    today = date.today()

    for record_data in records_data:
        # Get horse by name and owner
        horse_name = record_data.get("horse_name")
        owner_username = record_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping saddle fit record")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping saddle fit record")
            continue

        # Calculate date
        check_date = today
        if "days_ago" in record_data:
            check_date = today - timedelta(days=record_data["days_ago"])
        elif record_data.get("check_date"):
            check_date = datetime.fromisoformat(record_data["check_date"]).date()

        # Calculate next check due
        next_check_due = None
        if record_data.get("next_check_months"):
            next_check_due = check_date + timedelta(days=record_data["next_check_months"] * 30)
        elif record_data.get("next_check_due"):
            next_check_due = datetime.fromisoformat(record_data["next_check_due"]).date()

        record = SaddleFitRecord(
            horse_id=horse.id,
            check_date=check_date,
            fitter_name=record_data.get("fitter_name"),
            saddle_type=record_data.get("saddle_type"),
            fit_status=record_data.get("fit_status", "good"),
            adjustments_made=record_data.get("adjustments_made"),
            next_check_due=next_check_due,
            cost=record_data.get("cost"),
            notes=record_data.get("notes"),
        )
        db.add(record)
        count += 1
        log(f"  Created saddle fit record for: {horse_name}")

    db.flush()
    return count


def _import_feed_additions(db: Session, additions_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import feed additions (medications/supplements) from seed data."""
    log("Importing feed additions...")
    count = 0
    today = date.today()

    for addition_data in additions_data:
        # Get horse by name and owner
        horse_name = addition_data.get("horse_name")
        owner_username = addition_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping feed addition")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping feed addition")
            continue

        # Resolve requested_by
        requested_by_username = addition_data.get("requested_by_username", owner_username)
        requested_by_id = user_map.get(requested_by_username) or owner_id

        # Resolve approved_by
        approved_by_id = None
        if addition_data.get("approved_by_username"):
            approved_by_id = user_map.get(addition_data["approved_by_username"])

        # Calculate dates
        start_date = today
        if addition_data.get("start_days_ago"):
            start_date = today - timedelta(days=addition_data["start_days_ago"])
        elif addition_data.get("start_date"):
            start_date = datetime.fromisoformat(addition_data["start_date"]).date()

        end_date = None
        if addition_data.get("end_days_from_now"):
            end_date = today + timedelta(days=addition_data["end_days_from_now"])
        elif addition_data.get("end_date"):
            end_date = datetime.fromisoformat(addition_data["end_date"]).date()

        # Parse feed time
        feed_time_str = addition_data.get("feed_time", "both")
        try:
            feed_time = FeedTime(feed_time_str)
        except ValueError:
            feed_time = FeedTime.BOTH

        # Parse status
        status_str = addition_data.get("status", "approved")
        try:
            addition_status = AdditionStatus(status_str)
        except ValueError:
            addition_status = AdditionStatus.APPROVED

        addition = FeedAddition(
            horse_id=horse.id,
            name=addition_data.get("name"),
            dosage=addition_data.get("dosage", "1 scoop"),
            feed_time=feed_time,
            start_date=start_date,
            end_date=end_date,
            reason=addition_data.get("reason"),
            status=addition_status,
            is_active=addition_data.get("is_active", True),
            requested_by_id=requested_by_id,
            approved_by_id=approved_by_id,
        )
        db.add(addition)
        count += 1
        log(f"  Created feed addition: {addition_data.get('name')} for {horse_name}")

    db.flush()
    return count


def _import_wound_care_logs(db: Session, logs_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import wound care logs from seed data."""
    log("Importing wound care logs...")
    count = 0
    today = date.today()

    for log_data in logs_data:
        # Get horse by name and owner
        horse_name = log_data.get("horse_name")
        owner_username = log_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping wound care log")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping wound care log")
            continue

        # Resolve treated_by
        treated_by_username = log_data.get("treated_by_username", "staff1")
        treated_by_id = user_map.get(treated_by_username)
        if not treated_by_id:
            treated_by_id = user_map.get("admin")

        # Calculate dates
        treatment_date = today
        if "days_ago" in log_data:
            treatment_date = today - timedelta(days=log_data["days_ago"])

        next_treatment_due = None
        if log_data.get("next_treatment_days"):
            next_treatment_due = today + timedelta(days=log_data["next_treatment_days"])

        # Parse healing status
        healing_status = None
        if log_data.get("healing_assessment"):
            try:
                healing_status = HealingStatus(log_data["healing_assessment"])
            except ValueError:
                pass

        wound_log = WoundCareLog(
            horse_id=horse.id,
            wound_name=log_data.get("wound_name", "Wound"),
            wound_location=log_data.get("wound_location"),
            wound_description=log_data.get("wound_description"),
            treatment_date=treatment_date,
            treatment_given=log_data.get("treatment_given", "Cleaned and dressed"),
            products_used=log_data.get("products_used"),
            healing_assessment=healing_status,
            assessment_notes=log_data.get("assessment_notes"),
            next_treatment_due=next_treatment_due,
            treated_by_id=treated_by_id,
            is_resolved=log_data.get("is_resolved", False),
        )
        db.add(wound_log)
        count += 1
        log(f"  Created wound care log for: {horse_name}")

    db.flush()
    return count


def _import_health_observations(db: Session, observations_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import health observations from seed data."""
    log("Importing health observations...")
    count = 0
    today = date.today()

    for obs_data in observations_data:
        # Get horse by name and owner
        horse_name = obs_data.get("horse_name")
        owner_username = obs_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping health observation")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping health observation")
            continue

        # Resolve observed_by
        observed_by_username = obs_data.get("observed_by_username", "staff1")
        observed_by_id = user_map.get(observed_by_username)
        if not observed_by_id:
            observed_by_id = user_map.get("admin")

        # Calculate date
        observation_date = today
        if "days_ago" in obs_data:
            observation_date = today - timedelta(days=obs_data["days_ago"])

        # Parse enums
        appetite = None
        if obs_data.get("appetite"):
            try:
                appetite = AppetiteStatus(obs_data["appetite"])
            except ValueError:
                pass

        demeanor = None
        if obs_data.get("demeanor"):
            try:
                demeanor = DemeanorStatus(obs_data["demeanor"])
            except ValueError:
                pass

        observation = HealthObservation(
            horse_id=horse.id,
            observation_date=observation_date,
            temperature=obs_data.get("temperature"),
            appetite=appetite,
            demeanor=demeanor,
            droppings_normal=obs_data.get("droppings_normal"),
            concerns=obs_data.get("concerns"),
            action_taken=obs_data.get("action_taken"),
            vet_notified=obs_data.get("vet_notified", False),
            observed_by_id=observed_by_id,
        )
        db.add(observation)
        count += 1
        log(f"  Created health observation for: {horse_name}")

    db.flush()
    return count


def _import_rehab_programs(db: Session, programs_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import rehabilitation programs with phases and tasks from seed data."""
    log("Importing rehabilitation programs...")
    count = 0
    today = date.today()

    for program_data in programs_data:
        # Get horse by name and owner
        horse_name = program_data.get("horse_name")
        owner_username = program_data.get("owner_username")
        owner_id = user_map.get(owner_username)

        if not owner_id:
            log(f"  Warning: Owner '{owner_username}' not found, skipping rehab program")
            continue

        horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping rehab program")
            continue

        # Resolve created_by
        created_by_username = program_data.get("created_by_username", "admin")
        created_by_id = user_map.get(created_by_username) or user_map.get("admin")

        # Calculate dates
        start_date = today
        if program_data.get("start_days_ago"):
            start_date = today - timedelta(days=program_data["start_days_ago"])
        elif program_data.get("start_date"):
            start_date = datetime.fromisoformat(program_data["start_date"]).date()

        expected_end_date = None
        if program_data.get("duration_weeks"):
            expected_end_date = start_date + timedelta(weeks=program_data["duration_weeks"])

        # Parse status
        status_str = program_data.get("status", "active")
        try:
            rehab_status = RehabStatus(status_str)
        except ValueError:
            rehab_status = RehabStatus.ACTIVE

        program = RehabProgram(
            horse_id=horse.id,
            name=program_data.get("name", "Recovery Program"),
            description=program_data.get("description"),
            reason=program_data.get("reason"),
            prescribed_by=program_data.get("prescribed_by"),
            prescription_date=start_date,
            start_date=start_date,
            expected_end_date=expected_end_date,
            status=rehab_status,
            current_phase=program_data.get("current_phase", 1),
            notes=program_data.get("notes"),
            created_by_id=created_by_id,
        )
        db.add(program)
        db.flush()  # Get ID for phases

        # Add phases
        for phase_data in program_data.get("phases", []):
            phase = RehabPhase(
                program_id=program.id,
                phase_number=phase_data.get("phase_number", 1),
                name=phase_data.get("name", "Phase"),
                description=phase_data.get("description"),
                duration_days=phase_data.get("duration_days", 7),
                start_day=phase_data.get("start_day", 1),
                is_completed=phase_data.get("is_completed", False),
            )
            db.add(phase)
            db.flush()  # Get ID for tasks

            # Add tasks
            for task_data in phase_data.get("tasks", []):
                # Parse frequency
                freq_str = task_data.get("frequency", "daily")
                try:
                    frequency = TaskFrequency(freq_str)
                except ValueError:
                    frequency = TaskFrequency.DAILY

                task = RehabTask(
                    phase_id=phase.id,
                    task_type=task_data.get("task_type", "exercise"),
                    description=task_data.get("description", "Complete task"),
                    duration_minutes=task_data.get("duration_minutes"),
                    frequency=frequency,
                    instructions=task_data.get("instructions"),
                    equipment_needed=task_data.get("equipment_needed"),
                    is_feed_based=task_data.get("is_feed_based", False),
                    feed_time=task_data.get("feed_time"),
                    sequence=task_data.get("sequence", 0),
                )
                db.add(task)

        count += 1
        log(f"  Created rehab program: {program_data.get('name')} for {horse_name}")

    db.flush()
    return count


def _import_rehab_task_logs(db: Session, logs_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import rehabilitation task logs from seed data."""
    log("Importing rehab task logs...")
    count = 0
    today = date.today()

    for log_data in logs_data:
        # Get horse by name
        horse_name = log_data.get("horse_name")
        horse = db.query(Horse).filter(Horse.name == horse_name).first()
        if not horse:
            log(f"  Warning: Horse '{horse_name}' not found, skipping task log")
            continue

        # Get program by name and horse
        program_name = log_data.get("program_name")
        program = db.query(RehabProgram).filter(
            RehabProgram.horse_id == horse.id,
            RehabProgram.name == program_name
        ).first()
        if not program:
            log(f"  Warning: Program '{program_name}' not found for horse '{horse_name}', skipping task log")
            continue

        # Get task by type within program
        task_type = log_data.get("task_type")
        task = db.query(RehabTask).join(RehabPhase).filter(
            RehabPhase.program_id == program.id,
            RehabTask.task_type == task_type
        ).first()
        if not task:
            log(f"  Warning: Task type '{task_type}' not found in program, skipping task log")
            continue

        # Get completed_by user
        completed_by_username = log_data.get("completed_by_username")
        completed_by_id = user_map.get(completed_by_username)
        if not completed_by_id:
            log(f"  Warning: User '{completed_by_username}' not found, skipping task log")
            continue

        # Calculate log date
        log_date = today
        if "days_ago" in log_data:
            log_date = today - timedelta(days=log_data["days_ago"])
        elif "days_from_now" in log_data:
            log_date = today + timedelta(days=log_data["days_from_now"])

        task_log = RehabTaskLog(
            task_id=task.id,
            program_id=program.id,
            horse_id=horse.id,
            log_date=log_date,
            was_completed=log_data.get("was_completed", True),
            skip_reason=log_data.get("skip_reason"),
            actual_duration_minutes=log_data.get("actual_duration_minutes"),
            horse_response=log_data.get("horse_response"),
            concerns=log_data.get("concerns"),
            vet_notified=log_data.get("vet_notified", False),
            lameness_score=log_data.get("lameness_score"),
            physical_observations=log_data.get("physical_observations"),
            completed_by_id=completed_by_id,
            completed_at=datetime.combine(log_date, datetime.min.time()) + timedelta(hours=10)
        )
        db.add(task_log)
        count += 1

    db.flush()
    log(f"  Created {count} rehab task logs")
    return count


def _import_shifts(db: Session, shifts_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import staff shifts from seed data."""
    log("Importing shifts...")
    count = 0
    today = date.today()

    for shift_data in shifts_data:
        # Get staff by username
        staff_username = shift_data.get("staff_username")
        staff_id = user_map.get(staff_username)
        if not staff_id:
            log(f"  Warning: Staff '{staff_username}' not found, skipping shift")
            continue

        # Resolve created_by
        created_by_username = shift_data.get("created_by_username", "admin")
        created_by_id = user_map.get(created_by_username) or user_map.get("admin")

        # Calculate date
        shift_date = today
        if "days_from_now" in shift_data:
            shift_date = today + timedelta(days=shift_data["days_from_now"])
        elif "days_ago" in shift_data:
            shift_date = today - timedelta(days=shift_data["days_ago"])

        # Parse enums
        shift_type_str = shift_data.get("shift_type", "full_day")
        try:
            shift_type = ShiftType(shift_type_str)
        except ValueError:
            shift_type = ShiftType.FULL_DAY

        role_str = shift_data.get("role", "yard_duties")
        try:
            role = ShiftRole(role_str)
        except ValueError:
            role = ShiftRole.YARD_DUTIES

        shift = Shift(
            staff_id=staff_id,
            date=shift_date,
            shift_type=shift_type,
            role=role,
            notes=shift_data.get("notes"),
            created_by_id=created_by_id,
        )
        db.add(shift)
        count += 1
        log(f"  Created shift: {staff_username} on {shift_date}")

    db.flush()
    return count


def _import_invoices(db: Session, invoices_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import invoices with line items from seed data."""
    log("Importing invoices...")
    count = 0
    today = date.today()
    invoice_counter = 1

    for invoice_data in invoices_data:
        # Get user by username
        user_username = invoice_data.get("user_username")
        user_id = user_map.get(user_username)
        if not user_id:
            log(f"  Warning: User '{user_username}' not found, skipping invoice")
            continue

        # Resolve created_by
        created_by_username = invoice_data.get("created_by_username", "admin")
        created_by_id = user_map.get(created_by_username) or user_map.get("admin")

        # Calculate dates
        period_start = today.replace(day=1)
        if invoice_data.get("period_start_months_ago"):
            months_ago = invoice_data["period_start_months_ago"]
            period_start = (today.replace(day=1) - timedelta(days=months_ago * 30)).replace(day=1)

        period_end = (period_start + timedelta(days=32)).replace(day=1) - timedelta(days=1)

        issue_date = None
        due_date = None
        if invoice_data.get("status") != "draft":
            issue_date = period_end + timedelta(days=1)
            due_date = issue_date + timedelta(days=14)

        # Parse status
        status_str = invoice_data.get("status", "draft")
        try:
            invoice_status = InvoiceStatus(status_str)
        except ValueError:
            invoice_status = InvoiceStatus.DRAFT

        # Generate invoice number
        invoice_number = invoice_data.get("invoice_number", f"INV-{today.year}-{invoice_counter:04d}")
        invoice_counter += 1

        invoice = Invoice(
            user_id=user_id,
            invoice_number=invoice_number,
            period_start=period_start,
            period_end=period_end,
            subtotal=invoice_data.get("subtotal", 0),
            payments_received=invoice_data.get("payments_received", 0),
            balance_due=invoice_data.get("balance_due", 0),
            status=invoice_status,
            issue_date=issue_date,
            due_date=due_date,
            notes=invoice_data.get("notes"),
            created_by_id=created_by_id,
        )
        db.add(invoice)
        db.flush()  # Get ID for line items

        # Add line items
        for item_data in invoice_data.get("line_items", []):
            line_item = InvoiceLineItem(
                invoice_id=invoice.id,
                description=item_data.get("description", "Item"),
                quantity=item_data.get("quantity", 1),
                unit_price=item_data.get("unit_price", 0),
                amount=item_data.get("amount", 0),
                category=item_data.get("category"),
            )
            db.add(line_item)

        count += 1
        log(f"  Created invoice: {invoice_number} for {user_username}")

    db.flush()
    return count


def _import_turnout_groups(db: Session, groups_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import turnout groups with assigned horses from seed data."""
    log("Importing turnout groups...")
    count = 0
    today = date.today()

    for group_data in groups_data:
        # Get field by name
        field_name = group_data.get("field_name")
        field = db.query(Field).filter(Field.name == field_name).first()
        if not field:
            log(f"  Warning: Field '{field_name}' not found, skipping turnout group")
            continue

        # Resolve assigned_by
        assigned_by_username = group_data.get("assigned_by_username", "admin")
        assigned_by_id = user_map.get(assigned_by_username) or user_map.get("admin")

        # Calculate date
        turnout_date = today
        if "days_from_now" in group_data:
            turnout_date = today + timedelta(days=group_data["days_from_now"])
        elif "days_ago" in group_data:
            turnout_date = today - timedelta(days=group_data["days_ago"])

        group = TurnoutGroup(
            turnout_date=turnout_date,
            field_id=field.id,
            notes=group_data.get("notes"),
            assigned_by_id=assigned_by_id,
        )
        db.add(group)
        db.flush()  # Get ID for horses

        # Add horses to group
        for horse_data in group_data.get("horses", []):
            horse_name = horse_data.get("horse_name")
            owner_username = horse_data.get("owner_username")
            owner_id = user_map.get(owner_username)

            if not owner_id:
                log(f"  Warning: Owner '{owner_username}' not found, skipping horse in turnout group")
                continue

            horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
            if not horse:
                log(f"  Warning: Horse '{horse_name}' not found, skipping in turnout group")
                continue

            # Resolve turned_out_by
            turned_out_by_id = None
            if horse_data.get("turned_out_by_username"):
                turned_out_by_id = user_map.get(horse_data["turned_out_by_username"])

            group_horse = TurnoutGroupHorse(
                group_id=group.id,
                horse_id=horse.id,
                turned_out_at=datetime.now() if horse_data.get("is_out") else None,
                turned_out_by_id=turned_out_by_id,
            )
            db.add(group_horse)

        count += 1
        log(f"  Created turnout group for {field_name} on {turnout_date}")

    db.flush()
    return count


def _import_field_usage_logs(db: Session, logs_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import field usage logs from seed data."""
    log("Importing field usage logs...")
    count = 0
    today = date.today()

    for log_data in logs_data:
        # Get field by name
        field_name = log_data.get("field_name")
        field = db.query(Field).filter(Field.name == field_name).first()
        if not field:
            log(f"  Warning: Field '{field_name}' not found, skipping usage log")
            continue

        # Resolve logged_by
        logged_by_username = log_data.get("logged_by_username", "staff1")
        logged_by_id = user_map.get(logged_by_username)

        # Calculate date
        usage_date = today
        if "days_ago" in log_data:
            usage_date = today - timedelta(days=log_data["days_ago"])

        # Parse conditions
        condition_start = None
        if log_data.get("condition_start"):
            try:
                condition_start = FieldCondition(log_data["condition_start"])
            except ValueError:
                pass

        condition_end = None
        if log_data.get("condition_end"):
            try:
                condition_end = FieldCondition(log_data["condition_end"])
            except ValueError:
                pass

        usage_log = FieldUsageLog(
            field_id=field.id,
            usage_date=usage_date,
            condition_start=condition_start,
            condition_end=condition_end,
            notes=log_data.get("notes"),
            logged_by_id=logged_by_id,
        )
        db.add(usage_log)
        db.flush()  # Get ID for horses

        # Add horses to usage log
        for horse_data in log_data.get("horses", []):
            horse_name = horse_data.get("horse_name")
            owner_username = horse_data.get("owner_username")
            owner_id = user_map.get(owner_username)

            if not owner_id:
                continue

            horse = db.query(Horse).filter(Horse.name == horse_name, Horse.owner_id == owner_id).first()
            if not horse:
                continue

            usage_horse = FieldUsageHorse(
                usage_log_id=usage_log.id,
                horse_id=horse.id,
            )
            db.add(usage_horse)

        count += 1
        log(f"  Created field usage log for {field_name} on {usage_date}")

    db.flush()
    return count


def _import_coach_availability_slots(db: Session, slots_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import coach availability slots from seed data."""
    log("Importing coach availability slots...")
    count = 0
    today = date.today()

    for slot_data in slots_data:
        # Get coach profile by username
        coach_username = slot_data.get("coach_username")
        coach_profile = db.query(CoachProfile).join(
            User, CoachProfile.user_id == User.id
        ).filter(User.username == coach_username).first()

        if not coach_profile:
            log(f"  Warning: Coach profile for '{coach_username}' not found, skipping availability slot")
            continue

        # Calculate date
        slot_date = today
        if "days_from_now" in slot_data:
            slot_date = today + timedelta(days=slot_data["days_from_now"])
        elif "days_ago" in slot_data:
            slot_date = today - timedelta(days=slot_data["days_ago"])

        # Parse times
        start_time = time_obj.fromisoformat(slot_data.get("start_time", "09:00"))
        end_time = time_obj.fromisoformat(slot_data.get("end_time", "17:00"))

        slot = CoachAvailabilitySlot(
            coach_profile_id=coach_profile.id,
            date=slot_date,
            start_time=start_time,
            end_time=end_time,
            is_blocked=slot_data.get("is_blocked", False),
            block_reason=slot_data.get("block_reason"),
        )
        db.add(slot)
        count += 1
        log(f"  Created availability slot for {coach_username} on {slot_date}")

    db.flush()
    return count


def _import_holiday_livery_requests(db: Session, requests_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import holiday livery requests from seed data."""
    log("Importing holiday livery requests...")
    count = 0
    today = date.today()

    for req_data in requests_data:
        guest_email = req_data.get("guest_email")

        # Check if already exists
        existing = db.query(HolidayLiveryRequest).filter(
            HolidayLiveryRequest.guest_email == guest_email,
            HolidayLiveryRequest.horse_name == req_data.get("horse_name")
        ).first()
        if existing:
            log(f"  Holiday livery request for {guest_email} already exists, skipping")
            continue

        # Calculate dates
        arrival_days = req_data.get("requested_arrival_days_from_now", 14)
        departure_days = req_data.get("requested_departure_days_from_now", 21)
        requested_arrival = today + timedelta(days=arrival_days)
        requested_departure = today + timedelta(days=departure_days)

        # Parse status
        status_str = req_data.get("status", "pending")
        try:
            status = HolidayLiveryStatus(status_str)
        except ValueError:
            status = HolidayLiveryStatus.PENDING

        # Resolve processed_by for approved/rejected requests
        processed_by_id = None
        processed_at = None
        if req_data.get("processed_by_username"):
            processed_by_id = user_map.get(req_data["processed_by_username"])
            if status != HolidayLiveryStatus.PENDING:
                processed_at = datetime.now()

        # Get confirmed dates if approved
        confirmed_arrival = None
        confirmed_departure = None
        if status == HolidayLiveryStatus.APPROVED:
            confirmed_arrival_days = req_data.get("confirmed_arrival_days_from_now", arrival_days)
            confirmed_departure_days = req_data.get("confirmed_departure_days_from_now", departure_days)
            confirmed_arrival = today + timedelta(days=confirmed_arrival_days)
            confirmed_departure = today + timedelta(days=confirmed_departure_days)

        # Resolve stable assignment
        assigned_stable_id = None
        if req_data.get("assigned_stable_name"):
            stable = db.query(Stable).filter(Stable.name == req_data["assigned_stable_name"]).first()
            if stable:
                assigned_stable_id = stable.id

        request = HolidayLiveryRequest(
            guest_name=req_data.get("guest_name"),
            guest_email=guest_email,
            guest_phone=req_data.get("guest_phone"),
            horse_name=req_data.get("horse_name"),
            horse_breed=req_data.get("horse_breed"),
            horse_age=req_data.get("horse_age"),
            horse_colour=req_data.get("horse_colour"),
            horse_gender=req_data.get("horse_gender"),
            special_requirements=req_data.get("special_requirements"),
            requested_arrival=requested_arrival,
            requested_departure=requested_departure,
            message=req_data.get("message"),
            status=status,
            admin_notes=req_data.get("admin_notes"),
            rejection_reason=req_data.get("rejection_reason"),
            confirmed_arrival=confirmed_arrival,
            confirmed_departure=confirmed_departure,
            assigned_stable_id=assigned_stable_id,
            processed_by_id=processed_by_id,
            processed_at=processed_at,
        )
        db.add(request)
        count += 1
        log(f"  Created holiday livery request: {req_data.get('guest_name')} - {req_data.get('horse_name')} ({status.value})")

    db.flush()
    return count


def _import_contracts(
    db: Session,
    templates_data: List[Dict],
    user_map: Dict[str, int],
    user_id_map: Dict[int, int],
    package_map: Dict[str, int],
    log: Callable
) -> Tuple[int, int, int]:
    """
    Import contract templates with versions and signatures.
    Returns (template_count, version_count, signature_count).
    """
    log("Importing contract templates...")
    template_count = 0
    version_count = 0
    signature_count = 0
    today = date.today()

    for template_data in templates_data:
        # Resolve created_by user - try ID map first (backup format), then username (seed format)
        created_by_id = None
        old_created_by_id = template_data.get("created_by_id")
        if old_created_by_id and old_created_by_id in user_id_map:
            created_by_id = user_id_map[old_created_by_id]
        elif template_data.get("created_by_username"):
            created_by_id = user_map.get(template_data["created_by_username"])

        # If still no created_by_id, use the first admin user as fallback
        if not created_by_id:
            admin_user = db.query(User).filter(User.role == UserRole.ADMIN).first()
            if admin_user:
                created_by_id = admin_user.id

        # Resolve optional livery package
        livery_package_id = None
        if template_data.get("livery_package_name"):
            livery_package_id = package_map.get(template_data["livery_package_name"])

        # Handle contract type enum
        contract_type_str = template_data.get("contract_type", "livery")
        contract_type = ContractType(contract_type_str)

        template = ContractTemplate(
            name=template_data.get("name"),
            contract_type=contract_type,
            livery_package_id=livery_package_id,
            description=template_data.get("description"),
            is_active=template_data.get("is_active", True),
            created_by_id=created_by_id,
        )
        db.add(template)
        db.flush()
        template_count += 1
        log(f"  Created contract template: {template.name}")

        # Import versions for this template
        for version_data in template_data.get("versions", []):
            version_created_by_id = created_by_id
            if version_data.get("created_by_username"):
                version_created_by_id = user_map.get(version_data["created_by_username"])

            version = ContractVersion(
                template_id=template.id,
                version_number=version_data.get("version_number", 1),
                html_content=version_data.get("html_content", "<p>Contract content</p>"),
                change_summary=version_data.get("change_summary"),
                is_current=version_data.get("is_current", True),
                created_by_id=version_created_by_id,
            )
            db.add(version)
            db.flush()
            version_count += 1

            # Import signatures for this version
            for sig_data in version_data.get("signatures", []):
                user_id = None
                if sig_data.get("user_username"):
                    user_id = user_map.get(sig_data["user_username"])

                requested_by_id = created_by_id
                if sig_data.get("requested_by_username"):
                    requested_by_id = user_map.get(sig_data["requested_by_username"])

                # Handle status enum
                status_str = sig_data.get("status", "pending")
                status = SignatureStatus(status_str)

                # Handle relative dates
                requested_at = datetime.now()
                if sig_data.get("requested_days_ago"):
                    requested_at = datetime.combine(
                        today - timedelta(days=sig_data["requested_days_ago"]),
                        datetime.min.time()
                    )

                signed_at = None
                if sig_data.get("signed_days_ago") is not None:
                    signed_at = datetime.combine(
                        today - timedelta(days=sig_data["signed_days_ago"]),
                        datetime.min.time()
                    )

                signature = ContractSignature(
                    contract_version_id=version.id,
                    user_id=user_id,
                    status=status,
                    requested_at=requested_at,
                    signed_at=signed_at,
                    requested_by_id=requested_by_id,
                    notes=sig_data.get("notes"),
                )
                db.add(signature)
                signature_count += 1

    db.flush()
    log(f"  Imported {template_count} templates, {version_count} versions, {signature_count} signatures")
    return template_count, version_count, signature_count


def _import_flood_monitoring_stations(db: Session, stations_data: List[Dict], log: Callable) -> int:
    """Import flood monitoring stations."""
    log("Importing flood monitoring stations...")
    count = 0

    for station_data in stations_data:
        station_id = station_data.get("station_id")
        existing = db.query(FloodMonitoringStation).filter(
            FloodMonitoringStation.station_id == station_id
        ).first()
        if existing:
            log(f"  Station '{station_id}' already exists, skipping")
            continue

        station = FloodMonitoringStation(
            station_id=station_id,
            station_name=station_data.get("station_name"),
            river_name=station_data.get("river_name"),
            latitude=station_data.get("latitude"),
            longitude=station_data.get("longitude"),
            warning_threshold_meters=station_data.get("warning_threshold_meters"),
            severe_threshold_meters=station_data.get("severe_threshold_meters"),
            is_active=station_data.get("is_active", True),
            notes=station_data.get("notes"),
        )
        db.add(station)
        count += 1
        log(f"  Created flood monitoring station: {station_data.get('station_name')} ({station_id})")

    db.flush()
    return count


def _import_land_features(db: Session, features_data: List[Dict], log: Callable) -> int:
    """Import land features (hedgerows, trees, water troughs, fences, etc.)."""
    log("Importing land features...")
    count = 0
    today = date.today()

    for feature_data in features_data:
        name = feature_data.get("name")
        existing = db.query(LandFeature).filter(LandFeature.name == name).first()
        if existing:
            log(f"  Land feature '{name}' already exists, skipping")
            continue

        # Parse enums
        feature_type_str = feature_data.get("feature_type", "other")
        try:
            feature_type = LandFeatureType(feature_type_str)
        except ValueError:
            feature_type = LandFeatureType.OTHER

        condition_str = feature_data.get("current_condition", "good")
        try:
            condition = FeatureCondition(condition_str)
        except ValueError:
            condition = FeatureCondition.GOOD

        water_source = None
        if feature_data.get("water_source_type"):
            try:
                water_source = WaterSourceType(feature_data["water_source_type"])
            except ValueError:
                pass

        # Handle relative dates
        last_fill_date = None
        if feature_data.get("last_fill_days_ago") is not None:
            last_fill_date = today - timedelta(days=feature_data["last_fill_days_ago"])
        elif feature_data.get("last_fill_date"):
            last_fill_date = datetime.fromisoformat(feature_data["last_fill_date"]).date()

        last_maintenance_date = None
        if feature_data.get("last_maintenance_days_ago") is not None:
            last_maintenance_date = today - timedelta(days=feature_data["last_maintenance_days_ago"])

        # Look up field by name if provided
        field_id = None
        if feature_data.get("field_name"):
            field = db.query(Field).filter(Field.name == feature_data["field_name"]).first()
            if field:
                field_id = field.id

        feature = LandFeature(
            name=name,
            feature_type=feature_type,
            description=feature_data.get("description"),
            field_id=field_id,
            location_description=feature_data.get("location_description"),
            length_meters=feature_data.get("length_meters"),
            area_sqm=feature_data.get("area_sqm"),
            current_condition=condition,
            maintenance_frequency_days=feature_data.get("maintenance_frequency_days"),
            last_maintenance_date=last_maintenance_date,
            tpo_protected=feature_data.get("tpo_protected", False),
            tpo_reference=feature_data.get("tpo_reference"),
            tree_species=feature_data.get("tree_species"),
            hedgerow_species_mix=feature_data.get("hedgerow_species_mix"),
            fence_type=feature_data.get("fence_type"),
            fence_height_cm=feature_data.get("fence_height_cm"),
            water_source_type=water_source,
            fill_frequency_days=feature_data.get("fill_frequency_days"),
            last_fill_date=last_fill_date,
            electric_fence_working=feature_data.get("electric_fence_working", True),
            electric_fence_voltage=feature_data.get("electric_fence_voltage"),
            notes=feature_data.get("notes"),
            is_active=feature_data.get("is_active", True),
        )
        db.add(feature)
        count += 1
        log(f"  Created land feature: {name} ({feature_type_str})")

    db.flush()
    return count


def _import_grants(db: Session, grants_data: List[Dict], log: Callable) -> int:
    """Import grants and environmental schemes."""
    log("Importing grants...")
    count = 0
    today = date.today()

    for grant_data in grants_data:
        name = grant_data.get("name")
        existing = db.query(Grant).filter(Grant.name == name).first()
        if existing:
            log(f"  Grant '{name}' already exists, skipping")
            continue

        # Parse enums
        scheme_type_str = grant_data.get("scheme_type", "other")
        try:
            scheme_type = GrantSchemeType(scheme_type_str)
        except ValueError:
            scheme_type = GrantSchemeType.OTHER

        status_str = grant_data.get("status", "active")
        try:
            status = GrantStatus(status_str)
        except ValueError:
            status = GrantStatus.ACTIVE

        # Handle relative dates
        agreement_start = None
        if grant_data.get("agreement_start_days_ago") is not None:
            agreement_start = today - timedelta(days=grant_data["agreement_start_days_ago"])
        elif grant_data.get("agreement_start_date"):
            agreement_start = datetime.fromisoformat(grant_data["agreement_start_date"]).date()

        agreement_end = None
        if grant_data.get("agreement_end_days_from_now") is not None:
            agreement_end = today + timedelta(days=grant_data["agreement_end_days_from_now"])
        elif grant_data.get("agreement_end_date"):
            agreement_end = datetime.fromisoformat(grant_data["agreement_end_date"]).date()

        next_inspection = None
        if grant_data.get("next_inspection_days_from_now") is not None:
            next_inspection = today + timedelta(days=grant_data["next_inspection_days_from_now"])

        grant = Grant(
            name=name,
            scheme_type=scheme_type,
            status=status,
            reference_number=grant_data.get("reference_number"),
            agreement_start_date=agreement_start,
            agreement_end_date=agreement_end,
            total_value=grant_data.get("total_value"),
            annual_payment=grant_data.get("annual_payment"),
            scheme_provider=grant_data.get("scheme_provider"),
            next_inspection_date=next_inspection,
            inspection_notes=grant_data.get("inspection_notes"),
            compliance_requirements=grant_data.get("compliance_requirements"),
            notes=grant_data.get("notes"),
        )
        db.add(grant)
        count += 1
        log(f"  Created grant: {name}")

    db.flush()
    return count


def _import_risk_assessments(db: Session, assessments_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import risk assessments."""
    log("Importing risk assessments...")
    count = 0
    today = date.today()

    # Get admin user for created_by
    admin_user_id = user_map.get("admin")
    if not admin_user_id:
        # Fall back to first admin user
        from app.models import User, UserRole
        admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
        admin_user_id = admin.id if admin else 1

    for assessment_data in assessments_data:
        title = assessment_data.get("title")
        existing = db.query(RiskAssessment).filter(RiskAssessment.title == title).first()
        if existing:
            log(f"  Risk assessment '{title}' already exists, skipping")
            continue

        # Parse category enum
        category_str = assessment_data.get("category", "other")
        try:
            category = RiskAssessmentCategory(category_str)
        except ValueError:
            category = RiskAssessmentCategory.OTHER

        # Handle relative dates for last_reviewed_at
        last_reviewed_at = datetime.utcnow()
        if assessment_data.get("last_review_days_ago") is not None:
            last_reviewed_at = datetime.utcnow() - timedelta(days=assessment_data["last_review_days_ago"])

        next_review_due = None
        if assessment_data.get("next_review_days_from_now") is not None:
            next_review_due = datetime.utcnow() + timedelta(days=assessment_data["next_review_days_from_now"])

        # Handle applies_to_roles - convert list to JSON string
        applies_to_roles = assessment_data.get("applies_to_roles")
        if applies_to_roles and isinstance(applies_to_roles, list):
            import json
            applies_to_roles = json.dumps(applies_to_roles)

        assessment = RiskAssessment(
            title=title,
            category=category,
            summary=assessment_data.get("summary"),
            content=assessment_data.get("content"),
            version=assessment_data.get("version", 1),
            is_active=assessment_data.get("is_active", True),
            required_for_induction=assessment_data.get("required_for_induction", False),
            applies_to_roles=applies_to_roles,
            review_period_months=assessment_data.get("review_period_months", 12),
            last_reviewed_at=last_reviewed_at,
            last_reviewed_by_id=admin_user_id,
            next_review_due=next_review_due,
            created_by_id=admin_user_id,
        )
        db.add(assessment)
        count += 1
        log(f"  Created risk assessment: {title} ({category_str})")

    db.flush()
    return count


def _import_risk_assessment_reviews(db: Session, reviews_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import risk assessment review history."""
    log("Importing risk assessment reviews...")
    count = 0

    for review_data in reviews_data:
        # Find the risk assessment by title
        assessment_title = review_data.get("assessment_title")
        assessment = db.query(RiskAssessment).filter(RiskAssessment.title == assessment_title).first()
        if not assessment:
            log(f"  Risk assessment '{assessment_title}' not found, skipping review")
            continue

        # Get reviewer user
        reviewer_username = review_data.get("reviewed_by_username", "admin")
        reviewer_id = user_map.get(reviewer_username)
        if not reviewer_id:
            log(f"  User '{reviewer_username}' not found, skipping review")
            continue

        # Parse trigger enum
        trigger_str = review_data.get("trigger", "scheduled")
        try:
            trigger = ReviewTrigger(trigger_str)
        except ValueError:
            trigger = ReviewTrigger.SCHEDULED

        # Handle relative dates
        reviewed_at = datetime.utcnow()
        if review_data.get("reviewed_days_ago") is not None:
            reviewed_at = datetime.utcnow() - timedelta(days=review_data["reviewed_days_ago"])

        review = RiskAssessmentReview(
            risk_assessment_id=assessment.id,
            reviewed_at=reviewed_at,
            reviewed_by_id=reviewer_id,
            trigger=trigger,
            trigger_details=review_data.get("trigger_details"),
            version_before=review_data.get("version_before", 1),
            version_after=review_data.get("version_after", 1),
            changes_made=review_data.get("changes_made", False),
            changes_summary=review_data.get("changes_summary"),
            notes=review_data.get("notes"),
        )
        db.add(review)
        count += 1
        log(f"  Created review for '{assessment_title}' by {reviewer_username}")

    db.flush()
    return count


def _import_risk_assessment_acknowledgements(db: Session, acks_data: List[Dict], user_map: Dict[str, int], log: Callable) -> int:
    """Import risk assessment acknowledgements."""
    log("Importing risk assessment acknowledgements...")
    count = 0

    for ack_data in acks_data:
        # Find the risk assessment by title
        assessment_title = ack_data.get("assessment_title")
        assessment = db.query(RiskAssessment).filter(RiskAssessment.title == assessment_title).first()
        if not assessment:
            log(f"  Risk assessment '{assessment_title}' not found, skipping acknowledgement")
            continue

        # Get user
        username = ack_data.get("username")
        user_id = user_map.get(username)
        if not user_id:
            log(f"  User '{username}' not found, skipping acknowledgement")
            continue

        # Check for existing acknowledgement for this user/assessment combo
        existing = db.query(RiskAssessmentAcknowledgement).filter(
            RiskAssessmentAcknowledgement.risk_assessment_id == assessment.id,
            RiskAssessmentAcknowledgement.user_id == user_id
        ).first()
        if existing:
            log(f"  Acknowledgement already exists for {username} on '{assessment_title}', skipping")
            continue

        # Handle relative dates
        acknowledged_at = datetime.utcnow()
        if ack_data.get("acknowledged_days_ago") is not None:
            acknowledged_at = datetime.utcnow() - timedelta(days=ack_data["acknowledged_days_ago"])

        ack = RiskAssessmentAcknowledgement(
            risk_assessment_id=assessment.id,
            assessment_version=ack_data.get("assessment_version", assessment.version),
            user_id=user_id,
            acknowledged_at=acknowledged_at,
            notes=ack_data.get("notes"),
        )
        db.add(ack)
        count += 1
        log(f"  Created acknowledgement for {username} on '{assessment_title}'")

    db.flush()
    return count
