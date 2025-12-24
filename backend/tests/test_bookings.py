import pytest
from datetime import datetime, timedelta
from app.models.booking import BookingType, PaymentStatus


class TestCreateBooking:
    def test_create_booking_public_user(self, client, arena, auth_headers_public):
        start = (datetime.utcnow() + timedelta(days=2)).isoformat()
        end = (datetime.utcnow() + timedelta(days=2, hours=1)).isoformat()

        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "title": "My Lesson",
            "start_time": start,
            "end_time": end
        }, headers=auth_headers_public)

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "My Lesson"
        assert data["booking_type"] == BookingType.PUBLIC
        assert data["payment_status"] == PaymentStatus.PENDING

    def test_create_booking_livery_user(self, client, arena, auth_headers_livery, horse):
        start = (datetime.utcnow() + timedelta(days=2)).isoformat()
        end = (datetime.utcnow() + timedelta(days=2, hours=1)).isoformat()

        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "horse_id": horse.id,
            "title": "Practice Session",
            "start_time": start,
            "end_time": end
        }, headers=auth_headers_livery)

        assert response.status_code == 201
        data = response.json()
        assert data["booking_type"] == BookingType.LIVERY
        assert data["payment_status"] == PaymentStatus.NOT_REQUIRED
        assert data["horse_id"] == horse.id
        assert data["booking_status"] == "confirmed"

    def test_create_booking_livery_without_horse_fails(self, client, arena, auth_headers_livery):
        """Livery bookings without horse_id should fail"""
        start = (datetime.utcnow() + timedelta(days=2)).isoformat()
        end = (datetime.utcnow() + timedelta(days=2, hours=1)).isoformat()

        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "title": "Practice Session",
            "start_time": start,
            "end_time": end
        }, headers=auth_headers_livery)

        assert response.status_code == 400
        assert "horse" in response.json()["detail"].lower()

    def test_create_maintenance_booking_admin(self, client, arena, auth_headers_admin):
        start = (datetime.utcnow() + timedelta(days=2)).isoformat()
        end = (datetime.utcnow() + timedelta(days=2, hours=2)).isoformat()

        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "title": "Arena Maintenance",
            "start_time": start,
            "end_time": end,
            "booking_type": "maintenance"
        }, headers=auth_headers_admin)

        assert response.status_code == 201
        data = response.json()
        assert data["booking_type"] == BookingType.MAINTENANCE

    def test_create_maintenance_booking_public_forbidden(self, client, arena, auth_headers_public):
        start = (datetime.utcnow() + timedelta(days=2)).isoformat()
        end = (datetime.utcnow() + timedelta(days=2, hours=2)).isoformat()

        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "title": "Maintenance",
            "start_time": start,
            "end_time": end,
            "booking_type": "maintenance"
        }, headers=auth_headers_public)

        assert response.status_code == 403

    def test_create_maintenance_booking_livery_forbidden(self, client, arena, auth_headers_livery):
        start = (datetime.utcnow() + timedelta(days=2)).isoformat()
        end = (datetime.utcnow() + timedelta(days=2, hours=2)).isoformat()

        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "title": "Maintenance",
            "start_time": start,
            "end_time": end,
            "booking_type": "maintenance"
        }, headers=auth_headers_livery)

        assert response.status_code == 403

    def test_create_booking_conflict(self, client, arena, public_booking, auth_headers_public):
        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "title": "Conflicting Booking",
            "start_time": public_booking.start_time.isoformat(),
            "end_time": public_booking.end_time.isoformat()
        }, headers=auth_headers_public)

        assert response.status_code == 409

    def test_create_booking_invalid_times(self, client, arena, auth_headers_public):
        start = (datetime.utcnow() + timedelta(days=2)).isoformat()
        end = (datetime.utcnow() + timedelta(days=1)).isoformat()

        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "title": "Invalid Booking",
            "start_time": start,
            "end_time": end
        }, headers=auth_headers_public)

        assert response.status_code == 400

    def test_create_booking_no_auth(self, client, arena):
        start = (datetime.utcnow() + timedelta(days=2)).isoformat()
        end = (datetime.utcnow() + timedelta(days=2, hours=1)).isoformat()

        response = client.post("/api/bookings/", json={
            "arena_id": arena.id,
            "title": "Test Booking",
            "start_time": start,
            "end_time": end
        })

        assert response.status_code == 401


class TestListBookings:
    def test_list_bookings_admin_sees_all(self, client, public_booking, auth_headers_admin):
        response = client.get("/api/bookings/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Public Booking"

    def test_list_bookings_filtered_by_arena(self, client, arena, public_booking, auth_headers_admin):
        response = client.get(f"/api/bookings/?arena_id={arena.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1


class TestDeleteBooking:
    def test_delete_own_booking(self, client, public_booking, auth_headers_public):
        response = client.delete(f"/api/bookings/{public_booking.id}", headers=auth_headers_public)
        assert response.status_code == 204

    def test_delete_others_booking_forbidden(self, client, public_booking, auth_headers_livery):
        response = client.delete(f"/api/bookings/{public_booking.id}", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_admin_can_delete_any_booking(self, client, public_booking, auth_headers_admin):
        response = client.delete(f"/api/bookings/{public_booking.id}", headers=auth_headers_admin)
        assert response.status_code == 204

    def test_delete_nonexistent_booking(self, client, auth_headers_admin):
        response = client.delete("/api/bookings/999", headers=auth_headers_admin)
        assert response.status_code == 404


class TestPublicBookings:
    def test_get_public_bookings_no_auth(self, client, public_booking):
        response = client.get("/api/bookings/public")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
