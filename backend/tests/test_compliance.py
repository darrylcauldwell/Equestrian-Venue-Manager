import pytest
from datetime import datetime, timedelta


class TestListComplianceItems:
    """Tests for listing compliance items."""

    def test_list_compliance_requires_admin(self, client, compliance_item, auth_headers_livery):
        """Only admin can view compliance items."""
        response = client.get("/api/compliance/items", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_compliance_as_admin(self, client, compliance_item, auth_headers_admin):
        """Admin can list compliance items."""
        response = client.get("/api/compliance/items", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Public Liability Insurance"

    def test_list_compliance_no_auth(self, client, compliance_item):
        """Unauthenticated users cannot view compliance."""
        response = client.get("/api/compliance/items")
        assert response.status_code == 401


class TestGetComplianceItem:
    def test_get_compliance_item_success(self, client, compliance_item, auth_headers_admin):
        """Admin can get a specific compliance item."""
        response = client.get(f"/api/compliance/items/{compliance_item.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Public Liability Insurance"
        assert data["category"] == "insurance"
        assert data["reference_number"] == "PLI-2024-001"

    def test_get_compliance_item_not_found(self, client, auth_headers_admin):
        """Returns 404 for non-existent compliance item."""
        response = client.get("/api/compliance/items/999", headers=auth_headers_admin)
        assert response.status_code == 404


class TestCreateComplianceItem:
    def test_create_compliance_item_as_admin(self, client, auth_headers_admin, admin_user):
        """Admin can create compliance items."""
        response = client.post("/api/compliance/items", json={
            "name": "PAT Testing",
            "category": "electrical",
            "description": "Portable appliance testing",
            "renewal_frequency_months": 12,
            "reminder_days_before": 30,
            "responsible_user_id": admin_user.id
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "PAT Testing"
        assert data["category"] == "electrical"
        assert data["is_active"] == True

    def test_create_compliance_item_as_livery_forbidden(self, client, auth_headers_livery):
        """Livery users cannot create compliance items."""
        response = client.post("/api/compliance/items", json={
            "name": "Test Item",
            "category": "other",
            "renewal_frequency_months": 12
        }, headers=auth_headers_livery)
        assert response.status_code == 403


class TestUpdateComplianceItem:
    def test_update_compliance_item_as_admin(self, client, compliance_item, auth_headers_admin):
        """Admin can update compliance items."""
        response = client.put(f"/api/compliance/items/{compliance_item.id}", json={
            "name": "Updated Insurance",
            "provider": "New Insurance Co",
            "reference_number": "NEW-2024-001"
        }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Insurance"
        assert data["provider"] == "New Insurance Co"

    def test_update_compliance_item_as_livery_forbidden(self, client, compliance_item, auth_headers_livery):
        """Livery users cannot update compliance items."""
        response = client.put(f"/api/compliance/items/{compliance_item.id}", json={
            "name": "Hacked"
        }, headers=auth_headers_livery)
        assert response.status_code == 403


class TestDeleteComplianceItem:
    def test_delete_compliance_item_as_admin(self, client, compliance_item, auth_headers_admin):
        """Admin can delete compliance items."""
        response = client.delete(f"/api/compliance/items/{compliance_item.id}", headers=auth_headers_admin)
        assert response.status_code == 204

        # Verify deleted
        response = client.get(f"/api/compliance/items/{compliance_item.id}", headers=auth_headers_admin)
        assert response.status_code == 404

    def test_delete_compliance_item_as_livery_forbidden(self, client, compliance_item, auth_headers_livery):
        """Livery users cannot delete compliance items."""
        response = client.delete(f"/api/compliance/items/{compliance_item.id}", headers=auth_headers_livery)
        assert response.status_code == 403


class TestComplianceDashboard:
    def test_dashboard_shows_overdue(self, client, overdue_compliance_item, auth_headers_admin):
        """Dashboard shows overdue items."""
        response = client.get("/api/compliance/dashboard", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["overdue_count"] >= 1
        assert len(data["overdue_items"]) >= 1

    def test_dashboard_as_admin(self, client, compliance_item, auth_headers_admin):
        """Dashboard accessible to admin."""
        response = client.get("/api/compliance/dashboard", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "due_soon_items" in data
        assert "overdue_count" in data
        assert "total_items" in data


class TestCompleteComplianceItem:
    def test_complete_compliance_item(self, client, compliance_item, auth_headers_admin):
        """Admin can mark compliance item as complete."""
        response = client.post(f"/api/compliance/items/{compliance_item.id}/complete", json={
            "completed_date": "2024-01-15T10:00:00",
            "notes": "Renewed successfully",
            "cost": 500.00,
            "certificate_url": "/uploads/cert.pdf"
        }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        # Item should have updated dates
        assert data["last_completed_date"] is not None

    def test_complete_compliance_item_creates_history(self, client, db, compliance_item, auth_headers_admin):
        """Completing creates a history record."""
        from app.models.compliance import ComplianceHistory

        response = client.post(f"/api/compliance/items/{compliance_item.id}/complete", json={
            "completed_date": "2024-01-15T10:00:00",
            "notes": "Test completion"
        }, headers=auth_headers_admin)
        assert response.status_code == 200

        # Check history was created
        history = db.query(ComplianceHistory).filter(
            ComplianceHistory.compliance_item_id == compliance_item.id
        ).first()
        assert history is not None
        assert history.notes == "Test completion"


class TestComplianceHistory:
    def test_get_compliance_history(self, client, db, compliance_item, auth_headers_admin, admin_user):
        """Can get history for a compliance item."""
        from app.models.compliance import ComplianceHistory

        # Create some history
        history = ComplianceHistory(
            compliance_item_id=compliance_item.id,
            completed_date=datetime.utcnow() - timedelta(days=365),
            completed_by_id=admin_user.id,
            notes="Previous year renewal",
            cost=450.00
        )
        db.add(history)
        db.commit()

        response = client.get(f"/api/compliance/items/{compliance_item.id}/history", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["notes"] == "Previous year renewal"
