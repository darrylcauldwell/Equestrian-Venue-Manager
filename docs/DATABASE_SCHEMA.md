# Database Schema Documentation

## Overview

The Equestrian Venue Manager uses **PostgreSQL** as its relational database, with **SQLAlchemy ORM** for object-relational mapping and **Alembic** for database migrations.

### Key Architecture Decisions

- **PostgreSQL Enums**: All enum types are stored as PostgreSQL ENUM types with UPPERCASE values
- **Timestamps**: Most tables include `created_at` and `updated_at` timestamps
- **Soft Deletes**: Using `is_active` flags where appropriate, with CASCADE deletes for dependent records
- **Foreign Keys**: Comprehensive relationship tracking with appropriate cascade behaviors
- **Indexing**: Primary keys, foreign keys, and frequently queried fields are indexed

### Migration Strategy

Database schema changes are managed through Alembic migrations located in `/backend/alembic/versions/`.

**Important**: SQLAlchemy's `create_all()` only creates NEW tables - it does NOT:
- Add new columns to existing tables
- Create new enum types
- Modify existing constraints

For schema changes:
1. New columns require manual `ALTER TABLE` statements
2. New enum types must be created with UPPERCASE values
3. Always rebuild the backend container after schema changes
4. Verify changes in logs before testing endpoints

---

## Entity Relationship Overview

The database is organized into several functional domains:

### User & Access Management
- `users` - Core user accounts with role-based access (PUBLIC, LIVERY, STAFF, COACH, ADMIN)

### Facilities & Resources
- `arenas` - Bookable riding arenas/facilities
- `stable_blocks` & `stables` - Horse accommodation
- `fields` - Turnout paddocks/fields

### Horses & Ownership
- `horses` - Horse records with personality traits, health flags, turnout preferences
- `emergency_contacts` - Horse-specific emergency contacts (vets, farriers, owners)

### Booking & Scheduling
- `bookings` - Arena bookings (public, livery, lessons, clinics, events)
- `clinic_requests`, `clinic_slots`, `clinic_participants` - Training clinic management
- `coach_profiles`, `coach_recurring_schedules`, `coach_availability_slots`, `lesson_requests` - Ad-hoc lesson bookings

### Livery Management
- `livery_packages` - Available livery packages (monthly/weekly billing)
- `holiday_livery_requests` - Public requests for short-term holiday livery
- `turnout_requests` - Daily turnout in/out requests from livery clients
- `turnout_groups`, `turnout_group_horses` - Daily field assignments

### Services & Tasks
- `services` - Catalog of available services (exercise, grooming, rehab, third-party)
- `service_requests` - Service requests from livery clients
- `yard_tasks`, `task_comments` - General yard task management

### Health & Veterinary
- `farrier_records`, `dentist_records`, `vaccination_records`, `worming_records` - Routine health care
- `health_observations` - Daily health checks (temperature, appetite, demeanor)
- `wound_care_logs` - Wound treatment tracking
- `medication_admin_logs` - Medication administration logs
- `rehab_programs`, `rehab_phases`, `rehab_tasks`, `rehab_task_logs` - Rehabilitation programs

### Feed Management
- `feed_requirements` - Regular daily feed requirements
- `feed_additions` - Temporary feed additions (medications, supplements)
- `feed_supply_alerts` - Low supply alerts

### Field & Turnout Management
- `field_usage_logs`, `field_usage_horses` - Historical field usage tracking
- `horse_companions` - Horse relationship tracking (preferred/compatible/incompatible)

### Staff Management
- `shifts` - Scheduled work shifts
- `timesheets` - Actual hours worked
- `holiday_requests` - Annual leave and time off
- `unplanned_absences` - Sickness and emergency absences

### Financial Management
- `invoices`, `invoice_line_items` - Invoice generation and tracking
- `ledger_entries` - Account ledger for all financial transactions

### System & Configuration
- `site_settings` - Global application settings
- `notices` - Noticeboard posts
- `professionals` - Directory of equine professionals
- `compliance_items`, `compliance_history` - Regulatory compliance tracking
- `backups`, `backup_schedules` - Database backup management

---

## Detailed Table Schemas

### Users & Authentication

#### users
Core user accounts with role-based access control.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique user identifier |
| username | VARCHAR(50) | UNIQUE, NOT NULL, INDEXED | Login username |
| email | VARCHAR(255) | UNIQUE, INDEXED | User email address |
| name | VARCHAR(100) | NOT NULL | Full display name |
| phone | VARCHAR(20) | | Contact phone number |
| address_street | VARCHAR(200) | | Street address |
| address_town | VARCHAR(100) | | Town/city |
| address_county | VARCHAR(100) | | County |
| address_postcode | VARCHAR(10) | | UK postcode |
| password_hash | VARCHAR(255) | NOT NULL | Hashed password |
| role | ENUM(UserRole) | NOT NULL, DEFAULT 'PUBLIC' | User role (PUBLIC, LIVERY, STAFF, COACH, ADMIN) |
| must_change_password | BOOLEAN | NOT NULL, DEFAULT FALSE | Force password change on next login |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Account active status |
| is_yard_staff | BOOLEAN | NOT NULL, DEFAULT FALSE | Can perform staff duties |
| staff_type | ENUM(StaffType) | | Staff classification (REGULAR, CASUAL, ON_CALL) |
| annual_leave_entitlement | INTEGER | DEFAULT 28 | Annual leave days (for regular staff) |
| created_at | TIMESTAMP | DEFAULT NOW() | Account creation timestamp |

**Relationships:**
- One-to-many: bookings, horses, notices, shifts, timesheets, holiday_requests
- One-to-one: coach_profile

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE INDEX (username)
- UNIQUE INDEX (email)

---

### Facilities & Resources

#### arenas
Bookable riding arenas and facilities.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique arena identifier |
| name | VARCHAR(100) | NOT NULL | Arena name |
| description | TEXT | | Detailed description |
| is_active | BOOLEAN | DEFAULT TRUE | Arena availability |
| size | VARCHAR(50) | | Dimensions (e.g., "20x40", "60x40") |
| surface_type | VARCHAR(50) | | Surface material (sand, rubber, grass) |
| price_per_hour | NUMERIC(10,2) | | Hourly rate for public bookings |
| has_lights | BOOLEAN | NOT NULL, DEFAULT FALSE | Lighting availability |
| jumps_type | VARCHAR(50) | | Jump equipment type |
| free_for_livery | BOOLEAN | NOT NULL, DEFAULT FALSE | Free for livery clients |
| image_url | VARCHAR(500) | | Photo URL |

**Relationships:**
- One-to-many: bookings, clinic_slots, coach_profiles, lesson_requests

#### stable_blocks
Logical grouping of stables (e.g., "Front Block", "Brown Block").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique block identifier |
| name | VARCHAR(100) | NOT NULL | Block name |
| sequence | INTEGER | NOT NULL, DEFAULT 0 | Display order |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Block active status |

**Relationships:**
- One-to-many: stables

#### stables
Individual horse stables within blocks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique stable identifier |
| name | VARCHAR(100) | NOT NULL | Display name (e.g., "Front Block 1") |
| block_id | INTEGER | FK → stable_blocks.id | Parent block |
| number | INTEGER | | Number within block |
| sequence | INTEGER | NOT NULL, DEFAULT 0 | Global display order for feed prep |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Stable availability |

**Relationships:**
- Many-to-one: stable_blocks
- One-to-many: horses

#### fields
Paddocks/fields for horse turnout.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique field identifier |
| name | VARCHAR(100) | NOT NULL | Field name |
| description | TEXT | | Field description |
| max_horses | INTEGER | | Maximum horse capacity |
| size_acres | NUMERIC(5,2) | | Field size in acres |
| current_condition | ENUM(FieldCondition) | DEFAULT 'GOOD' | Current condition (EXCELLENT, GOOD, FAIR, POOR, RESTING) |
| condition_notes | TEXT | | Condition details |
| last_condition_update | TIMESTAMP | | Last condition assessment |
| is_resting | BOOLEAN | DEFAULT FALSE | Field resting status |
| rest_start_date | DATE | | Rest period start |
| rest_end_date | DATE | | Rest period end |
| has_shelter | BOOLEAN | DEFAULT FALSE | Shelter available |
| has_water | BOOLEAN | DEFAULT FALSE | Water supply available |
| is_electric_fenced | BOOLEAN | DEFAULT FALSE | Electric fencing present |
| is_active | BOOLEAN | DEFAULT TRUE | Field availability |
| display_order | INTEGER | DEFAULT 0 | Display sequence |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- One-to-many: field_usage_logs, turnout_groups

---

### Horses & Ownership

#### horses
Horse records with comprehensive personality traits and preferences.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique horse identifier |
| owner_id | INTEGER | FK → users.id, NOT NULL | Horse owner |
| stable_id | INTEGER | FK → stables.id | Assigned stable |
| name | VARCHAR(100) | NOT NULL | Stable name/nickname |
| passport_name | VARCHAR(200) | | Official registered name |
| colour | VARCHAR(50) | | Horse colour |
| birth_year | INTEGER | | Year of birth |
| feed_notes | VARCHAR(500) | | Quick feed reference |
| livery_package_id | INTEGER | FK → livery_packages.id | Current livery package |
| livery_start_date | DATE | | Livery start date (for pro-rata) |
| livery_end_date | DATE | | Livery end date (for pro-rata) |
| **Farrier traits** |
| farrier_friendly | BOOLEAN | NOT NULL, DEFAULT TRUE | Good for farrier |
| farrier_notes | VARCHAR(500) | | Farrier-specific notes |
| **Dentist traits** |
| dentist_friendly | BOOLEAN | NOT NULL, DEFAULT TRUE | Good for dentist |
| needs_sedation_dentist | BOOLEAN | NOT NULL, DEFAULT FALSE | Requires sedation for dentist |
| dentist_notes | VARCHAR(500) | | Dentist-specific notes |
| **Clipping traits** |
| clipping_friendly | BOOLEAN | NOT NULL, DEFAULT TRUE | Good for clipping |
| needs_sedation_clipping | BOOLEAN | NOT NULL, DEFAULT FALSE | Requires sedation for clipping |
| clipping_notes | VARCHAR(500) | | Clipping-specific notes |
| **General handling** |
| kicks | BOOLEAN | NOT NULL, DEFAULT FALSE | Known to kick |
| bites | BOOLEAN | NOT NULL, DEFAULT FALSE | Known to bite |
| handling_notes | VARCHAR(500) | | General handling notes |
| **Loading & catching** |
| loads_well | BOOLEAN | NOT NULL, DEFAULT TRUE | Loads into transport easily |
| loading_notes | VARCHAR(500) | | Loading-specific notes |
| difficult_to_catch | BOOLEAN | NOT NULL, DEFAULT FALSE | Hard to catch in field |
| catching_notes | VARCHAR(500) | | Catching-specific notes |
| **Vet traits** |
| vet_friendly | BOOLEAN | NOT NULL, DEFAULT TRUE | Good for vet |
| needle_shy | BOOLEAN | NOT NULL, DEFAULT FALSE | Difficult with injections |
| vet_notes | VARCHAR(500) | | Vet-specific notes |
| **Tying & sedation** |
| can_be_tied | BOOLEAN | NOT NULL, DEFAULT TRUE | Can be tied up safely |
| tying_notes | VARCHAR(500) | | Tying-specific notes |
| has_sedation_risk | BOOLEAN | NOT NULL, DEFAULT FALSE | Risk of collapse during sedation |
| sedation_notes | VARCHAR(500) | | Sedation-specific notes |
| **Headshyness** |
| headshy | BOOLEAN | NOT NULL, DEFAULT FALSE | Head-shy |
| headshy_notes | VARCHAR(500) | | Head-shy details |
| **Turnout preferences** |
| turnout_alone | BOOLEAN | NOT NULL, DEFAULT FALSE | Must go out alone |
| turnout_notes | TEXT | | Turnout preferences/notes |

**Relationships:**
- Many-to-one: users (owner), stables, livery_packages
- One-to-many: farrier_records, dentist_records, vaccination_records, worming_records, service_requests, turnout_requests, emergency_contacts, feed_additions, feed_alerts, medication_admin_logs, wound_care_logs, health_observations, rehab_programs
- One-to-one: feed_requirement

**Indexes:**
- PRIMARY KEY (id)
- INDEX (owner_id)
- INDEX (stable_id)

#### emergency_contacts
Horse-specific emergency contact information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique contact identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Associated horse |
| contact_type | ENUM(ContactType) | NOT NULL | Contact type (VET, VET_BACKUP, FARRIER, FARRIER_BACKUP, OWNER_BACKUP, INSURANCE, OTHER) |
| name | VARCHAR(150) | NOT NULL | Contact name |
| phone | VARCHAR(20) | NOT NULL | Primary phone number |
| phone_alt | VARCHAR(20) | | Alternative phone number |
| email | VARCHAR(255) | | Email address |
| practice_name | VARCHAR(150) | | Practice/business name |
| address | TEXT | | Contact address |
| available_24h | BOOLEAN | NOT NULL, DEFAULT FALSE | 24-hour availability |
| availability_notes | TEXT | | Availability details |
| is_primary | BOOLEAN | NOT NULL, DEFAULT FALSE | Primary contact for this type |
| notes | TEXT | | Additional notes |
| created_by_id | INTEGER | FK → users.id, NOT NULL | Created by user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: horses, users (created_by)

---

### Booking & Scheduling

#### bookings
Arena bookings for all booking types.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique booking identifier |
| arena_id | INTEGER | FK → arenas.id, NOT NULL | Booked arena |
| user_id | INTEGER | FK → users.id | User (null for guest bookings) |
| horse_id | INTEGER | FK → horses.id | Horse (for livery bookings) |
| title | VARCHAR(200) | NOT NULL | Booking title |
| description | TEXT | | Booking description |
| start_time | TIMESTAMP | NOT NULL | Booking start time |
| end_time | TIMESTAMP | NOT NULL | Booking end time |
| booking_type | ENUM(BookingType) | NOT NULL, DEFAULT 'PUBLIC' | Type (PUBLIC, LIVERY, EVENT, MAINTENANCE, TRAINING_CLINIC, LESSON) |
| booking_status | ENUM(BookingStatus) | NOT NULL, DEFAULT 'CONFIRMED' | Status (CONFIRMED, PENDING, CANCELLED) |
| open_to_share | BOOLEAN | NOT NULL, DEFAULT FALSE | Livery can share arena |
| payment_ref | VARCHAR(100) | | Payment reference |
| payment_status | ENUM(PaymentStatus) | NOT NULL, DEFAULT 'PENDING' | Payment status (PENDING, PAID, NOT_REQUIRED) |
| guest_name | VARCHAR(100) | | Guest name (for public bookings) |
| guest_email | VARCHAR(255) | | Guest email |
| guest_phone | VARCHAR(20) | | Guest phone |
| created_at | TIMESTAMP | DEFAULT NOW() | Booking creation timestamp |

**Relationships:**
- Many-to-one: arenas, users, horses

**Indexes:**
- PRIMARY KEY (id)
- INDEX (arena_id)
- INDEX (user_id)
- INDEX (start_time)

#### clinic_requests
Training clinic proposals from coaches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique clinic identifier |
| coach_name | VARCHAR(200) | NOT NULL | Coach name |
| coach_email | VARCHAR(255) | NOT NULL | Coach email |
| coach_phone | VARCHAR(50) | | Coach phone |
| coach_bio | TEXT | | Coach biography |
| discipline | ENUM(Discipline) | NOT NULL | Discipline (DRESSAGE, SHOW_JUMPING, CROSS_COUNTRY, EVENTING, etc.) |
| title | VARCHAR(200) | | Clinic title |
| description | TEXT | | Clinic description |
| proposed_date | DATE | NOT NULL | Proposed start date |
| proposed_end_date | DATE | | End date (multi-day clinics) |
| proposed_start_time | TIME | | Proposed start time |
| proposed_end_time | TIME | | Proposed end time |
| arena_required | VARCHAR(100) | | Arena requirements |
| lesson_format | ENUM(LessonFormat) | DEFAULT 'GROUP' | Format (PRIVATE, SEMI_PRIVATE, GROUP, MIXED) |
| lesson_duration_minutes | INTEGER | | Lesson duration |
| max_participants | INTEGER | | Maximum total participants |
| max_group_size | INTEGER | | Max riders per group slot |
| coach_fee_private | NUMERIC(10,2) | | Coach fee for private lessons |
| coach_fee_group | NUMERIC(10,2) | | Coach fee per person for group |
| venue_fee_private | NUMERIC(10,2) | | Venue fee for private lessons |
| venue_fee_group | NUMERIC(10,2) | | Venue fee per person for group |
| venue_fee_waived | BOOLEAN | DEFAULT FALSE | Venue fees waived for entire clinic |
| livery_venue_fee_private | NUMERIC(10,2) | DEFAULT 0 | Reduced venue fee for livery users (private) |
| livery_venue_fee_group | NUMERIC(10,2) | DEFAULT 0 | Reduced venue fee for livery users (group) |
| special_requirements | TEXT | | Special requirements |
| proposed_by_id | INTEGER | FK → users.id | Proposing user (if registered coach) |
| status | ENUM(ClinicStatus) | DEFAULT 'PENDING' | Status (PENDING, APPROVED, REJECTED, CHANGES_REQUESTED, CANCELLED, COMPLETED) |
| reviewed_by_id | INTEGER | FK → users.id | Reviewing admin |
| reviewed_at | TIMESTAMP | | Review timestamp |
| review_notes | TEXT | | Review notes |
| rejection_reason | TEXT | | Rejection reason |
| booking_id | INTEGER | FK → bookings.id | Associated booking (if approved) |
| notice_id | INTEGER | FK → notices.id | Associated notice (if approved) |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (proposed_by, reviewed_by), bookings, notices
- One-to-many: clinic_slots, clinic_participants

#### clinic_slots
Time slots for approved clinics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique slot identifier |
| clinic_id | INTEGER | FK → clinic_requests.id (CASCADE), NOT NULL | Parent clinic |
| slot_date | DATE | NOT NULL | Slot date |
| start_time | TIME | NOT NULL | Slot start time |
| end_time | TIME | NOT NULL | Slot end time |
| group_name | VARCHAR(100) | | Group identifier (e.g., "Group A", "Novice") |
| description | VARCHAR(255) | | Slot description |
| arena_id | INTEGER | FK → arenas.id | Assigned arena |
| is_group_slot | BOOLEAN | DEFAULT FALSE | Group lesson (multiple riders) |
| max_participants | INTEGER | | Max riders for this slot |
| venue_fee_waived | BOOLEAN | DEFAULT FALSE | Venue fee waived for this slot |
| sequence | INTEGER | DEFAULT 0 | Display order |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: clinic_requests, arenas
- One-to-many: clinic_participants

**Indexes:**
- INDEX (clinic_id)
- INDEX (slot_date, start_time)

#### clinic_participants
Participants registered for clinics.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique participant identifier |
| clinic_id | INTEGER | FK → clinic_requests.id (CASCADE), NOT NULL | Parent clinic |
| slot_id | INTEGER | FK → clinic_slots.id (SET NULL) | Assigned slot |
| user_id | INTEGER | FK → users.id | Participant user (if registered) |
| horse_id | INTEGER | FK → horses.id | Participant horse |
| participant_name | VARCHAR(200) | | External participant name |
| participant_email | VARCHAR(255) | | External participant email |
| participant_phone | VARCHAR(50) | | External participant phone |
| lesson_time | TIME | | Preferred time |
| preferred_lesson_type | VARCHAR(20) | | Preference (private/group) |
| notes | TEXT | | Participant notes and preferences |
| is_confirmed | BOOLEAN | DEFAULT FALSE | Booking confirmed |
| slot_notified_at | TIMESTAMP | | In-app notification timestamp |
| sms_notified_at | TIMESTAMP | | SMS notification timestamp |
| created_at | TIMESTAMP | DEFAULT NOW() | Registration timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: clinic_requests, clinic_slots, users, horses

#### coach_profiles
Coach profiles for ad-hoc lesson bookings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique profile identifier |
| user_id | INTEGER | FK → users.id, UNIQUE, NOT NULL | Associated user account |
| disciplines | JSON | | List of Discipline enum values |
| teaching_description | TEXT | | Teaching approach description |
| bio | TEXT | | Coach biography |
| arena_id | INTEGER | FK → arenas.id | Teaching arena |
| availability_mode | ENUM(AvailabilityMode) | DEFAULT 'ALWAYS' | Availability mode (RECURRING, SPECIFIC, ALWAYS) |
| booking_mode | ENUM(BookingMode) | DEFAULT 'REQUEST_FIRST' | Booking mode (AUTO_ACCEPT, REQUEST_FIRST) |
| lesson_duration_minutes | INTEGER | DEFAULT 45 | Standard lesson duration |
| coach_fee | NUMERIC(10,2) | NOT NULL | Coach fee per lesson |
| venue_fee | NUMERIC(10,2) | | Standard venue fee (admin sets) |
| livery_venue_fee | NUMERIC(10,2) | DEFAULT 0 | Reduced venue fee for livery users |
| is_active | BOOLEAN | DEFAULT FALSE | Profile active (requires admin approval) |
| approved_by_id | INTEGER | FK → users.id | Approving admin |
| approved_at | TIMESTAMP | | Approval timestamp |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- One-to-one: users
- Many-to-one: arenas (teaching arena), users (approved_by)
- One-to-many: recurring_schedules, availability_slots, lesson_requests

#### coach_recurring_schedules
Weekly recurring availability for coaches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique schedule identifier |
| coach_profile_id | INTEGER | FK → coach_profiles.id (CASCADE), NOT NULL | Parent coach profile |
| day_of_week | INTEGER | NOT NULL | Day (0=Monday, 6=Sunday) |
| start_time | TIME | NOT NULL | Availability start time |
| end_time | TIME | NOT NULL | Availability end time |
| is_active | BOOLEAN | DEFAULT TRUE | Schedule active |

**Relationships:**
- Many-to-one: coach_profiles

#### coach_availability_slots
Specific date/time slots manually added by coaches.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique slot identifier |
| coach_profile_id | INTEGER | FK → coach_profiles.id (CASCADE), NOT NULL | Parent coach profile |
| slot_date | DATE | NOT NULL | Slot date |
| start_time | TIME | NOT NULL | Slot start time |
| end_time | TIME | NOT NULL | Slot end time |
| is_booked | BOOLEAN | DEFAULT FALSE | Slot booked status |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: coach_profiles

#### lesson_requests
Ad-hoc lesson booking requests.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique request identifier |
| coach_profile_id | INTEGER | FK → coach_profiles.id, NOT NULL | Requested coach |
| user_id | INTEGER | FK → users.id | Requesting user (null for guests) |
| horse_id | INTEGER | FK → horses.id | Horse for lesson |
| guest_name | VARCHAR(100) | | Guest name (for public bookings) |
| guest_email | VARCHAR(255) | | Guest email |
| guest_phone | VARCHAR(20) | | Guest phone |
| requested_date | DATE | NOT NULL | Requested date |
| requested_time | TIME | | Preferred time |
| alternative_dates | TEXT | | Alternative date suggestions |
| discipline | ENUM(Discipline) | | Requested discipline |
| notes | TEXT | | User goals/requirements |
| coach_fee | NUMERIC(10,2) | NOT NULL | Coach fee (captured at request time) |
| venue_fee | NUMERIC(10,2) | NOT NULL | Venue fee (captured at request time) |
| venue_fee_waived | BOOLEAN | DEFAULT FALSE | Admin can waive venue fee |
| total_price | NUMERIC(10,2) | NOT NULL | Total price |
| confirmed_date | DATE | | Confirmed date (when accepted) |
| confirmed_start_time | TIME | | Confirmed start time |
| confirmed_end_time | TIME | | Confirmed end time |
| arena_id | INTEGER | FK → arenas.id | Assigned arena |
| booking_id | INTEGER | FK → bookings.id | Associated arena booking |
| status | ENUM(LessonRequestStatus) | DEFAULT 'PENDING' | Status (PENDING, ACCEPTED, DECLINED, CONFIRMED, CANCELLED, COMPLETED) |
| coach_response | TEXT | | Coach's acceptance message |
| declined_reason | TEXT | | Decline reason |
| payment_status | ENUM(PaymentStatus) | DEFAULT 'PENDING' | Payment status |
| payment_ref | VARCHAR(100) | | Payment reference |
| created_at | TIMESTAMP | DEFAULT NOW() | Request timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| responded_at | TIMESTAMP | | Coach response timestamp |

**Relationships:**
- Many-to-one: coach_profiles, users, horses, arenas, bookings

---

### Livery Management

#### livery_packages
Available livery packages (monthly or weekly billing).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique package identifier |
| name | VARCHAR(100) | NOT NULL | Package name |
| price_display | VARCHAR(50) | NOT NULL | Display price (e.g., "£165/week") |
| monthly_price | NUMERIC(10,2) | | Monthly price (for MONTHLY billing) |
| weekly_price | NUMERIC(10,2) | | Weekly price (for WEEKLY billing - holiday livery) |
| billing_type | ENUM(BillingType) | NOT NULL, DEFAULT 'MONTHLY' | Billing type (MONTHLY, WEEKLY) |
| description | TEXT | | Package description |
| features | TEXT | | JSON array of feature strings |
| additional_note | TEXT | | Additional notes |
| is_featured | BOOLEAN | NOT NULL, DEFAULT FALSE | Featured package |
| display_order | INTEGER | NOT NULL, DEFAULT 0 | Display sequence |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Package availability |
| is_insurance_claimable | BOOLEAN | NOT NULL, DEFAULT FALSE | For rehab livery packages |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- One-to-many: horses, ledger_entries

#### holiday_livery_requests
Public requests for short-term holiday livery.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique request identifier |
| guest_name | VARCHAR(100) | NOT NULL | Requester name |
| guest_email | VARCHAR(255) | NOT NULL, INDEXED | Requester email |
| guest_phone | VARCHAR(50) | | Requester phone |
| horse_name | VARCHAR(100) | NOT NULL | Horse name |
| horse_breed | VARCHAR(100) | | Horse breed |
| horse_age | INTEGER | | Horse age in years |
| horse_colour | VARCHAR(50) | | Horse colour |
| horse_gender | VARCHAR(20) | | Horse gender (gelding/mare/stallion) |
| special_requirements | TEXT | | Dietary, medical, handling notes |
| requested_arrival | DATE | NOT NULL | Requested arrival date |
| requested_departure | DATE | NOT NULL | Requested departure date |
| message | TEXT | | Request message from guest |
| status | ENUM(HolidayLiveryStatus) | NOT NULL, DEFAULT 'PENDING', INDEXED | Status (PENDING, APPROVED, REJECTED, CANCELLED) |
| admin_notes | TEXT | | Internal admin notes |
| rejection_reason | TEXT | | Rejection reason (shown to guest) |
| confirmed_arrival | DATE | | Confirmed arrival (may differ from requested) |
| confirmed_departure | DATE | | Confirmed departure |
| assigned_stable_id | INTEGER | FK → stables.id | Assigned stable (on approval) |
| created_user_id | INTEGER | FK → users.id | Created user account (on approval) |
| created_horse_id | INTEGER | FK → horses.id | Created horse record (on approval) |
| processed_by_id | INTEGER | FK → users.id | Processing admin |
| processed_at | TIMESTAMP | | Processing timestamp |
| created_at | TIMESTAMP | DEFAULT NOW() | Request timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: stables (assigned_stable), users (created_user, processed_by), horses (created_horse)

**Indexes:**
- PRIMARY KEY (id)
- INDEX (guest_email)
- INDEX (status)

#### turnout_requests
Daily turnout in/out requests from livery clients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique request identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse for turnout |
| requested_by_id | INTEGER | FK → users.id, NOT NULL | Requesting user |
| request_date | DATE | NOT NULL | Date for turnout |
| turnout_type | ENUM(TurnoutType) | DEFAULT 'OUT' | Type (OUT, IN) |
| field_preference | VARCHAR(100) | | Preferred field |
| notes | TEXT | | Request notes |
| status | ENUM(TurnoutStatus) | DEFAULT 'PENDING' | Status (PENDING, APPROVED, DECLINED) |
| reviewed_by_id | INTEGER | FK → users.id | Reviewing staff |
| reviewed_at | TIMESTAMP | | Review timestamp |
| response_message | TEXT | | Staff response message |
| created_at | TIMESTAMP | DEFAULT NOW() | Request timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: horses, users (requested_by, reviewed_by)

#### turnout_groups
Daily assignment of horses to fields.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique group identifier |
| turnout_date | DATE | NOT NULL | Turnout date |
| field_id | INTEGER | FK → fields.id, NOT NULL | Assigned field |
| notes | TEXT | | Assignment notes |
| assigned_by_id | INTEGER | FK → users.id, NOT NULL | Assigning staff member |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: fields, users (assigned_by)
- One-to-many: turnout_group_horses

#### turnout_group_horses
Horses assigned to a turnout group.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique assignment identifier |
| group_id | INTEGER | FK → turnout_groups.id (CASCADE), NOT NULL | Parent turnout group |
| horse_id | INTEGER | FK → horses.id, NOT NULL | Assigned horse |
| turned_out_at | TIMESTAMP | | Actual turnout timestamp |
| brought_in_at | TIMESTAMP | | Actual bring-in timestamp |
| turned_out_by_id | INTEGER | FK → users.id | Staff who turned out |
| brought_in_by_id | INTEGER | FK → users.id | Staff who brought in |

**Relationships:**
- Many-to-one: turnout_groups, horses, users (turned_out_by, brought_in_by)

---

### Services & Tasks

#### services
Catalog of available services.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(50) | PRIMARY KEY | Unique service identifier |
| category | ENUM(ServiceCategory) | NOT NULL | Category (EXERCISE, SCHOOLING, GROOMING, THIRD_PARTY, REHAB) |
| name | VARCHAR(100) | NOT NULL | Service name |
| description | TEXT | | Service description |
| duration_minutes | INTEGER | | Estimated duration |
| price_gbp | NUMERIC(10,2) | NOT NULL | Service price |
| requires_approval | BOOLEAN | NOT NULL, DEFAULT FALSE | Requires admin approval |
| approval_reason | TEXT | | Approval reason explanation |
| advance_notice_hours | INTEGER | NOT NULL, DEFAULT 24 | Required advance notice |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Service availability |
| is_insurance_claimable | BOOLEAN | NOT NULL, DEFAULT FALSE | Can be insurance claimed |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- One-to-many: service_requests

#### service_requests
Service requests from livery clients.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique request identifier |
| service_id | VARCHAR(50) | FK → services.id, NOT NULL | Requested service |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse for service |
| requested_by_id | INTEGER | FK → users.id, NOT NULL | Requesting user |
| requested_date | DATE | NOT NULL | Requested service date |
| preferred_time | ENUM(PreferredTime) | NOT NULL, DEFAULT 'ANY' | Time preference (MORNING, AFTERNOON, EVENING, ANY) |
| status | ENUM(RequestStatus) | NOT NULL, DEFAULT 'PENDING' | Status (PENDING, QUOTED, APPROVED, SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED) |
| assigned_to_id | INTEGER | FK → users.id | Assigned staff member |
| scheduled_datetime | TIMESTAMP | | Scheduled time |
| completed_datetime | TIMESTAMP | | Completion timestamp |
| completed_by_id | INTEGER | FK → users.id | Staff who completed |
| notes | TEXT | | Request notes |
| special_instructions | TEXT | | Special instructions |
| quote_amount | NUMERIC(10,2) | | Cost estimate from admin |
| quote_notes | TEXT | | Admin quote notes |
| quoted_at | TIMESTAMP | | Quote timestamp |
| quoted_by_id | INTEGER | FK → users.id | Quoting admin |
| charge_amount | NUMERIC(10,2) | | Actual charge amount |
| charge_status | ENUM(ChargeStatus) | NOT NULL, DEFAULT 'PENDING' | Charge status (PENDING, CHARGED, WAIVED) |
| insurance_claimable | BOOLEAN | NOT NULL, DEFAULT FALSE | Insurance reimbursement flag |
| rehab_program_id | INTEGER | FK → rehab_programs.id (SET NULL) | Associated rehab program |
| rehab_task_id | INTEGER | FK → rehab_tasks.id (SET NULL) | Associated rehab task |
| recurring_pattern | ENUM(RecurringPattern) | NOT NULL, DEFAULT 'NONE' | Recurrence (NONE, DAILY, WEEKDAYS, CUSTOM) |
| recurring_days | TEXT | | JSON array for custom days |
| recurring_end_date | DATE | | Recurrence end date |
| recurring_series_id | INTEGER | | Groups recurring requests |
| created_at | TIMESTAMP | DEFAULT NOW() | Request timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: services, horses, users (requested_by, assigned_to, completed_by, quoted_by), rehab_programs, rehab_tasks
- One-to-one: yard_task

**Indexes:**
- PRIMARY KEY (id)
- INDEX (horse_id)
- INDEX (requested_by_id)
- INDEX (status)

#### yard_tasks
General yard task management.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique task identifier |
| title | VARCHAR(200) | NOT NULL | Task title |
| description | TEXT | | Task description |
| category | ENUM(TaskCategory) | NOT NULL | Category (MAINTENANCE, REPAIRS, CLEANING, FEEDING, TURNOUT, HEALTH, ADMIN, SAFETY, LIVERY_SERVICE, OTHER) |
| priority | ENUM(TaskPriority) | DEFAULT 'MEDIUM' | Priority (LOW, MEDIUM, HIGH, URGENT) |
| location | VARCHAR(200) | | Task location |
| reported_by_id | INTEGER | FK → users.id, NOT NULL | Reporting user |
| reported_date | TIMESTAMP | DEFAULT NOW() | Report timestamp |
| assignment_type | ENUM(AssignmentType) | DEFAULT 'BACKLOG' | Assignment type (SPECIFIC, POOL, BACKLOG) |
| assigned_to_id | INTEGER | FK → users.id | Assigned staff member |
| scheduled_date | DATE | | Scheduled date |
| status | ENUM(TaskStatus) | DEFAULT 'OPEN' | Status (OPEN, IN_PROGRESS, COMPLETED, CANCELLED) |
| completed_date | TIMESTAMP | | Completion timestamp |
| completed_by_id | INTEGER | FK → users.id | Completing staff member |
| completion_notes | TEXT | | Completion notes |
| estimated_cost | NUMERIC(10,2) | | Estimated cost |
| is_maintenance_day_task | BOOLEAN | DEFAULT FALSE | Maintenance day grouping |
| is_recurring | BOOLEAN | DEFAULT FALSE | Recurring task |
| recurrence_type | ENUM(RecurrenceType) | | Recurrence type (DAILY, WEEKLY, MONTHLY, CUSTOM) |
| recurrence_days | VARCHAR(50) | | Recurrence days |
| parent_task_id | INTEGER | FK → yard_tasks.id | Parent recurring task |
| service_request_id | INTEGER | FK → service_requests.id, UNIQUE | Linked service request |
| health_task_type | ENUM(HealthTaskType) | | Health task discriminator (MEDICATION, WOUND_CARE, HEALTH_CHECK, REHAB_EXERCISE) |
| horse_id | INTEGER | FK → horses.id | Associated horse (for health tasks) |
| feed_addition_id | INTEGER | FK → feed_additions.id | Associated medication |
| wound_care_log_id | INTEGER | FK → wound_care_logs.id | Associated wound care |
| rehab_task_id | INTEGER | FK → rehab_tasks.id | Associated rehab task |
| rehab_program_id | INTEGER | FK → rehab_programs.id | Associated rehab program |
| feed_time | VARCHAR(20) | | Feed time (morning/evening) for medication tasks |
| health_record_id | INTEGER | | Created health record ID |
| health_record_type | VARCHAR(50) | | Health record type |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (reported_by, assigned_to, completed_by), yard_tasks (parent_task), service_requests, horses, feed_additions, wound_care_logs, rehab_tasks, rehab_programs
- One-to-many: task_comments

#### task_comments
Comments and updates on tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique comment identifier |
| task_id | INTEGER | FK → yard_tasks.id, NOT NULL | Parent task |
| user_id | INTEGER | FK → users.id, NOT NULL | Commenting user |
| content | TEXT | NOT NULL | Comment content |
| created_at | TIMESTAMP | DEFAULT NOW() | Comment timestamp |

**Relationships:**
- Many-to-one: yard_tasks, users

---

### Health & Veterinary

#### farrier_records
Farrier visit records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique record identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| visit_date | DATE | NOT NULL | Visit date |
| farrier_name | VARCHAR(100) | | Farrier name |
| work_done | TEXT | NOT NULL | Work performed |
| cost | NUMERIC(10,2) | | Visit cost |
| next_due | DATE | | Next visit due date |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: horses

#### dentist_records
Dentist visit records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique record identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| visit_date | DATE | NOT NULL | Visit date |
| dentist_name | VARCHAR(100) | | Dentist name |
| treatment | TEXT | NOT NULL | Treatment performed |
| cost | NUMERIC(10,2) | | Visit cost |
| next_due | DATE | | Next visit due date |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: horses

#### vaccination_records
Vaccination records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique record identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| vaccination_date | DATE | NOT NULL | Vaccination date |
| vaccine_type | ENUM(VaccineType) | NOT NULL | Vaccine type (FLU, TETANUS, FLU_TETANUS, OTHER) |
| vaccine_name | VARCHAR(100) | | Vaccine product name |
| batch_number | VARCHAR(50) | | Vaccine batch number |
| administered_by | VARCHAR(100) | | Administrator name |
| next_due | DATE | | Next vaccination due date |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: horses

#### worming_records
Worming treatment records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique record identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| treatment_date | DATE | NOT NULL | Treatment date |
| product | VARCHAR(100) | NOT NULL | Wormer product name |
| worm_count_date | DATE | | Worm count test date |
| worm_count_result | INTEGER | | EPG result |
| next_due | DATE | | Next treatment due date |
| notes | TEXT | | Additional notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: horses

#### health_observations
Daily health observations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique observation identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| observation_date | DATE | NOT NULL | Observation date |
| observation_time | TIME | | Observation time |
| temperature | NUMERIC(4,1) | | Temperature in Celsius |
| appetite | ENUM(AppetiteStatus) | | Appetite status (NORMAL, REDUCED, NOT_EATING, INCREASED) |
| demeanor | ENUM(DemeanorStatus) | | Demeanor (BRIGHT, QUIET, LETHARGIC, AGITATED) |
| droppings_normal | BOOLEAN | | Droppings normal |
| concerns | TEXT | | Health concerns |
| action_taken | TEXT | | Actions taken |
| vet_notified | BOOLEAN | DEFAULT FALSE | Vet notified |
| observed_by_id | INTEGER | FK → users.id, NOT NULL | Observing staff member |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: horses, users (observed_by)

#### wound_care_logs
Wound care and treatment tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique log identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| wound_name | VARCHAR(100) | NOT NULL | Wound identifier |
| wound_location | VARCHAR(100) | | Wound location on body |
| wound_description | TEXT | | Wound description |
| treatment_date | DATE | NOT NULL | Treatment date |
| treatment_time | TIME | | Treatment time |
| treatment_given | TEXT | NOT NULL | Treatment performed |
| products_used | TEXT | | Products/medications applied |
| healing_assessment | ENUM(HealingStatus) | | Healing status (IMPROVING, STABLE, WORSENING, INFECTED, HEALED) |
| assessment_notes | TEXT | | Assessment notes |
| next_treatment_due | DATE | | Next treatment due |
| treated_by_id | INTEGER | FK → users.id, NOT NULL | Treating staff member |
| is_resolved | BOOLEAN | DEFAULT FALSE | Wound case resolved |
| resolved_date | DATE | | Resolution date |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: horses, users (treated_by)

#### medication_admin_logs
Daily medication administration logs.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique log identifier |
| feed_addition_id | INTEGER | FK → feed_additions.id (CASCADE), NOT NULL | Associated medication |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| admin_date | DATE | NOT NULL | Administration date |
| feed_time | ENUM(FeedTime) | NOT NULL | Feed time (MORNING, EVENING) |
| was_given | BOOLEAN | NOT NULL | Medication given (true) or skipped (false) |
| skip_reason | TEXT | | Skip/refusal reason |
| given_by_id | INTEGER | FK → users.id, NOT NULL | Administering staff member |
| given_at | TIMESTAMP | DEFAULT NOW() | Administration timestamp |
| notes | TEXT | | Additional notes |

**Relationships:**
- Many-to-one: feed_additions, horses, users (given_by)

**Indexes:**
- UNIQUE CONSTRAINT (feed_addition_id, admin_date, feed_time)

#### rehab_programs
Rehabilitation/recovery programs for horses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique program identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| name | VARCHAR(200) | NOT NULL | Program name |
| description | TEXT | | Program description |
| reason | TEXT | | Injury/condition being rehabbed |
| prescribed_by | VARCHAR(150) | | Prescribing vet/professional |
| prescription_date | DATE | | Prescription date |
| start_date | DATE | NOT NULL | Program start date |
| expected_end_date | DATE | | Expected completion date |
| actual_end_date | DATE | | Actual completion date |
| status | ENUM(RehabStatus) | DEFAULT 'DRAFT' | Status (DRAFT, ACTIVE, PAUSED, COMPLETED, CANCELLED) |
| current_phase | INTEGER | DEFAULT 1 | Current phase number |
| notes | TEXT | | Program notes |
| staff_managed | BOOLEAN | NOT NULL, DEFAULT FALSE | All tasks handled by staff |
| weekly_care_price | NUMERIC(10,2) | | Weekly care price (for rehab livery billing) |
| created_by_id | INTEGER | FK → users.id, NOT NULL | Creating user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: horses, users (created_by)
- One-to-many: rehab_phases, service_requests

#### rehab_phases
Phases within a rehab program.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique phase identifier |
| program_id | INTEGER | FK → rehab_programs.id (CASCADE), NOT NULL | Parent program |
| phase_number | INTEGER | NOT NULL | Phase sequence number |
| name | VARCHAR(100) | NOT NULL | Phase name |
| description | TEXT | | Phase description |
| duration_days | INTEGER | NOT NULL | Phase duration in days |
| start_day | INTEGER | NOT NULL | Day in program this phase starts (1-indexed) |
| is_completed | BOOLEAN | DEFAULT FALSE | Phase completed |
| completed_date | DATE | | Completion date |
| completion_notes | TEXT | | Completion notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: rehab_programs
- One-to-many: rehab_tasks

#### rehab_tasks
Specific tasks within a rehab phase.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique task identifier |
| phase_id | INTEGER | FK → rehab_phases.id (CASCADE), NOT NULL | Parent phase |
| task_type | VARCHAR(50) | NOT NULL | Task type (walk, trot, raised_poles, ice, poultice, etc.) |
| description | VARCHAR(500) | NOT NULL | Task description |
| duration_minutes | INTEGER | | Duration for time-based tasks |
| frequency | ENUM(TaskFrequency) | DEFAULT 'DAILY' | Frequency (DAILY, TWICE_DAILY, EVERY_OTHER_DAY, WEEKLY, AS_NEEDED) |
| instructions | TEXT | | Special instructions |
| equipment_needed | VARCHAR(200) | | Required equipment |
| is_feed_based | BOOLEAN | NOT NULL, DEFAULT FALSE | Shows in feed schedule instead of yard tasks |
| feed_time | VARCHAR(20) | | Feed time (morning/evening/both) - only when is_feed_based=True |
| sequence | INTEGER | DEFAULT 0 | Display order |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: rehab_phases
- One-to-many: service_requests

#### rehab_task_logs
Log of completed rehab tasks.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique log identifier |
| task_id | INTEGER | FK → rehab_tasks.id (CASCADE), NOT NULL | Associated task |
| program_id | INTEGER | FK → rehab_programs.id (CASCADE), NOT NULL | Parent program |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| log_date | DATE | NOT NULL | Log date |
| feed_time | ENUM(FeedTime) | | Feed time (for twice daily tasks) |
| was_completed | BOOLEAN | NOT NULL | Task completed (true) or skipped (false) |
| skip_reason | TEXT | | Skip reason |
| actual_duration_minutes | INTEGER | | Actual duration |
| horse_response | TEXT | | How horse coped |
| concerns | TEXT | | Concerns noted |
| vet_notified | BOOLEAN | DEFAULT FALSE | Vet notified |
| lameness_score | INTEGER | | AAEP lameness scale (0=sound, 5=non-weight bearing) |
| physical_observations | TEXT | | Swelling, heat, filling, etc. |
| completed_by_id | INTEGER | FK → users.id, NOT NULL | Completing staff member |
| completed_at | TIMESTAMP | DEFAULT NOW() | Completion timestamp |

**Relationships:**
- Many-to-one: rehab_tasks, rehab_programs, horses, users (completed_by)

---

### Feed Management

#### feed_requirements
Regular daily feed requirements for horses.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique requirement identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), UNIQUE, NOT NULL | Horse |
| morning_feed | TEXT | | Morning feed details |
| evening_feed | TEXT | | Evening feed details |
| supplements | TEXT | | Supplement details |
| special_instructions | TEXT | | Special feeding instructions |
| supply_status | ENUM(SupplyStatus) | NOT NULL, DEFAULT 'ADEQUATE' | Supply status (ADEQUATE, LOW, CRITICAL) |
| supply_notes | TEXT | | Supply notes |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |
| updated_by_id | INTEGER | FK → users.id | Last updating user |

**Relationships:**
- One-to-one: horses
- Many-to-one: users (updated_by)

#### feed_additions
Temporary feed additions (medications, supplements).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique addition identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| name | VARCHAR(100) | NOT NULL | Medication/supplement name |
| dosage | VARCHAR(100) | NOT NULL | Amount per feed |
| feed_time | ENUM(FeedTime) | NOT NULL, DEFAULT 'BOTH' | When to give (MORNING, EVENING, BOTH) |
| start_date | DATE | NOT NULL | Start date |
| end_date | DATE | | End date (null = ongoing) |
| reason | TEXT | | Reason for addition |
| status | ENUM(AdditionStatus) | NOT NULL, DEFAULT 'PENDING' | Status (PENDING, APPROVED, REJECTED, COMPLETED) |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Addition active |
| requested_by_id | INTEGER | FK → users.id, NOT NULL | Requesting user |
| approved_by_id | INTEGER | FK → users.id | Approving user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: horses, users (requested_by, approved_by)

#### feed_supply_alerts
Alerts when feed supplies are running low.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique alert identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Horse |
| item | VARCHAR(100) | NOT NULL | Item running low |
| notes | TEXT | | Alert notes |
| is_resolved | BOOLEAN | NOT NULL, DEFAULT FALSE | Alert resolved |
| created_by_id | INTEGER | FK → users.id, NOT NULL | Creating user |
| resolved_by_id | INTEGER | FK → users.id | Resolving user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| resolved_at | TIMESTAMP | | Resolution timestamp |

**Relationships:**
- Many-to-one: horses, users (created_by, resolved_by)

---

### Field & Turnout Management

#### field_usage_logs
Historical tracking of field usage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique log identifier |
| field_id | INTEGER | FK → fields.id, NOT NULL | Field |
| usage_date | DATE | NOT NULL | Usage date |
| condition_start | ENUM(FieldCondition) | | Condition at start of day |
| condition_end | ENUM(FieldCondition) | | Condition at end of day |
| notes | TEXT | | Usage notes |
| logged_by_id | INTEGER | FK → users.id | Logging user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: fields, users (logged_by)
- One-to-many: field_usage_horses

#### field_usage_horses
Horses that were in a field on a given day.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique record identifier |
| usage_log_id | INTEGER | FK → field_usage_logs.id (CASCADE), NOT NULL | Parent usage log |
| horse_id | INTEGER | FK → horses.id, NOT NULL | Horse |

**Relationships:**
- Many-to-one: field_usage_logs, horses

#### horse_companions
Horse relationship tracking for turnout planning.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique relationship identifier |
| horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | First horse |
| companion_horse_id | INTEGER | FK → horses.id (CASCADE), NOT NULL | Second horse |
| relationship_type | ENUM(CompanionRelationship) | NOT NULL | Relationship (PREFERRED, COMPATIBLE, INCOMPATIBLE) |
| notes | TEXT | | Relationship notes |
| created_by_id | INTEGER | FK → users.id, NOT NULL | Creating user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: horses (horse, companion), users (created_by)

**Indexes:**
- UNIQUE CONSTRAINT (horse_id, companion_horse_id)

---

### Staff Management

#### shifts
Scheduled work shifts for staff members.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique shift identifier |
| staff_id | INTEGER | FK → users.id, NOT NULL | Staff member |
| date | DATE | NOT NULL | Shift date |
| shift_type | ENUM(ShiftType) | NOT NULL, DEFAULT 'FULL_DAY' | Shift type (MORNING, AFTERNOON, FULL_DAY) |
| role | ENUM(ShiftRole) | DEFAULT 'YARD_DUTIES' | Role (YARD_DUTIES, OFFICE, EVENTS, TEACHING, MAINTENANCE, OTHER) |
| notes | TEXT | | Shift notes |
| created_by_id | INTEGER | FK → users.id, NOT NULL | Creating user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (staff, created_by)

#### timesheets
Actual hours worked by staff members.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique timesheet identifier |
| staff_id | INTEGER | FK → users.id, NOT NULL | Staff member |
| date | DATE | NOT NULL | Work date |
| clock_in | TIME | NOT NULL | Clock in time |
| clock_out | TIME | | Clock out time |
| lunch_start | TIME | | Lunch break start |
| lunch_end | TIME | | Lunch break end |
| break_minutes | INTEGER | DEFAULT 0 | Additional break minutes |
| work_type | ENUM(WorkType) | DEFAULT 'YARD_DUTIES' | Work type (YARD_DUTIES, YARD_MAINTENANCE, OFFICE, EVENTS, OTHER) |
| notes | TEXT | | Timesheet notes |
| logged_by_id | INTEGER | FK → users.id | Logging user (null = self-logged) |
| status | ENUM(TimesheetStatus) | DEFAULT 'DRAFT' | Status (DRAFT, SUBMITTED, APPROVED, REJECTED) |
| submitted_at | TIMESTAMP | | Submission timestamp |
| approved_by_id | INTEGER | FK → users.id | Approving user |
| approved_at | TIMESTAMP | | Approval timestamp |
| rejection_reason | TEXT | | Rejection reason |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (staff, logged_by, approved_by)

#### holiday_requests
Holiday/leave requests from staff.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique request identifier |
| staff_id | INTEGER | FK → users.id, NOT NULL | Staff member |
| start_date | DATE | NOT NULL | Leave start date |
| end_date | DATE | NOT NULL | Leave end date |
| leave_type | ENUM(LeaveType) | DEFAULT 'ANNUAL' | Leave type (ANNUAL, UNPAID, TOIL, EXTENDED) |
| days_requested | NUMERIC(4,1) | NOT NULL | Number of days (allows half days) |
| reason | TEXT | | Request reason |
| status | ENUM(LeaveStatus) | DEFAULT 'PENDING' | Status (PENDING, APPROVED, REJECTED, CANCELLED) |
| approved_by_id | INTEGER | FK → users.id | Approving user |
| approval_date | TIMESTAMP | | Approval timestamp |
| approval_notes | TEXT | | Approval notes |
| created_at | TIMESTAMP | DEFAULT NOW() | Request timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (staff, approved_by)

#### unplanned_absences
Unplanned absence records for staff (sickness, no-show, emergency).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique absence identifier |
| staff_id | INTEGER | FK → users.id, NOT NULL | Staff member |
| date | DATE | NOT NULL | Absence date |
| reported_time | TIME | | Time absence was reported |
| reported_to_id | INTEGER | FK → users.id | Who it was reported to |
| reason | VARCHAR(100) | | Absence reason (sickness, emergency, no contact) |
| expected_return | DATE | | Expected return date |
| actual_return | DATE | | Actual return date |
| notes | TEXT | | Absence notes |
| has_fit_note | BOOLEAN | DEFAULT FALSE | Medical certificate provided |
| fit_note_start | DATE | | Fit note start date |
| fit_note_end | DATE | | Fit note end date |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (staff, reported_to)

---

### Financial Management

#### invoices
Invoices for users covering billing periods.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique invoice identifier |
| user_id | INTEGER | FK → users.id, NOT NULL | Invoice recipient |
| invoice_number | VARCHAR(20) | UNIQUE, NOT NULL, INDEXED | Invoice number (e.g., "INV-2024-0001") |
| period_start | DATE | NOT NULL | Billing period start |
| period_end | DATE | NOT NULL | Billing period end |
| subtotal | NUMERIC(10,2) | NOT NULL, DEFAULT 0 | Invoice subtotal |
| payments_received | NUMERIC(10,2) | NOT NULL, DEFAULT 0 | Payments received |
| balance_due | NUMERIC(10,2) | NOT NULL, DEFAULT 0 | Balance due |
| status | ENUM(InvoiceStatus) | NOT NULL, DEFAULT 'DRAFT' | Status (DRAFT, ISSUED, PAID, CANCELLED, OVERDUE) |
| issue_date | DATE | | Issue date |
| due_date | DATE | | Payment due date |
| paid_date | DATE | | Payment date |
| pdf_filename | VARCHAR(255) | | PDF filename |
| notes | TEXT | | Invoice notes |
| created_by_id | INTEGER | FK → users.id, NOT NULL | Creating user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (user, created_by)
- One-to-many: invoice_line_items

**Indexes:**
- PRIMARY KEY (id)
- UNIQUE INDEX (invoice_number)

#### invoice_line_items
Individual line items on invoices.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique line item identifier |
| invoice_id | INTEGER | FK → invoices.id (CASCADE), NOT NULL | Parent invoice |
| ledger_entry_id | INTEGER | FK → ledger_entries.id | Linked ledger entry |
| description | VARCHAR(500) | NOT NULL | Item description |
| quantity | NUMERIC(10,2) | NOT NULL, DEFAULT 1 | Quantity |
| unit_price | NUMERIC(10,2) | NOT NULL | Unit price |
| amount | NUMERIC(10,2) | NOT NULL | Total amount (quantity × unit_price) |
| category | VARCHAR(50) | | Category (livery, service, booking, etc.) |
| item_date_start | DATE | | Item start date (for recurring items) |
| item_date_end | DATE | | Item end date (for recurring items) |

**Relationships:**
- Many-to-one: invoices, ledger_entries

#### ledger_entries
Account ledger for all financial transactions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique entry identifier |
| user_id | INTEGER | FK → users.id, NOT NULL | Account owner |
| transaction_type | ENUM(TransactionType) | NOT NULL | Type (PACKAGE_CHARGE, SERVICE_CHARGE, PAYMENT, CREDIT, ADJUSTMENT) |
| amount | NUMERIC(10,2) | NOT NULL | Amount (positive = charge, negative = payment) |
| description | VARCHAR(500) | NOT NULL | Transaction description |
| notes | TEXT | | Internal notes |
| service_request_id | INTEGER | FK → service_requests.id | Linked service request |
| livery_package_id | INTEGER | FK → livery_packages.id | Linked livery package |
| period_start | TIMESTAMP | | Billing period start |
| period_end | TIMESTAMP | | Billing period end |
| transaction_date | TIMESTAMP | NOT NULL, DEFAULT NOW() | Transaction date |
| created_by_id | INTEGER | FK → users.id, NOT NULL | Creating user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: users (user, created_by), service_requests, livery_packages

---

### System & Configuration

#### site_settings
Global application settings (singleton table).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Settings ID (always 1) |
| **Venue Information** |
| venue_name | VARCHAR(200) | NOT NULL, DEFAULT 'Equestrian Venue Manager' | Venue name |
| venue_tagline | VARCHAR(500) | | Venue tagline |
| contact_email | VARCHAR(255) | | Contact email |
| contact_phone | VARCHAR(50) | | Contact phone |
| address_street | VARCHAR(200) | | Street address |
| address_town | VARCHAR(100) | | Town/city |
| address_county | VARCHAR(100) | | County |
| address_postcode | VARCHAR(10) | | UK postcode (for weather) |
| banner_image_url | VARCHAR(500) | | Banner image URL |
| logo_url | VARCHAR(500) | | Logo URL |
| venue_latitude | NUMERIC(10,6) | | Latitude (for weather) |
| venue_longitude | NUMERIC(10,6) | | Longitude (for weather) |
| gate_code | VARCHAR(50) | | Gate code (livery only) |
| key_safe_code | VARCHAR(50) | | Key safe code (livery only) |
| security_info | TEXT | | Security information |
| what3words | VARCHAR(100) | | What3Words location |
| **Theme Customization** |
| theme_primary_color | VARCHAR(7) | DEFAULT '#3B82F6' | Primary color (hex) |
| theme_accent_color | VARCHAR(7) | DEFAULT '#10B981' | Accent color (hex) |
| theme_font_family | VARCHAR(50) | DEFAULT 'Inter' | Font family |
| theme_mode | VARCHAR(10) | DEFAULT 'light' | Theme mode (light, dark, auto) |
| **Livery Settings** |
| livery_billing_day | INTEGER | DEFAULT 1 | Billing day of month (1-28) |
| livery_max_future_hours_per_horse | NUMERIC(5,1) | | Max total future booking hours per horse |
| livery_max_booking_hours | NUMERIC(5,1) | | Max single booking duration (hours) |
| livery_min_advance_hours | INTEGER | DEFAULT 0 | Min hours before booking start |
| livery_max_advance_days | INTEGER | DEFAULT 30 | Max days ahead can book |
| livery_max_weekly_hours_per_horse | NUMERIC(5,1) | | Max weekly hours per horse |
| livery_max_daily_hours_per_horse | NUMERIC(5,1) | | Max daily hours per horse |
| **Rugging Guide** |
| rugging_guide | JSON | | Rug weight matrix by temp/clip type |
| **SMS Settings** |
| sms_enabled | BOOLEAN | DEFAULT FALSE | SMS notifications enabled |
| sms_provider | VARCHAR(50) | DEFAULT 'twilio' | SMS provider |
| sms_account_sid | VARCHAR(100) | | Provider account SID |
| sms_auth_token | VARCHAR(100) | | Provider auth token (encrypted) |
| sms_from_number | VARCHAR(20) | | Sender phone number (E.164) |
| sms_test_mode | BOOLEAN | DEFAULT TRUE | Test mode (don't send) |
| **Stripe Settings** |
| stripe_enabled | BOOLEAN | DEFAULT FALSE | Stripe payments enabled |
| stripe_secret_key | VARCHAR(200) | | Stripe secret key |
| stripe_publishable_key | VARCHAR(200) | | Stripe publishable key |
| stripe_webhook_secret | VARCHAR(200) | | Stripe webhook secret |
| **Application Settings** |
| access_token_expire_minutes | INTEGER | DEFAULT 30 | JWT access token lifetime (minutes) |
| refresh_token_expire_days | INTEGER | DEFAULT 7 | JWT refresh token lifetime (days) |
| frontend_url | VARCHAR(200) | DEFAULT 'http://localhost:3000' | Frontend URL |
| demo_data_enabled | BOOLEAN | DEFAULT FALSE | Demo data loaded |
| dev_mode | BOOLEAN | DEFAULT TRUE | Development mode (disables caching) |
| turnout_cutoff_date | DATE | | Turnout cutoff (staff triggered) |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Notes:**
- This is a singleton table (only one row with id=1)
- Sensitive fields (sms_auth_token, stripe keys) should be encrypted at rest

#### notices
Noticeboard posts for the yard community.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique notice identifier |
| title | VARCHAR(200) | NOT NULL | Notice title |
| content | TEXT | NOT NULL | Notice content |
| category | ENUM(NoticeCategory) | NOT NULL, DEFAULT 'GENERAL' | Category (GENERAL, EVENT, MAINTENANCE, HEALTH, URGENT, SOCIAL) |
| priority | ENUM(NoticePriority) | NOT NULL, DEFAULT 'NORMAL' | Priority (LOW, NORMAL, HIGH) |
| is_pinned | BOOLEAN | NOT NULL, DEFAULT FALSE | Pinned to top |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Notice active |
| expires_at | TIMESTAMP | | Expiration timestamp |
| created_by_id | INTEGER | FK → users.id, NOT NULL | Creating user |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (created_by)

#### professionals
Directory of equine professionals and service providers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique professional identifier |
| category | ENUM(ProfessionalCategory) | NOT NULL | Category (FARRIER, VET, DENTIST, PHYSIO, CHIROPRACTOR, SADDLER, NUTRITIONIST, INSTRUCTOR, TRANSPORTER, FEED_STORE, OTHER) |
| business_name | VARCHAR(150) | NOT NULL | Business name |
| contact_name | VARCHAR(100) | | Contact person name |
| phone | VARCHAR(20) | | Phone number |
| mobile | VARCHAR(20) | | Mobile number |
| email | VARCHAR(255) | | Email address |
| website | VARCHAR(255) | | Website URL |
| address | TEXT | | Business address |
| coverage_area | VARCHAR(200) | | Service coverage area |
| services | TEXT | | Services offered |
| specialties | TEXT | | Specializations |
| qualifications | TEXT | | Professional qualifications |
| typical_rates | TEXT | | Price guidance |
| booking_notes | TEXT | | Booking information |
| yard_recommended | BOOLEAN | NOT NULL, DEFAULT FALSE | Yard's preferred provider |
| yard_notes | TEXT | | Internal yard notes |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Professional active |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

#### compliance_items
Compliance items to track (insurance, fire safety, PAT testing, etc.).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique item identifier |
| name | VARCHAR(200) | NOT NULL | Item name |
| category | VARCHAR(50) | NOT NULL | Category (insurance, fire_safety, electrical, equipment, first_aid, health_safety, other) |
| description | TEXT | | Item description |
| reference_number | VARCHAR(100) | | Policy/certificate number |
| provider | VARCHAR(200) | | Provider name |
| renewal_frequency_months | INTEGER | NOT NULL, DEFAULT 12 | Renewal frequency (months) |
| last_completed_date | TIMESTAMP | | Last completion date |
| next_due_date | TIMESTAMP | | Next due date |
| reminder_days_before | INTEGER | DEFAULT 30 | Reminder days before due |
| responsible_user_id | INTEGER | FK → users.id | Responsible user |
| certificate_url | VARCHAR(500) | | Certificate/proof URL |
| notes | TEXT | | Additional notes |
| is_active | BOOLEAN | NOT NULL, DEFAULT TRUE | Item active |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Relationships:**
- Many-to-one: users (responsible_user)
- One-to-many: compliance_history

#### compliance_history
History of compliance completions/renewals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique history identifier |
| compliance_item_id | INTEGER | FK → compliance_items.id (CASCADE), NOT NULL | Parent compliance item |
| completed_date | TIMESTAMP | NOT NULL | Completion date |
| completed_by_id | INTEGER | FK → users.id | Completing user |
| certificate_url | VARCHAR(500) | | Certificate for this completion |
| notes | TEXT | | Completion notes |
| cost | NUMERIC(10,2) | | Renewal cost |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |

**Relationships:**
- Many-to-one: compliance_items, users (completed_by)

#### backups
Database backup records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique backup identifier |
| filename | VARCHAR(255) | NOT NULL | Backup filename |
| backup_date | TIMESTAMP | DEFAULT NOW() | Backup timestamp |
| file_size | INTEGER | | File size in bytes |
| entity_counts | JSON | | Entity counts (e.g., {"users": 10, "horses": 25}) |
| storage_location | VARCHAR(50) | DEFAULT 'local' | Storage location (local, s3) |
| s3_url | VARCHAR(500) | | S3 URL (if stored in S3) |
| notes | TEXT | | Backup notes |
| created_by_id | INTEGER | FK → users.id | Creating user |

**Relationships:**
- Many-to-one: users (created_by)

#### backup_schedules
Automated backup configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | PRIMARY KEY | Unique schedule identifier |
| is_enabled | BOOLEAN | DEFAULT FALSE | Schedule enabled |
| frequency | VARCHAR(20) | DEFAULT 'daily' | Frequency (daily, weekly, monthly) |
| retention_days | INTEGER | DEFAULT 30 | Backup retention days |
| last_run | TIMESTAMP | | Last run timestamp |
| next_run | TIMESTAMP | | Next scheduled run |
| s3_enabled | BOOLEAN | DEFAULT FALSE | S3 storage enabled |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

---

## Enum Types

### User & Access

**UserRole**
- `PUBLIC` - Public access (arena bookings only)
- `LIVERY` - Livery client (can book arenas free, manage horses)
- `STAFF` - Yard staff (can perform duties, timesheets, tasks)
- `COACH` - Coach (can propose training clinics)
- `ADMIN` - Full system access (inherits all capabilities)

**StaffType**
- `REGULAR` - Regular staff with guaranteed hours
- `CASUAL` - Called in as needed
- `ON_CALL` - Available for emergencies and cover

### Booking & Scheduling

**BookingType**
- `PUBLIC` - Public arena booking
- `LIVERY` - Livery client booking
- `EVENT` - Special event
- `MAINTENANCE` - Maintenance block
- `TRAINING_CLINIC` - Training clinic
- `LESSON` - Ad-hoc lesson

**BookingStatus**
- `CONFIRMED` - Confirmed booking
- `PENDING` - Awaiting auto-confirmation
- `CANCELLED` - Cancelled

**PaymentStatus**
- `PENDING` - Payment pending
- `PAID` - Payment received
- `NOT_REQUIRED` - No payment required

**Discipline**
- `DRESSAGE`, `SHOW_JUMPING`, `CROSS_COUNTRY`, `EVENTING`, `FLATWORK`, `POLEWORK`, `HACKING`, `GROUNDWORK`, `LUNGING`, `NATURAL_HORSEMANSHIP`, `OTHER`

**LessonFormat**
- `PRIVATE` - One-on-one
- `SEMI_PRIVATE` - 2-3 riders
- `GROUP` - Group lesson
- `MIXED` - Mix of formats

**ClinicStatus**
- `PENDING` - Awaiting review
- `APPROVED` - Approved by admin
- `REJECTED` - Rejected
- `CHANGES_REQUESTED` - Needs modifications
- `CANCELLED` - Cancelled
- `COMPLETED` - Completed

**AvailabilityMode** (Coach)
- `RECURRING` - Weekly schedule
- `SPECIFIC` - Specific date/time slots
- `ALWAYS` - Accept any request

**BookingMode** (Coach)
- `AUTO_ACCEPT` - Direct booking
- `REQUEST_FIRST` - Request and review

**LessonRequestStatus**
- `PENDING` - Awaiting coach response
- `ACCEPTED` - Coach accepted
- `DECLINED` - Coach declined
- `CONFIRMED` - Payment complete
- `CANCELLED` - Cancelled
- `COMPLETED` - Lesson delivered

### Services & Tasks

**ServiceCategory**
- `EXERCISE` - Exercise services
- `SCHOOLING` - Schooling/training
- `GROOMING` - Grooming services
- `THIRD_PARTY` - Third-party services
- `REHAB` - Rehabilitation services

**RequestStatus**
- `PENDING` - Awaiting processing
- `QUOTED` - Cost estimate provided
- `APPROVED` - Client approved quote
- `SCHEDULED` - Scheduled
- `IN_PROGRESS` - In progress
- `COMPLETED` - Completed
- `CANCELLED` - Cancelled

**ChargeStatus**
- `PENDING` - Charge pending
- `CHARGED` - Charged to account
- `WAIVED` - Charge waived

**PreferredTime**
- `MORNING`, `AFTERNOON`, `EVENING`, `ANY`

**RecurringPattern**
- `NONE` - One-time
- `DAILY` - Every day
- `WEEKDAYS` - Monday-Friday
- `CUSTOM` - Specific days

**TaskCategory**
- `MAINTENANCE`, `REPAIRS`, `CLEANING`, `FEEDING`, `TURNOUT`, `HEALTH`, `ADMIN`, `SAFETY`, `LIVERY_SERVICE`, `OTHER`

**TaskPriority**
- `LOW`, `MEDIUM`, `HIGH`, `URGENT`

**TaskStatus**
- `OPEN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`

**RecurrenceType**
- `DAILY`, `WEEKLY`, `MONTHLY`, `CUSTOM`

**AssignmentType**
- `SPECIFIC` - Assigned to specific person
- `POOL` - Available for any staff
- `BACKLOG` - Not time-sensitive

**HealthTaskType**
- `MEDICATION` - Medication administration
- `WOUND_CARE` - Wound treatment
- `HEALTH_CHECK` - Daily health check
- `REHAB_EXERCISE` - Rehab exercise

### Health & Veterinary

**VaccineType**
- `FLU`, `TETANUS`, `FLU_TETANUS`, `OTHER`

**HealingStatus**
- `IMPROVING`, `STABLE`, `WORSENING`, `INFECTED`, `HEALED`

**AppetiteStatus**
- `NORMAL`, `REDUCED`, `NOT_EATING`, `INCREASED`

**DemeanorStatus**
- `BRIGHT`, `QUIET`, `LETHARGIC`, `AGITATED`

**RehabStatus**
- `DRAFT`, `ACTIVE`, `PAUSED`, `COMPLETED`, `CANCELLED`

**TaskFrequency**
- `DAILY`, `TWICE_DAILY`, `EVERY_OTHER_DAY`, `WEEKLY`, `AS_NEEDED`

### Feed Management

**FeedTime**
- `MORNING`, `EVENING`, `BOTH`

**SupplyStatus**
- `ADEQUATE`, `LOW`, `CRITICAL`

**AdditionStatus**
- `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`

### Field Management

**FieldCondition**
- `EXCELLENT`, `GOOD`, `FAIR`, `POOR`, `RESTING`

**CompanionRelationship**
- `PREFERRED` - Best friends
- `COMPATIBLE` - Can go together
- `INCOMPATIBLE` - Must NOT go together

**TurnoutStatus**
- `PENDING`, `APPROVED`, `DECLINED`

**TurnoutType**
- `OUT` - Turn out
- `IN` - Stay in

### Staff Management

**ShiftType**
- `MORNING`, `AFTERNOON`, `FULL_DAY`

**ShiftRole**
- `YARD_DUTIES`, `OFFICE`, `EVENTS`, `TEACHING`, `MAINTENANCE`, `OTHER`

**TimesheetStatus**
- `DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`

**WorkType**
- `YARD_DUTIES`, `YARD_MAINTENANCE`, `OFFICE`, `EVENTS`, `OTHER`

**LeaveType**
- `ANNUAL` - Annual leave
- `UNPAID` - Unpaid leave
- `TOIL` - Time off in lieu
- `EXTENDED` - Extended leave (university, travel, sabbatical)

**LeaveStatus**
- `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

### Financial

**InvoiceStatus**
- `DRAFT`, `ISSUED`, `PAID`, `CANCELLED`, `OVERDUE`

**TransactionType**
- `PACKAGE_CHARGE` - Monthly livery package
- `SERVICE_CHARGE` - Ad-hoc service
- `PAYMENT` - Payment received
- `CREDIT` - Credit/refund
- `ADJUSTMENT` - Manual adjustment

**BillingType**
- `MONTHLY` - Monthly billing (pro-rata by days)
- `WEEKLY` - Weekly billing (charged per day)

**HolidayLiveryStatus**
- `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`

### System

**NoticeCategory**
- `GENERAL`, `EVENT`, `MAINTENANCE`, `HEALTH`, `URGENT`, `SOCIAL`

**NoticePriority**
- `LOW`, `NORMAL`, `HIGH`

**ProfessionalCategory**
- `FARRIER`, `VET`, `DENTIST`, `PHYSIO`, `CHIROPRACTOR`, `SADDLER`, `NUTRITIONIST`, `INSTRUCTOR`, `TRANSPORTER`, `FEED_STORE`, `OTHER`

**ContactType**
- `VET`, `VET_BACKUP`, `FARRIER`, `FARRIER_BACKUP`, `OWNER_BACKUP`, `INSURANCE`, `OTHER`

---

## Common Patterns

### Timestamps
Most tables include:
- `created_at` - Record creation timestamp (default: NOW())
- `updated_at` - Last update timestamp (default: NOW(), updates on modification)

### Soft Deletes
Using `is_active` boolean flags where appropriate, with CASCADE deletes for dependent records to maintain referential integrity.

### Audit Trails
Many tables track:
- `created_by_id` - User who created the record
- `updated_by_id` - User who last updated the record
- `approved_by_id` - User who approved the record

### Foreign Key Cascade Behaviors

**CASCADE DELETE** - Used for tight parent-child relationships:
- horses → health records (farrier, dentist, vaccination, worming)
- horses → emergency_contacts, feed_additions, feed_alerts, service_requests, turnout_requests
- clinic_requests → clinic_slots, clinic_participants
- coach_profiles → recurring_schedules, availability_slots
- rehab_programs → rehab_phases → rehab_tasks
- invoices → invoice_line_items
- field_usage_logs → field_usage_horses
- turnout_groups → turnout_group_horses
- yard_tasks → task_comments
- compliance_items → compliance_history

**SET NULL** - Used for optional relationships that should persist:
- service_requests → rehab_program_id, rehab_task_id
- clinic_participants → slot_id

### Indexing Strategy

**Primary Keys:** All tables have indexed integer primary keys

**Foreign Keys:** Automatically indexed for join performance

**Unique Constraints:**
- users.username, users.email
- invoices.invoice_number
- feed_requirements.horse_id
- coach_profiles.user_id
- medication_admin_logs (feed_addition_id, admin_date, feed_time)
- horse_companions (horse_id, companion_horse_id)

**Additional Indexes:**
- bookings.start_time - For date range queries
- holiday_livery_requests.guest_email, holiday_livery_requests.status - For request lookup

---

## Migration Notes

### Alembic Migrations

All schema changes are tracked in `/backend/alembic/versions/`. Each migration file includes:
- Upgrade script (forward migration)
- Downgrade script (rollback)

### Schema Change Workflow

1. **Modify Models** - Update SQLAlchemy models in `/backend/app/models/`
2. **Generate Migration** - `alembic revision --autogenerate -m "description"`
3. **Review Migration** - Manually review and edit generated migration
4. **Apply Migration** - `alembic upgrade head`
5. **Rebuild Container** - `docker compose up -d --build backend`
6. **Verify** - Check logs and test endpoints

### Important Constraints

**PostgreSQL Enum Limitations:**
- Enum values are case-sensitive - always use UPPERCASE
- Default values must match exactly: `DEFAULT 'MONTHLY'` not `DEFAULT 'monthly'`
- Adding new enum values requires ALTER TYPE commands
- Renaming enum values is complex (create new type, migrate data, drop old type)

**Column Additions:**
- SQLAlchemy `create_all()` does NOT add columns to existing tables
- Requires manual ALTER TABLE commands in migrations
- Always specify DEFAULT values for new NOT NULL columns

---

## Database Size Estimates

Based on typical usage patterns:

**Small Venue (10 horses, 1 arena):**
- ~5,000 records/month
- ~1 MB/month growth

**Medium Venue (50 horses, 3 arenas):**
- ~25,000 records/month
- ~5 MB/month growth

**Large Venue (150 horses, 5+ arenas):**
- ~100,000 records/month
- ~20 MB/month growth

**Main Growth Areas:**
- Bookings (daily)
- Health observations (daily per horse)
- Medication logs (twice daily per horse on medication)
- Yard tasks (daily)
- Timesheets (per staff member per day)

**Archival Recommendations:**
- Archive bookings older than 2 years
- Archive timesheets older than 7 years (UK legal requirement)
- Archive completed rehab programs older than 5 years
- Retain health records indefinitely
- Retain invoices and ledger entries indefinitely

---

## Backup Strategy

There are **two types of backups** available, serving different purposes:

### 1. Database Backup (pg_dump) - Disaster Recovery

**Purpose:** Full PostgreSQL backup for disaster recovery. Use this for production backups.

**Location:** Admin → Settings → Backups → "Database Backup" section

**Features:**
- Creates a complete PostgreSQL dump (.sql file)
- Includes all data, schema, sequences, and constraints
- Download to your laptop for safekeeping
- Restore using standard PostgreSQL tools

**When to use:**
- Before major updates or migrations
- Regular scheduled backups (weekly recommended)
- Before any destructive operations

**Restore command:**
```bash
cat backup.sql | docker compose exec -T db psql -U evm evm_db
```

### 2. Data Export/Import (JSON) - Portability & Seeding

**Purpose:** Human-readable JSON export for seeding new environments or data portability.

**Location:** Admin → Settings → Backups → "Data Export / Import" section

**Features:**
- Creates a JSON file with all entity data
- Human-readable and editable
- Can be used to seed new environments
- Validates data before import
- Automated scheduling available

**When to use:**
- Setting up new development/staging environments
- Migrating data between systems
- Creating test data snapshots
- Inspecting data without SQL access

**Storage:**
- Local: `/backend/backups/`
- Metadata stored in `backups` table
- Optional S3 storage for off-site backup

### Recommended Backup Schedule

| Backup Type | Frequency | Retention | Purpose |
|-------------|-----------|-----------|---------|
| Database (pg_dump) | Weekly | 4 weeks | Disaster recovery |
| Data Export (JSON) | Daily | 30 days | Quick restores, seeding |

### Important Notes

- **Always download Database Backups** to your laptop - they are the true disaster recovery option
- Data Exports are useful but may not capture everything (e.g., sequences, constraints)
- Test your restore process regularly - don't wait for a disaster to find out your backups don't work

---

## Performance Considerations

### Query Optimization
- Use SELECT queries with specific columns instead of SELECT *
- Leverage indexes for WHERE clauses and JOINs
- Use EXPLAIN ANALYZE for slow queries
- Consider materialized views for complex reporting queries

### Connection Pooling
- SQLAlchemy connection pool (default: 5-20 connections)
- Configure based on concurrent users and request patterns

### Caching
- Application-level caching for site_settings (singleton)
- Cache arena availability calculations
- Cache user permissions and roles
- Invalidate caches on updates (dev_mode=True disables caching)

### Monitoring
- Track slow queries (>1 second)
- Monitor connection pool saturation
- Watch for table bloat on high-update tables (bookings, timesheets)
- Regular VACUUM ANALYZE for PostgreSQL maintenance

---

## Security Considerations

### Sensitive Data
- Passwords: Hashed using bcrypt (never stored in plain text)
- SMS credentials: Should be encrypted at rest
- Stripe keys: Should be encrypted at rest
- Consider using PostgreSQL encryption for sensitive columns

### Access Control
- Role-based access control (RBAC) via UserRole enum
- Row-level security for multi-tenant data (owner_id filtering)
- API endpoints validate user permissions before queries

### SQL Injection Prevention
- SQLAlchemy ORM parameterizes all queries automatically
- Never use raw SQL with string concatenation
- Validate and sanitize all user inputs

### Audit Logging
- Track created_by, updated_by for accountability
- Consider separate audit log table for sensitive operations
- Log authentication attempts and access to sensitive data

---

## Future Considerations

### Scalability
- Consider partitioning large tables (bookings, ledger_entries) by date
- Implement read replicas for reporting queries
- Archive old data to separate database

### Multi-Tenancy
- Current schema supports single venue
- For multi-venue: Add venue_id to all tables, implement tenant isolation

### Advanced Features
- Full-text search (PostgreSQL tsvector) for notes and descriptions
- Geospatial queries (PostGIS) for coverage areas and location-based features
- Time-series data (TimescaleDB) for analytics and trending

---

**Last Updated:** 2025-12-24
**Schema Version:** Alembic HEAD
**Database:** PostgreSQL 13+
