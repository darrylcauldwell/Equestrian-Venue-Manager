import pytest
from datetime import date, datetime, timedelta
from fastapi import status

from app.models.user import User, UserRole
from app.models.task import (
    YardTask,
    TaskCategory,
    TaskPriority,
    TaskStatus,
    AssignmentType
)
from app.models.staff_management import Shift, ShiftType, ShiftRole
from app.utils.auth import get_password_hash, create_access_token


# =====================
# Additional Fixtures
# =====================

@pytest.fixture
def staff_role_user(db):
    """User with role=STAFF (not is_yard_staff, but role=STAFF)."""
    user = User(
        username="staffroleuser",
        email="staffrole@example.com",
        name="Staff Role User",
        password_hash=get_password_hash("password123"),
        role=UserRole.STAFF,
        is_yard_staff=False,  # Role is STAFF but flag is False
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers_staff_role(staff_role_user):
    token = create_access_token(staff_role_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def yard_task(db, admin_user):
    """Creates a YardTask in backlog status."""
    task = YardTask(
        title="Fix stable door",
        description="Door hinge needs repair",
        category=TaskCategory.REPAIRS,
        priority=TaskPriority.MEDIUM,
        location="Stable Block A - Door 3",
        reported_by_id=admin_user.id,
        assignment_type=AssignmentType.BACKLOG,
        status=TaskStatus.OPEN
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@pytest.fixture
def yard_task_list(db, admin_user):
    """Creates multiple YardTasks for bulk operations."""
    tasks = [
        YardTask(
            title=f"Task {i}",
            description=f"Description for task {i}",
            category=TaskCategory.MAINTENANCE,
            priority=TaskPriority.MEDIUM,
            reported_by_id=admin_user.id,
            assignment_type=AssignmentType.BACKLOG,
            status=TaskStatus.OPEN
        )
        for i in range(1, 4)
    ]
    db.add_all(tasks)
    db.commit()
    for task in tasks:
        db.refresh(task)
    return tasks


# =====================
# Maintenance Day Tests
# =====================

def test_admin_can_assign_maintenance_day(client, db, admin_user, auth_headers_admin, staff_user, yard_task_list):
    """Test that admin can assign maintenance day to staff users."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 3

    # Verify tasks were updated correctly
    for task_data in data:
        assert task_data["assigned_to_id"] == staff_user.id
        assert task_data["scheduled_date"] == scheduled_date.isoformat()
        assert task_data["assignment_type"] == AssignmentType.SPECIFIC.value
        assert task_data["is_maintenance_day_task"] is True


def test_admin_can_assign_to_staff_role_user(client, db, admin_user, auth_headers_admin, staff_role_user, yard_task_list):
    """Test that admin can assign maintenance day to users with role=STAFF."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_role_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert len(data) == 3

    # Verify assignment worked for role=STAFF user
    for task_data in data:
        assert task_data["assigned_to_id"] == staff_role_user.id


def test_admin_can_assign_to_yard_staff_user(client, db, admin_user, auth_headers_admin, staff_user, yard_task_list):
    """Test that admin can assign maintenance day to users with is_yard_staff=True."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Verify assignment worked for is_yard_staff=True user
    for task_data in data:
        assert task_data["assigned_to_id"] == staff_user.id


def test_cannot_assign_to_livery_user(client, db, admin_user, auth_headers_admin, livery_user, yard_task_list):
    """Test that maintenance day cannot be assigned to livery users (403)."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": livery_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Can only assign to staff members" in response.json()["detail"]


def test_cannot_assign_to_coach_user(client, db, admin_user, auth_headers_admin, coach_user, yard_task_list):
    """Test that maintenance day cannot be assigned to coach users."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": coach_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Can only assign to staff members" in response.json()["detail"]


def test_cannot_assign_to_public_user(client, db, admin_user, auth_headers_admin, public_user, yard_task_list):
    """Test that maintenance day cannot be assigned to public users."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": public_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Can only assign to staff members" in response.json()["detail"]


def test_shift_creation_with_maintenance_type(client, db, admin_user, auth_headers_admin, staff_user, yard_task_list):
    """Test that shift is created with type=MAINTENANCE when assigning maintenance day."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    # Verify no shift exists yet
    shift_before = db.query(Shift).filter(
        Shift.staff_id == staff_user.id,
        Shift.date == scheduled_date
    ).first()
    assert shift_before is None

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK

    # Verify shift was created
    shift = db.query(Shift).filter(
        Shift.staff_id == staff_user.id,
        Shift.date == scheduled_date
    ).first()

    assert shift is not None
    assert shift.shift_type == ShiftType.FULL_DAY
    assert shift.role == ShiftRole.MAINTENANCE
    assert "Maintenance day" in shift.notes
    assert "3 task(s) assigned" in shift.notes
    assert shift.created_by_id == admin_user.id


def test_no_duplicate_shift_creation(client, db, admin_user, auth_headers_admin, staff_user, yard_task_list):
    """Test that shift is not duplicated if one already exists for the date."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    # Create an existing shift
    existing_shift = Shift(
        staff_id=staff_user.id,
        date=scheduled_date,
        shift_type=ShiftType.MORNING,
        role=ShiftRole.YARD_DUTIES,
        notes="Existing shift",
        created_by_id=admin_user.id
    )
    db.add(existing_shift)
    db.commit()
    db.refresh(existing_shift)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK

    # Verify only one shift exists (the original)
    shifts = db.query(Shift).filter(
        Shift.staff_id == staff_user.id,
        Shift.date == scheduled_date
    ).all()

    assert len(shifts) == 1
    assert shifts[0].id == existing_shift.id
    assert shifts[0].notes == "Existing shift"  # Original shift unchanged


def test_task_marking_with_is_maintenance_day_task(client, db, admin_user, auth_headers_admin, staff_user, yard_task_list):
    """Test that tasks are marked with is_maintenance_day_task=True."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    # Verify tasks are not marked initially
    for task in yard_task_list:
        assert task.is_maintenance_day_task is False

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK

    # Verify tasks are now marked
    updated_tasks = db.query(YardTask).filter(
        YardTask.id.in_(task_ids)
    ).all()

    for task in updated_tasks:
        assert task.is_maintenance_day_task is True
        assert task.assigned_to_id == staff_user.id
        assert task.assignment_type == AssignmentType.SPECIFIC


def test_only_admin_can_assign_maintenance_day(client, db, staff_user, auth_headers_staff, yard_task_list):
    """Test that only admin can assign maintenance day (staff user cannot)."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_staff
    )

    # Should be forbidden for non-admin users
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_cannot_assign_nonexistent_user(client, db, admin_user, auth_headers_admin, yard_task_list):
    """Test that assigning to a non-existent user returns 404."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": 99999,  # Non-existent user ID
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert "Assigned user not found" in response.json()["detail"]


def test_cannot_assign_completed_tasks(client, db, admin_user, auth_headers_admin, staff_user, yard_task_list):
    """Test that completed tasks cannot be assigned to maintenance day."""
    # Mark one task as completed
    yard_task_list[0].status = TaskStatus.COMPLETED
    db.commit()

    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Some tasks not found or already completed" in response.json()["detail"]


def test_empty_task_list(client, db, admin_user, auth_headers_admin, staff_user):
    """Test that empty task list is handled gracefully."""
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": [],
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    # Should still return 200 with empty list
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == []


def test_admin_can_assign_to_self(client, db, admin_user, auth_headers_admin, yard_task_list):
    """Test that admin can assign maintenance day to themselves."""
    task_ids = [task.id for task in yard_task_list]
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": admin_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.json()

    # Verify admin can assign to self (admin role allowed)
    for task_data in data:
        assert task_data["assigned_to_id"] == admin_user.id


def test_partial_task_ids_not_found(client, db, admin_user, auth_headers_admin, staff_user, yard_task_list):
    """Test that if some task IDs don't exist, the request fails."""
    task_ids = [yard_task_list[0].id, 99999, yard_task_list[1].id]  # One non-existent ID
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": task_ids,
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "Some tasks not found or already completed" in response.json()["detail"]


def test_maintenance_day_assignment_fields(client, db, admin_user, auth_headers_admin, staff_user, yard_task):
    """Test that all required fields are set correctly after maintenance day assignment."""
    scheduled_date = date.today() + timedelta(days=7)

    response = client.post(
        "/api/tasks/bulk/maintenance-day",
        json={
            "task_ids": [yard_task.id],
            "assigned_to_id": staff_user.id,
            "scheduled_date": scheduled_date.isoformat()
        },
        headers=auth_headers_admin
    )

    assert response.status_code == status.HTTP_200_OK

    # Refresh task from database
    db.refresh(yard_task)

    # Verify all fields are set correctly
    assert yard_task.assigned_to_id == staff_user.id
    assert yard_task.scheduled_date == scheduled_date
    assert yard_task.assignment_type == AssignmentType.SPECIFIC
    assert yard_task.is_maintenance_day_task is True
    assert yard_task.status == TaskStatus.OPEN  # Status should remain open
