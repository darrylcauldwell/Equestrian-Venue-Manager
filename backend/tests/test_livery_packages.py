import pytest


class TestListLiveryPackages:
    def test_list_packages_no_auth(self, client, livery_package):
        """Public can list active livery packages."""
        response = client.get("/api/livery-packages/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Full Livery"
        # Verify features are parsed from JSON
        assert isinstance(data[0]["features"], list)
        assert "Daily turnout" in data[0]["features"]

    def test_list_packages_excludes_inactive(self, client, livery_package, inactive_livery_package):
        """Inactive packages are excluded by default."""
        response = client.get("/api/livery-packages/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Full Livery"

    def test_list_all_packages_includes_inactive(self, client, livery_package, inactive_livery_package):
        """Can include inactive packages with query param."""
        response = client.get("/api/livery-packages/?active_only=false")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestGetLiveryPackage:
    def test_get_package_success(self, client, livery_package):
        """Can get a specific package by ID."""
        response = client.get(f"/api/livery-packages/{livery_package.id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Full Livery"
        assert data["price_display"] == "£165/week"
        assert data["is_featured"] == True

    def test_get_package_not_found(self, client):
        """Returns 404 for non-existent package."""
        response = client.get("/api/livery-packages/999")
        assert response.status_code == 404


class TestCreateLiveryPackage:
    def test_create_package_as_admin(self, client, auth_headers_admin):
        """Admin can create packages."""
        response = client.post("/api/livery-packages/", json={
            "name": "Part Livery",
            "price_display": "£120/week",
            "monthly_price": 520.00,
            "description": "Part care package",
            "features": ["Daily check", "Feeding once daily"],
            "is_featured": False,
            "display_order": 2
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Part Livery"
        assert data["is_active"] == True
        assert len(data["features"]) == 2

    def test_create_package_as_livery_forbidden(self, client, auth_headers_livery):
        """Livery users cannot create packages."""
        response = client.post("/api/livery-packages/", json={
            "name": "Test Package",
            "price_display": "£100/week"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_create_package_as_coach_forbidden(self, client, auth_headers_coach):
        """Coaches cannot create packages."""
        response = client.post("/api/livery-packages/", json={
            "name": "Test Package",
            "price_display": "£100/week"
        }, headers=auth_headers_coach)
        assert response.status_code == 403

    def test_create_package_no_auth(self, client):
        """Unauthenticated users cannot create packages."""
        response = client.post("/api/livery-packages/", json={
            "name": "Test Package",
            "price_display": "£100/week"
        })
        assert response.status_code == 401


class TestUpdateLiveryPackage:
    def test_update_package_as_admin(self, client, livery_package, auth_headers_admin):
        """Admin can update packages."""
        response = client.put(f"/api/livery-packages/{livery_package.id}", json={
            "name": "Premium Full Livery",
            "price_display": "£180/week",
            "is_active": False
        }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Premium Full Livery"
        assert data["price_display"] == "£180/week"
        assert data["is_active"] == False

    def test_update_package_as_livery_forbidden(self, client, livery_package, auth_headers_livery):
        """Livery users cannot update packages."""
        response = client.put(f"/api/livery-packages/{livery_package.id}", json={
            "name": "Updated Package"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_update_nonexistent_package(self, client, auth_headers_admin):
        """Returns 404 for non-existent package."""
        response = client.put("/api/livery-packages/999", json={
            "name": "Updated Package"
        }, headers=auth_headers_admin)
        assert response.status_code == 404


class TestDeleteLiveryPackage:
    def test_delete_package_as_admin(self, client, livery_package, auth_headers_admin):
        """Admin can delete packages."""
        response = client.delete(f"/api/livery-packages/{livery_package.id}", headers=auth_headers_admin)
        assert response.status_code == 204

        # Verify deleted
        response = client.get(f"/api/livery-packages/{livery_package.id}")
        assert response.status_code == 404

    def test_delete_package_as_livery_forbidden(self, client, livery_package, auth_headers_livery):
        """Livery users cannot delete packages."""
        response = client.delete(f"/api/livery-packages/{livery_package.id}", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_delete_nonexistent_package(self, client, auth_headers_admin):
        """Returns 404 for non-existent package."""
        response = client.delete("/api/livery-packages/999", headers=auth_headers_admin)
        assert response.status_code == 404
