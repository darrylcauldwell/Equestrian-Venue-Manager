import pytest
from datetime import date, timedelta
from app.models.settings import SiteSettings


class TestGetSettings:
    """Tests for GET /api/settings/ - public endpoint."""

    def test_get_settings_creates_defaults(self, client):
        """Test that settings are created with defaults if none exist."""
        response = client.get("/api/settings/")
        assert response.status_code == 200
        data = response.json()
        assert data["venue_name"] == "Equestrian Venue Manager"
        assert data["id"] == 1

    def test_get_settings_returns_existing(self, client, db):
        """Test that existing settings are returned."""
        # Create custom settings with valid UK phone format
        phone_number = "07987654321"  # Valid UK mobile number
        settings = SiteSettings(
            venue_name="Test Venue",
            contact_email="test@example.com",
            contact_phone=phone_number
        )
        db.add(settings)
        db.commit()

        response = client.get("/api/settings/")
        assert response.status_code == 200
        data = response.json()
        assert data["venue_name"] == "Test Venue"
        assert data["contact_email"] == "test@example.com"
        # Phone may be formatted with spaces during normalization
        assert data["contact_phone"] is not None
        assert "07987" in data["contact_phone"]

    def test_get_settings_no_auth_required(self, client):
        """Test that settings endpoint doesn't require auth."""
        response = client.get("/api/settings/")
        assert response.status_code == 200


class TestUpdateSettings:
    """Tests for PUT /api/settings/ - admin only endpoint."""

    def test_update_venue_details(self, client, auth_headers_admin, db):
        """Test updating venue details."""
        # First get to create defaults
        client.get("/api/settings/")

        phone_number = "07123456789"  # Valid UK mobile number
        response = client.put("/api/settings/", json={
            "venue_name": "Updated Venue",
            "venue_tagline": "The best equestrian venue",
            "contact_email": "info@updated.com",
            "contact_phone": phone_number
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["venue_name"] == "Updated Venue"
        assert data["venue_tagline"] == "The best equestrian venue"
        assert data["contact_email"] == "info@updated.com"

    def test_update_address_fields(self, client, auth_headers_admin, db):
        """Test updating address fields."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "address_street": "123 Stable Lane",
            "address_town": "Horseville",
            "address_county": "Equestershire",
            "address_postcode": "EQ1 2ST"
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["address_street"] == "123 Stable Lane"
        assert data["address_town"] == "Horseville"
        assert data["address_county"] == "Equestershire"
        assert data["address_postcode"] == "EQ1 2ST"

    def test_update_security_fields(self, client, auth_headers_admin, db):
        """Test updating security/access fields."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "gate_code": "1234",
            "key_safe_code": "5678",
            "security_info": "Gate closes at 9pm",
            "what3words": "filled.count.soap"
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["gate_code"] == "1234"
        assert data["key_safe_code"] == "5678"
        assert data["security_info"] == "Gate closes at 9pm"
        assert data["what3words"] == "filled.count.soap"

    def test_update_theme_settings(self, client, auth_headers_admin, db):
        """Test updating theme settings."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "theme_primary_color": "#FF0000",
            "theme_accent_color": "#00FF00",
            "theme_primary_color_dark": "#CC0000",
            "theme_accent_color_dark": "#00CC00",
            "theme_font_family": "Arial",
            "theme_mode": "dark"
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["theme_primary_color"] == "#FF0000"
        assert data["theme_accent_color"] == "#00FF00"
        assert data["theme_mode"] == "dark"

    def test_update_livery_booking_rules(self, client, auth_headers_admin, db):
        """Test updating livery booking rules."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "livery_billing_day": 15,
            "livery_max_future_hours_per_horse": "10.0",
            "livery_max_booking_hours": "2.0",
            "livery_min_advance_hours": 2,
            "livery_max_advance_days": 14,
            "livery_max_weekly_hours_per_horse": "6.0",
            "livery_max_daily_hours_per_horse": "2.0"
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["livery_billing_day"] == 15
        assert data["livery_max_advance_days"] == 14

    def test_update_sms_settings(self, client, auth_headers_admin, db):
        """Test updating SMS/Twilio settings."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "sms_enabled": True,
            "sms_provider": "twilio",
            "sms_account_sid": "ACtest123",
            "sms_auth_token": "auth123",
            "sms_from_number": "+441234567890",
            "sms_test_mode": True
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["sms_enabled"] is True
        assert data["sms_account_sid"] == "ACtest123"

    def test_update_whatsapp_settings(self, client, auth_headers_admin, db):
        """Test updating WhatsApp settings."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "whatsapp_enabled": True,
            "whatsapp_phone_number": "+441234567890",
            "whatsapp_test_mode": True,
            "whatsapp_notify_invoice": False,
            "whatsapp_notify_feed_alerts": True,
            "whatsapp_notify_service_requests": True,
            "whatsapp_notify_holiday_livery": False
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["whatsapp_enabled"] is True
        assert data["whatsapp_notify_invoice"] is False
        assert data["whatsapp_notify_feed_alerts"] is True

    def test_update_scheduler_settings(self, client, auth_headers_admin, db):
        """Test updating scheduler time settings."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "scheduler_health_tasks_hour": 6,
            "scheduler_health_tasks_minute": 30,
            "scheduler_rollover_hour": 7,
            "scheduler_rollover_minute": 0,
            "scheduler_billing_day": 1,
            "scheduler_billing_hour": 8,
            "scheduler_billing_minute": 0
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["scheduler_health_tasks_hour"] == 6
        assert data["scheduler_health_tasks_minute"] == 30

    def test_update_settings_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot update settings."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "venue_name": "Hacked Venue"
        }, headers=auth_headers_livery)

        assert response.status_code == 403
        assert "admin" in response.json()["detail"].lower()

    def test_update_settings_requires_auth(self, client, db):
        """Test that unauthenticated users cannot update settings."""
        client.get("/api/settings/")

        response = client.put("/api/settings/", json={
            "venue_name": "Hacked Venue"
        })

        assert response.status_code == 401


class TestTurnoutCutoff:
    """Tests for POST /api/settings/turnout-cutoff endpoint."""

    def test_trigger_turnout_cutoff_admin(self, client, auth_headers_admin, db):
        """Test admin can trigger turnout cutoff."""
        client.get("/api/settings/")

        response = client.post("/api/settings/turnout-cutoff", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["turnout_cutoff_date"] == date.today().isoformat()
        assert "activated" in data["message"].lower()

    def test_trigger_turnout_cutoff_staff(self, client, auth_headers_staff, staff_user, db):
        """Test staff can trigger turnout cutoff."""
        client.get("/api/settings/")

        response = client.post("/api/settings/turnout-cutoff", headers=auth_headers_staff)

        assert response.status_code == 200
        data = response.json()
        assert data["turnout_cutoff_date"] == date.today().isoformat()

    def test_trigger_turnout_cutoff_livery_forbidden(self, client, auth_headers_livery, db):
        """Test livery users cannot trigger turnout cutoff."""
        client.get("/api/settings/")

        response = client.post("/api/settings/turnout-cutoff", headers=auth_headers_livery)

        assert response.status_code == 403

    def test_trigger_turnout_cutoff_unauthenticated(self, client, db):
        """Test unauthenticated users cannot trigger turnout cutoff."""
        client.get("/api/settings/")

        response = client.post("/api/settings/turnout-cutoff")

        assert response.status_code == 401


class TestWhatsAppTest:
    """Tests for POST /api/settings/whatsapp/test endpoint."""

    def test_whatsapp_test_disabled(self, client, auth_headers_admin, db):
        """Test WhatsApp test fails when WhatsApp is disabled."""
        client.get("/api/settings/")

        response = client.post("/api/settings/whatsapp/test", headers=auth_headers_admin)

        assert response.status_code == 400
        assert "not enabled" in response.json()["detail"].lower()

    def test_whatsapp_test_no_phone(self, client, auth_headers_admin, db):
        """Test WhatsApp test fails when no phone number configured."""
        client.get("/api/settings/")
        client.put("/api/settings/", json={
            "whatsapp_enabled": True
        }, headers=auth_headers_admin)

        response = client.post("/api/settings/whatsapp/test", headers=auth_headers_admin)

        assert response.status_code == 400
        assert "phone number" in response.json()["detail"].lower()

    def test_whatsapp_test_no_credentials(self, client, auth_headers_admin, db):
        """Test WhatsApp test fails when Twilio credentials missing."""
        client.get("/api/settings/")
        client.put("/api/settings/", json={
            "whatsapp_enabled": True,
            "whatsapp_phone_number": "+441234567890"
        }, headers=auth_headers_admin)

        response = client.post("/api/settings/whatsapp/test", headers=auth_headers_admin)

        assert response.status_code == 400
        assert "twilio credentials" in response.json()["detail"].lower()

    def test_whatsapp_test_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot test WhatsApp."""
        client.get("/api/settings/")

        response = client.post("/api/settings/whatsapp/test", headers=auth_headers_livery)

        assert response.status_code == 403


class TestDemoDataStatus:
    """Tests for GET /api/settings/demo-data/status endpoint."""

    def test_demo_data_status_fresh_install(self, client, auth_headers_admin, admin_user, db):
        """Test demo data status on fresh install."""
        client.get("/api/settings/")

        response = client.get("/api/settings/demo-data/status", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["demo_data_enabled"] is False
        assert data["can_enable_demo"] is True
        assert data["has_real_data"] is False

    def test_demo_data_status_with_data(self, client, auth_headers_admin, admin_user, livery_user, horse, db):
        """Test demo data status when real data exists."""
        client.get("/api/settings/")

        response = client.get("/api/settings/demo-data/status", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["has_real_data"] is True
        assert data["can_enable_demo"] is False
        assert data["reason"] is not None

    def test_demo_data_status_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot check demo data status."""
        client.get("/api/settings/")

        response = client.get("/api/settings/demo-data/status", headers=auth_headers_livery)

        assert response.status_code == 403


class TestDemoDataSeed:
    """Tests for POST /api/settings/demo-data/seed endpoint."""

    def test_demo_data_seed_with_existing_data(self, client, auth_headers_admin, admin_user, livery_user, db):
        """Test that seeding fails when real data exists."""
        client.get("/api/settings/")

        response = client.post("/api/settings/demo-data/seed", headers=auth_headers_admin)

        assert response.status_code == 400
        assert "cannot enable demo data" in response.json()["detail"].lower()

    def test_demo_data_seed_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot seed demo data."""
        client.get("/api/settings/")

        response = client.post("/api/settings/demo-data/seed", headers=auth_headers_livery)

        assert response.status_code == 403


class TestSchedulerStatus:
    """Tests for GET /api/settings/scheduler/status endpoint."""

    def test_scheduler_status_admin(self, client, auth_headers_admin, db):
        """Test admin can view scheduler status."""
        client.get("/api/settings/")

        response = client.get("/api/settings/scheduler/status", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert "scheduler_running" in data
        assert "jobs" in data
        assert "todays_health_tasks" in data
        assert "current_date" in data

    def test_scheduler_status_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot view scheduler status."""
        client.get("/api/settings/")

        response = client.get("/api/settings/scheduler/status", headers=auth_headers_livery)

        assert response.status_code == 403


class TestSchedulerPreview:
    """Tests for GET /api/settings/scheduler/preview/{date} endpoint."""

    def test_preview_health_tasks_admin(self, client, auth_headers_admin, db):
        """Test admin can preview health tasks for a date."""
        client.get("/api/settings/")
        target_date = (date.today() + timedelta(days=1)).isoformat()

        response = client.get(f"/api/settings/scheduler/preview/{target_date}", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["target_date"] == target_date
        assert "existing_tasks" in data
        assert "already_generated" in data

    def test_preview_health_tasks_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot preview health tasks."""
        client.get("/api/settings/")
        target_date = (date.today() + timedelta(days=1)).isoformat()

        response = client.get(f"/api/settings/scheduler/preview/{target_date}", headers=auth_headers_livery)

        assert response.status_code == 403


class TestSchedulerGenerate:
    """Tests for POST /api/settings/scheduler/generate/{date} endpoint."""

    def test_generate_health_tasks_admin(self, client, auth_headers_admin, db):
        """Test admin can generate health tasks for a date."""
        client.get("/api/settings/")
        target_date = (date.today() + timedelta(days=1)).isoformat()

        response = client.post(f"/api/settings/scheduler/generate/{target_date}", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["target_date"] == target_date
        assert "tasks_generated" in data

    def test_generate_health_tasks_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot generate health tasks."""
        client.get("/api/settings/")
        target_date = (date.today() + timedelta(days=1)).isoformat()

        response = client.post(f"/api/settings/scheduler/generate/{target_date}", headers=auth_headers_livery)

        assert response.status_code == 403


class TestSchedulerRollover:
    """Tests for POST /api/settings/scheduler/rollover endpoint."""

    def test_rollover_admin(self, client, auth_headers_admin, db):
        """Test admin can run task rollover."""
        client.get("/api/settings/")

        response = client.post("/api/settings/scheduler/rollover", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "tasks_moved" in data

    def test_rollover_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot run rollover."""
        client.get("/api/settings/")

        response = client.post("/api/settings/scheduler/rollover", headers=auth_headers_livery)

        assert response.status_code == 403


class TestMaintenanceDays:
    """Tests for GET /api/settings/scheduler/maintenance-days endpoint."""

    def test_get_maintenance_days_admin(self, client, auth_headers_admin, db):
        """Test admin can view maintenance days."""
        client.get("/api/settings/")

        response = client.get("/api/settings/scheduler/maintenance-days", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert "maintenance_days" in data
        assert isinstance(data["maintenance_days"], list)

    def test_get_maintenance_days_requires_admin(self, client, auth_headers_livery, db):
        """Test that non-admin users cannot view maintenance days."""
        client.get("/api/settings/")

        response = client.get("/api/settings/scheduler/maintenance-days", headers=auth_headers_livery)

        assert response.status_code == 403


class TestStaffOnRota:
    """Tests for GET /api/settings/scheduler/staff-on-rota/{date} endpoint."""

    def test_staff_on_rota_admin(self, client, auth_headers_admin, db):
        """Test admin can view staff on rota."""
        client.get("/api/settings/")
        target_date = date.today().isoformat()

        response = client.get(f"/api/settings/scheduler/staff-on-rota/{target_date}", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["date"] == target_date
        assert "staff_on_rota" in data
        assert "count" in data

    def test_staff_on_rota_staff(self, client, auth_headers_staff, staff_user, db):
        """Test staff can view staff on rota."""
        client.get("/api/settings/")
        target_date = date.today().isoformat()

        response = client.get(f"/api/settings/scheduler/staff-on-rota/{target_date}", headers=auth_headers_staff)

        assert response.status_code == 200
        data = response.json()
        assert data["date"] == target_date

    def test_staff_on_rota_livery_forbidden(self, client, auth_headers_livery, db):
        """Test that livery users cannot view staff on rota."""
        client.get("/api/settings/")
        target_date = date.today().isoformat()

        response = client.get(f"/api/settings/scheduler/staff-on-rota/{target_date}", headers=auth_headers_livery)

        assert response.status_code == 403
