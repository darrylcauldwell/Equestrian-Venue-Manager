"""Tests for sheep flock management functionality."""
import pytest
from datetime import date, timedelta

from app.models.field import Field
from app.models.land_management import SheepFlock, SheepFlockFieldAssignment


class TestSheepFlockList:
    """Tests for GET /sheep-flocks/ endpoint."""

    def test_list_flocks_requires_auth(self, client):
        """Test that listing flocks requires authentication."""
        response = client.get("/api/sheep-flocks/")
        assert response.status_code == 401

    def test_list_flocks_requires_staff_or_admin(self, client, auth_headers_livery):
        """Test that listing flocks requires staff or admin role."""
        response = client.get("/api/sheep-flocks/", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_flocks_empty(self, client, auth_headers_admin):
        """Test listing flocks when none exist."""
        response = client.get("/api/sheep-flocks/", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json() == []

    def test_list_flocks_success(self, client, auth_headers_admin, sheep_flock):
        """Test listing flocks."""
        response = client.get("/api/sheep-flocks/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == sheep_flock.name
        assert data[0]["count"] == sheep_flock.count
        assert data[0]["breed"] == sheep_flock.breed

    def test_list_flocks_excludes_inactive(self, client, auth_headers_admin, sheep_flock, inactive_sheep_flock):
        """Test that inactive flocks are excluded by default."""
        response = client.get("/api/sheep-flocks/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["id"] == sheep_flock.id

    def test_list_flocks_includes_inactive(self, client, auth_headers_admin, sheep_flock, inactive_sheep_flock):
        """Test that inactive flocks can be included."""
        response = client.get("/api/sheep-flocks/?include_inactive=true", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_flocks_with_staff_role(self, client, auth_headers_staff_role, sheep_flock):
        """Test that staff can list flocks."""
        response = client.get("/api/sheep-flocks/", headers=auth_headers_staff_role)
        assert response.status_code == 200
        assert len(response.json()) == 1


class TestSheepFlockCreate:
    """Tests for POST /sheep-flocks/ endpoint."""

    def test_create_flock_requires_admin(self, client, auth_headers_staff):
        """Test that creating flocks requires admin role."""
        response = client.post(
            "/api/sheep-flocks/",
            json={"name": "New Flock", "count": 5},
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_create_flock_success(self, client, auth_headers_admin):
        """Test creating a new flock."""
        response = client.post(
            "/api/sheep-flocks/",
            json={
                "name": "New Flock",
                "count": 15,
                "breed": "Herdwick",
                "notes": "Hardy mountain sheep"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "New Flock"
        assert data["count"] == 15
        assert data["breed"] == "Herdwick"
        assert data["notes"] == "Hardy mountain sheep"
        assert data["is_active"] is True
        assert data["current_field_id"] is None

    def test_create_flock_minimal(self, client, auth_headers_admin):
        """Test creating a flock with minimal fields."""
        response = client.post(
            "/api/sheep-flocks/",
            json={"name": "Minimal Flock", "count": 3},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Minimal Flock"
        assert data["count"] == 3

    def test_create_flock_missing_name(self, client, auth_headers_admin):
        """Test that name is required."""
        response = client.post(
            "/api/sheep-flocks/",
            json={"count": 5},
            headers=auth_headers_admin
        )
        assert response.status_code == 422

    def test_create_flock_missing_count(self, client, auth_headers_admin):
        """Test that count is required."""
        response = client.post(
            "/api/sheep-flocks/",
            json={"name": "No Count Flock"},
            headers=auth_headers_admin
        )
        assert response.status_code == 422


class TestSheepFlockGet:
    """Tests for GET /sheep-flocks/{flock_id} endpoint."""

    def test_get_flock_not_found(self, client, auth_headers_admin):
        """Test getting non-existent flock."""
        response = client.get("/api/sheep-flocks/99999", headers=auth_headers_admin)
        assert response.status_code == 404

    def test_get_flock_success(self, client, auth_headers_admin, sheep_flock):
        """Test getting a flock with history."""
        response = client.get(f"/api/sheep-flocks/{sheep_flock.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == sheep_flock.id
        assert data["name"] == sheep_flock.name
        assert "assignment_history" in data

    def test_get_flock_with_assignment(self, client, auth_headers_admin, sheep_flock_with_field_assignment):
        """Test getting flock that has field assignment."""
        flock, assignment = sheep_flock_with_field_assignment
        response = client.get(f"/api/sheep-flocks/{flock.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["current_field_id"] == assignment.field_id
        assert len(data["assignment_history"]) == 1


class TestSheepFlockUpdate:
    """Tests for PUT /sheep-flocks/{flock_id} endpoint."""

    def test_update_flock_requires_admin(self, client, auth_headers_staff, sheep_flock):
        """Test that updating requires admin role."""
        response = client.put(
            f"/api/sheep-flocks/{sheep_flock.id}",
            json={"count": 20},
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_update_flock_not_found(self, client, auth_headers_admin):
        """Test updating non-existent flock."""
        response = client.put(
            "/api/sheep-flocks/99999",
            json={"count": 20},
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_update_flock_count(self, client, auth_headers_admin, sheep_flock, db):
        """Test updating flock count."""
        response = client.put(
            f"/api/sheep-flocks/{sheep_flock.id}",
            json={"count": 25},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["count"] == 25

    def test_update_flock_partial(self, client, auth_headers_admin, sheep_flock):
        """Test partial update keeps existing values."""
        original_name = sheep_flock.name
        response = client.put(
            f"/api/sheep-flocks/{sheep_flock.id}",
            json={"breed": "New Breed"},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == original_name
        assert data["breed"] == "New Breed"


class TestSheepFlockDelete:
    """Tests for DELETE /sheep-flocks/{flock_id} endpoint."""

    def test_delete_flock_requires_admin(self, client, auth_headers_staff, sheep_flock):
        """Test that deleting requires admin role."""
        response = client.delete(f"/api/sheep-flocks/{sheep_flock.id}", headers=auth_headers_staff)
        assert response.status_code == 403

    def test_delete_flock_not_found(self, client, auth_headers_admin):
        """Test deleting non-existent flock."""
        response = client.delete("/api/sheep-flocks/99999", headers=auth_headers_admin)
        assert response.status_code == 404

    def test_delete_flock_soft_deletes(self, client, auth_headers_admin, sheep_flock, db):
        """Test that delete is a soft delete."""
        response = client.delete(f"/api/sheep-flocks/{sheep_flock.id}", headers=auth_headers_admin)
        assert response.status_code == 200

        # Flock should still exist but be inactive
        db.refresh(sheep_flock)
        assert sheep_flock.is_active is False

    def test_delete_flock_ends_assignment(self, client, auth_headers_admin, sheep_flock_with_field_assignment, db):
        """Test that deleting flock ends its current assignment."""
        flock, assignment = sheep_flock_with_field_assignment
        response = client.delete(f"/api/sheep-flocks/{flock.id}", headers=auth_headers_admin)
        assert response.status_code == 200

        db.refresh(assignment)
        assert assignment.end_date is not None


class TestSheepFlockFieldAssignment:
    """Tests for sheep flock field assignment endpoints."""

    def test_assign_flock_to_field(self, client, auth_headers_admin, sheep_flock, field):
        """Test assigning a flock to a field."""
        response = client.post(
            f"/api/sheep-flocks/{sheep_flock.id}/assign-field",
            json={"field_id": field.id, "notes": "Moving for worm control"},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["flock_id"] == sheep_flock.id
        assert data["field_id"] == field.id
        assert data["notes"] == "Moving for worm control"

    def test_assign_flock_staff_can_assign(self, client, auth_headers_staff_role, sheep_flock, field):
        """Test that staff can assign flocks to fields."""
        response = client.post(
            f"/api/sheep-flocks/{sheep_flock.id}/assign-field",
            json={"field_id": field.id},
            headers=auth_headers_staff_role
        )
        assert response.status_code == 200

    def test_assign_flock_not_found(self, client, auth_headers_admin, field):
        """Test assigning non-existent flock."""
        response = client.post(
            "/api/sheep-flocks/99999/assign-field",
            json={"field_id": field.id},
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_assign_flock_field_not_found(self, client, auth_headers_admin, sheep_flock):
        """Test assigning to non-existent field."""
        response = client.post(
            f"/api/sheep-flocks/{sheep_flock.id}/assign-field",
            json={"field_id": 99999},
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_assign_flock_inactive_flock(self, client, auth_headers_admin, inactive_sheep_flock, field):
        """Test assigning inactive flock fails."""
        response = client.post(
            f"/api/sheep-flocks/{inactive_sheep_flock.id}/assign-field",
            json={"field_id": field.id},
            headers=auth_headers_admin
        )
        assert response.status_code == 400

    def test_assign_flock_replaces_existing(self, client, auth_headers_admin, sheep_flock_with_field_assignment, db):
        """Test that new assignment ends previous one."""
        flock, old_assignment = sheep_flock_with_field_assignment

        # Create a second field
        field2 = Field(name="Field 2", max_horses=5, is_active=True)
        db.add(field2)
        db.commit()
        db.refresh(field2)

        response = client.post(
            f"/api/sheep-flocks/{flock.id}/assign-field",
            json={"field_id": field2.id},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.json()["field_id"] == field2.id

        # Old assignment should be ended
        db.refresh(old_assignment)
        assert old_assignment.end_date is not None

    def test_remove_flock_from_field(self, client, auth_headers_admin, sheep_flock_with_field_assignment, db):
        """Test removing flock from field."""
        flock, assignment = sheep_flock_with_field_assignment
        response = client.delete(
            f"/api/sheep-flocks/{flock.id}/field-assignment",
            headers=auth_headers_admin
        )
        assert response.status_code == 200

        db.refresh(assignment)
        assert assignment.end_date is not None

    def test_remove_flock_no_assignment(self, client, auth_headers_admin, sheep_flock):
        """Test removing when no assignment exists."""
        response = client.delete(
            f"/api/sheep-flocks/{sheep_flock.id}/field-assignment",
            headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestSheepFlockCurrentAssignment:
    """Tests for GET /sheep-flocks/{flock_id}/current-assignment endpoint."""

    def test_get_current_assignment_none(self, client, auth_headers_admin, sheep_flock):
        """Test getting current assignment when none exists."""
        response = client.get(
            f"/api/sheep-flocks/{sheep_flock.id}/current-assignment",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.json() is None

    def test_get_current_assignment_exists(self, client, auth_headers_admin, sheep_flock_with_field_assignment):
        """Test getting current assignment when one exists."""
        flock, assignment = sheep_flock_with_field_assignment
        response = client.get(
            f"/api/sheep-flocks/{flock.id}/current-assignment",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == assignment.id
        assert data["field_id"] == assignment.field_id


class TestSheepFlockAssignmentHistory:
    """Tests for GET /sheep-flocks/{flock_id}/assignment-history endpoint."""

    def test_get_history_empty(self, client, auth_headers_admin, sheep_flock):
        """Test getting history when none exists."""
        response = client.get(
            f"/api/sheep-flocks/{sheep_flock.id}/assignment-history",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_get_history_with_assignments(self, client, auth_headers_admin, sheep_flock_with_field_assignment):
        """Test getting history with assignments."""
        flock, _ = sheep_flock_with_field_assignment
        response = client.get(
            f"/api/sheep-flocks/{flock.id}/assignment-history",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_get_history_not_found(self, client, auth_headers_admin):
        """Test getting history for non-existent flock."""
        response = client.get(
            "/api/sheep-flocks/99999/assignment-history",
            headers=auth_headers_admin
        )
        assert response.status_code == 404


# Fixtures for these tests
@pytest.fixture
def field(db):
    """Create a test field."""
    field = Field(
        name="Test Field",
        max_horses=6,
        current_condition="good",
        is_active=True
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@pytest.fixture
def sheep_flock(db):
    """Create a test sheep flock."""
    flock = SheepFlock(
        name="Test Flock",
        count=10,
        breed="Suffolk",
        is_active=True
    )
    db.add(flock)
    db.commit()
    db.refresh(flock)
    return flock


@pytest.fixture
def inactive_sheep_flock(db):
    """Create an inactive sheep flock."""
    flock = SheepFlock(
        name="Inactive Flock",
        count=5,
        breed="Herdwick",
        is_active=False
    )
    db.add(flock)
    db.commit()
    db.refresh(flock)
    return flock


@pytest.fixture
def sheep_flock_with_field_assignment(db, sheep_flock, field, admin_user):
    """Create a sheep flock with an active field assignment."""
    assignment = SheepFlockFieldAssignment(
        flock_id=sheep_flock.id,
        field_id=field.id,
        start_date=date.today() - timedelta(days=7),
        assigned_by_id=admin_user.id,
        notes="For grazing"
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return sheep_flock, assignment


@pytest.fixture
def staff_role_user(db):
    """Create a user with STAFF role."""
    from app.models.user import User, UserRole
    from app.utils.auth import get_password_hash

    user = User(
        username="staffroleuser",
        email="staffrole@example.com",
        name="Staff Role User",
        password_hash=get_password_hash("password123"),
        role=UserRole.STAFF,
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers_staff_role(staff_role_user):
    """Auth headers for staff role user."""
    from app.utils.auth import create_access_token

    token = create_access_token(staff_role_user.id)
    return {"Authorization": f"Bearer {token}"}
