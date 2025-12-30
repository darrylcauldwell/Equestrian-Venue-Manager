import pytest
from app.models.user import UserRole


class TestRegistration:
    def test_register_success(self, client):
        response = client.post("/api/auth/register", json={
            "username": "newuser",
            "email": "newuser@example.com",
            "name": "New User",
            "password": "password123"
        })
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newuser"
        assert data["email"] == "newuser@example.com"
        assert data["name"] == "New User"
        assert data["role"] == UserRole.PUBLIC

    def test_register_duplicate_username(self, client, public_user):
        response = client.post("/api/auth/register", json={
            "username": "publicuser",
            "email": "another@example.com",
            "name": "Another User",
            "password": "password123"
        })
        assert response.status_code == 400
        assert "already taken" in response.json()["detail"]

    def test_register_duplicate_email(self, client, public_user):
        response = client.post("/api/auth/register", json={
            "username": "anotheruser",
            "email": "public@example.com",
            "name": "Another User",
            "password": "password123"
        })
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_register_invalid_email(self, client):
        response = client.post("/api/auth/register", json={
            "username": "baduser",
            "email": "notanemail",
            "name": "User",
            "password": "password123"
        })
        assert response.status_code == 422


class TestLogin:
    def test_login_success(self, client, public_user):
        response = client.post("/api/auth/login", data={
            "username": "publicuser",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["must_change_password"] == False

    def test_login_wrong_password(self, client, public_user):
        response = client.post("/api/auth/login", data={
            "username": "publicuser",
            "password": "wrongpassword"
        })
        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        response = client.post("/api/auth/login", data={
            "username": "nobody",
            "password": "password123"
        })
        assert response.status_code == 401

    def test_login_disabled_user(self, client, disabled_user):
        response = client.post("/api/auth/login", data={
            "username": "disableduser",
            "password": "password123"
        })
        assert response.status_code == 403
        assert "disabled" in response.json()["detail"].lower()

    def test_login_must_change_password_flag(self, client, must_change_password_user):
        response = client.post("/api/auth/login", data={
            "username": "newuser",
            "password": "temppass123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["must_change_password"] == True


class TestTokenRefresh:
    def test_refresh_token_success(self, client, public_user):
        login_response = client.post("/api/auth/login", data={
            "username": "publicuser",
            "password": "password123"
        })
        refresh_token = login_response.json()["refresh_token"]

        response = client.post("/api/auth/refresh", params={
            "refresh_token": refresh_token
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_refresh_with_access_token_fails(self, client, public_user):
        login_response = client.post("/api/auth/login", data={
            "username": "publicuser",
            "password": "password123"
        })
        access_token = login_response.json()["access_token"]

        response = client.post("/api/auth/refresh", params={
            "refresh_token": access_token
        })
        assert response.status_code == 401


class TestChangePassword:
    def test_change_password_success(self, client, must_change_password_user):
        # Login first
        login_response = client.post("/api/auth/login", data={
            "username": "newuser",
            "password": "temppass123"
        })
        token = login_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Change password
        response = client.post("/api/auth/change-password", json={
            "current_password": "temppass123",
            "new_password": "newpassword123"
        }, headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert data["must_change_password"] == False

    def test_change_password_wrong_current(self, client, auth_headers_public):
        response = client.post("/api/auth/change-password", json={
            "current_password": "wrongpassword",
            "new_password": "newpassword123"
        }, headers=auth_headers_public)

        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()

    def test_change_password_too_short(self, client, auth_headers_public):
        response = client.post("/api/auth/change-password", json={
            "current_password": "password123",
            "new_password": "short"
        }, headers=auth_headers_public)

        assert response.status_code == 400
        assert "8 characters" in response.json()["detail"]
