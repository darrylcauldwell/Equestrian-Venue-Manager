import pytest
from datetime import date, time, timedelta


class TestListClinics:
    """Tests for listing clinics."""

    def test_list_clinics_public(self, client, approved_clinic):
        """Public can list approved clinics via /public endpoint."""
        response = client.get("/api/clinics/public")
        assert response.status_code == 200
        data = response.json()
        # Response has upcoming and past arrays
        assert "upcoming" in data
        assert "past" in data

    def test_list_clinics_as_livery(self, client, approved_clinic, auth_headers_livery):
        """Livery users can list clinics."""
        response = client.get("/api/clinics/", headers=auth_headers_livery)
        assert response.status_code == 200


class TestGetClinic:
    def test_get_clinic_success_public(self, client, approved_clinic):
        """Can get a specific approved clinic via public endpoint."""
        response = client.get(f"/api/clinics/public/{approved_clinic.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Show Jumping Clinic"
        assert data["status"] == "approved"

    def test_get_clinic_success_auth(self, client, approved_clinic, auth_headers_livery):
        """Authenticated users can get clinic details."""
        response = client.get(f"/api/clinics/{approved_clinic.id}", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Show Jumping Clinic"

    def test_get_clinic_not_found(self, client, auth_headers_livery):
        """Returns 404 for non-existent clinic."""
        response = client.get("/api/clinics/999", headers=auth_headers_livery)
        assert response.status_code == 404


class TestProposeClinic:
    def test_propose_clinic_as_coach(self, client, auth_headers_coach):
        """Coaches can propose clinics."""
        response = client.post("/api/clinics/propose", json={
            "coach_name": "Test Coach",
            "coach_email": "coach@test.com",
            "coach_phone": "07700 900000",
            "discipline": "dressage",
            "title": "Advanced Dressage Workshop",
            "description": "A workshop for advanced dressage riders",
            "proposed_date": str(date.today() + timedelta(days=60)),
            "start_time": "09:00",
            "end_time": "17:00",
            "duration_type": "full_day",
            "lesson_format": "group",
            "max_participants": 12,
            "price_per_lesson": 55.00
        }, headers=auth_headers_coach)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Advanced Dressage Workshop"
        assert data["status"] == "pending"

    def test_request_clinic_as_public(self, client, auth_headers_public):
        """Public users can request clinics via request endpoint."""
        response = client.post("/api/clinics/request", json={
            "coach_name": "External Coach",
            "coach_email": "external@test.com",
            "discipline": "show_jumping",
            "title": "Jumping for Beginners",
            "proposed_date": str(date.today() + timedelta(days=45)),
            "duration_type": "half_day",
            "lesson_format": "group",
            "max_participants": 8
        }, headers=auth_headers_public)
        assert response.status_code == 201


class TestApproveClinic:
    def test_approve_clinic_as_admin(self, client, clinic_request, auth_headers_admin):
        """Admin can approve pending clinics."""
        response = client.put(
            f"/api/clinics/{clinic_request.id}/approve",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"

    def test_approve_clinic_as_coach_forbidden(self, client, clinic_request, auth_headers_coach):
        """Coaches cannot approve clinics."""
        response = client.put(
            f"/api/clinics/{clinic_request.id}/approve",
            headers=auth_headers_coach
        )
        assert response.status_code == 403

    def test_approve_already_approved_fails(self, client, approved_clinic, auth_headers_admin):
        """Cannot approve already approved clinic."""
        response = client.put(
            f"/api/clinics/{approved_clinic.id}/approve",
            headers=auth_headers_admin
        )
        assert response.status_code == 400


class TestRejectClinic:
    def test_reject_clinic_as_admin(self, client, clinic_request, auth_headers_admin):
        """Admin can reject pending clinics."""
        # reason is a query parameter, not JSON body
        response = client.put(
            f"/api/clinics/{clinic_request.id}/reject?reason=Date%20not%20available",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "rejected"
        assert data["rejection_reason"] == "Date not available"

    def test_reject_clinic_as_coach_forbidden(self, client, clinic_request, auth_headers_coach):
        """Coaches cannot reject clinics."""
        response = client.put(
            f"/api/clinics/{clinic_request.id}/reject?reason=Test",
            headers=auth_headers_coach
        )
        assert response.status_code == 403


class TestDeleteClinic:
    def test_delete_clinic_as_admin(self, client, clinic_request, auth_headers_admin):
        """Admin can delete clinics."""
        response = client.delete(
            f"/api/clinics/{clinic_request.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 204


class TestRegisterForClinic:
    def test_register_for_clinic_as_livery(self, client, approved_clinic, horse, auth_headers_livery):
        """Livery users can register for approved clinics."""
        response = client.post(
            f"/api/clinics/{approved_clinic.id}/register",
            json={
                "horse_id": horse.id,
                "participant_phone": "07700 900000",
                "notes": "Looking forward to it!"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 201
        data = response.json()
        assert data["clinic_id"] == approved_clinic.id

    def test_register_for_clinic_as_public(self, client, approved_clinic, auth_headers_public):
        """Public users can register for clinics (external participants)."""
        response = client.post(
            f"/api/clinics/{approved_clinic.id}/register",
            json={
                "participant_name": "John External",
                "participant_email": "john@external.com",
                "participant_phone": "07700 123456"
            },
            headers=auth_headers_public
        )
        assert response.status_code == 201

    def test_register_for_pending_clinic_fails(self, client, clinic_request, auth_headers_livery, horse):
        """Cannot register for clinics that aren't approved."""
        response = client.post(
            f"/api/clinics/{clinic_request.id}/register",
            json={
                "horse_id": horse.id,
                "participant_phone": "07700 900000"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 400


class TestMyRegistrations:
    def test_get_my_registrations(self, client, db, approved_clinic, livery_user, horse, auth_headers_livery):
        """Users can see their own clinic registrations."""
        from app.models.clinic import ClinicParticipant

        # Create a registration (participant_phone is required in schema but not in model)
        registration = ClinicParticipant(
            clinic_id=approved_clinic.id,
            user_id=livery_user.id,
            horse_id=horse.id,
            participant_phone="07700 900000"
        )
        db.add(registration)
        db.commit()

        response = client.get("/api/clinics/my-registrations", headers=auth_headers_livery)
        assert response.status_code == 200


class TestCoachClinics:
    def test_coach_can_see_own_proposals(self, client, clinic_request, auth_headers_coach):
        """Coaches can see their own proposed clinics."""
        response = client.get("/api/clinics/my-proposals", headers=auth_headers_coach)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["title"] == "Dressage Training Day"


class TestAdminClinicManagement:
    def test_admin_can_list_all_clinics(self, client, clinic_request, approved_clinic, auth_headers_admin):
        """Admin can see all clinics via main list endpoint."""
        response = client.get("/api/clinics/", headers=auth_headers_admin)
        assert response.status_code == 200

    def test_admin_can_filter_pending_clinics(self, client, clinic_request, auth_headers_admin):
        """Admin can filter to pending clinics via query param."""
        response = client.get("/api/clinics/?status=pending", headers=auth_headers_admin)
        assert response.status_code == 200
