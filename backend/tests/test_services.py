"""
Tests for Service Request endpoints.

Covers:
- Service request creation (basic and rehab assistance)
- Recurring patterns (none, daily, weekdays, custom)
- Series cancellation
- Authorization (livery can only request for their own horses)
- Service request status transitions
"""
import pytest
from datetime import date, timedelta


class TestCreateServiceRequest:
    """Tests for creating basic service requests."""

    def test_create_service_request_success(self, client, auth_headers_livery, service, horse):
        """Livery user can create a service request for their own horse."""
        request_date = date.today() + timedelta(days=3)
        response = client.post(
            "/api/services/requests",
            json={
                "service_id": service.id,
                "horse_id": horse.id,
                "requested_date": str(request_date),
                "preferred_time": "morning",
                "special_instructions": "Horse prefers quiet areas"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 201
        data = response.json()
        assert data["service_id"] == service.id
        assert data["horse_id"] == horse.id
        assert data["requested_date"] == str(request_date)
        assert data["preferred_time"] == "morning"
        assert data["status"] == "approved"  # Auto-approved (service.requires_approval=False)
        assert data["charge_amount"] == "10.00"
        assert data["service_name"] == "Exercise - Walk in Hand"
        assert data["horse_name"] == "Thunder"

    def test_create_service_request_with_approval_required(self, client, db, auth_headers_livery, horse):
        """Service requiring approval starts with pending status."""
        from app.models.service import Service, ServiceCategory

        # Create service that requires approval
        service_approval = Service(
            id="third-party-farrier",
            category=ServiceCategory.THIRD_PARTY,
            name="Farrier Service",
            price_gbp=50.00,
            requires_approval=True,
            approval_reason="Must coordinate with farrier schedule",
            advance_notice_hours=48,
            is_active=True
        )
        db.add(service_approval)
        db.commit()

        request_date = date.today() + timedelta(days=5)
        response = client.post(
            "/api/services/requests",
            json={
                "service_id": service_approval.id,
                "horse_id": horse.id,
                "requested_date": str(request_date),
                "preferred_time": "any"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "pending"  # Requires approval

    def test_create_service_request_insufficient_advance_notice(self, client, auth_headers_livery, service, horse):
        """Cannot create request without sufficient advance notice."""
        # Service requires 24 hours notice
        request_date = date.today()  # Today - insufficient notice
        response = client.post(
            "/api/services/requests",
            json={
                "service_id": service.id,
                "horse_id": horse.id,
                "requested_date": str(request_date),
                "preferred_time": "afternoon"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 400
        assert "advance notice" in response.json()["detail"].lower()

    def test_create_service_request_for_other_users_horse(self, client, db, auth_headers_livery, service):
        """Livery user cannot request service for another user's horse."""
        from app.models.horse import Horse
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Create another user with their horse
        other_user = User(
            username="otherlivery",
            email="other@example.com",
            name="Other Livery",
            password_hash=get_password_hash("password123"),
            role=UserRole.LIVERY,
            is_active=True
        )
        db.add(other_user)
        db.commit()
        db.refresh(other_user)

        other_horse = Horse(
            owner_id=other_user.id,
            name="Other Horse",
            colour="White",
            birth_year=2016
        )
        db.add(other_horse)
        db.commit()

        request_date = date.today() + timedelta(days=3)
        response = client.post(
            "/api/services/requests",
            json={
                "service_id": service.id,
                "horse_id": other_horse.id,
                "requested_date": str(request_date),
                "preferred_time": "morning"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 403
        assert "your own horses" in response.json()["detail"].lower()

    def test_create_service_request_inactive_service(self, client, db, auth_headers_livery, horse):
        """Cannot request an inactive service."""
        from app.models.service import Service, ServiceCategory

        inactive_service = Service(
            id="inactive-service",
            category=ServiceCategory.GROOMING,
            name="Old Grooming Service",
            price_gbp=15.00,
            is_active=False
        )
        db.add(inactive_service)
        db.commit()

        request_date = date.today() + timedelta(days=3)
        response = client.post(
            "/api/services/requests",
            json={
                "service_id": inactive_service.id,
                "horse_id": horse.id,
                "requested_date": str(request_date),
                "preferred_time": "afternoon"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 404
        assert "not found or inactive" in response.json()["detail"].lower()

    def test_admin_can_request_for_any_horse(self, client, db, auth_headers_admin, service):
        """Admin can create service requests for any horse."""
        from app.models.horse import Horse
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Create another user with their horse
        other_user = User(
            username="somelivery",
            email="some@example.com",
            name="Some Livery",
            password_hash=get_password_hash("password123"),
            role=UserRole.LIVERY,
            is_active=True
        )
        db.add(other_user)
        db.commit()

        some_horse = Horse(
            owner_id=other_user.id,
            name="Some Horse",
            colour="Chestnut",
            birth_year=2017
        )
        db.add(some_horse)
        db.commit()

        request_date = date.today() + timedelta(days=3)
        response = client.post(
            "/api/services/requests",
            json={
                "service_id": service.id,
                "horse_id": some_horse.id,
                "requested_date": str(request_date),
                "preferred_time": "evening"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "approved"  # Admin requests auto-approved


class TestCreateRehabAssistanceRequest:
    """Tests for creating rehab assistance requests."""

    def test_create_rehab_assistance_single_day(self, client, auth_headers_livery, rehab_program_active, horse):
        """Create a single day rehab assistance request."""
        request_date = date.today() + timedelta(days=1)
        response = client.post(
            "/api/services/requests/rehab",
            json={
                "horse_id": horse.id,
                "rehab_program_id": rehab_program_active.id,
                "start_date": str(request_date),
                "end_date": str(request_date),
                "special_instructions": "Please be gentle"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 1
        request = data[0]
        assert request["horse_id"] == horse.id
        assert request["rehab_program_id"] == rehab_program_active.id
        assert request["requested_date"] == str(request_date)
        assert request["recurring_pattern"] == "none"
        assert request["recurring_series_id"] is None
        assert request["status"] == "pending"
        assert "Please be gentle" in request["special_instructions"]

    def test_create_rehab_assistance_date_range(self, client, auth_headers_livery, rehab_program_active, horse):
        """Create rehab assistance for a date range (creates daily requests)."""
        start_date = date.today() + timedelta(days=1)
        end_date = start_date + timedelta(days=6)  # 7 days total

        response = client.post(
            "/api/services/requests/rehab",
            json={
                "horse_id": horse.id,
                "rehab_program_id": rehab_program_active.id,
                "start_date": str(start_date),
                "end_date": str(end_date)
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data) == 7  # 7 days

        # All should have same series_id
        series_id = data[0]["recurring_series_id"]
        assert series_id is not None
        for request in data:
            assert request["recurring_series_id"] == series_id
            assert request["recurring_pattern"] == "daily"
            assert request["status"] == "pending"

        # Check dates are consecutive
        dates = sorted([request["requested_date"] for request in data])
        expected_dates = [(start_date + timedelta(days=i)).isoformat() for i in range(7)]
        assert dates == expected_dates

    def test_create_rehab_assistance_invalid_end_date(self, client, auth_headers_livery, rehab_program_active, horse):
        """End date before start date should fail."""
        start_date = date.today() + timedelta(days=5)
        end_date = date.today() + timedelta(days=2)  # Before start

        response = client.post(
            "/api/services/requests/rehab",
            json={
                "horse_id": horse.id,
                "rehab_program_id": rehab_program_active.id,
                "start_date": str(start_date),
                "end_date": str(end_date)
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 400
        assert "after" in response.json()["detail"].lower() or "on or after" in response.json()["detail"].lower()

    def test_create_rehab_assistance_for_other_users_horse(self, client, db, auth_headers_livery, rehab_program_active):
        """Cannot create rehab assistance for another user's horse."""
        from app.models.horse import Horse
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        other_user = User(
            username="anotherlivery",
            email="another@example.com",
            name="Another Livery",
            password_hash=get_password_hash("password123"),
            role=UserRole.LIVERY,
            is_active=True
        )
        db.add(other_user)
        db.commit()

        other_horse = Horse(
            owner_id=other_user.id,
            name="Another Horse",
            colour="Brown",
            birth_year=2018
        )
        db.add(other_horse)
        db.commit()

        request_date = date.today() + timedelta(days=1)
        response = client.post(
            "/api/services/requests/rehab",
            json={
                "horse_id": other_horse.id,
                "rehab_program_id": rehab_program_active.id,
                "start_date": str(request_date),
                "end_date": str(request_date)
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 403
        assert "your own horses" in response.json()["detail"].lower()

    def test_create_rehab_assistance_inactive_program(self, client, db, auth_headers_livery, horse):
        """Cannot create rehab assistance for inactive program."""
        from app.models.medication_log import RehabProgram, RehabStatus

        inactive_program = RehabProgram(
            horse_id=horse.id,
            name="Completed rehab",
            start_date=date.today() - timedelta(days=30),
            expected_end_date=date.today() - timedelta(days=1),
            status=RehabStatus.COMPLETED,
            created_by_id=1
        )
        db.add(inactive_program)
        db.commit()

        request_date = date.today() + timedelta(days=1)
        response = client.post(
            "/api/services/requests/rehab",
            json={
                "horse_id": horse.id,
                "rehab_program_id": inactive_program.id,
                "start_date": str(request_date),
                "end_date": str(request_date)
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 400
        assert "active" in response.json()["detail"].lower()


class TestCancelRecurringSeries:
    """Tests for cancelling recurring series."""

    def test_cancel_recurring_series_success(self, client, auth_headers_livery, rehab_program_active, horse):
        """User can cancel their own recurring series."""
        # Create a recurring series
        start_date = date.today() + timedelta(days=1)
        end_date = start_date + timedelta(days=6)

        response = client.post(
            "/api/services/requests/rehab",
            json={
                "horse_id": horse.id,
                "rehab_program_id": rehab_program_active.id,
                "start_date": str(start_date),
                "end_date": str(end_date)
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 201
        data = response.json()
        series_id = data[0]["recurring_series_id"]

        # Cancel the series
        response = client.delete(
            f"/api/services/requests/series/{series_id}",
            headers=auth_headers_livery
        )
        assert response.status_code == 204

        # Verify all requests in series are cancelled
        response = client.get("/api/services/requests/my", headers=auth_headers_livery)
        assert response.status_code == 200
        my_requests = response.json()

        # Should have no pending/scheduled requests from this series
        for request in my_requests.get("pending_requests", []):
            assert request["recurring_series_id"] != series_id
        for request in my_requests.get("scheduled_requests", []):
            assert request["recurring_series_id"] != series_id

    def test_cancel_recurring_series_not_found(self, client, auth_headers_livery):
        """Cancelling non-existent series returns 404."""
        response = client.delete(
            "/api/services/requests/series/999999",
            headers=auth_headers_livery
        )
        assert response.status_code == 404

    def test_cancel_recurring_series_other_user(self, client, db, auth_headers_livery, rehab_program_active, horse):
        """Cannot cancel another user's recurring series."""
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash, create_access_token

        # Create another user
        other_user = User(
            username="otheruser",
            email="otheruser@example.com",
            name="Other User",
            password_hash=get_password_hash("password123"),
            role=UserRole.LIVERY,
            is_active=True
        )
        db.add(other_user)
        db.commit()
        db.refresh(other_user)

        # Create horse for other user
        from app.models.horse import Horse
        other_horse = Horse(
            owner_id=other_user.id,
            name="Other Horse",
            colour="Grey",
            birth_year=2019
        )
        db.add(other_horse)
        db.commit()

        # Create rehab program for other user's horse
        from app.models.medication_log import RehabProgram, RehabStatus
        other_program = RehabProgram(
            horse_id=other_horse.id,
            name="Other rehab",
            start_date=date.today(),
            status=RehabStatus.ACTIVE,
            created_by_id=other_user.id
        )
        db.add(other_program)
        db.commit()
        db.refresh(other_program)

        # Other user creates recurring series
        other_token = create_access_token(other_user.id)
        other_headers = {"Authorization": f"Bearer {other_token}"}

        start_date = date.today() + timedelta(days=1)
        end_date = start_date + timedelta(days=6)

        response = client.post(
            "/api/services/requests/rehab",
            json={
                "horse_id": other_horse.id,
                "rehab_program_id": other_program.id,
                "start_date": str(start_date),
                "end_date": str(end_date)
            },
            headers=other_headers
        )
        assert response.status_code == 201
        data = response.json()
        series_id = data[0]["recurring_series_id"]

        # Try to cancel with different user
        response = client.delete(
            f"/api/services/requests/series/{series_id}",
            headers=auth_headers_livery
        )
        assert response.status_code == 403


class TestListServiceRequests:
    """Tests for listing service requests."""

    def test_list_my_requests(self, client, auth_headers_livery, service_request):
        """User can list their own service requests."""
        response = client.get("/api/services/requests/my", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert "pending_requests" in data
        assert "scheduled_requests" in data
        assert "completed_requests" in data

    def test_list_all_requests_as_admin(self, client, auth_headers_admin, service_request):
        """Admin can list all service requests."""
        response = client.get("/api/services/requests/all", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_list_all_requests_as_livery_forbidden(self, client, auth_headers_livery, service_request):
        """Livery users cannot list all requests."""
        response = client.get("/api/services/requests/all", headers=auth_headers_livery)
        assert response.status_code == 403


class TestServiceRequestStatusTransitions:
    """Tests for service request status transitions."""

    def test_approve_pending_request(self, client, db, auth_headers_admin, horse, livery_user):
        """Admin can approve a pending service request."""
        from app.models.service import Service, ServiceCategory, ServiceRequest, RequestStatus

        # Create service requiring approval
        service_approval = Service(
            id="approval-required",
            category=ServiceCategory.THIRD_PARTY,
            name="Special Service",
            price_gbp=25.00,
            requires_approval=True,
            is_active=True
        )
        db.add(service_approval)
        db.commit()

        # Create pending request
        pending_request = ServiceRequest(
            service_id=service_approval.id,
            horse_id=horse.id,
            requested_by_id=livery_user.id,
            requested_date=date.today() + timedelta(days=5),
            status=RequestStatus.PENDING,
            charge_amount=service_approval.price_gbp
        )
        db.add(pending_request)
        db.commit()
        db.refresh(pending_request)

        # Approve request
        response = client.put(
            f"/api/services/requests/{pending_request.id}/approve",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "approved"

    def test_approve_request_non_admin_forbidden(self, client, auth_headers_livery, service_request):
        """Non-admin cannot approve requests."""
        response = client.put(
            f"/api/services/requests/{service_request.id}/approve",
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_cancel_service_request(self, client, auth_headers_livery, service_request):
        """User can cancel their own service request."""
        response = client.put(
            f"/api/services/requests/{service_request.id}/cancel",
            headers=auth_headers_livery
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "cancelled"

    def test_cancel_other_users_request_forbidden(self, client, db, auth_headers_livery, service):
        """Cannot cancel another user's service request."""
        from app.models.user import User, UserRole
        from app.models.horse import Horse
        from app.models.service import ServiceRequest, RequestStatus
        from app.utils.auth import get_password_hash

        # Create another user with horse and request
        other_user = User(
            username="differentuser",
            email="different@example.com",
            name="Different User",
            password_hash=get_password_hash("password123"),
            role=UserRole.LIVERY,
            is_active=True
        )
        db.add(other_user)
        db.commit()

        other_horse = Horse(
            owner_id=other_user.id,
            name="Different Horse",
            colour="Dapple",
            birth_year=2020
        )
        db.add(other_horse)
        db.commit()

        other_request = ServiceRequest(
            service_id=service.id,
            horse_id=other_horse.id,
            requested_by_id=other_user.id,
            requested_date=date.today() + timedelta(days=5),
            status=RequestStatus.APPROVED,
            charge_amount=service.price_gbp
        )
        db.add(other_request)
        db.commit()
        db.refresh(other_request)

        # Try to cancel with different user
        response = client.put(
            f"/api/services/requests/{other_request.id}/cancel",
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_get_service_request_details(self, client, auth_headers_livery, service_request):
        """User can view their own service request details."""
        response = client.get(
            f"/api/services/requests/{service_request.id}",
            headers=auth_headers_livery
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == service_request.id
        assert data["service_name"] == "Exercise - Walk in Hand"
        assert data["horse_name"] == "Thunder"
