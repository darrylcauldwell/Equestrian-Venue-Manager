"""Feature Flags Service

Manages system capability toggles for gradual feature rollout and licensing.
"""
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.settings import SiteSettings


# Feature groups - logical groupings for the admin UI
FEATURE_GROUPS = {
    "core": ["user_management"],
    "staff_operations": ["timesheets", "staff_management", "yard_tasks"],
    "livery": ["livery_services", "holiday_livery", "turnout_management"],
    "health": ["health_records", "care_plans", "feed_management", "worming_management"],
    "facilities": ["arena_management", "arena_bookings", "stables_management", "fields_management", "land_management"],
    "financial": ["invoicing", "billing_payments"],
    "events": ["events_clinics", "lessons"],
    "communication": ["noticeboard", "service_requests", "professional_directory"],
    "contracts": ["contract_management", "e_signatures"],
    "administration": ["compliance", "security_management", "backups"],
    "integrations": ["stripe_integration", "docusign_integration", "whatsapp_notifications", "sms_notifications"],
}

# Feature dependencies - key depends on values (must be enabled first)
FEATURE_DEPENDENCIES = {
    "holiday_livery": ["livery_services"],
    "turnout_management": ["livery_services", "fields_management"],
    "care_plans": ["health_records"],
    "feed_management": ["livery_services"],
    "worming_management": ["health_records"],
    "arena_bookings": ["arena_management"],
    "billing_payments": ["invoicing"],
    "lessons": ["arena_management"],
    "events_clinics": ["arena_management"],
    "e_signatures": ["contract_management"],
    "stripe_integration": ["billing_payments"],
    "docusign_integration": ["e_signatures"],
}

# Compute reverse dependencies - if key is disabled, these must be disabled too
FEATURE_DEPENDENTS: Dict[str, List[str]] = {}
for feature, deps in FEATURE_DEPENDENCIES.items():
    for dep in deps:
        if dep not in FEATURE_DEPENDENTS:
            FEATURE_DEPENDENTS[dep] = []
        FEATURE_DEPENDENTS[dep].append(feature)


# Feature display information for admin UI
FEATURE_INFO = {
    # Core
    "user_management": {"label": "User Management", "description": "User accounts and role management"},

    # Staff Operations
    "timesheets": {"label": "Timesheets", "description": "Staff clock-in/out and timesheet management"},
    "staff_management": {"label": "Staff Management", "description": "Staff rota, schedules, and holiday requests"},
    "yard_tasks": {"label": "Yard Tasks", "description": "Daily task assignment and tracking"},

    # Livery
    "livery_services": {"label": "Livery Services", "description": "Livery packages and service requests"},
    "holiday_livery": {"label": "Holiday Livery", "description": "Temporary boarding requests and management"},
    "turnout_management": {"label": "Turnout", "description": "Field turnout scheduling and tracking"},

    # Health & Care
    "health_records": {"label": "Health Records", "description": "Farrier, dentist, vaccination, worming tracking"},
    "care_plans": {"label": "Care Plans", "description": "Rehabilitation and custom care programs"},
    "feed_management": {"label": "Feed Management", "description": "Feed schedules and duty assignments"},
    "worming_management": {"label": "Worming", "description": "Worm count tracking and treatment schedules"},

    # Facilities
    "arena_management": {"label": "Arenas", "description": "Arena configuration and management"},
    "arena_bookings": {"label": "Arena Bookings", "description": "Public and livery booking system"},
    "stables_management": {"label": "Stables", "description": "Stable/box configuration"},
    "fields_management": {"label": "Fields", "description": "Paddock and field management"},
    "land_management": {"label": "Land Management", "description": "Grants, features, and maintenance"},

    # Financial
    "invoicing": {"label": "Invoicing", "description": "Invoice generation and management"},
    "billing_payments": {"label": "Billing & Payments", "description": "Payment processing and billing configuration"},

    # Events
    "events_clinics": {"label": "Events & Clinics", "description": "Clinic proposals and registrations"},
    "lessons": {"label": "Lessons", "description": "Lesson bookings and management"},

    # Communication
    "noticeboard": {"label": "Noticeboard", "description": "Announcements and community posts"},
    "service_requests": {"label": "Service Requests", "description": "Service catalog and request workflow"},
    "professional_directory": {"label": "Professional Directory", "description": "Farrier, vet, and professional contacts"},

    # Contracts
    "contract_management": {"label": "Contracts", "description": "Contract templates and management"},
    "e_signatures": {"label": "E-Signatures", "description": "Electronic contract signing"},

    # Administration
    "compliance": {"label": "Compliance", "description": "Compliance tracking and renewals"},
    "security_management": {"label": "Security", "description": "Gate codes and key safe management"},
    "backups": {"label": "Backups", "description": "Database backup and restore"},

    # Integrations
    "stripe_integration": {"label": "Stripe Payments", "description": "Online payment processing via Stripe"},
    "docusign_integration": {"label": "DocuSign", "description": "Electronic signature via DocuSign"},
    "whatsapp_notifications": {"label": "WhatsApp", "description": "WhatsApp messaging notifications"},
    "sms_notifications": {"label": "SMS", "description": "SMS text message notifications"},
}

# Group display information
GROUP_INFO = {
    "core": {"label": "Core", "description": "Essential features that cannot be disabled"},
    "staff_operations": {"label": "Staff Operations", "description": "Staff workflow and scheduling features"},
    "livery": {"label": "Livery", "description": "Horse boarding and livery management"},
    "health": {"label": "Health & Care", "description": "Horse health and care tracking"},
    "facilities": {"label": "Facilities", "description": "Physical venue and facility management"},
    "financial": {"label": "Financial", "description": "Billing, invoicing, and payments"},
    "events": {"label": "Events", "description": "Clinics, lessons, and scheduling"},
    "communication": {"label": "Communication", "description": "Messaging and announcements"},
    "contracts": {"label": "Contracts", "description": "Contract and agreement management"},
    "administration": {"label": "Administration", "description": "System administration features"},
    "integrations": {"label": "Integrations", "description": "Third-party service integrations"},
}


def get_default_feature_flags() -> Dict:
    """Get default feature flags configuration (all enabled by default).

    Features are enabled by default so existing functionality works.
    Administrators can disable features they don't need via Site Settings.
    """
    flags = {}
    for group, features in FEATURE_GROUPS.items():
        for feature in features:
            flags[feature] = {
                "enabled": True,  # All features enabled by default
                "group": group,
                "locked": feature == "user_management",  # Core features cannot be disabled
            }
    return flags


def get_feature_flags(db: Session) -> Dict:
    """Get current feature flags from database with full metadata."""
    settings = db.query(SiteSettings).first()
    if not settings or not settings.feature_flags:
        return get_default_feature_flags()

    # Merge with defaults to ensure all features exist
    flags = get_default_feature_flags()
    if settings.feature_flags:
        for key, value in settings.feature_flags.items():
            if key in flags:
                flags[key].update(value)

    return flags


def get_feature_flags_with_info(db: Session) -> Dict:
    """Get feature flags with display info, dependencies, and grouping."""
    flags = get_feature_flags(db)

    result = {
        "flags": {},
        "groups": {},
    }

    # Add flag info with dependencies
    for key, flag_data in flags.items():
        result["flags"][key] = {
            **flag_data,
            "label": FEATURE_INFO.get(key, {}).get("label", key),
            "description": FEATURE_INFO.get(key, {}).get("description", ""),
            "dependencies": FEATURE_DEPENDENCIES.get(key, []),
            "dependents": FEATURE_DEPENDENTS.get(key, []),
        }

    # Add group info
    for group, features in FEATURE_GROUPS.items():
        result["groups"][group] = {
            "label": GROUP_INFO.get(group, {}).get("label", group),
            "description": GROUP_INFO.get(group, {}).get("description", ""),
            "features": features,
        }

    return result


def is_feature_enabled(db: Session, feature_key: str) -> bool:
    """Check if a specific feature is enabled."""
    flags = get_feature_flags(db)
    flag = flags.get(feature_key)
    if flag is None:
        return False
    return flag.get("enabled", False)


def validate_feature_update(
    current_flags: Dict,
    feature_key: str,
    enabled: bool
) -> Tuple[bool, List[str], List[str], List[str]]:
    """
    Validate a feature flag update against dependencies.

    Returns:
        Tuple of (is_valid, errors, warnings, features_to_cascade)
    """
    errors = []
    warnings = []
    cascade_disable = []

    flag = current_flags.get(feature_key)
    if flag is None:
        errors.append(f"Unknown feature: {feature_key}")
        return False, errors, warnings, cascade_disable

    if flag.get("locked", False) and not enabled:
        errors.append(f"Cannot disable locked feature: {feature_key}")
        return False, errors, warnings, cascade_disable

    if enabled:
        # Check if dependencies are enabled
        deps = FEATURE_DEPENDENCIES.get(feature_key, [])
        for dep in deps:
            dep_flag = current_flags.get(dep)
            if dep_flag and not dep_flag.get("enabled", False):
                errors.append(
                    f"Cannot enable {feature_key}: requires {dep} to be enabled first"
                )
    else:
        # Check if any dependent features are enabled
        dependents = FEATURE_DEPENDENTS.get(feature_key, [])
        for dependent in dependents:
            dep_flag = current_flags.get(dependent)
            if dep_flag and dep_flag.get("enabled", False):
                warnings.append(
                    f"Disabling {feature_key} will also disable {dependent}"
                )
                cascade_disable.append(dependent)

    is_valid = len(errors) == 0
    return is_valid, errors, warnings, cascade_disable


def update_feature_flag(
    db: Session,
    feature_key: str,
    enabled: bool,
    cascade: bool = True
) -> Tuple[bool, List[str], List[str]]:
    """
    Update a feature flag with dependency validation.

    Args:
        db: Database session
        feature_key: The feature to update
        enabled: New enabled state
        cascade: If True, automatically disable dependent features when disabling

    Returns:
        Tuple of (success, errors, warnings)
    """
    settings = db.query(SiteSettings).first()
    if not settings:
        return False, ["No settings found"], []

    current_flags = get_feature_flags(db)
    is_valid, errors, warnings, cascade_disable = validate_feature_update(
        current_flags, feature_key, enabled
    )

    if not is_valid:
        return False, errors, warnings

    # Update the flags
    new_flags = dict(settings.feature_flags) if settings.feature_flags else get_default_feature_flags()

    # Update the main feature
    if feature_key not in new_flags:
        new_flags[feature_key] = {"enabled": enabled, "group": current_flags[feature_key].get("group", ""), "locked": False}
    else:
        new_flags[feature_key]["enabled"] = enabled

    # Cascade disable dependent features if requested
    if cascade and not enabled:
        for dep_feature in cascade_disable:
            if dep_feature in new_flags:
                new_flags[dep_feature]["enabled"] = False
            else:
                new_flags[dep_feature] = {"enabled": False, "group": current_flags[dep_feature].get("group", ""), "locked": False}

    settings.feature_flags = new_flags
    db.commit()

    return True, [], warnings


def bulk_update_feature_flags(
    db: Session,
    updates: Dict[str, bool],
    cascade: bool = True
) -> Tuple[bool, List[str], List[str]]:
    """
    Update multiple feature flags at once.

    Args:
        db: Database session
        updates: Dict of feature_key -> enabled
        cascade: If True, automatically disable dependent features

    Returns:
        Tuple of (success, errors, warnings)
    """
    settings = db.query(SiteSettings).first()
    if not settings:
        return False, ["No settings found"], []

    current_flags = get_feature_flags(db)
    all_errors = []
    all_warnings = []
    all_cascade = set()

    # Validate all updates first
    for feature_key, enabled in updates.items():
        is_valid, errors, warnings, cascade_disable = validate_feature_update(
            current_flags, feature_key, enabled
        )
        all_errors.extend(errors)
        all_warnings.extend(warnings)
        if cascade:
            all_cascade.update(cascade_disable)

    if all_errors:
        return False, all_errors, all_warnings

    # Apply all updates
    new_flags = dict(settings.feature_flags) if settings.feature_flags else get_default_feature_flags()

    for feature_key, enabled in updates.items():
        if feature_key not in new_flags:
            new_flags[feature_key] = {"enabled": enabled, "group": current_flags[feature_key].get("group", ""), "locked": False}
        else:
            new_flags[feature_key]["enabled"] = enabled

    # Apply cascade disables
    for dep_feature in all_cascade:
        if dep_feature in new_flags:
            new_flags[dep_feature]["enabled"] = False
        else:
            new_flags[dep_feature] = {"enabled": False, "group": current_flags.get(dep_feature, {}).get("group", ""), "locked": False}

    settings.feature_flags = new_flags
    db.commit()

    return True, [], all_warnings


def get_enabled_features(db: Session) -> List[str]:
    """Get list of enabled feature keys."""
    flags = get_feature_flags(db)
    return [key for key, value in flags.items() if value.get("enabled", False)]
