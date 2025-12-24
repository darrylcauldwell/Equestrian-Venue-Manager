"""Synchronize all enum values to match Python model definitions

Revision ID: sync_all_enum_values
Revises: fix_missing_worktype_column
Create Date: 2025-12-23

This migration ensures all PostgreSQL enum types have the exact same values
as defined in the Python models. It adds any missing enum values.
"""
from alembic import op


revision = 'sync_all_enum_values'
down_revision = 'fix_missing_worktype_column'
branch_labels = None
depends_on = None


def add_enum_value(enum_name: str, value: str):
    """Add a value to an existing enum if it doesn't exist."""
    op.execute(f"""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = '{enum_name}') THEN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_enum
                    WHERE enumlabel = '{value}'
                    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = '{enum_name}')
                ) THEN
                    ALTER TYPE {enum_name} ADD VALUE '{value}';
                END IF;
            END IF;
        END $$;
    """)


def upgrade() -> None:
    # ========================================
    # WorkType enum (timesheets.work_type)
    # Model: yard_duties, yard_maintenance, office, events, other
    # ========================================
    add_enum_value('worktype', 'yard_duties')
    add_enum_value('worktype', 'yard_maintenance')
    add_enum_value('worktype', 'office')
    add_enum_value('worktype', 'events')
    add_enum_value('worktype', 'other')
    # Also add values that may be in migrations but not model (for safety)
    add_enum_value('worktype', 'teaching')
    add_enum_value('worktype', 'maintenance')

    # ========================================
    # LeaveType enum (holiday_requests.leave_type)
    # Model: annual, unpaid, toil, extended
    # ========================================
    add_enum_value('leavetype', 'annual')
    add_enum_value('leavetype', 'unpaid')
    add_enum_value('leavetype', 'toil')
    add_enum_value('leavetype', 'extended')
    # Legacy values that may exist
    add_enum_value('leavetype', 'sick')
    add_enum_value('leavetype', 'compassionate')
    add_enum_value('leavetype', 'other')

    # ========================================
    # TaskCategory enum (yard_tasks.category)
    # Model: maintenance, repairs, cleaning, feeding, turnout, health, admin, safety, livery_service, other
    # ========================================
    add_enum_value('taskcategory', 'maintenance')
    add_enum_value('taskcategory', 'repairs')
    add_enum_value('taskcategory', 'cleaning')
    add_enum_value('taskcategory', 'feeding')
    add_enum_value('taskcategory', 'turnout')
    add_enum_value('taskcategory', 'health')
    add_enum_value('taskcategory', 'admin')
    add_enum_value('taskcategory', 'safety')
    add_enum_value('taskcategory', 'livery_service')
    add_enum_value('taskcategory', 'other')

    # ========================================
    # Discipline enum (clinic_requests.discipline, lesson_requests.discipline)
    # Model: dressage, show_jumping, cross_country, eventing, flatwork, polework, hacking, groundwork, lunging, natural_horsemanship, other
    # ========================================
    add_enum_value('discipline', 'dressage')
    add_enum_value('discipline', 'show_jumping')
    add_enum_value('discipline', 'cross_country')
    add_enum_value('discipline', 'eventing')
    add_enum_value('discipline', 'flatwork')
    add_enum_value('discipline', 'polework')
    add_enum_value('discipline', 'hacking')
    add_enum_value('discipline', 'groundwork')
    add_enum_value('discipline', 'lunging')
    add_enum_value('discipline', 'natural_horsemanship')
    add_enum_value('discipline', 'other')

    # ========================================
    # UserRole enum (users.role)
    # Model: public, livery, staff, coach, admin
    # ========================================
    add_enum_value('userrole', 'public')
    add_enum_value('userrole', 'livery')
    add_enum_value('userrole', 'staff')
    add_enum_value('userrole', 'coach')
    add_enum_value('userrole', 'admin')

    # ========================================
    # HealthTaskType enum (yard_tasks.health_task_type if exists)
    # Model: medication, wound_care, health_check, rehab_exercise
    # ========================================
    add_enum_value('healthtasktype', 'medication')
    add_enum_value('healthtasktype', 'wound_care')
    add_enum_value('healthtasktype', 'health_check')
    add_enum_value('healthtasktype', 'rehab_exercise')

    # ========================================
    # FieldCondition enum (fields.condition)
    # Model: excellent, good, fair, poor, resting
    # ========================================
    add_enum_value('fieldcondition', 'excellent')
    add_enum_value('fieldcondition', 'good')
    add_enum_value('fieldcondition', 'fair')
    add_enum_value('fieldcondition', 'poor')
    add_enum_value('fieldcondition', 'resting')

    # ========================================
    # CompanionRelationship enum (horse_companions.relationship)
    # Model values - check model
    # ========================================
    add_enum_value('companionrelationship', 'bonded')
    add_enum_value('companionrelationship', 'friendly')
    add_enum_value('companionrelationship', 'neutral')
    add_enum_value('companionrelationship', 'incompatible')

    # ========================================
    # TransactionType enum (ledger_entries.transaction_type)
    # Model: package_charge, service_charge, payment, credit, adjustment
    # ========================================
    add_enum_value('transactiontype', 'package_charge')
    add_enum_value('transactiontype', 'service_charge')
    add_enum_value('transactiontype', 'payment')
    add_enum_value('transactiontype', 'credit')
    add_enum_value('transactiontype', 'adjustment')

    # ========================================
    # StaffType enum (users.staff_type)
    # Model: regular, casual, on_call
    # ========================================
    add_enum_value('stafftype', 'regular')
    add_enum_value('stafftype', 'casual')
    add_enum_value('stafftype', 'on_call')


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values
    pass
