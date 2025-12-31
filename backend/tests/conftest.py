import pytest
import json
import os
from datetime import datetime, timedelta, date, time
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db
from app.models.user import User, UserRole
from app.models.arena import Arena
from app.models.booking import Booking, BookingType, PaymentStatus
from app.models.horse import Horse
from app.models.livery_package import LiveryPackage
from app.models.stable import Stable, StableBlock
from app.models.notice import Notice, NoticeCategory, NoticePriority
from app.models.professional import Professional, ProfessionalCategory
from app.models.compliance import ComplianceItem, ComplianceHistory
from app.models.clinic import ClinicRequest, ClinicStatus, Discipline, LessonFormat
from app.models.livery_package import BillingType
from app.models.holiday_livery import HolidayLiveryRequest, HolidayLiveryStatus
from app.models.service import Service, ServiceRequest, ServiceCategory, RequestStatus, PreferredTime, RecurringPattern
from app.models.medication_log import RehabProgram, RehabPhase, RehabTask, RehabStatus, TaskFrequency
from app.models.settings import SiteSettings
from app.models.account import LedgerEntry
from app.models.backup import Backup, BackupSchedule
from app.models.coach import CoachProfile, LessonRequest
from app.models.emergency_contact import EmergencyContact
from app.models.feed import FeedRequirement, FeedAddition, FeedSupplyAlert
from app.models.field import Field, FieldUsageLog, HorseCompanion, TurnoutGroup
from app.models.health_record import FarrierRecord, DentistRecord, VaccinationRecord, WormingRecord
from app.models.invoice import Invoice, InvoiceLineItem
from app.models.staff_management import Shift, Timesheet, HolidayRequest, UnplannedAbsence
from app.models.task import YardTask, TaskComment
from app.models.turnout import TurnoutRequest
from app.models.contract import ContractTemplate, ContractVersion, ContractSignature
from app.models.staff_profile import StaffProfile
from app.utils.auth import get_password_hash, create_access_token

# Use DATABASE_URL from environment (for CI with PostgreSQL) or fall back to SQLite for local testing
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///:memory:")

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# User fixtures for each role
@pytest.fixture
def public_user(db):
    user = User(
        username="publicuser",
        email="public@example.com",
        name="Public User",
        password_hash=get_password_hash("password123"),
        role=UserRole.PUBLIC,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def livery_user(db):
    user = User(
        username="liveryuser",
        email="livery@example.com",
        name="Livery User",
        password_hash=get_password_hash("password123"),
        role=UserRole.LIVERY,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def coach_user(db):
    user = User(
        username="coachuser",
        email="coach@example.com",
        name="Coach User",
        password_hash=get_password_hash("password123"),
        role=UserRole.COACH,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_user(db):
    user = User(
        username="adminuser",
        email="admin@example.com",
        name="Admin User",
        password_hash=get_password_hash("password123"),
        role=UserRole.ADMIN,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def disabled_user(db):
    user = User(
        username="disableduser",
        email="disabled@example.com",
        name="Disabled User",
        password_hash=get_password_hash("password123"),
        role=UserRole.LIVERY,
        is_active=False
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def must_change_password_user(db):
    user = User(
        username="newuser",
        email="newuser@example.com",
        name="New User",
        password_hash=get_password_hash("temppass123"),
        role=UserRole.LIVERY,
        must_change_password=True,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


# Auth headers for each role
@pytest.fixture
def auth_headers_public(public_user):
    token = create_access_token(public_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_livery(livery_user):
    token = create_access_token(livery_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_coach(coach_user):
    token = create_access_token(coach_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def auth_headers_admin(admin_user):
    token = create_access_token(admin_user.id)
    return {"Authorization": f"Bearer {token}"}


# Arena fixtures
@pytest.fixture
def arena(db):
    arena = Arena(
        name="Indoor Arena",
        description="Indoor riding arena",
        size="20x40",
        surface_type="sand",
        has_lights=True,
        free_for_livery=False,
        is_active=True
    )
    db.add(arena)
    db.commit()
    db.refresh(arena)
    return arena


@pytest.fixture
def free_arena(db):
    arena = Arena(
        name="Outdoor Arena",
        description="Outdoor arena free for livery clients",
        size="60x40",
        surface_type="grass",
        has_lights=False,
        free_for_livery=True,
        is_active=True
    )
    db.add(arena)
    db.commit()
    db.refresh(arena)
    return arena


# Booking fixtures
@pytest.fixture
def public_booking(db, arena, public_user):
    booking = Booking(
        arena_id=arena.id,
        user_id=public_user.id,
        title="Public Booking",
        description="Test booking by public user",
        start_time=datetime.utcnow() + timedelta(days=1),
        end_time=datetime.utcnow() + timedelta(days=1, hours=1),
        booking_type=BookingType.PUBLIC,
        payment_status=PaymentStatus.PENDING
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@pytest.fixture
def livery_booking(db, arena, livery_user, horse):
    booking = Booking(
        arena_id=arena.id,
        user_id=livery_user.id,
        horse_id=horse.id,
        title="Livery Booking",
        description="Test booking by livery user",
        start_time=datetime.utcnow() + timedelta(days=2),
        end_time=datetime.utcnow() + timedelta(days=2, hours=1),
        booking_type=BookingType.LIVERY,
        payment_status=PaymentStatus.NOT_REQUIRED
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


# Horse fixture
@pytest.fixture
def horse(db, livery_user):
    horse = Horse(
        owner_id=livery_user.id,
        name="Thunder",
        colour="Black",
        birth_year=2015
    )
    db.add(horse)
    db.commit()
    db.refresh(horse)
    return horse


# Helper to create multiple users for testing
@pytest.fixture
def all_users(db, public_user, livery_user, coach_user, admin_user):
    return {
        "public": public_user,
        "livery": livery_user,
        "coach": coach_user,
        "admin": admin_user
    }


@pytest.fixture
def all_auth_headers(auth_headers_public, auth_headers_livery, auth_headers_coach, auth_headers_admin):
    return {
        "public": auth_headers_public,
        "livery": auth_headers_livery,
        "coach": auth_headers_coach,
        "admin": auth_headers_admin
    }


# Yard staff user fixture
@pytest.fixture
def staff_user(db):
    user = User(
        username="staffuser",
        email="staff@example.com",
        name="Staff User",
        password_hash=get_password_hash("password123"),
        role=UserRole.LIVERY,
        is_yard_staff=True,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers_staff(staff_user):
    token = create_access_token(staff_user.id)
    return {"Authorization": f"Bearer {token}"}


# Livery Package fixtures
@pytest.fixture
def livery_package(db):
    package = LiveryPackage(
        name="Full Livery",
        price_display="£165/week",
        monthly_price=715.00,
        description="Complete care package",
        features=json.dumps(["Daily turnout", "Feeding twice daily", "Mucking out"]),
        is_featured=True,
        display_order=1,
        is_active=True
    )
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


@pytest.fixture
def inactive_livery_package(db):
    package = LiveryPackage(
        name="DIY Livery",
        price_display="£85/week",
        monthly_price=368.00,
        description="Self-care package",
        features=json.dumps(["Stable only", "Use of facilities"]),
        is_featured=False,
        display_order=2,
        is_active=False
    )
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


# Stable Block and Stable fixtures
@pytest.fixture
def stable_block(db):
    block = StableBlock(
        name="Front Block",
        sequence=1,
        is_active=True
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block


@pytest.fixture
def stable(db, stable_block):
    stable = Stable(
        name="Front Block 1",
        block_id=stable_block.id,
        number=1,
        sequence=1,
        is_active=True
    )
    db.add(stable)
    db.commit()
    db.refresh(stable)
    return stable


# Notice fixtures
@pytest.fixture
def notice(db, admin_user):
    notice = Notice(
        title="Test Notice",
        content="This is a test notice content",
        category=NoticeCategory.GENERAL,
        priority=NoticePriority.NORMAL,
        is_pinned=False,
        is_active=True,
        created_by_id=admin_user.id
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


@pytest.fixture
def pinned_notice(db, admin_user):
    notice = Notice(
        title="Pinned Notice",
        content="Important pinned notice",
        category=NoticeCategory.URGENT,
        priority=NoticePriority.HIGH,
        is_pinned=True,
        is_active=True,
        created_by_id=admin_user.id
    )
    db.add(notice)
    db.commit()
    db.refresh(notice)
    return notice


# Professional fixtures
@pytest.fixture
def professional(db):
    prof = Professional(
        category=ProfessionalCategory.FARRIER,
        business_name="Smith Farrier Services",
        contact_name="John Smith",
        phone="01onal 234567",
        mobile="07700 900001",
        email="john@smithfarrier.com",
        coverage_area="Within 20 miles",
        services="Hot and cold shoeing, remedial work",
        yard_recommended=True,
        is_active=True
    )
    db.add(prof)
    db.commit()
    db.refresh(prof)
    return prof


@pytest.fixture
def inactive_professional(db):
    prof = Professional(
        category=ProfessionalCategory.VET,
        business_name="Inactive Vets",
        contact_name="Dr Gone",
        is_active=False
    )
    db.add(prof)
    db.commit()
    db.refresh(prof)
    return prof


# Compliance fixtures
@pytest.fixture
def compliance_item(db, admin_user):
    item = ComplianceItem(
        name="Public Liability Insurance",
        category="insurance",
        description="Annual public liability insurance renewal",
        reference_number="PLI-2024-001",
        provider="Equine Insurance Co",
        renewal_frequency_months=12,
        last_completed_date=datetime.utcnow() - timedelta(days=30),
        next_due_date=datetime.utcnow() + timedelta(days=335),
        reminder_days_before=30,
        responsible_user_id=admin_user.id,
        is_active=True
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@pytest.fixture
def overdue_compliance_item(db, admin_user):
    item = ComplianceItem(
        name="Fire Extinguisher Service",
        category="fire_safety",
        description="Annual fire extinguisher inspection",
        renewal_frequency_months=12,
        last_completed_date=datetime.utcnow() - timedelta(days=400),
        next_due_date=datetime.utcnow() - timedelta(days=35),
        reminder_days_before=30,
        responsible_user_id=admin_user.id,
        is_active=True
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


# Clinic fixtures
@pytest.fixture
def clinic_request(db, coach_user, arena):
    clinic = ClinicRequest(
        coach_name=coach_user.name,
        coach_email=coach_user.email,
        coach_phone="07700 900002",
        discipline=Discipline.DRESSAGE,
        title="Dressage Training Day",
        description="A day of dressage training",
        proposed_date=date.today() + timedelta(days=30),
        proposed_start_time=time(9, 0),
        proposed_end_time=time(17, 0),
        lesson_format=LessonFormat.GROUP,
        max_participants=10,
        coach_fee_private=50.00,
        proposed_by_id=coach_user.id,
        status=ClinicStatus.PENDING
    )
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    return clinic


@pytest.fixture
def approved_clinic(db, coach_user, admin_user, arena):
    clinic = ClinicRequest(
        coach_name=coach_user.name,
        coach_email=coach_user.email,
        discipline=Discipline.SHOW_JUMPING,
        title="Show Jumping Clinic",
        description="Jumping training for all levels",
        proposed_date=date.today() + timedelta(days=14),
        proposed_start_time=time(10, 0),
        proposed_end_time=time(16, 0),
        lesson_format=LessonFormat.GROUP,
        max_participants=8,
        coach_fee_private=60.00,
        proposed_by_id=coach_user.id,
        status=ClinicStatus.APPROVED,
        reviewed_by_id=admin_user.id,
        reviewed_at=datetime.utcnow()
    )
    db.add(clinic)
    db.commit()
    db.refresh(clinic)
    return clinic


# Holiday Livery fixtures
@pytest.fixture
def holiday_livery_package(db):
    """Weekly-billed package for holiday livery."""
    package = LiveryPackage(
        name="Holiday Livery",
        price_display="£280/week",
        monthly_price=None,
        weekly_price=280.00,
        billing_type=BillingType.WEEKLY,
        description="Short-term holiday livery",
        features=json.dumps(["Full care", "Daily turnout", "Feeding"]),
        is_featured=False,
        display_order=5,
        is_active=True
    )
    db.add(package)
    db.commit()
    db.refresh(package)
    return package


@pytest.fixture
def holiday_livery_request(db):
    """A pending holiday livery request."""
    request = HolidayLiveryRequest(
        guest_name="Jane Smith",
        guest_email="jane.smith@example.com",
        guest_phone="07700 900123",
        horse_name="Star",
        horse_breed="Thoroughbred",
        horse_age=8,
        horse_colour="Bay",
        horse_gender="mare",
        special_requirements="Needs twice daily medication",
        requested_arrival=date.today() + timedelta(days=7),
        requested_departure=date.today() + timedelta(days=14),
        message="Looking forward to visiting!",
        status=HolidayLiveryStatus.PENDING
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@pytest.fixture
def approved_holiday_livery_request(db, admin_user, livery_user, horse, stable):
    """An approved holiday livery request."""
    request = HolidayLiveryRequest(
        guest_name="John Doe",
        guest_email="john.doe@example.com",
        guest_phone="07700 900456",
        horse_name="Lightning",
        horse_breed="Warmblood",
        horse_age=10,
        horse_colour="Grey",
        horse_gender="gelding",
        requested_arrival=date.today() + timedelta(days=1),
        requested_departure=date.today() + timedelta(days=10),
        status=HolidayLiveryStatus.APPROVED,
        confirmed_arrival=date.today() + timedelta(days=1),
        confirmed_departure=date.today() + timedelta(days=10),
        assigned_stable_id=stable.id,
        created_user_id=livery_user.id,
        created_horse_id=horse.id,
        processed_by_id=admin_user.id,
        processed_at=datetime.utcnow()
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


# Service fixtures
@pytest.fixture
def service(db):
    """Basic exercise service."""
    service = Service(
        id="exercise-walk",
        category=ServiceCategory.EXERCISE,
        name="Exercise - Walk in Hand",
        description="15-minute walk in hand",
        duration_minutes=15,
        price_gbp=10.00,
        requires_approval=False,
        advance_notice_hours=24,
        is_active=True
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@pytest.fixture
def rehab_assistance_service(db):
    """Rehab assistance service."""
    service = Service(
        id="rehab-assistance",
        category=ServiceCategory.REHAB,
        name="Rehab Task Assistance",
        description="Staff assistance with horse rehabilitation exercises and tasks",
        price_gbp=0.00,
        requires_approval=False,
        advance_notice_hours=0,
        is_active=True
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


@pytest.fixture
def service_request(db, service, horse, livery_user):
    """Basic service request."""
    request = ServiceRequest(
        service_id=service.id,
        horse_id=horse.id,
        requested_by_id=livery_user.id,
        requested_date=date.today() + timedelta(days=3),
        preferred_time=PreferredTime.MORNING,
        status=RequestStatus.APPROVED,
        charge_amount=service.price_gbp
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@pytest.fixture
def rehab_program_active(db, horse, livery_user):
    """Active rehab program with phases and tasks."""
    program = RehabProgram(
        horse_id=horse.id,
        name="Post-injury rehabilitation",
        description="Recovery program after tendon injury",
        reason="Tendon strain - left front leg",
        prescribed_by="Dr. Vet Smith",
        prescription_date=date.today() - timedelta(days=7),
        start_date=date.today() - timedelta(days=7),
        expected_end_date=date.today() + timedelta(days=21),
        status=RehabStatus.ACTIVE,
        current_phase=1,
        created_by_id=livery_user.id
    )
    db.add(program)
    db.commit()
    db.refresh(program)

    # Add phase 1
    phase1 = RehabPhase(
        program_id=program.id,
        phase_number=1,
        name="Phase 1: Walk Only",
        description="Gentle walking exercises",
        duration_days=14,
        start_day=1,
        is_completed=False
    )
    db.add(phase1)
    db.commit()
    db.refresh(phase1)

    # Add tasks to phase 1
    task1 = RehabTask(
        phase_id=phase1.id,
        task_type="walk",
        description="Walk in hand for 10 minutes",
        duration_minutes=10,
        frequency=TaskFrequency.DAILY,
        sequence=1
    )
    task2 = RehabTask(
        phase_id=phase1.id,
        task_type="ice",
        description="Ice boot application - 15 minutes",
        duration_minutes=15,
        frequency=TaskFrequency.TWICE_DAILY,
        sequence=2
    )
    db.add(task1)
    db.add(task2)
    db.commit()
    db.refresh(task1)
    db.refresh(task2)

    # Store task references on program for easy access in tests
    program.phase1 = phase1
    program.task1 = task1
    program.task2 = task2

    return program
