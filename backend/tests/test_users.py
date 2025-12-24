import pytest
from app.models.user import UserRole


class TestAdminCreateUser:
    def test_admin_creates_livery_user(self, client, auth_headers_admin):
        response = client.post("/api/users/create", json={
            "username": "newlivery",
            "email": "newlivery@example.com",
            "name": "New Livery",
            "role": "livery"
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["user"]["username"] == "newlivery"
        assert data["user"]["role"] == UserRole.LIVERY
        assert data["user"]["must_change_password"] == True
        assert "temporary_password" in data
        assert len(data["temporary_password"]) >= 8

    def test_admin_creates_coach_user(self, client, auth_headers_admin):
        response = client.post("/api/users/create", json={
            "username": "newcoach",
            "name": "New Coach",
            "role": "coach"
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == UserRole.COACH
        assert data["user"]["must_change_password"] == True

    def test_admin_creates_admin_user(self, client, auth_headers_admin):
        response = client.post("/api/users/create", json={
            "username": "newadmin",
            "name": "New Admin",
            "role": "admin"
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == UserRole.ADMIN

    def test_livery_cannot_create_user(self, client, auth_headers_livery):
        response = client.post("/api/users/create", json={
            "username": "newuser",
            "name": "New User"
        }, headers=auth_headers_livery)

        assert response.status_code == 403

    def test_coach_cannot_create_user(self, client, auth_headers_coach):
        response = client.post("/api/users/create", json={
            "username": "newuser",
            "name": "New User"
        }, headers=auth_headers_coach)

        assert response.status_code == 403

    def test_public_cannot_create_user(self, client, auth_headers_public):
        response = client.post("/api/users/create", json={
            "username": "newuser",
            "name": "New User"
        }, headers=auth_headers_public)

        assert response.status_code == 403

    def test_create_user_duplicate_username(self, client, auth_headers_admin, livery_user):
        response = client.post("/api/users/create", json={
            "username": "liveryuser",
            "name": "Duplicate"
        }, headers=auth_headers_admin)

        assert response.status_code == 400
        assert "already taken" in response.json()["detail"]


class TestListUsers:
    def test_admin_can_list_users(self, client, auth_headers_admin, all_users):
        response = client.get("/api/users/", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 4  # At least the 4 test users

    def test_livery_cannot_list_users(self, client, auth_headers_livery):
        response = client.get("/api/users/", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_public_cannot_list_users(self, client, auth_headers_public):
        response = client.get("/api/users/", headers=auth_headers_public)
        assert response.status_code == 403


class TestUpdateUserRole:
    def test_admin_updates_user_role(self, client, auth_headers_admin, livery_user):
        response = client.put(
            f"/api/users/{livery_user.id}/role?role=coach",
            headers=auth_headers_admin
        )

        assert response.status_code == 200
        data = response.json()
        assert data["role"] == UserRole.COACH

    def test_admin_cannot_change_own_role(self, client, auth_headers_admin, admin_user):
        response = client.put(
            f"/api/users/{admin_user.id}/role?role=livery",
            headers=auth_headers_admin
        )

        assert response.status_code == 400

    def test_livery_cannot_update_roles(self, client, auth_headers_livery, public_user):
        response = client.put(
            f"/api/users/{public_user.id}/role?role=admin",
            headers=auth_headers_livery
        )

        assert response.status_code == 403


class TestResetPassword:
    def test_admin_resets_user_password(self, client, auth_headers_admin, livery_user):
        response = client.post(f"/api/users/{livery_user.id}/reset-password", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert "temporary_password" in data
        assert len(data["temporary_password"]) >= 8
        assert "message" in data

    def test_admin_cannot_reset_own_password(self, client, auth_headers_admin, admin_user):
        response = client.post(f"/api/users/{admin_user.id}/reset-password", headers=auth_headers_admin)

        assert response.status_code == 400

    def test_livery_cannot_reset_passwords(self, client, auth_headers_livery, public_user):
        response = client.post(f"/api/users/{public_user.id}/reset-password", headers=auth_headers_livery)

        assert response.status_code == 403

    def test_reset_password_sets_must_change_flag(self, client, db, auth_headers_admin, livery_user):
        response = client.post(f"/api/users/{livery_user.id}/reset-password", headers=auth_headers_admin)
        assert response.status_code == 200

        # Refresh user from database
        db.refresh(livery_user)
        assert livery_user.must_change_password == True


class TestToggleUserActive:
    def test_admin_disables_user(self, client, auth_headers_admin, livery_user):
        # Livery user starts active
        assert livery_user.is_active == True

        response = client.put(f"/api/users/{livery_user.id}/toggle-active", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] == False

    def test_admin_enables_disabled_user(self, client, auth_headers_admin, disabled_user):
        assert disabled_user.is_active == False

        response = client.put(f"/api/users/{disabled_user.id}/toggle-active", headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] == True

    def test_admin_cannot_disable_self(self, client, auth_headers_admin, admin_user):
        response = client.put(f"/api/users/{admin_user.id}/toggle-active", headers=auth_headers_admin)

        assert response.status_code == 400

    def test_livery_cannot_toggle_active(self, client, auth_headers_livery, public_user):
        response = client.put(f"/api/users/{public_user.id}/toggle-active", headers=auth_headers_livery)

        assert response.status_code == 403


class TestGetCurrentUser:
    def test_get_current_user_public(self, client, auth_headers_public, public_user):
        response = client.get("/api/users/me", headers=auth_headers_public)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "publicuser"
        assert data["role"] == UserRole.PUBLIC

    def test_get_current_user_livery(self, client, auth_headers_livery, livery_user):
        response = client.get("/api/users/me", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == UserRole.LIVERY

    def test_get_current_user_no_auth(self, client):
        response = client.get("/api/users/me")
        assert response.status_code == 401
