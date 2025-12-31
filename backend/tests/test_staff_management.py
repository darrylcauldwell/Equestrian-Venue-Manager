"""Tests for staff management functionality.

Tests cover:
- Shifts: CRUD operations and access control
- Timesheets: CRUD, submission, approval workflow
- Holiday requests: CRUD, approval workflow
- Unplanned absences: CRUD operations
- Leave summary: aggregation and reporting
- Dashboard: manager statistics
"""
import pytest
from datetime import date, time, timedelta, datetime

from app.models.staff_management import (
    Shift, Timesheet, HolidayRequest, UnplannedAbsence,
    ShiftType, ShiftRole, WorkType, TimesheetStatus, LeaveType, LeaveStatus
)
from app.models.user import User, UserRole, StaffType
from app.utils.auth import get_password_hash, create_access_token


# ============== Fixtures ==============

@pytest.fixture
def second_staff_user(db):
    """Second yard staff user for multi-user tests."""
    user = User(
        username="staffuser2",
        email="staff2@example.com",
        name="Staff User Two",
        password_hash=get_password_hash("password123"),
        role=UserRole.LIVERY,
        is_yard_staff=True,
        is_active=True,
        annual_leave_entitlement=28
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers_second_staff(second_staff_user):
    token = create_access_token(second_staff_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def casual_staff_user(db):
    """Casual/zero-hours staff user."""
    user = User(
        username="casualuser",
        email="casual@example.com",
        name="Casual Staff",
        password_hash=get_password_hash("password123"),
        role=UserRole.LIVERY,
        is_yard_staff=True,
        is_active=True,
        staff_type=StaffType.CASUAL
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def shift(db, staff_user, admin_user):
    """A basic shift."""
    shift = Shift(
        staff_id=staff_user.id,
        date=date.today() + timedelta(days=1),
        shift_type=ShiftType.MORNING,
        role=ShiftRole.YARD_DUTIES,
        notes="Morning yard duties",
        created_by_id=admin_user.id
    )
    db.add(shift)
    db.commit()
    db.refresh(shift)
    return shift


@pytest.fixture
def timesheet_draft(db, staff_user):
    """A draft timesheet."""
    ts = Timesheet(
        staff_id=staff_user.id,
        date=date.today(),
        clock_in=time(9, 0),
        clock_out=time(17, 0),
        break_minutes=30,
        work_type=WorkType.YARD_DUTIES,
        notes="Regular day",
        status=TimesheetStatus.DRAFT
    )
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


@pytest.fixture
def timesheet_submitted(db, staff_user):
    """A submitted timesheet awaiting approval."""
    ts = Timesheet(
        staff_id=staff_user.id,
        date=date.today() - timedelta(days=1),
        clock_in=time(8, 30),
        clock_out=time(16, 30),
        break_minutes=30,
        work_type=WorkType.YARD_DUTIES,
        status=TimesheetStatus.SUBMITTED,
        submitted_at=datetime.utcnow()
    )
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


@pytest.fixture
def timesheet_approved(db, staff_user, admin_user):
    """An approved timesheet."""
    ts = Timesheet(
        staff_id=staff_user.id,
        date=date.today() - timedelta(days=7),
        clock_in=time(9, 0),
        clock_out=time(17, 0),
        break_minutes=30,
        work_type=WorkType.YARD_DUTIES,
        status=TimesheetStatus.APPROVED,
        submitted_at=datetime.utcnow() - timedelta(days=6),
        approved_by_id=admin_user.id,
        approved_at=datetime.utcnow() - timedelta(days=5)
    )
    db.add(ts)
    db.commit()
    db.refresh(ts)
    return ts


@pytest.fixture
def holiday_request_pending(db, staff_user):
    """A pending holiday request."""
    req = HolidayRequest(
        staff_id=staff_user.id,
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=34),
        leave_type=LeaveType.ANNUAL,
        days_requested=5,
        reason="Family vacation",
        status=LeaveStatus.PENDING
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@pytest.fixture
def holiday_request_approved(db, staff_user, admin_user):
    """An approved holiday request (in the past within current year)."""
    # Use a date in the current year to ensure leave summary counts it
    current_year = date.today().year
    start = date(current_year, 6, 1)  # June 1st of current year
    end = date(current_year, 6, 3)    # June 3rd of current year
    req = HolidayRequest(
        staff_id=staff_user.id,
        start_date=start,
        end_date=end,
        leave_type=LeaveType.ANNUAL,
        days_requested=3,
        status=LeaveStatus.APPROVED,
        approved_by_id=admin_user.id,
        approval_date=datetime.utcnow()
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


@pytest.fixture
def unplanned_absence(db, staff_user, admin_user):
    """An unplanned absence record."""
    absence = UnplannedAbsence(
        staff_id=staff_user.id,
        date=date.today() - timedelta(days=3),
        reported_time=time(8, 0),
        reported_to_id=admin_user.id,
        reason="sickness",
        expected_return=date.today() - timedelta(days=1),
        actual_return=date.today() - timedelta(days=1),
        notes="Had flu symptoms"
    )
    db.add(absence)
    db.commit()
    db.refresh(absence)
    return absence


# ============== Enum Endpoint Tests ==============

class TestEnums:
    """Tests for GET /api/staff/enums."""

    def test_get_enums_success(self, client):
        """Test getting enum values (public endpoint)."""
        response = client.get("/api/staff/enums")
        assert response.status_code == 200
        data = response.json()

        assert "shift_types" in data
        assert "shift_roles" in data
        assert "work_types" in data
        assert "timesheet_statuses" in data
        assert "leave_types" in data
        assert "leave_statuses" in data
        assert "staff_types" in data

        # Check structure
        assert len(data["shift_types"]) == 3  # morning, afternoon, full_day
        assert data["shift_types"][0]["value"] == "morning"
        assert data["shift_types"][0]["label"] == "Morning"


# ============== Dashboard Tests ==============

class TestDashboard:
    """Tests for GET /api/staff/dashboard."""

    def test_dashboard_requires_auth(self, client):
        """Test that dashboard requires authentication."""
        response = client.get("/api/staff/dashboard")
        assert response.status_code == 401

    def test_dashboard_requires_admin(self, client, auth_headers_staff):
        """Test that dashboard requires admin role."""
        response = client.get("/api/staff/dashboard", headers=auth_headers_staff)
        assert response.status_code == 403

    def test_dashboard_success_empty(self, client, auth_headers_admin):
        """Test dashboard with no data."""
        response = client.get("/api/staff/dashboard", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()

        assert data["pending_timesheets"] == 0
        assert data["pending_holiday_requests"] == 0
        assert data["staff_on_leave_today"] == 0
        assert data["staff_absent_today"] == 0
        assert data["shifts_today"] == 0

    def test_dashboard_with_data(
        self, client, auth_headers_admin, db,
        timesheet_submitted, holiday_request_pending, shift, staff_user, admin_user
    ):
        """Test dashboard reflects actual data counts."""
        # Add a shift for today
        today_shift = Shift(
            staff_id=staff_user.id,
            date=date.today(),
            shift_type=ShiftType.FULL_DAY,
            role=ShiftRole.YARD_DUTIES,
            created_by_id=admin_user.id
        )
        db.add(today_shift)
        db.commit()

        response = client.get("/api/staff/dashboard", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()

        assert data["pending_timesheets"] >= 1
        assert data["pending_holiday_requests"] >= 1
        assert data["shifts_today"] >= 1


# ============== Shift Tests ==============

class TestShiftList:
    """Tests for GET /api/staff/shifts."""

    def test_list_shifts_requires_auth(self, client):
        """Test that listing shifts requires authentication."""
        response = client.get("/api/staff/shifts")
        assert response.status_code == 401

    def test_list_shifts_requires_staff(self, client, auth_headers_livery):
        """Test that listing shifts requires staff access."""
        response = client.get("/api/staff/shifts", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_shifts_staff_success(self, client, auth_headers_staff, shift):
        """Test staff can list shifts."""
        response = client.get("/api/staff/shifts", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["shifts"]) >= 1

    def test_list_shifts_admin_success(self, client, auth_headers_admin, shift):
        """Test admin can list all shifts."""
        response = client.get("/api/staff/shifts", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    def test_list_shifts_filter_by_staff(
        self, client, auth_headers_admin, shift, staff_user
    ):
        """Test filtering shifts by staff_id."""
        response = client.get(
            f"/api/staff/shifts?staff_id={staff_user.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        for s in data["shifts"]:
            assert s["staff_id"] == staff_user.id

    def test_list_shifts_filter_by_date_range(
        self, client, auth_headers_admin, shift
    ):
        """Test filtering shifts by date range."""
        start = date.today().isoformat()
        end = (date.today() + timedelta(days=7)).isoformat()
        response = client.get(
            f"/api/staff/shifts?start_date={start}&end_date={end}",
            headers=auth_headers_admin
        )
        assert response.status_code == 200


class TestShiftCreate:
    """Tests for POST /api/staff/shifts."""

    def test_create_shift_requires_auth(self, client):
        """Test that creating shift requires authentication."""
        response = client.post("/api/staff/shifts", json={
            "staff_id": 1,
            "date": date.today().isoformat(),
            "shift_type": "morning"
        })
        assert response.status_code == 401

    def test_create_shift_requires_admin(self, client, auth_headers_staff, staff_user):
        """Test that creating shift requires admin role."""
        response = client.post("/api/staff/shifts", json={
            "staff_id": staff_user.id,
            "date": date.today().isoformat(),
            "shift_type": "morning"
        }, headers=auth_headers_staff)
        assert response.status_code == 403

    def test_create_shift_success(self, client, auth_headers_admin, staff_user):
        """Test admin can create a shift."""
        shift_date = (date.today() + timedelta(days=7)).isoformat()
        response = client.post("/api/staff/shifts", json={
            "staff_id": staff_user.id,
            "date": shift_date,
            "shift_type": "afternoon",
            "role": "office",
            "notes": "Office coverage"
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["staff_id"] == staff_user.id
        assert data["shift_type"] == "afternoon"
        assert data["role"] == "office"
        assert data["notes"] == "Office coverage"


class TestShiftUpdate:
    """Tests for PUT /api/staff/shifts/{shift_id}."""

    def test_update_shift_requires_admin(self, client, auth_headers_staff, shift):
        """Test that updating shift requires admin role."""
        response = client.put(
            f"/api/staff/shifts/{shift.id}",
            json={"notes": "Updated"},
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_update_shift_not_found(self, client, auth_headers_admin):
        """Test updating non-existent shift."""
        response = client.put(
            "/api/staff/shifts/99999",
            json={"notes": "Updated"},
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_update_shift_success(self, client, auth_headers_admin, shift):
        """Test admin can update a shift."""
        response = client.put(
            f"/api/staff/shifts/{shift.id}",
            json={
                "shift_type": "full_day",
                "notes": "Changed to full day"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["shift_type"] == "full_day"
        assert data["notes"] == "Changed to full day"


class TestShiftDelete:
    """Tests for DELETE /api/staff/shifts/{shift_id}."""

    def test_delete_shift_requires_admin(self, client, auth_headers_staff, shift):
        """Test that deleting shift requires admin role."""
        response = client.delete(
            f"/api/staff/shifts/{shift.id}",
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_delete_shift_not_found(self, client, auth_headers_admin):
        """Test deleting non-existent shift."""
        response = client.delete(
            "/api/staff/shifts/99999",
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_delete_shift_success(self, client, auth_headers_admin, shift, db):
        """Test admin can delete a shift."""
        shift_id = shift.id
        response = client.delete(
            f"/api/staff/shifts/{shift_id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 204

        # Verify deleted
        assert db.query(Shift).filter(Shift.id == shift_id).first() is None


# ============== Timesheet Tests ==============

class TestTimesheetList:
    """Tests for GET /api/staff/timesheets."""

    def test_list_timesheets_requires_auth(self, client):
        """Test that listing timesheets requires authentication."""
        response = client.get("/api/staff/timesheets")
        assert response.status_code == 401

    def test_list_timesheets_requires_staff(self, client, auth_headers_livery):
        """Test that listing timesheets requires staff access."""
        response = client.get("/api/staff/timesheets", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_timesheets_staff_sees_own(
        self, client, auth_headers_staff, timesheet_draft, staff_user
    ):
        """Test staff sees only their own timesheets."""
        response = client.get("/api/staff/timesheets", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        for ts in data["timesheets"]:
            assert ts["staff_id"] == staff_user.id

    def test_list_timesheets_admin_sees_all(
        self, client, auth_headers_admin, db, staff_user, admin_user
    ):
        """Test admin can see all timesheets."""
        # Create timesheet for staff_user
        ts = Timesheet(
            staff_id=staff_user.id,
            date=date.today(),
            clock_in=time(9, 0),
            status=TimesheetStatus.DRAFT
        )
        db.add(ts)
        db.commit()

        response = client.get("/api/staff/timesheets", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1

    def test_list_timesheets_filter_by_status(
        self, client, auth_headers_admin, timesheet_submitted
    ):
        """Test filtering timesheets by status."""
        response = client.get(
            "/api/staff/timesheets?status_filter=submitted",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        for ts in data["timesheets"]:
            assert ts["status"] == "submitted"


class TestTimesheetCreate:
    """Tests for POST /api/staff/timesheets."""

    def test_create_timesheet_requires_auth(self, client):
        """Test that creating timesheet requires authentication."""
        response = client.post("/api/staff/timesheets", json={
            "date": date.today().isoformat(),
            "clock_in": "09:00"
        })
        assert response.status_code == 401

    def test_create_timesheet_requires_staff(self, client, auth_headers_livery):
        """Test that creating timesheet requires staff access."""
        response = client.post("/api/staff/timesheets", json={
            "date": date.today().isoformat(),
            "clock_in": "09:00"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_create_timesheet_success(self, client, auth_headers_staff, staff_user):
        """Test staff can create a timesheet."""
        response = client.post("/api/staff/timesheets", json={
            "date": (date.today() - timedelta(days=2)).isoformat(),
            "clock_in": "08:30",
            "clock_out": "16:30",
            "break_minutes": 30,
            "work_type": "yard_duties",
            "notes": "Morning feeding, turnout, afternoon mucking out"
        }, headers=auth_headers_staff)
        assert response.status_code == 201
        data = response.json()
        assert data["staff_id"] == staff_user.id
        assert data["status"] == "draft"
        assert data["clock_in"] == "08:30:00"
        assert data["total_hours"] == 7.5  # 8 hours - 0.5 hour break


class TestTimesheetUpdate:
    """Tests for PUT /api/staff/timesheets/{timesheet_id}."""

    def test_update_timesheet_own_only(
        self, client, auth_headers_second_staff, timesheet_draft
    ):
        """Test staff can only update their own timesheets."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_draft.id}",
            json={"notes": "Updated by someone else"},
            headers=auth_headers_second_staff
        )
        assert response.status_code == 403

    def test_update_timesheet_draft_only(
        self, client, auth_headers_staff, timesheet_submitted
    ):
        """Test can only update draft timesheets."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_submitted.id}",
            json={"notes": "Trying to update submitted"},
            headers=auth_headers_staff
        )
        assert response.status_code == 400

    def test_update_timesheet_success(
        self, client, auth_headers_staff, timesheet_draft
    ):
        """Test staff can update their draft timesheet."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_draft.id}",
            json={
                "clock_out": "18:00",
                "notes": "Stayed late for evening feed"
            },
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert data["clock_out"] == "18:00:00"
        assert "Stayed late" in data["notes"]

    def test_update_rejected_timesheet_resets_to_draft(
        self, client, auth_headers_staff, db, staff_user
    ):
        """Test updating a rejected timesheet resets it to draft."""
        # Create rejected timesheet
        ts = Timesheet(
            staff_id=staff_user.id,
            date=date.today() - timedelta(days=5),
            clock_in=time(9, 0),
            clock_out=time(17, 0),
            status=TimesheetStatus.REJECTED,
            rejection_reason="Missing break time"
        )
        db.add(ts)
        db.commit()
        db.refresh(ts)

        response = client.put(
            f"/api/staff/timesheets/{ts.id}",
            json={"break_minutes": 30},
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "draft"
        assert data["rejection_reason"] is None


class TestTimesheetSubmit:
    """Tests for PUT /api/staff/timesheets/{timesheet_id}/submit."""

    def test_submit_timesheet_own_only(
        self, client, auth_headers_second_staff, timesheet_draft
    ):
        """Test staff can only submit their own timesheets."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_draft.id}/submit",
            headers=auth_headers_second_staff
        )
        assert response.status_code == 403

    def test_submit_timesheet_requires_clock_out(
        self, client, auth_headers_staff, db, staff_user
    ):
        """Test cannot submit without clock_out."""
        ts = Timesheet(
            staff_id=staff_user.id,
            date=date.today(),
            clock_in=time(9, 0),
            status=TimesheetStatus.DRAFT
        )
        db.add(ts)
        db.commit()
        db.refresh(ts)

        response = client.put(
            f"/api/staff/timesheets/{ts.id}/submit",
            headers=auth_headers_staff
        )
        assert response.status_code == 400
        assert "clock out" in response.json()["detail"].lower()

    def test_submit_timesheet_success(
        self, client, auth_headers_staff, timesheet_draft
    ):
        """Test staff can submit their timesheet."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_draft.id}/submit",
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "submitted"
        assert data["submitted_at"] is not None


class TestTimesheetApprove:
    """Tests for PUT /api/staff/timesheets/{timesheet_id}/approve."""

    def test_approve_timesheet_requires_admin(
        self, client, auth_headers_staff, timesheet_submitted
    ):
        """Test that approving requires admin role."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_submitted.id}/approve",
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_approve_timesheet_must_be_submitted(
        self, client, auth_headers_admin, timesheet_draft
    ):
        """Test can only approve submitted timesheets."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_draft.id}/approve",
            headers=auth_headers_admin
        )
        assert response.status_code == 400

    def test_approve_timesheet_success(
        self, client, auth_headers_admin, timesheet_submitted, admin_user
    ):
        """Test admin can approve a submitted timesheet."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_submitted.id}/approve",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["approved_by_id"] == admin_user.id
        assert data["approved_at"] is not None


class TestTimesheetReject:
    """Tests for PUT /api/staff/timesheets/{timesheet_id}/reject."""

    def test_reject_timesheet_requires_admin(
        self, client, auth_headers_staff, timesheet_submitted
    ):
        """Test that rejecting requires admin role."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_submitted.id}/reject",
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_reject_timesheet_success(
        self, client, auth_headers_admin, timesheet_submitted
    ):
        """Test admin can reject a submitted timesheet."""
        response = client.put(
            f"/api/staff/timesheets/{timesheet_submitted.id}/reject?reason=Missing%20break%20information",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        assert data["rejection_reason"] == "Missing break information"


class TestAdminTimesheetCreate:
    """Tests for POST /api/staff/timesheets/admin."""

    def test_admin_create_timesheet_requires_admin(
        self, client, auth_headers_staff, staff_user
    ):
        """Test that admin create requires admin role."""
        response = client.post("/api/staff/timesheets/admin", json={
            "staff_id": staff_user.id,
            "date": date.today().isoformat(),
            "clock_in": "09:00",
            "clock_out": "17:00"
        }, headers=auth_headers_staff)
        assert response.status_code == 403

    def test_admin_create_timesheet_invalid_staff(
        self, client, auth_headers_admin, livery_user
    ):
        """Test admin cannot create timesheet for non-staff user."""
        response = client.post("/api/staff/timesheets/admin", json={
            "staff_id": livery_user.id,
            "date": date.today().isoformat(),
            "clock_in": "09:00",
            "clock_out": "17:00"
        }, headers=auth_headers_admin)
        assert response.status_code == 400

    def test_admin_create_timesheet_success(
        self, client, auth_headers_admin, staff_user, admin_user
    ):
        """Test admin can create timesheet for staff."""
        response = client.post("/api/staff/timesheets/admin", json={
            "staff_id": staff_user.id,
            "date": (date.today() - timedelta(days=3)).isoformat(),
            "clock_in": "08:00",
            "clock_out": "16:00",
            "break_minutes": 30,
            "notes": "Staff forgot to log hours"
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["staff_id"] == staff_user.id
        assert data["logged_by_id"] == admin_user.id
        assert data["status"] == "submitted"  # Admin-created go straight to submitted


# ============== Holiday Request Tests ==============

class TestHolidayRequestList:
    """Tests for GET /api/staff/holidays."""

    def test_list_holidays_requires_auth(self, client):
        """Test that listing holidays requires authentication."""
        response = client.get("/api/staff/holidays")
        assert response.status_code == 401

    def test_list_holidays_requires_staff(self, client, auth_headers_livery):
        """Test that listing holidays requires staff access."""
        response = client.get("/api/staff/holidays", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_holidays_staff_sees_own(
        self, client, auth_headers_staff, holiday_request_pending, staff_user
    ):
        """Test staff sees only their own holiday requests."""
        response = client.get("/api/staff/holidays", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        # Check all categories
        for req in data["pending"] + data["approved"] + data["rejected"]:
            assert req["staff_id"] == staff_user.id

    def test_list_holidays_admin_sees_all(
        self, client, auth_headers_admin, holiday_request_pending
    ):
        """Test admin can see all holiday requests."""
        response = client.get("/api/staff/holidays", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data["pending"]) >= 1


class TestHolidayRequestCreate:
    """Tests for POST /api/staff/holidays."""

    def test_create_holiday_requires_auth(self, client):
        """Test that creating holiday request requires authentication."""
        response = client.post("/api/staff/holidays", json={
            "start_date": (date.today() + timedelta(days=30)).isoformat(),
            "end_date": (date.today() + timedelta(days=32)).isoformat(),
            "days_requested": 3
        })
        assert response.status_code == 401

    def test_create_holiday_success(self, client, auth_headers_staff, staff_user):
        """Test staff can create a holiday request."""
        start = date.today() + timedelta(days=45)
        end = start + timedelta(days=4)
        response = client.post("/api/staff/holidays", json={
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "leave_type": "annual",
            "days_requested": 5,
            "reason": "Summer holiday"
        }, headers=auth_headers_staff)
        assert response.status_code == 201
        data = response.json()
        assert data["staff_id"] == staff_user.id
        assert data["status"] == "pending"
        assert float(data["days_requested"]) == 5.0


class TestHolidayRequestUpdate:
    """Tests for PUT /api/staff/holidays/{request_id}."""

    def test_update_holiday_own_only(
        self, client, auth_headers_second_staff, holiday_request_pending
    ):
        """Test staff can only update their own holiday requests."""
        response = client.put(
            f"/api/staff/holidays/{holiday_request_pending.id}",
            json={"reason": "Changed plans"},
            headers=auth_headers_second_staff
        )
        assert response.status_code == 403

    def test_update_holiday_pending_only(
        self, client, auth_headers_staff, holiday_request_approved
    ):
        """Test can only update pending requests."""
        response = client.put(
            f"/api/staff/holidays/{holiday_request_approved.id}",
            json={"reason": "Trying to change approved"},
            headers=auth_headers_staff
        )
        assert response.status_code == 400

    def test_update_holiday_success(
        self, client, auth_headers_staff, holiday_request_pending
    ):
        """Test staff can update their pending holiday request."""
        new_end = date.today() + timedelta(days=36)
        response = client.put(
            f"/api/staff/holidays/{holiday_request_pending.id}",
            json={
                "end_date": new_end.isoformat(),
                "days_requested": 7,
                "reason": "Extended trip"
            },
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert float(data["days_requested"]) == 7.0
        assert data["reason"] == "Extended trip"


class TestHolidayRequestApprove:
    """Tests for PUT /api/staff/holidays/{request_id}/approve."""

    def test_approve_holiday_requires_admin(
        self, client, auth_headers_staff, holiday_request_pending
    ):
        """Test that approving requires admin role."""
        response = client.put(
            f"/api/staff/holidays/{holiday_request_pending.id}/approve",
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_approve_holiday_success(
        self, client, auth_headers_admin, holiday_request_pending, admin_user
    ):
        """Test admin can approve a holiday request."""
        response = client.put(
            f"/api/staff/holidays/{holiday_request_pending.id}/approve?notes=Enjoy%20your%20break!",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["approved_by_id"] == admin_user.id
        assert data["approval_notes"] == "Enjoy your break!"


class TestHolidayRequestReject:
    """Tests for PUT /api/staff/holidays/{request_id}/reject."""

    def test_reject_holiday_requires_admin(
        self, client, auth_headers_staff, holiday_request_pending
    ):
        """Test that rejecting requires admin role."""
        response = client.put(
            f"/api/staff/holidays/{holiday_request_pending.id}/reject",
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_reject_holiday_success(
        self, client, auth_headers_admin, holiday_request_pending
    ):
        """Test admin can reject a holiday request."""
        response = client.put(
            f"/api/staff/holidays/{holiday_request_pending.id}/reject?notes=Busy%20period",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        assert data["approval_notes"] == "Busy period"


class TestHolidayRequestCancel:
    """Tests for DELETE /api/staff/holidays/{request_id}."""

    def test_cancel_holiday_own_only(
        self, client, auth_headers_second_staff, holiday_request_pending
    ):
        """Test staff can only cancel their own holiday requests."""
        response = client.delete(
            f"/api/staff/holidays/{holiday_request_pending.id}",
            headers=auth_headers_second_staff
        )
        assert response.status_code == 403

    def test_cancel_holiday_pending_only(
        self, client, auth_headers_staff, holiday_request_approved
    ):
        """Test can only cancel pending requests."""
        response = client.delete(
            f"/api/staff/holidays/{holiday_request_approved.id}",
            headers=auth_headers_staff
        )
        assert response.status_code == 400

    def test_cancel_holiday_success(
        self, client, auth_headers_staff, holiday_request_pending, db
    ):
        """Test staff can cancel their pending holiday request."""
        response = client.delete(
            f"/api/staff/holidays/{holiday_request_pending.id}",
            headers=auth_headers_staff
        )
        assert response.status_code == 204

        # Verify cancelled (not deleted)
        req = db.query(HolidayRequest).filter(
            HolidayRequest.id == holiday_request_pending.id
        ).first()
        assert req is not None
        assert req.status == LeaveStatus.CANCELLED


# ============== Unplanned Absence Tests ==============

class TestUnplannedAbsenceList:
    """Tests for GET /api/staff/absences."""

    def test_list_absences_requires_auth(self, client):
        """Test that listing absences requires authentication."""
        response = client.get("/api/staff/absences")
        assert response.status_code == 401

    def test_list_absences_requires_staff(self, client, auth_headers_livery):
        """Test that listing absences requires staff access."""
        response = client.get("/api/staff/absences", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_absences_staff_sees_own(
        self, client, auth_headers_staff, unplanned_absence, staff_user
    ):
        """Test staff sees only their own absence records."""
        response = client.get("/api/staff/absences", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        for record in data["records"]:
            assert record["staff_id"] == staff_user.id

    def test_list_absences_admin_sees_all(
        self, client, auth_headers_admin, unplanned_absence
    ):
        """Test admin can see all absence records."""
        response = client.get("/api/staff/absences", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1


class TestUnplannedAbsenceCreate:
    """Tests for POST /api/staff/absences."""

    def test_create_absence_requires_admin(
        self, client, auth_headers_staff, staff_user
    ):
        """Test that recording absence requires admin role."""
        response = client.post("/api/staff/absences", json={
            "staff_id": staff_user.id,
            "date": date.today().isoformat(),
            "reason": "sickness"
        }, headers=auth_headers_staff)
        assert response.status_code == 403

    def test_create_absence_success(
        self, client, auth_headers_admin, staff_user, admin_user
    ):
        """Test admin can record an unplanned absence."""
        response = client.post("/api/staff/absences", json={
            "staff_id": staff_user.id,
            "date": date.today().isoformat(),
            "reported_time": "08:15",
            "reason": "sickness",
            "expected_return": (date.today() + timedelta(days=2)).isoformat(),
            "notes": "Called in with stomach bug"
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["staff_id"] == staff_user.id
        assert data["reported_to_id"] == admin_user.id
        assert data["reason"] == "sickness"


class TestUnplannedAbsenceUpdate:
    """Tests for PUT /api/staff/absences/{record_id}."""

    def test_update_absence_requires_admin(
        self, client, auth_headers_staff, unplanned_absence
    ):
        """Test that updating absence requires admin role."""
        response = client.put(
            f"/api/staff/absences/{unplanned_absence.id}",
            json={"notes": "Updated"},
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_update_absence_not_found(self, client, auth_headers_admin):
        """Test updating non-existent absence."""
        response = client.put(
            "/api/staff/absences/99999",
            json={"notes": "Updated"},
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_update_absence_success(
        self, client, auth_headers_admin, unplanned_absence
    ):
        """Test admin can update an absence record."""
        response = client.put(
            f"/api/staff/absences/{unplanned_absence.id}",
            json={
                "actual_return": date.today().isoformat(),
                "notes": "Returned after recovery"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["actual_return"] == date.today().isoformat()
        assert "recovery" in data["notes"]


# ============== Leave Summary Tests ==============

class TestLeaveSummary:
    """Tests for GET /api/staff/leave-summary."""

    def test_leave_summary_requires_auth(self, client):
        """Test that leave summary requires authentication."""
        response = client.get("/api/staff/leave-summary")
        assert response.status_code == 401

    def test_leave_summary_requires_staff(self, client, auth_headers_livery):
        """Test that leave summary requires staff access."""
        response = client.get("/api/staff/leave-summary", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_leave_summary_success(
        self, client, auth_headers_staff, staff_user, db
    ):
        """Test staff can view leave summary."""
        # Set up staff with entitlement
        staff_user.annual_leave_entitlement = 28
        db.commit()

        response = client.get("/api/staff/leave-summary", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        assert data["year"] == date.today().year
        assert "staff_summaries" in data

    def test_leave_summary_with_approved_leave(
        self, client, auth_headers_admin, staff_user, holiday_request_approved, db
    ):
        """Test leave summary reflects approved leave."""
        # Ensure staff has entitlement
        staff_user.annual_leave_entitlement = 28
        db.commit()

        response = client.get("/api/staff/leave-summary", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()

        # Find staff_user's summary
        staff_summary = next(
            (s for s in data["staff_summaries"] if s["staff_id"] == staff_user.id),
            None
        )
        assert staff_summary is not None
        assert staff_summary["annual_leave_taken"] >= 3  # From approved request

    def test_leave_summary_specific_year(
        self, client, auth_headers_admin
    ):
        """Test leave summary for specific year."""
        response = client.get(
            "/api/staff/leave-summary?year=2024",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["year"] == 2024

    def test_leave_summary_casual_staff_no_entitlement(
        self, client, auth_headers_admin, casual_staff_user, db
    ):
        """Test casual staff shows no fixed entitlement."""
        response = client.get("/api/staff/leave-summary", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()

        # Find casual staff's summary
        casual_summary = next(
            (s for s in data["staff_summaries"] if s["staff_id"] == casual_staff_user.id),
            None
        )
        assert casual_summary is not None
        assert casual_summary["staff_type"] == "casual"
        assert casual_summary["annual_leave_entitlement"] is None
        assert casual_summary["annual_leave_remaining"] is None


# ============== Edge Cases and Integration Tests ==============

class TestTimesheetHoursCalculation:
    """Tests for timesheet hours calculation."""

    def test_hours_calculation_with_lunch(
        self, client, auth_headers_staff, staff_user
    ):
        """Test hours calculation includes lunch break."""
        response = client.post("/api/staff/timesheets", json={
            "date": (date.today() - timedelta(days=1)).isoformat(),
            "clock_in": "09:00",
            "clock_out": "17:00",
            "lunch_start": "12:00",
            "lunch_end": "12:30",
            "break_minutes": 15
        }, headers=auth_headers_staff)
        assert response.status_code == 201
        data = response.json()
        # 8 hours - 30 min lunch - 15 min break = 7.25 hours
        assert data["total_hours"] == 7.25

    def test_hours_calculation_overnight_shift(
        self, client, auth_headers_staff
    ):
        """Test hours calculation for overnight shift."""
        response = client.post("/api/staff/timesheets", json={
            "date": (date.today() - timedelta(days=1)).isoformat(),
            "clock_in": "22:00",
            "clock_out": "06:00",
            "break_minutes": 30
        }, headers=auth_headers_staff)
        assert response.status_code == 201
        data = response.json()
        # 8 hours - 30 min break = 7.5 hours
        assert data["total_hours"] == 7.5


class TestStaffAccessControl:
    """Tests for staff access patterns."""

    def test_admin_is_staff_by_role(self, client, auth_headers_admin):
        """Test that admin users have staff access via role."""
        response = client.get("/api/staff/shifts", headers=auth_headers_admin)
        assert response.status_code == 200

    def test_yard_staff_flag_grants_access(self, client, auth_headers_staff):
        """Test that is_yard_staff flag grants staff access."""
        response = client.get("/api/staff/shifts", headers=auth_headers_staff)
        assert response.status_code == 200

    def test_livery_without_flag_denied(self, client, auth_headers_livery):
        """Test that regular livery users are denied staff access."""
        response = client.get("/api/staff/shifts", headers=auth_headers_livery)
        assert response.status_code == 403
