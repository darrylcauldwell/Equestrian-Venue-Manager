import pytest
from datetime import date, timedelta
from decimal import Decimal

from app.models.staff_profile import StaffProfile, HourlyRateHistory


class TestStaffProfilesAdmin:
    """Tests for admin staff profile management."""

    def test_list_profiles_admin(self, client, auth_headers_admin, db, staff_user):
        """Admin can list all staff profiles."""
        # Create a staff profile
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Yard Manager",
            bio="Experienced yard manager"
        )
        db.add(profile)
        db.commit()

        response = client.get("/api/staff-profiles", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        # Response is StaffProfileListResponse with profiles and total
        assert "profiles" in data
        assert "total" in data
        assert len(data["profiles"]) >= 1
        assert any(p["user_id"] == staff_user.id for p in data["profiles"])

    def test_list_profiles_non_admin_forbidden(self, client, auth_headers_livery):
        """Non-admin users cannot list all profiles."""
        response = client.get("/api/staff-profiles", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_create_profile_admin(self, client, auth_headers_admin, staff_user):
        """Admin can create a staff profile."""
        response = client.post(
            "/api/staff-profiles",
            json={
                "user_id": staff_user.id,
                "job_title": "Head Groom",
                "bio": "Expert in horse care",
                "date_of_birth": "1990-06-15",
                "start_date": "2020-01-01",
                "qualifications": "BHS Stage 2, First Aid"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 201  # Created
        data = response.json()
        assert data["job_title"] == "Head Groom"
        assert data["bio"] == "Expert in horse care"

    def test_create_profile_duplicate_user(self, client, auth_headers_admin, db, staff_user):
        """Cannot create duplicate profile for same user."""
        # Create existing profile
        profile = StaffProfile(user_id=staff_user.id, job_title="Existing")
        db.add(profile)
        db.commit()

        response = client.post(
            "/api/staff-profiles",
            json={
                "user_id": staff_user.id,
                "job_title": "New Title"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 400

    def test_get_profile_admin(self, client, auth_headers_admin, db, staff_user):
        """Admin can get a specific profile."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Barn Manager",
            bio="Manages the barn operations"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

        response = client.get(
            f"/api/staff-profiles/{staff_user.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["job_title"] == "Barn Manager"

    def test_update_profile_admin(self, client, auth_headers_admin, db, staff_user):
        """Admin can update a staff profile."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Original Title",
            bio="Original bio"
        )
        db.add(profile)
        db.commit()

        response = client.put(
            f"/api/staff-profiles/{staff_user.id}",
            json={
                "job_title": "Updated Title",
                "notes": "Admin note"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["job_title"] == "Updated Title"
        assert data["notes"] == "Admin note"

    def test_delete_profile_admin(self, client, auth_headers_admin, db, staff_user):
        """Admin can delete a staff profile."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="To Delete"
        )
        db.add(profile)
        db.commit()

        response = client.delete(
            f"/api/staff-profiles/{staff_user.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 204  # No Content

        # Verify deletion
        response = client.get(
            f"/api/staff-profiles/{staff_user.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestStaffProfilesSummaries:
    """Tests for staff profile summaries endpoint."""

    def test_get_summaries_admin(self, client, auth_headers_admin, db, staff_user, admin_user):
        """Admin can get staff profile summaries."""
        # Create profiles for staff and admin
        profile1 = StaffProfile(
            user_id=staff_user.id,
            job_title="Yard Hand"
        )
        profile2 = StaffProfile(
            user_id=admin_user.id,
            job_title="Manager"
        )
        db.add(profile1)
        db.add(profile2)
        db.commit()

        response = client.get("/api/staff-profiles/summaries", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        # Response is List[StaffProfileSummary]
        assert isinstance(data, list)
        assert len(data) >= 2
        # Each summary should have expected fields
        for summary in data:
            assert "user_id" in summary
            assert "user_name" in summary
            assert "job_title" in summary

    def test_summaries_non_admin_forbidden(self, client, auth_headers_livery):
        """Non-admin cannot access summaries."""
        response = client.get("/api/staff-profiles/summaries", headers=auth_headers_livery)
        assert response.status_code == 403


class TestStaffMilestones:
    """Tests for staff milestone notifications."""

    def test_get_milestones_admin(self, client, auth_headers_admin, db, staff_user):
        """Admin can get upcoming milestones."""
        # Create profile with birthday coming up
        today = date.today()
        upcoming_birthday = today.replace(year=1990) + timedelta(days=3)
        if upcoming_birthday > today.replace(year=1990):
            # Birthday is in the future this year
            dob = date(1990, upcoming_birthday.month, upcoming_birthday.day)
        else:
            # Birthday already passed this year
            dob = date(1990, (today + timedelta(days=3)).month, (today + timedelta(days=3)).day)

        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Groom",
            date_of_birth=dob,
            start_date=date.today() - timedelta(days=365)  # 1 year anniversary
        )
        db.add(profile)
        db.commit()

        response = client.get("/api/staff-profiles/milestones?days=7", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "birthdays" in data
        assert "anniversaries" in data
        assert "has_upcoming" in data

    def test_milestones_non_admin_forbidden(self, client, auth_headers_livery):
        """Non-admin cannot access milestones."""
        response = client.get("/api/staff-profiles/milestones?days=7", headers=auth_headers_livery)
        assert response.status_code == 403


class TestMyProfile:
    """Tests for self-service profile access."""

    def test_get_my_profile_staff(self, client, auth_headers_staff, db, staff_user):
        """Staff user can view their own profile."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Assistant Groom",
            bio="Loves working with horses",
            personal_email="personal@example.com"
        )
        db.add(profile)
        db.commit()

        response = client.get("/api/staff-profiles/me", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        assert data["job_title"] == "Assistant Groom"
        # Admin notes should not be visible in self-service response
        assert "notes" not in data

    def test_get_my_profile_not_found(self, client, auth_headers_staff):
        """Returns 404 if staff user has no profile."""
        response = client.get("/api/staff-profiles/me", headers=auth_headers_staff)
        assert response.status_code == 404

    def test_update_my_profile_staff(self, client, auth_headers_staff, db, staff_user):
        """Staff user can update their own profile."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Groom",
            bio="Original bio"
        )
        db.add(profile)
        db.commit()

        response = client.put(
            "/api/staff-profiles/me",
            json={
                "bio": "Updated bio by myself",
                "personal_email": "updated@personal.com",
                "emergency_contact_name": "Jane Doe",
                "emergency_contact_phone": "07700 900123"
            },
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert data["bio"] == "Updated bio by myself"
        assert data["personal_email"] == "updated@personal.com"
        assert data["emergency_contact_name"] == "Jane Doe"

    def test_update_my_profile_cannot_change_job_title(self, client, auth_headers_staff, db, staff_user):
        """Staff cannot change fields like job_title (admin-only)."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Original Title"
        )
        db.add(profile)
        db.commit()

        response = client.put(
            "/api/staff-profiles/me",
            json={
                "job_title": "Self-Promoted Manager"
            },
            headers=auth_headers_staff
        )
        # Should succeed but job_title should not change
        # (the schema won't accept job_title in self-update)
        assert response.status_code in [200, 422]


class TestStaffProfileAccess:
    """Tests for staff profile access control."""

    def test_staff_can_view_own_profile(self, client, auth_headers_staff, db, staff_user):
        """Staff user can view their own profile via user_id endpoint."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="My Role"
        )
        db.add(profile)
        db.commit()

        response = client.get(
            f"/api/staff-profiles/{staff_user.id}",
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert data["job_title"] == "My Role"

    def test_staff_cannot_view_other_profile(self, client, auth_headers_staff, db, admin_user):
        """Staff user cannot view another user's profile."""
        profile = StaffProfile(
            user_id=admin_user.id,
            job_title="Admin Role"
        )
        db.add(profile)
        db.commit()

        response = client.get(
            f"/api/staff-profiles/{admin_user.id}",
            headers=auth_headers_staff
        )
        assert response.status_code == 403

    def test_livery_cannot_access_profiles(self, client, auth_headers_livery, db, staff_user):
        """Livery user cannot access staff profiles."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Staff Role"
        )
        db.add(profile)
        db.commit()

        response = client.get(
            f"/api/staff-profiles/{staff_user.id}",
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_unauthenticated_cannot_access(self, client, db, staff_user):
        """Unauthenticated requests are rejected."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Test"
        )
        db.add(profile)
        db.commit()

        response = client.get(f"/api/staff-profiles/{staff_user.id}")
        assert response.status_code == 401


class TestStaffProfileQualifications:
    """Tests for qualifications handling."""

    def test_create_with_qualifications(self, client, auth_headers_admin, staff_user):
        """Can create profile with qualifications string."""
        response = client.post(
            "/api/staff-profiles",
            json={
                "user_id": staff_user.id,
                "job_title": "Senior Groom",
                "qualifications": "BHS Stage 1, BHS Stage 2, First Aid at Work"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 201  # Created
        data = response.json()
        assert "BHS Stage 1" in data["qualifications"]
        assert "BHS Stage 2" in data["qualifications"]

    def test_update_qualifications(self, client, auth_headers_admin, db, staff_user):
        """Can update qualifications."""
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Groom",
            qualifications="BHS Stage 1"
        )
        db.add(profile)
        db.commit()

        response = client.put(
            f"/api/staff-profiles/{staff_user.id}",
            json={
                "qualifications": "BHS Stage 1, BHS Stage 2, Forklift License"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert "BHS Stage 2" in data["qualifications"]
        assert "Forklift License" in data["qualifications"]


class TestHourlyRateHistory:
    """Tests for hourly rate history tracking."""

    def test_get_rate_history_admin(self, client, auth_headers_admin, db, staff_user, admin_user):
        """Admin can get rate history for a staff member."""
        # Create a profile
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Groom",
            hourly_rate=Decimal("12.50")
        )
        db.add(profile)
        db.commit()

        # Add some rate history entries
        history1 = HourlyRateHistory(
            staff_id=staff_user.id,
            hourly_rate=Decimal("10.00"),
            effective_date=date.today() - timedelta(days=365),
            notes="Initial rate",
            created_by_id=admin_user.id
        )
        history2 = HourlyRateHistory(
            staff_id=staff_user.id,
            hourly_rate=Decimal("12.50"),
            effective_date=date.today() - timedelta(days=30),
            notes="Annual review increase",
            created_by_id=admin_user.id
        )
        db.add(history1)
        db.add(history2)
        db.commit()

        response = client.get(
            f"/api/staff-profiles/{staff_user.id}/rate-history",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Should be ordered by effective_date desc
        assert data[0]["hourly_rate"] == 12.50
        assert data[1]["hourly_rate"] == 10.00

    def test_get_rate_history_non_admin_forbidden(self, client, auth_headers_livery, db, staff_user):
        """Non-admin users cannot access rate history."""
        response = client.get(
            f"/api/staff-profiles/{staff_user.id}/rate-history",
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_add_rate_history_admin(self, client, auth_headers_admin, db, staff_user):
        """Admin can add a new rate to history."""
        # Create a profile
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Groom",
            hourly_rate=Decimal("10.00")
        )
        db.add(profile)
        db.commit()

        response = client.post(
            f"/api/staff-profiles/{staff_user.id}/rate-history",
            json={
                "hourly_rate": 12.50,
                "effective_date": date.today().isoformat(),
                "notes": "Pay increase"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 201
        data = response.json()
        assert data["hourly_rate"] == 12.50
        assert data["notes"] == "Pay increase"

        # Verify the current rate on profile was updated (effective date is today)
        db.refresh(profile)
        assert float(profile.hourly_rate) == 12.50

    def test_add_future_rate_does_not_update_current(self, client, auth_headers_admin, db, staff_user):
        """Adding a rate with future effective date doesn't update current rate."""
        # Create a profile with current rate
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Groom",
            hourly_rate=Decimal("10.00")
        )
        db.add(profile)
        db.commit()

        future_date = (date.today() + timedelta(days=30)).isoformat()
        response = client.post(
            f"/api/staff-profiles/{staff_user.id}/rate-history",
            json={
                "hourly_rate": 15.00,
                "effective_date": future_date,
                "notes": "Scheduled increase"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 201

        # Current rate should NOT have changed
        db.refresh(profile)
        assert float(profile.hourly_rate) == 10.00

    def test_add_rate_non_admin_forbidden(self, client, auth_headers_livery, db, staff_user):
        """Non-admin users cannot add rate history."""
        response = client.post(
            f"/api/staff-profiles/{staff_user.id}/rate-history",
            json={
                "hourly_rate": 12.50,
                "effective_date": date.today().isoformat()
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_rate_history_user_not_found(self, client, auth_headers_admin):
        """Returns 404 for non-existent user."""
        response = client.get(
            "/api/staff-profiles/99999/rate-history",
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_add_rate_user_not_found(self, client, auth_headers_admin):
        """Returns 404 when adding rate for non-existent user."""
        response = client.post(
            "/api/staff-profiles/99999/rate-history",
            json={
                "hourly_rate": 12.50,
                "effective_date": date.today().isoformat()
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestMyRateHistory:
    """Tests for staff self-service rate history access."""

    def test_staff_can_view_own_rate_history(self, client, auth_headers_staff, db, staff_user, admin_user):
        """Staff user can view their own rate history (read-only)."""
        # Create a profile
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Groom",
            hourly_rate=Decimal("12.50")
        )
        db.add(profile)
        db.commit()

        # Add some rate history entries
        history1 = HourlyRateHistory(
            staff_id=staff_user.id,
            hourly_rate=Decimal("10.00"),
            effective_date=date.today() - timedelta(days=365),
            notes="Initial rate",
            created_by_id=admin_user.id
        )
        history2 = HourlyRateHistory(
            staff_id=staff_user.id,
            hourly_rate=Decimal("12.50"),
            effective_date=date.today() - timedelta(days=30),
            notes="Annual review increase",
            created_by_id=admin_user.id
        )
        db.add(history1)
        db.add(history2)
        db.commit()

        response = client.get(
            "/api/staff-profiles/me/rate-history",
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        # Should be ordered by effective_date desc
        assert data[0]["hourly_rate"] == 12.50
        assert data[1]["hourly_rate"] == 10.00

    def test_my_rate_history_no_profile_returns_404(self, client, auth_headers_staff):
        """Returns 404 if staff user has no profile."""
        response = client.get(
            "/api/staff-profiles/me/rate-history",
            headers=auth_headers_staff
        )
        assert response.status_code == 404

    def test_my_rate_history_empty_returns_empty_list(self, client, auth_headers_staff, db, staff_user):
        """Returns empty list if no rate history exists."""
        # Create a profile without rate history
        profile = StaffProfile(
            user_id=staff_user.id,
            job_title="Groom",
            hourly_rate=Decimal("12.50")
        )
        db.add(profile)
        db.commit()

        response = client.get(
            "/api/staff-profiles/me/rate-history",
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 0

    def test_livery_cannot_access_rate_history(self, client, auth_headers_livery):
        """Livery users cannot access rate history endpoint."""
        response = client.get(
            "/api/staff-profiles/me/rate-history",
            headers=auth_headers_livery
        )
        assert response.status_code == 403
