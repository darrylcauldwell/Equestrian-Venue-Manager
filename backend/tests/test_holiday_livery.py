"""
Tests for Holiday Livery endpoints.
"""
import pytest
from datetime import date, timedelta


class TestPublicHolidayLiveryRequest:
    """Tests for public holiday livery request submission."""

    def test_submit_request_no_auth(self, client):
        """Public can submit a holiday livery request without authentication."""
        response = client.post("/api/holiday-livery/request", json={
            "guest_name": "Alice Johnson",
            "guest_email": "alice@example.com",
            "guest_phone": "07700 900789",
            "horse_name": "Midnight",
            "horse_breed": "Irish Sport Horse",
            "horse_age": 6,
            "horse_colour": "Black",
            "horse_gender": "gelding",
            "special_requirements": "Easy keeper, needs limited grass",
            "requested_arrival": str(date.today() + timedelta(days=10)),
            "requested_departure": str(date.today() + timedelta(days=17)),
            "message": "Looking for temporary accommodation"
        })
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert data["status"] == "pending"
        assert "Your holiday livery request has been submitted" in data["message"]

    def test_submit_request_minimal_fields(self, client):
        """Can submit with only required fields."""
        response = client.post("/api/holiday-livery/request", json={
            "guest_name": "Bob Brown",
            "guest_email": "bob@example.com",
            "horse_name": "Flash",
            "requested_arrival": str(date.today() + timedelta(days=5)),
            "requested_departure": str(date.today() + timedelta(days=12))
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    def test_submit_request_missing_required_fields(self, client):
        """Fails without required fields."""
        response = client.post("/api/holiday-livery/request", json={
            "guest_name": "Test User"
            # Missing guest_email, horse_name, dates
        })
        assert response.status_code == 422


class TestAdminListHolidayLiveryRequests:
    """Tests for admin listing holiday livery requests."""

    def test_list_requests_as_admin(self, client, auth_headers_admin, holiday_livery_request):
        """Admin can list all holiday livery requests."""
        response = client.get("/api/holiday-livery/requests", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["guest_name"] == "Jane Smith"
        assert data[0]["horse_name"] == "Star"
        assert data[0]["status"] == "pending"

    def test_list_requests_filter_by_status(self, client, auth_headers_admin, holiday_livery_request, approved_holiday_livery_request):
        """Can filter requests by status."""
        # Filter for pending only
        response = client.get("/api/holiday-livery/requests?status=pending", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "pending"

        # Filter for approved only
        response = client.get("/api/holiday-livery/requests?status=approved", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "approved"

    def test_list_requests_as_livery_forbidden(self, client, auth_headers_livery, holiday_livery_request):
        """Livery users cannot list requests."""
        response = client.get("/api/holiday-livery/requests", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_requests_no_auth(self, client, holiday_livery_request):
        """Unauthenticated users cannot list requests."""
        response = client.get("/api/holiday-livery/requests")
        assert response.status_code == 401


class TestAdminGetHolidayLiveryRequest:
    """Tests for admin getting a specific holiday livery request."""

    def test_get_request_as_admin(self, client, auth_headers_admin, holiday_livery_request):
        """Admin can get request details."""
        response = client.get(f"/api/holiday-livery/requests/{holiday_livery_request.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["guest_name"] == "Jane Smith"
        assert data["guest_email"] == "jane.smith@example.com"
        assert data["horse_name"] == "Star"
        assert data["horse_breed"] == "Thoroughbred"
        assert data["special_requirements"] == "Needs twice daily medication"

    def test_get_request_not_found(self, client, auth_headers_admin):
        """Returns 404 for non-existent request."""
        response = client.get("/api/holiday-livery/requests/999", headers=auth_headers_admin)
        assert response.status_code == 404


class TestAdminApproveHolidayLiveryRequest:
    """Tests for admin approving holiday livery requests."""

    def test_approve_request_creates_user_and_horse(self, client, db, auth_headers_admin, holiday_livery_request, stable, holiday_livery_package):
        """Approving creates user account and horse record."""
        response = client.post(
            f"/api/holiday-livery/requests/{holiday_livery_request.id}/approve",
            json={
                "confirmed_arrival": str(date.today() + timedelta(days=7)),
                "confirmed_departure": str(date.today() + timedelta(days=14)),
                "assigned_stable_id": stable.id,
                "admin_notes": "Nice horse, excited to have them!"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        assert data["assigned_stable_id"] == stable.id
        assert data["created_user_id"] is not None
        assert data["created_horse_id"] is not None
        # Check that temp password is in admin notes
        assert "Temp Password:" in data["admin_notes"]

    def test_approve_request_existing_user(self, client, db, auth_headers_admin, holiday_livery_request, stable, holiday_livery_package, livery_user):
        """Approving with existing email uses existing user."""
        # Update request email to match existing user
        holiday_livery_request.guest_email = livery_user.email
        db.commit()

        response = client.post(
            f"/api/holiday-livery/requests/{holiday_livery_request.id}/approve",
            json={
                "confirmed_arrival": str(date.today() + timedelta(days=7)),
                "confirmed_departure": str(date.today() + timedelta(days=14)),
                "assigned_stable_id": stable.id
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"
        # Should use existing user
        assert data["created_user_id"] == livery_user.id
        # No temp password for existing user
        assert "Temp Password:" not in (data.get("admin_notes") or "")

    def test_approve_already_approved_fails(self, client, auth_headers_admin, approved_holiday_livery_request, stable):
        """Cannot approve an already approved request."""
        response = client.post(
            f"/api/holiday-livery/requests/{approved_holiday_livery_request.id}/approve",
            json={
                "confirmed_arrival": str(date.today() + timedelta(days=1)),
                "confirmed_departure": str(date.today() + timedelta(days=10)),
                "assigned_stable_id": stable.id
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 400
        assert "Cannot approve" in response.json()["detail"]

    def test_approve_invalid_stable_fails(self, client, auth_headers_admin, holiday_livery_request, holiday_livery_package):
        """Cannot approve with non-existent stable."""
        response = client.post(
            f"/api/holiday-livery/requests/{holiday_livery_request.id}/approve",
            json={
                "confirmed_arrival": str(date.today() + timedelta(days=7)),
                "confirmed_departure": str(date.today() + timedelta(days=14)),
                "assigned_stable_id": 999
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 400
        assert "stable not found" in response.json()["detail"].lower()


class TestAdminRejectHolidayLiveryRequest:
    """Tests for admin rejecting holiday livery requests."""

    def test_reject_request(self, client, auth_headers_admin, holiday_livery_request):
        """Admin can reject a request."""
        response = client.post(
            f"/api/holiday-livery/requests/{holiday_livery_request.id}/reject",
            json={
                "rejection_reason": "Stables are fully booked for those dates",
                "admin_notes": "Suggested alternative dates via email"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        assert data["rejection_reason"] == "Stables are fully booked for those dates"

    def test_reject_already_approved_fails(self, client, auth_headers_admin, approved_holiday_livery_request):
        """Cannot reject an already approved request."""
        response = client.post(
            f"/api/holiday-livery/requests/{approved_holiday_livery_request.id}/reject",
            json={"rejection_reason": "Changed my mind"},
            headers=auth_headers_admin
        )
        assert response.status_code == 400


class TestAdminCancelHolidayLiveryRequest:
    """Tests for admin cancelling holiday livery requests."""

    def test_cancel_pending_request(self, client, auth_headers_admin, holiday_livery_request):
        """Admin can cancel a pending request."""
        response = client.post(
            f"/api/holiday-livery/requests/{holiday_livery_request.id}/cancel",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"

    def test_cancel_approved_request(self, client, auth_headers_admin, approved_holiday_livery_request):
        """Admin can cancel an approved request."""
        response = client.post(
            f"/api/holiday-livery/requests/{approved_holiday_livery_request.id}/cancel",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"

    def test_cancel_already_cancelled_fails(self, client, db, auth_headers_admin, holiday_livery_request):
        """Cannot cancel an already cancelled request."""
        from app.models.holiday_livery import HolidayLiveryStatus
        holiday_livery_request.status = HolidayLiveryStatus.CANCELLED
        db.commit()

        response = client.post(
            f"/api/holiday-livery/requests/{holiday_livery_request.id}/cancel",
            headers=auth_headers_admin
        )
        assert response.status_code == 400


class TestHolidayLiveryStats:
    """Tests for holiday livery statistics."""

    def test_get_stats_as_admin(self, client, auth_headers_admin, holiday_livery_request, approved_holiday_livery_request):
        """Admin can get statistics."""
        response = client.get("/api/holiday-livery/stats", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert data["pending"] == 1
        assert data["approved"] == 1
        assert data["rejected"] == 0

    def test_get_stats_as_livery_forbidden(self, client, auth_headers_livery):
        """Livery users cannot get statistics."""
        response = client.get("/api/holiday-livery/stats", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_get_stats_no_auth(self, client):
        """Unauthenticated users cannot get statistics."""
        response = client.get("/api/holiday-livery/stats")
        assert response.status_code == 401


class TestHolidayLiveryPackage:
    """Tests for holiday livery package with weekly billing."""

    def test_create_weekly_package(self, client, auth_headers_admin):
        """Admin can create a package with weekly billing."""
        response = client.post("/api/livery-packages/", json={
            "name": "Short Stay Livery",
            "price_display": "£300/week",
            "weekly_price": 300.00,
            "billing_type": "weekly",
            "description": "For short-term visitors",
            "features": ["Full care", "Daily turnout"]
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Short Stay Livery"
        assert data["weekly_price"] == "300.00"
        assert data["billing_type"] == "weekly"

    def test_package_with_monthly_billing(self, client, auth_headers_admin):
        """Regular packages use monthly billing by default."""
        response = client.post("/api/livery-packages/", json={
            "name": "Standard Livery",
            "price_display": "£700/month",
            "monthly_price": 700.00,
            "description": "Regular monthly livery",
            "features": ["Full care"]
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["billing_type"] == "monthly"
