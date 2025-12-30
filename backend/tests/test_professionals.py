import pytest


class TestListProfessionals:
    """Tests for listing professionals."""

    def test_list_professionals_requires_auth(self, client, professional):
        """Listing professionals requires authentication."""
        response = client.get("/api/professionals/")
        assert response.status_code == 401

    def test_list_professionals_as_livery(self, client, professional, auth_headers_livery):
        """Livery users can list active professionals."""
        response = client.get("/api/professionals/", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        # Response has professionals array and categories
        assert "professionals" in data
        assert len(data["professionals"]) == 1
        assert data["professionals"][0]["business_name"] == "Smith Farrier Services"

    def test_list_professionals_excludes_inactive(self, client, professional, inactive_professional, auth_headers_livery):
        """Inactive professionals are excluded by default."""
        response = client.get("/api/professionals/", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert len(data["professionals"]) == 1

    def test_list_all_professionals_as_admin(self, client, professional, inactive_professional, auth_headers_admin):
        """Admin can list all professionals including inactive."""
        response = client.get("/api/professionals/admin/all?include_inactive=true", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    def test_list_professionals_filter_by_category(self, client, professional, auth_headers_livery, db):
        """Can filter professionals by category."""
        from app.models.professional import Professional, ProfessionalCategory

        # Create a vet
        vet = Professional(
            category=ProfessionalCategory.VET,
            business_name="Valley Vets",
            is_active=True
        )
        db.add(vet)
        db.commit()

        response = client.get("/api/professionals/?category=farrier", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert len(data["professionals"]) == 1
        assert data["professionals"][0]["category"] == "farrier"


class TestGetProfessional:
    def test_get_professional_success(self, client, professional, auth_headers_livery):
        """Can get a specific professional by ID."""
        response = client.get(f"/api/professionals/{professional.id}", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert data["business_name"] == "Smith Farrier Services"
        assert data["yard_recommended"] == True

    def test_get_professional_not_found(self, client, auth_headers_livery):
        """Returns 404 for non-existent professional."""
        response = client.get("/api/professionals/999", headers=auth_headers_livery)
        assert response.status_code == 404


class TestCreateProfessional:
    def test_create_professional_as_admin(self, client, auth_headers_admin):
        """Admin can create professionals."""
        response = client.post("/api/professionals/", json={
            "category": "vet",
            "business_name": "Valley Veterinary Practice",
            "contact_name": "Dr. Jane Doe",
            "phone": "01234 555123",
            "email": "info@valleyvets.com",
            "coverage_area": "30 mile radius",
            "yard_recommended": True
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["business_name"] == "Valley Veterinary Practice"

    def test_create_professional_as_livery_forbidden(self, client, auth_headers_livery):
        """Livery users cannot create professionals."""
        response = client.post("/api/professionals/", json={
            "category": "farrier",
            "business_name": "Test Farrier"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_create_professional_no_auth(self, client):
        """Unauthenticated users cannot create professionals."""
        response = client.post("/api/professionals/", json={
            "category": "farrier",
            "business_name": "Test Farrier"
        })
        assert response.status_code == 401


class TestUpdateProfessional:
    def test_update_professional_as_admin(self, client, professional, auth_headers_admin):
        """Admin can update professionals."""
        response = client.put(f"/api/professionals/{professional.id}", json={
            "business_name": "Smith & Sons Farrier Services",
            "yard_recommended": False,
            "is_active": False
        }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["business_name"] == "Smith & Sons Farrier Services"
        assert data["yard_recommended"] == False
        assert data["is_active"] == False

    def test_update_professional_as_livery_forbidden(self, client, professional, auth_headers_livery):
        """Livery users cannot update professionals."""
        response = client.put(f"/api/professionals/{professional.id}", json={
            "business_name": "Updated Name"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_update_nonexistent_professional(self, client, auth_headers_admin):
        """Returns 404 for non-existent professional."""
        response = client.put("/api/professionals/999", json={
            "business_name": "Updated Name"
        }, headers=auth_headers_admin)
        assert response.status_code == 404


class TestDeleteProfessional:
    def test_delete_professional_soft_delete(self, client, professional, auth_headers_admin):
        """Admin soft-deletes professionals (sets is_active=False)."""
        response = client.delete(f"/api/professionals/{professional.id}", headers=auth_headers_admin)
        assert response.status_code == 204

        # Verify soft deleted (not in active list)
        response = client.get("/api/professionals/", headers=auth_headers_admin)
        assert len(response.json()["professionals"]) == 0

        # But still in all list
        response = client.get("/api/professionals/admin/all?include_inactive=true", headers=auth_headers_admin)
        data = response.json()
        assert len(data) == 1
        assert data[0]["is_active"] == False

    def test_delete_professional_as_livery_forbidden(self, client, professional, auth_headers_livery):
        """Livery users cannot delete professionals."""
        response = client.delete(f"/api/professionals/{professional.id}", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_delete_nonexistent_professional(self, client, auth_headers_admin):
        """Returns 404 for non-existent professional."""
        response = client.delete("/api/professionals/999", headers=auth_headers_admin)
        assert response.status_code == 404
