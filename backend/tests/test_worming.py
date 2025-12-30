"""Tests for worming/worm count API endpoints."""
import pytest
from datetime import date, timedelta
from decimal import Decimal

from app.models.health_record import WormingRecord
from app.models.horse import Horse


# ============== Fixtures ==============

@pytest.fixture
def second_horse(db, livery_user):
    """A second horse for the same owner."""
    horse = Horse(
        owner_id=livery_user.id,
        name="Storm",
        colour="Grey",
        birth_year=2018
    )
    db.add(horse)
    db.commit()
    db.refresh(horse)
    return horse


@pytest.fixture
def worming_record(db, horse):
    """A basic worming record."""
    record = WormingRecord(
        horse_id=horse.id,
        treatment_date=date.today() - timedelta(days=30),
        product="Equest Pramox",
        worm_count_date=date.today() - timedelta(days=37),
        worm_count_result=150,
        cost=Decimal("12.50"),
        next_due=date.today() + timedelta(days=150),
        notes="Low count, preventative treatment"
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@pytest.fixture
def historical_worming_records(db, horse, second_horse):
    """Historical worming records for trend testing."""
    records = []

    # Records from different periods
    test_data = [
        # Horse 1 - various counts over time
        (horse.id, date.today() - timedelta(days=365), 180, "2024-H1"),
        (horse.id, date.today() - timedelta(days=180), 120, "2024-H2"),
        (horse.id, date.today() - timedelta(days=30), 90, "2025-H1"),
        # Horse 2 - higher counts
        (second_horse.id, date.today() - timedelta(days=365), 450, "2024-H1"),
        (second_horse.id, date.today() - timedelta(days=180), 380, "2024-H2"),
        (second_horse.id, date.today() - timedelta(days=30), 650, "2025-H1"),  # High count
    ]

    for horse_id, count_date, epg, period in test_data:
        record = WormingRecord(
            horse_id=horse_id,
            treatment_date=count_date + timedelta(days=7),
            product="Test Wormer",
            worm_count_date=count_date,
            worm_count_result=epg,
            cost=Decimal("10.00"),
            notes=f"Test record for {period}"
        )
        db.add(record)
        records.append(record)

    db.commit()
    return records


# ============== Individual Worming Record Tests ==============

class TestListWormingRecords:
    """Tests for GET /api/horses/{horse_id}/worming"""

    def test_list_worming_records_as_owner(self, client, horse, worming_record, auth_headers_livery):
        """Livery user can list their horse's worming records."""
        response = client.get(f"/api/horses/{horse.id}/worming", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["product"] == "Equest Pramox"
        assert data[0]["worm_count_result"] == 150
        assert data[0]["cost"] == "12.50"

    def test_list_worming_records_as_admin(self, client, horse, worming_record, auth_headers_admin):
        """Admin can list any horse's worming records."""
        response = client.get(f"/api/horses/{horse.id}/worming", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_list_worming_records_unauthorized(self, client, horse, worming_record, auth_headers_public):
        """Public user cannot list other's horse worming records."""
        response = client.get(f"/api/horses/{horse.id}/worming", headers=auth_headers_public)
        assert response.status_code == 403

    def test_list_worming_records_no_auth(self, client, horse, worming_record):
        """Unauthenticated request is rejected."""
        response = client.get(f"/api/horses/{horse.id}/worming")
        assert response.status_code == 401


class TestCreateWormingRecord:
    """Tests for POST /api/horses/{horse_id}/worming"""

    def test_create_worming_record_as_owner(self, client, horse, auth_headers_livery):
        """Livery user can create worming record for their horse."""
        response = client.post(
            f"/api/horses/{horse.id}/worming",
            headers=auth_headers_livery,
            json={
                "treatment_date": str(date.today()),
                "product": "Panacur",
                "worm_count_date": str(date.today() - timedelta(days=7)),
                "worm_count_result": 200,
                "cost": 15.00,
                "next_due": str(date.today() + timedelta(days=180)),
                "notes": "Routine worming"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["product"] == "Panacur"
        assert data["worm_count_result"] == 200
        assert data["cost"] == "15.00"

    def test_create_worming_record_minimal(self, client, horse, auth_headers_livery):
        """Create worming record with only required fields."""
        response = client.post(
            f"/api/horses/{horse.id}/worming",
            headers=auth_headers_livery,
            json={
                "treatment_date": str(date.today()),
                "product": "Ivermectin"
            }
        )
        assert response.status_code == 201
        data = response.json()
        assert data["product"] == "Ivermectin"
        assert data["worm_count_result"] is None
        assert data["cost"] is None

    def test_create_worming_record_unauthorized(self, client, horse, auth_headers_public):
        """Public user cannot create worming record for other's horse."""
        response = client.post(
            f"/api/horses/{horse.id}/worming",
            headers=auth_headers_public,
            json={
                "treatment_date": str(date.today()),
                "product": "Test"
            }
        )
        assert response.status_code == 403


class TestUpdateWormingRecord:
    """Tests for PUT /api/horses/{horse_id}/worming/{record_id}"""

    def test_update_worming_record(self, client, horse, worming_record, auth_headers_livery):
        """Owner can update their worming record."""
        response = client.put(
            f"/api/horses/{horse.id}/worming/{worming_record.id}",
            headers=auth_headers_livery,
            json={
                "worm_count_result": 175,
                "notes": "Updated notes"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["worm_count_result"] == 175
        assert data["notes"] == "Updated notes"

    def test_update_worming_record_cost(self, client, horse, worming_record, auth_headers_livery):
        """Can update cost field."""
        response = client.put(
            f"/api/horses/{horse.id}/worming/{worming_record.id}",
            headers=auth_headers_livery,
            json={"cost": 25.50}
        )
        assert response.status_code == 200
        assert response.json()["cost"] == "25.50"

    def test_update_nonexistent_record(self, client, horse, auth_headers_livery):
        """Cannot update non-existent record."""
        response = client.put(
            f"/api/horses/{horse.id}/worming/99999",
            headers=auth_headers_livery,
            json={"notes": "test"}
        )
        assert response.status_code == 404


class TestDeleteWormingRecord:
    """Tests for DELETE /api/horses/{horse_id}/worming/{record_id}"""

    def test_delete_worming_record(self, client, horse, worming_record, auth_headers_livery):
        """Owner can delete their worming record."""
        response = client.delete(
            f"/api/horses/{horse.id}/worming/{worming_record.id}",
            headers=auth_headers_livery
        )
        assert response.status_code == 204

    def test_delete_worming_record_as_admin(self, client, horse, worming_record, auth_headers_admin):
        """Admin can delete any worming record."""
        response = client.delete(
            f"/api/horses/{horse.id}/worming/{worming_record.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 204

    def test_delete_nonexistent_record(self, client, horse, auth_headers_livery):
        """Cannot delete non-existent record."""
        response = client.delete(
            f"/api/horses/{horse.id}/worming/99999",
            headers=auth_headers_livery
        )
        assert response.status_code == 404


# ============== Admin Bulk Worming Tests ==============

class TestGetWormingHorses:
    """Tests for GET /api/horses/worming/horses"""

    def test_get_worming_horses_as_admin(self, client, horse, second_horse, worming_record, auth_headers_admin):
        """Admin can get list of horses with worm count status."""
        response = client.get("/api/horses/worming/horses", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        # Check structure
        horse_data = next(h for h in data if h["horse_id"] == horse.id)
        assert "horse_name" in horse_data
        assert "owner_name" in horse_data
        assert "last_count_date" in horse_data
        assert "last_count_result" in horse_data

    def test_get_worming_horses_non_admin(self, client, horse, auth_headers_livery):
        """Non-admin cannot access bulk worming endpoint."""
        response = client.get("/api/horses/worming/horses", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_get_worming_horses_shows_latest(self, client, horse, historical_worming_records, auth_headers_admin):
        """Shows most recent worm count for each horse."""
        response = client.get("/api/horses/worming/horses", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()

        horse_data = next(h for h in data if h["horse_id"] == horse.id)
        # Most recent count should be 90 (from 30 days ago)
        assert horse_data["last_count_result"] == 90


class TestBulkCreateWormCounts:
    """Tests for POST /api/horses/worming/bulk"""

    def test_bulk_create_worm_counts(self, client, horse, second_horse, auth_headers_admin):
        """Admin can bulk create worm count records."""
        response = client.post(
            "/api/horses/worming/bulk",
            headers=auth_headers_admin,
            json={
                "worm_count_date": str(date.today()),
                "entries": [
                    {"horse_id": horse.id, "worm_count_result": 100, "cost": 8.50},
                    {"horse_id": second_horse.id, "worm_count_result": 250, "cost": 8.50}
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["created"] == 2
        assert data["updated"] == 0
        assert data["skipped"] == 0

    def test_bulk_create_skips_empty(self, client, horse, second_horse, auth_headers_admin):
        """Entries without results are skipped."""
        response = client.post(
            "/api/horses/worming/bulk",
            headers=auth_headers_admin,
            json={
                "worm_count_date": str(date.today()),
                "entries": [
                    {"horse_id": horse.id, "worm_count_result": 100},
                    {"horse_id": second_horse.id, "worm_count_result": None}  # Will be skipped
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["created"] == 1
        assert data["skipped"] == 1

    def test_bulk_create_updates_existing(self, client, db, horse, auth_headers_admin):
        """Updates existing record for same date."""
        # Create initial record
        test_date = date.today()
        record = WormingRecord(
            horse_id=horse.id,
            treatment_date=test_date,
            product="Worm Count Test",
            worm_count_date=test_date,
            worm_count_result=100
        )
        db.add(record)
        db.commit()

        # Bulk update with same date
        response = client.post(
            "/api/horses/worming/bulk",
            headers=auth_headers_admin,
            json={
                "worm_count_date": str(test_date),
                "entries": [
                    {"horse_id": horse.id, "worm_count_result": 150}
                ]
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["updated"] == 1
        assert data["created"] == 0

    def test_bulk_create_non_admin(self, client, horse, auth_headers_livery):
        """Non-admin cannot bulk create."""
        response = client.post(
            "/api/horses/worming/bulk",
            headers=auth_headers_livery,
            json={
                "worm_count_date": str(date.today()),
                "entries": [{"horse_id": horse.id, "worm_count_result": 100}]
            }
        )
        assert response.status_code == 403

    def test_bulk_create_with_notes(self, client, horse, auth_headers_admin):
        """Can include notes in bulk entry."""
        response = client.post(
            "/api/horses/worming/bulk",
            headers=auth_headers_admin,
            json={
                "worm_count_date": str(date.today()),
                "entries": [
                    {
                        "horse_id": horse.id,
                        "worm_count_result": 600,
                        "cost": 12.00,
                        "notes": "High count - treatment needed"
                    }
                ]
            }
        )
        assert response.status_code == 200
        assert response.json()["created"] == 1


class TestWormingReport:
    """Tests for GET /api/horses/worming/report"""

    def test_get_worming_report(self, client, historical_worming_records, auth_headers_admin):
        """Admin can get worming report with trends."""
        response = client.get("/api/horses/worming/report", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()

        # Check structure
        assert "current_year" in data
        assert "previous_years" in data
        assert "trends" in data
        assert "horses_needing_treatment" in data

    def test_get_worming_report_current_year(self, client, historical_worming_records, auth_headers_admin):
        """Current year summary is populated."""
        response = client.get("/api/horses/worming/report", headers=auth_headers_admin)
        data = response.json()

        current_year = data["current_year"]
        assert current_year["year"] == date.today().year
        assert current_year["total_counts"] >= 0
        assert "categories" in current_year

    def test_get_worming_report_horses_needing_treatment(self, client, historical_worming_records, auth_headers_admin):
        """Horses with high EPG are flagged."""
        response = client.get("/api/horses/worming/report", headers=auth_headers_admin)
        data = response.json()

        # second_horse has a recent count of 650 (>500), should be flagged
        needing_treatment = data["horses_needing_treatment"]
        assert len(needing_treatment) >= 1

        # Verify high EPG horse is in list
        high_epg_horses = [h for h in needing_treatment if h["last_count_result"] and h["last_count_result"] > 500]
        assert len(high_epg_horses) >= 1

    def test_get_worming_report_non_admin(self, client, auth_headers_livery):
        """Non-admin cannot access report."""
        response = client.get("/api/horses/worming/report", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_get_worming_report_custom_years(self, client, historical_worming_records, auth_headers_admin):
        """Can specify number of years in report."""
        response = client.get("/api/horses/worming/report?years=5", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        # Should have up to 4 previous years (current year + 4 previous = 5 total)
        assert len(data["previous_years"]) <= 4

    def test_get_worming_report_empty(self, client, horse, auth_headers_admin):
        """Report works with no worming data."""
        response = client.get("/api/horses/worming/report", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()

        assert data["current_year"]["total_counts"] == 0
        assert data["horses_needing_treatment"] == []


class TestWormingReportCategories:
    """Tests for EPG category breakdown in reports."""

    def test_category_breakdown(self, client, db, horse, second_horse, auth_headers_admin):
        """Verify EPG categories are calculated correctly."""
        # Create records with specific EPG values
        test_epgs = [
            (horse.id, 50),      # Low (0-200)
            (horse.id, 100),     # Low
            (second_horse.id, 300),    # Moderate (201-500)
            (second_horse.id, 700),    # High (501-1000)
        ]

        for horse_id, epg in test_epgs:
            record = WormingRecord(
                horse_id=horse_id,
                treatment_date=date.today(),
                product="Test",
                worm_count_date=date.today(),
                worm_count_result=epg
            )
            db.add(record)
        db.commit()

        response = client.get("/api/horses/worming/report", headers=auth_headers_admin)
        data = response.json()

        categories = data["current_year"]["categories"]
        cat_dict = {c["category"]: c for c in categories}

        assert cat_dict["low"]["count"] == 2
        assert cat_dict["moderate"]["count"] == 1
        assert cat_dict["high"]["count"] == 1
