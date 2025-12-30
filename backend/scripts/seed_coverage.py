#!/usr/bin/env python3
"""
Seed Coverage Checker

Verifies that seed_data.json contains sufficient data to demonstrate
all application features. Fails if coverage requirements aren't met.

Usage:
    python -m scripts.seed_coverage [--check] [--report]

Options:
    --check     Fail with exit code 1 if coverage requirements not met
    --report    Generate detailed coverage report
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Set, Any, Optional
from dataclasses import dataclass, field


# ============================================================================
# Coverage Manifest
# Defines what data is required to demo each feature
# ============================================================================

COVERAGE_MANIFEST = {
    "arena_booking": {
        "description": "Arena booking system for livery clients and public",
        "required_entities": ["arenas", "users", "bookings"],
        "minimum_counts": {"arenas": 2, "bookings": 3},
        "required_statuses": {
            "bookings": ["confirmed", "pending", "cancelled"]
        }
    },
    "horse_management": {
        "description": "Horse profiles with owner information",
        "required_entities": ["horses", "users"],
        "minimum_counts": {"horses": 5}
    },
    "health_records": {
        "description": "Farrier, dentist, vaccination, and worming records",
        "required_entities": ["horses", "farrier_records", "dentist_records", "vaccination_records", "worming_records"],
        "minimum_counts": {
            "farrier_records": 2,
            "dentist_records": 1,
            "vaccination_records": 2,
            "worming_records": 2
        }
    },
    "medical_tracking": {
        "description": "Wound care, medication, and health observations",
        "required_entities": ["horses", "wound_care_logs", "health_observations", "feed_additions"],
        "minimum_counts": {
            "wound_care_logs": 2,
            "health_observations": 2,
            "feed_additions": 2
        }
    },
    "rehabilitation": {
        "description": "Rehabilitation programs with phases and tasks",
        "required_entities": ["horses", "rehab_programs"],
        "minimum_counts": {"rehab_programs": 1},
        "required_statuses": {
            "rehab_programs": ["active"]
        }
    },
    "clinic_management": {
        "description": "Clinic proposals, approvals, and registrations",
        "required_entities": ["clinics", "users"],
        "minimum_counts": {"clinics": 3},
        "required_statuses": {
            "clinics": ["pending", "approved", "rejected", "changes_requested", "cancelled", "completed"]
        }
    },
    "lesson_requests": {
        "description": "Private lesson booking requests",
        "required_entities": ["lesson_requests", "users", "coach_profiles"],
        "minimum_counts": {"lesson_requests": 2},
        "required_statuses": {
            "lesson_requests": ["pending", "accepted", "declined", "confirmed", "cancelled"]
        }
    },
    "service_requests": {
        "description": "Yard service requests (grooming, exercise, etc.)",
        "required_entities": ["services", "service_requests", "horses"],
        "minimum_counts": {"services": 5, "service_requests": 5},
        "required_statuses": {
            "service_requests": ["pending", "approved", "in_progress", "completed", "cancelled"]
        }
    },
    "yard_tasks": {
        "description": "Task management for yard staff",
        "required_entities": ["yard_tasks", "users"],
        "minimum_counts": {"yard_tasks": 5},
        "required_statuses": {
            "yard_tasks": ["open", "in_progress", "completed", "cancelled"]
        }
    },
    "staff_management": {
        "description": "Shifts, timesheets, and holiday requests",
        "required_entities": ["shifts", "timesheets", "holiday_requests"],
        "minimum_counts": {"shifts": 3, "holiday_requests": 3},
        "required_statuses": {
            "holiday_requests": ["pending", "approved", "rejected", "cancelled"]
        }
    },
    "invoicing": {
        "description": "Invoice generation and payment tracking",
        "required_entities": ["invoices", "users"],
        "minimum_counts": {"invoices": 3},
        "required_statuses": {
            "invoices": ["draft", "issued", "paid", "overdue", "cancelled"]
        }
    },
    "turnout_management": {
        "description": "Field turnout planning and horse companions",
        "required_entities": ["fields", "horse_companions", "turnout_requests"],
        "minimum_counts": {"fields": 2, "turnout_requests": 2}
    },
    "livery_packages": {
        "description": "Livery package options for clients",
        "required_entities": ["livery_packages"],
        "minimum_counts": {"livery_packages": 2}
    },
    "professionals": {
        "description": "Contact directory for farriers, vets, etc.",
        "required_entities": ["professionals"],
        "minimum_counts": {"professionals": 3}
    },
    "notices": {
        "description": "Yard notices and announcements",
        "required_entities": ["notices"],
        "minimum_counts": {"notices": 2}
    },
    "compliance": {
        "description": "Safety checks and compliance tracking",
        "required_entities": ["compliance_items"],
        "minimum_counts": {"compliance_items": 2}
    }
}


@dataclass
class CoverageGap:
    """Represents a missing piece of coverage."""
    feature: str
    gap_type: str  # 'missing_entity', 'insufficient_count', 'missing_status'
    entity: str
    required: Any
    actual: Any

    def __str__(self) -> str:
        if self.gap_type == 'missing_entity':
            return f"[{self.feature}] Missing entity: {self.entity}"
        elif self.gap_type == 'insufficient_count':
            return f"[{self.feature}] {self.entity}: need {self.required}, have {self.actual}"
        elif self.gap_type == 'missing_status':
            return f"[{self.feature}] {self.entity}: missing statuses {self.required}"
        return f"[{self.feature}] {self.gap_type}: {self.entity}"


@dataclass
class CoverageResult:
    """Results of coverage check."""
    gaps: List[CoverageGap] = field(default_factory=list)
    covered_features: List[str] = field(default_factory=list)

    @property
    def is_complete(self) -> bool:
        return len(self.gaps) == 0

    def add_gap(self, feature: str, gap_type: str, entity: str, required: Any, actual: Any):
        self.gaps.append(CoverageGap(feature, gap_type, entity, required, actual))

    def get_report(self) -> str:
        lines = ["=" * 60, "SEED DATA COVERAGE REPORT", "=" * 60, ""]

        if self.covered_features:
            lines.append(f"COVERED FEATURES ({len(self.covered_features)}):")
            for feature in sorted(self.covered_features):
                desc = COVERAGE_MANIFEST.get(feature, {}).get('description', '')
                lines.append(f"  ✓ {feature}: {desc}")
            lines.append("")

        if self.gaps:
            lines.append(f"COVERAGE GAPS ({len(self.gaps)}):")
            for gap in self.gaps:
                lines.append(f"  ✗ {gap}")
            lines.append("")
            lines.append("RESULT: INCOMPLETE COVERAGE")
        else:
            lines.append("RESULT: FULL COVERAGE - All features can be demo'd!")

        lines.append("=" * 60)
        return "\n".join(lines)


def load_seed_data() -> dict:
    """Load seed data from JSON file."""
    seed_file = Path(__file__).parent.parent / "seed_data.json"
    with open(seed_file, "r") as f:
        return json.load(f)


def extract_statuses(items: List[Dict], status_field: str = "status") -> Set[str]:
    """Extract unique status values from a list of items."""
    statuses = set()
    for item in items:
        if status_field in item:
            status = item[status_field]
            if isinstance(status, str):
                statuses.add(status.lower())
    return statuses


# Map entity names to their status field if different from 'status'
STATUS_FIELD_MAP = {
    "bookings": "booking_status",
}


def check_coverage(data: Dict[str, Any]) -> CoverageResult:
    """
    Check seed data against coverage manifest.

    Args:
        data: The seed data dictionary

    Returns:
        CoverageResult with gaps and covered features
    """
    result = CoverageResult()

    for feature_name, requirements in COVERAGE_MANIFEST.items():
        feature_complete = True

        # Check required entities exist
        for entity in requirements.get("required_entities", []):
            if entity not in data or len(data.get(entity, [])) == 0:
                result.add_gap(feature_name, "missing_entity", entity, "exists", "missing")
                feature_complete = False

        # Check minimum counts
        for entity, min_count in requirements.get("minimum_counts", {}).items():
            actual_count = len(data.get(entity, []))
            if actual_count < min_count:
                result.add_gap(feature_name, "insufficient_count", entity, min_count, actual_count)
                feature_complete = False

        # Check required statuses
        for entity, required_statuses in requirements.get("required_statuses", {}).items():
            items = data.get(entity, [])
            status_field = STATUS_FIELD_MAP.get(entity, "status")
            actual_statuses = extract_statuses(items, status_field)
            missing = set(s.lower() for s in required_statuses) - actual_statuses
            if missing:
                result.add_gap(feature_name, "missing_status", entity, list(missing), list(actual_statuses))
                feature_complete = False

        if feature_complete:
            result.covered_features.append(feature_name)

    return result


def main():
    """Main entry point for coverage check."""
    check_mode = "--check" in sys.argv
    report_mode = "--report" in sys.argv or not check_mode

    print("Loading seed data...")
    data = load_seed_data()

    print("Checking coverage...")
    result = check_coverage(data)

    if report_mode:
        print(result.get_report())

    if check_mode:
        if result.is_complete:
            print("\n✓ Coverage check PASSED")
            sys.exit(0)
        else:
            print(f"\n✗ Coverage check FAILED: {len(result.gaps)} gaps found")
            sys.exit(1)


if __name__ == "__main__":
    main()
