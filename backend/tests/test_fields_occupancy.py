"""Tests for field occupancy and horse field assignment functionality."""
import pytest
from datetime import date, timedelta

from app.models.field import Field, HorseFieldAssignment
from app.models.land_management import SheepFlock, SheepFlockFieldAssignment


class TestFieldOccupancySummary:
    """Tests for GET /fields/occupancy-summary endpoint."""

    def test_occupancy_summary_requires_auth(self, client):
        """Test that occupancy summary requires authentication."""
        response = client.get("/api/fields/occupancy-summary")
        assert response.status_code == 401

    def test_occupancy_summary_requires_admin_or_staff(self, client, auth_headers_livery):
        """Test that occupancy summary requires admin or staff role."""
        response = client.get("/api/fields/occupancy-summary", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_occupancy_summary_empty(self, client, auth_headers_admin):
        """Test occupancy summary with no fields."""
        response = client.get("/api/fields/occupancy-summary", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json() == []

    def test_occupancy_summary_with_fields(self, client, auth_headers_admin, field):
        """Test occupancy summary returns fields."""
        response = client.get("/api/fields/occupancy-summary", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["field_id"] == field.id
        assert data[0]["field_name"] == field.name
        assert data[0]["total_horse_count"] == 0
        assert data[0]["total_sheep_count"] == 0

    def test_occupancy_summary_with_horses(self, client, auth_headers_admin, field, horse_field_assignment):
        """Test occupancy summary includes horse counts."""
        response = client.get("/api/fields/occupancy-summary", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["total_horse_count"] == 1
        assert len(data[0]["current_horses"]) == 1
        assert data[0]["current_horses"][0]["horse_name"] == "Thunder"

    def test_occupancy_summary_with_sheep(self, client, auth_headers_admin, field, sheep_flock_assignment):
        """Test occupancy summary includes sheep counts."""
        response = client.get("/api/fields/occupancy-summary", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["total_sheep_count"] == 10  # From sheep_flock fixture
        assert len(data[0]["current_sheep"]) == 1

    def test_occupancy_summary_excludes_inactive_fields(self, client, auth_headers_admin, field, inactive_field):
        """Test that inactive fields are excluded by default."""
        response = client.get("/api/fields/occupancy-summary", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["field_id"] == field.id

    def test_occupancy_summary_includes_inactive_fields(self, client, auth_headers_admin, field, inactive_field):
        """Test that inactive fields can be included."""
        response = client.get("/api/fields/occupancy-summary?include_inactive=true", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestSingleFieldOccupancy:
    """Tests for GET /fields/{field_id}/occupancy endpoint."""

    def test_field_occupancy_requires_auth(self, client, field):
        """Test that field occupancy requires authentication."""
        response = client.get(f"/api/fields/{field.id}/occupancy")
        assert response.status_code == 401

    def test_field_occupancy_not_found(self, client, auth_headers_admin):
        """Test field occupancy for non-existent field."""
        response = client.get("/api/fields/99999/occupancy", headers=auth_headers_admin)
        assert response.status_code == 404

    def test_field_occupancy_success(self, client, auth_headers_admin, field):
        """Test getting occupancy for a specific field."""
        response = client.get(f"/api/fields/{field.id}/occupancy", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["field_id"] == field.id
        assert data["field_name"] == field.name
        assert data["current_horses"] == []
        assert data["current_sheep"] == []


class TestHorseFieldAssignment:
    """Tests for horse field assignment endpoints."""

    def test_get_horse_assignment_requires_auth(self, client, horse):
        """Test that getting assignment requires authentication."""
        response = client.get(f"/api/fields/horses/{horse.id}/field-assignment")
        assert response.status_code == 401

    def test_get_horse_assignment_not_found(self, client, auth_headers_admin, horse):
        """Test getting assignment for horse without one."""
        response = client.get(f"/api/fields/horses/{horse.id}/field-assignment", headers=auth_headers_admin)
        assert response.status_code == 200
        assert response.json() is None

    def test_get_horse_assignment_success(self, client, auth_headers_admin, horse_field_assignment, horse):
        """Test getting existing horse assignment."""
        response = client.get(f"/api/fields/horses/{horse.id}/field-assignment", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["horse_id"] == horse.id
        assert data["horse_name"] == "Thunder"

    def test_create_horse_assignment(self, client, auth_headers_admin, horse, field):
        """Test creating a new horse field assignment."""
        response = client.post(
            f"/api/fields/horses/{horse.id}/field-assignment",
            json={"field_id": field.id, "notes": "Test assignment"},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["horse_id"] == horse.id
        assert data["field_id"] == field.id
        assert data["notes"] == "Test assignment"

    def test_create_horse_assignment_with_notes(self, client, auth_headers_admin, horse, field):
        """Test creating assignment with notes."""
        response = client.post(
            f"/api/fields/horses/{horse.id}/field-assignment",
            json={"field_id": field.id, "notes": "Regular turnout field"},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["horse_id"] == horse.id
        assert data["field_id"] == field.id
        assert data["notes"] == "Regular turnout field"

    def test_create_horse_assignment_replaces_existing(self, client, auth_headers_admin, horse_field_assignment, horse, field, db):
        """Test that creating new assignment ends the previous one."""
        # Create a second field
        field2 = Field(name="Field 2", max_horses=5, is_active=True)
        db.add(field2)
        db.commit()
        db.refresh(field2)

        response = client.post(
            f"/api/fields/horses/{horse.id}/field-assignment",
            json={"field_id": field2.id},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["field_id"] == field2.id

        # Old assignment should have end_date set
        db.refresh(horse_field_assignment)
        assert horse_field_assignment.end_date is not None

    def test_create_horse_assignment_invalid_horse(self, client, auth_headers_admin, field):
        """Test creating assignment for non-existent horse."""
        response = client.post(
            f"/api/fields/horses/99999/field-assignment",
            json={"field_id": field.id},
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_create_horse_assignment_invalid_field(self, client, auth_headers_admin, horse):
        """Test creating assignment for non-existent field."""
        response = client.post(
            f"/api/fields/horses/{horse.id}/field-assignment",
            json={"field_id": 99999},
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_delete_horse_assignment(self, client, auth_headers_admin, horse_field_assignment, horse, db):
        """Test removing horse from field."""
        response = client.delete(
            f"/api/fields/horses/{horse.id}/field-assignment",
            headers=auth_headers_admin
        )
        assert response.status_code == 200

        # Assignment should have end_date set
        db.refresh(horse_field_assignment)
        assert horse_field_assignment.end_date is not None

    def test_delete_horse_assignment_no_assignment(self, client, auth_headers_admin, horse):
        """Test removing assignment when horse has none."""
        response = client.delete(
            f"/api/fields/horses/{horse.id}/field-assignment",
            headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestHorseFieldHistory:
    """Tests for horse field assignment history."""

    def test_get_horse_history_requires_auth(self, client, horse):
        """Test that getting history requires authentication."""
        response = client.get(f"/api/fields/horses/{horse.id}/field-history")
        assert response.status_code == 401

    def test_get_horse_history_empty(self, client, auth_headers_admin, horse):
        """Test getting history for horse with no assignments."""
        response = client.get(f"/api/fields/horses/{horse.id}/field-history", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["horse_id"] == horse.id
        assert data["history"] == []

    def test_get_horse_history_with_current_assignment(self, client, auth_headers_admin, horse_field_assignment, horse):
        """Test getting history with a current (active) assignment."""
        response = client.get(f"/api/fields/horses/{horse.id}/field-history", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["horse_id"] == horse.id
        # Active assignment (no end_date) goes in current_assignment, not history
        assert data["current_assignment"] is not None
        assert data["current_assignment"]["field_id"] == horse_field_assignment.field_id
        # History only contains ended assignments
        assert data["history"] == []

    def test_get_horse_history_not_found(self, client, auth_headers_admin):
        """Test getting history for non-existent horse."""
        response = client.get("/api/fields/horses/99999/field-history", headers=auth_headers_admin)
        assert response.status_code == 404


# Fixtures for these tests
@pytest.fixture
def field(db):
    """Create a test field."""
    field = Field(
        name="Top Paddock",
        max_horses=6,
        current_condition="good",
        is_active=True
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@pytest.fixture
def inactive_field(db):
    """Create an inactive test field."""
    field = Field(
        name="Closed Field",
        max_horses=4,
        is_active=False
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@pytest.fixture
def horse_field_assignment(db, horse, field, admin_user):
    """Create a horse field assignment."""
    assignment = HorseFieldAssignment(
        horse_id=horse.id,
        field_id=field.id,
        start_date=date.today() - timedelta(days=7),
        assigned_by_id=admin_user.id,
        notes="Regular turnout"
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


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
def sheep_flock_assignment(db, sheep_flock, field, admin_user):
    """Create a sheep flock field assignment."""
    assignment = SheepFlockFieldAssignment(
        flock_id=sheep_flock.id,
        field_id=field.id,
        start_date=date.today() - timedelta(days=14),
        assigned_by_id=admin_user.id
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment
