"""Fix ALL remaining UPPERCASE enums to use lowercase values

Revision ID: fix_billingtype_enum
Revises: fix_uppercase_enums
Create Date: 2025-12-23

"""
from alembic import op
import sqlalchemy as sa


revision = 'fix_billingtype_enum'
down_revision = 'fix_uppercase_enums'
branch_labels = None
depends_on = None


def fix_enum_safe(table_name: str, column_name: str, enum_name: str, new_values: list, default_value: str = None, nullable: bool = False):
    """Helper to fix an enum column from UPPERCASE to lowercase, with safety checks."""
    # Check if table and column exist
    op.execute(f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = '{table_name}' AND column_name = '{column_name}'
            ) THEN
                -- Step 1: Add temp column
                ALTER TABLE {table_name} ADD COLUMN {column_name}_temp VARCHAR(100);

                -- Step 2: Copy data, converting to lowercase
                UPDATE {table_name} SET {column_name}_temp = LOWER({column_name}::text);

                -- Step 3: Drop old column
                ALTER TABLE {table_name} DROP COLUMN {column_name} CASCADE;
            END IF;
        END $$;
    """)

    # Drop and recreate enum type
    values_str = ", ".join([f"'{v}'" for v in new_values])
    op.execute(f"DROP TYPE IF EXISTS {enum_name} CASCADE")
    op.execute(f"CREATE TYPE {enum_name} AS ENUM ({values_str})")

    # Check if we need to add the column back
    op.execute(f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = '{table_name}' AND column_name = '{column_name}_temp'
            ) THEN
                -- Add new column with new enum type
                ALTER TABLE {table_name} ADD COLUMN {column_name} {enum_name};

                -- Copy data back (handle nulls)
                UPDATE {table_name} SET {column_name} = {column_name}_temp::{enum_name}
                WHERE {column_name}_temp IS NOT NULL;

                -- Set constraints
                {"" if nullable else f"ALTER TABLE {table_name} ALTER COLUMN {column_name} SET NOT NULL;"}
                {f"ALTER TABLE {table_name} ALTER COLUMN {column_name} SET DEFAULT '{default_value}';" if default_value else ""}

                -- Drop temp column
                ALTER TABLE {table_name} DROP COLUMN {column_name}_temp;
            END IF;
        END $$;
    """)


def upgrade() -> None:
    # billingtype in livery_packages
    fix_enum_safe('livery_packages', 'billing_type', 'billingtype',
                  ['monthly', 'weekly'], 'monthly')

    # professionalcategory in professionals
    fix_enum_safe('professionals', 'category', 'professionalcategory',
                  ['farrier', 'vet', 'dentist', 'physio', 'chiropractor', 'saddler',
                   'nutritionist', 'instructor', 'transporter', 'feed_store', 'other'], None)

    # servicecategory in services
    fix_enum_safe('services', 'category', 'servicecategory',
                  ['exercise', 'schooling', 'grooming', 'third_party'], None)

    # leavetype in holiday_requests
    fix_enum_safe('holiday_requests', 'leave_type', 'leavetype',
                  ['annual', 'unpaid', 'toil', 'extended', 'sick', 'compassionate', 'other'], 'annual', nullable=True)

    # leavestatus in holiday_requests
    fix_enum_safe('holiday_requests', 'status', 'leavestatus',
                  ['pending', 'approved', 'rejected', 'cancelled'], 'pending', nullable=True)

    # noticecategory in notices
    fix_enum_safe('notices', 'category', 'noticecategory',
                  ['general', 'event', 'maintenance', 'health', 'urgent', 'social'], 'general')

    # noticepriority in notices
    fix_enum_safe('notices', 'priority', 'noticepriority',
                  ['low', 'normal', 'high'], 'normal')

    # shiftrole in shifts
    fix_enum_safe('shifts', 'role', 'shiftrole',
                  ['yard_duties', 'office', 'events', 'teaching', 'maintenance', 'other'], None, nullable=True)

    # timesheetstatus in timesheets
    fix_enum_safe('timesheets', 'status', 'timesheetstatus',
                  ['draft', 'submitted', 'approved', 'rejected'], 'draft', nullable=True)

    # taskcategory in yard_tasks
    fix_enum_safe('yard_tasks', 'category', 'taskcategory',
                  ['maintenance', 'repairs', 'cleaning', 'feeding', 'turnout', 'health', 'admin', 'safety', 'other'], None)

    # taskpriority in yard_tasks
    fix_enum_safe('yard_tasks', 'priority', 'taskpriority',
                  ['low', 'medium', 'high', 'urgent'], 'medium', nullable=True)

    # taskstatus in yard_tasks
    fix_enum_safe('yard_tasks', 'status', 'taskstatus',
                  ['open', 'in_progress', 'completed', 'cancelled'], 'open', nullable=True)

    # recurrencetype in yard_tasks
    fix_enum_safe('yard_tasks', 'recurrence_type', 'recurrencetype',
                  ['daily', 'weekly', 'monthly', 'custom'], None, nullable=True)

    # discipline in clinic_requests
    fix_enum_safe('clinic_requests', 'discipline', 'discipline',
                  ['dressage', 'show_jumping', 'cross_country', 'eventing', 'flatwork',
                   'polework', 'hacking', 'groundwork', 'lunging', 'natural_horsemanship', 'other'], None)

    # Also fix discipline in lesson_requests if exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'lesson_requests' AND column_name = 'discipline'
            ) THEN
                ALTER TABLE lesson_requests ADD COLUMN discipline_temp VARCHAR(100);
                UPDATE lesson_requests SET discipline_temp = LOWER(discipline::text);
                ALTER TABLE lesson_requests DROP COLUMN discipline CASCADE;
                ALTER TABLE lesson_requests ADD COLUMN discipline discipline;
                UPDATE lesson_requests SET discipline = discipline_temp::discipline WHERE discipline_temp IS NOT NULL;
                ALTER TABLE lesson_requests DROP COLUMN discipline_temp;
            END IF;
        END $$;
    """)

    # lessonformat in clinic_requests
    fix_enum_safe('clinic_requests', 'lesson_format', 'lessonformat',
                  ['private', 'semi_private', 'group', 'mixed'], 'group', nullable=True)

    # clinicstatus in clinic_requests
    fix_enum_safe('clinic_requests', 'status', 'clinicstatus',
                  ['pending', 'approved', 'rejected', 'changes_requested', 'cancelled', 'completed'], 'pending', nullable=True)

    # feedtime in feed_schedules and feed_additions
    op.execute("DROP TYPE IF EXISTS feedtime CASCADE")
    op.execute("CREATE TYPE feedtime AS ENUM ('morning', 'evening', 'both')")

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_schedules' AND column_name = 'feed_time') THEN
                ALTER TABLE feed_schedules ADD COLUMN feed_time_temp VARCHAR(50);
                UPDATE feed_schedules SET feed_time_temp = LOWER(feed_time::text);
                ALTER TABLE feed_schedules DROP COLUMN feed_time CASCADE;
                ALTER TABLE feed_schedules ADD COLUMN feed_time feedtime;
                UPDATE feed_schedules SET feed_time = feed_time_temp::feedtime WHERE feed_time_temp IS NOT NULL;
                ALTER TABLE feed_schedules DROP COLUMN feed_time_temp;
            END IF;
        END $$;
    """)

    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'feed_additions' AND column_name = 'feed_time') THEN
                ALTER TABLE feed_additions ADD COLUMN feed_time_temp VARCHAR(50);
                UPDATE feed_additions SET feed_time_temp = LOWER(feed_time::text);
                ALTER TABLE feed_additions DROP COLUMN feed_time CASCADE;
                ALTER TABLE feed_additions ADD COLUMN feed_time feedtime;
                UPDATE feed_additions SET feed_time = feed_time_temp::feedtime WHERE feed_time_temp IS NOT NULL;
                ALTER TABLE feed_additions DROP COLUMN feed_time_temp;
            END IF;
        END $$;
    """)

    # additionstatus in feed_additions
    fix_enum_safe('feed_additions', 'status', 'additionstatus',
                  ['pending', 'approved', 'rejected', 'completed'], 'pending')

    # supplystatus in feed_schedules
    fix_enum_safe('feed_schedules', 'supply_status', 'supplystatus',
                  ['adequate', 'low', 'critical'], 'adequate')

    # requeststatus in service_requests
    fix_enum_safe('service_requests', 'status', 'requeststatus',
                  ['pending', 'approved', 'scheduled', 'in_progress', 'completed', 'cancelled'], 'pending')

    # chargestatus in service_requests
    fix_enum_safe('service_requests', 'charge_status', 'chargestatus',
                  ['pending', 'charged', 'waived'], 'pending')

    # preferredtime in service_requests
    fix_enum_safe('service_requests', 'preferred_time', 'preferredtime',
                  ['morning', 'afternoon', 'evening', 'any'], 'any')

    # vaccinetype in vaccination_records
    fix_enum_safe('vaccination_records', 'vaccine_type', 'vaccinetype',
                  ['flu', 'tetanus', 'flu_tetanus', 'other'], None)

    # assignmenttype in yard_tasks
    fix_enum_safe('yard_tasks', 'assignment_type', 'assignmenttype',
                  ['specific', 'pool', 'backlog'], None, nullable=True)

    # worktype in timesheets - need to handle column recreation since CASCADE drops dependent columns
    op.execute("""
        DO $$
        BEGIN
            -- Save existing data if column exists
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'timesheets' AND column_name = 'work_type'
            ) THEN
                ALTER TABLE timesheets ADD COLUMN work_type_temp VARCHAR(50);
                UPDATE timesheets SET work_type_temp = LOWER(work_type::text);
                ALTER TABLE timesheets DROP COLUMN work_type CASCADE;
            END IF;

            -- Drop and recreate enum
            DROP TYPE IF EXISTS worktype CASCADE;
            CREATE TYPE worktype AS ENUM ('yard_duties', 'yard_maintenance', 'office', 'events', 'teaching', 'maintenance', 'other');

            -- Recreate column
            ALTER TABLE timesheets ADD COLUMN IF NOT EXISTS work_type worktype DEFAULT 'yard_duties' NOT NULL;

            -- Restore data if we had it
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'timesheets' AND column_name = 'work_type_temp'
            ) THEN
                UPDATE timesheets SET work_type = work_type_temp::worktype WHERE work_type_temp IS NOT NULL;
                ALTER TABLE timesheets DROP COLUMN work_type_temp;
            END IF;
        END $$;
    """)

    # contacttype in emergency_contacts
    fix_enum_safe('emergency_contacts', 'contact_type', 'contacttype',
                  ['vet', 'vet_backup', 'farrier', 'farrier_backup', 'owner_backup', 'insurance', 'other'], None)

    # turnoutstatus in turnout_requests
    fix_enum_safe('turnout_requests', 'status', 'turnoutstatus',
                  ['pending', 'approved', 'declined'], 'pending', nullable=True)

    # turnouttype in turnout_requests
    fix_enum_safe('turnout_requests', 'turnout_type', 'turnouttype',
                  ['out', 'in'], 'out', nullable=True)


def downgrade() -> None:
    pass
