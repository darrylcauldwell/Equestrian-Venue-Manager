import pytest


class TestListArenas:
    def test_list_arenas_no_auth(self, client, arena):
        response = client.get("/api/arenas/")
        assert response.status_code == 200
        data = response.json()
        # Check that the created arena is in the list
        assert len(data) >= 1
        arena_names = [a["name"] for a in data]
        assert "Indoor Arena" in arena_names

    def test_list_arenas_excludes_inactive(self, client, db, arena):
        arena.is_active = False
        db.commit()

        response = client.get("/api/arenas/")
        assert response.status_code == 200
        # Check that the inactive arena is not in the list
        data = response.json()
        arena_ids = [a["id"] for a in data]
        assert arena.id not in arena_ids

    def test_list_all_arenas_includes_inactive(self, client, db, arena, auth_headers_admin):
        arena.is_active = False
        db.commit()

        response = client.get("/api/arenas/all", headers=auth_headers_admin)
        assert response.status_code == 200
        # Check that the inactive arena IS in the all list
        data = response.json()
        arena_ids = [a["id"] for a in data]
        assert arena.id in arena_ids


class TestGetArena:
    def test_get_arena_success(self, client, arena):
        response = client.get(f"/api/arenas/{arena.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Indoor Arena"

    def test_get_arena_not_found(self, client):
        response = client.get("/api/arenas/999")
        assert response.status_code == 404


class TestCreateArena:
    def test_create_arena_as_admin(self, client, auth_headers_admin):
        response = client.post("/api/arenas/", json={
            "name": "Outdoor Arena",
            "description": "Large outdoor arena",
            "size": "60x40",
            "surface_type": "grass"
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Outdoor Arena"
        assert data["is_active"] == True

    def test_create_arena_as_public_forbidden(self, client, auth_headers_public):
        response = client.post("/api/arenas/", json={
            "name": "Outdoor Arena"
        }, headers=auth_headers_public)
        assert response.status_code == 403

    def test_create_arena_as_livery_forbidden(self, client, auth_headers_livery):
        response = client.post("/api/arenas/", json={
            "name": "Outdoor Arena"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_create_arena_as_coach_forbidden(self, client, auth_headers_coach):
        response = client.post("/api/arenas/", json={
            "name": "Outdoor Arena"
        }, headers=auth_headers_coach)
        assert response.status_code == 403

    def test_create_arena_no_auth(self, client):
        response = client.post("/api/arenas/", json={
            "name": "Outdoor Arena"
        })
        assert response.status_code == 401


class TestUpdateArena:
    def test_update_arena_as_admin(self, client, arena, auth_headers_admin):
        response = client.put(f"/api/arenas/{arena.id}", json={
            "name": "Updated Arena",
            "is_active": False
        }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Arena"
        assert data["is_active"] == False

    def test_update_arena_as_public_forbidden(self, client, arena, auth_headers_public):
        response = client.put(f"/api/arenas/{arena.id}", json={
            "name": "Updated Arena"
        }, headers=auth_headers_public)
        assert response.status_code == 403

    def test_update_arena_as_livery_forbidden(self, client, arena, auth_headers_livery):
        response = client.put(f"/api/arenas/{arena.id}", json={
            "name": "Updated Arena"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_update_nonexistent_arena(self, client, auth_headers_admin):
        response = client.put("/api/arenas/999", json={
            "name": "Updated Arena"
        }, headers=auth_headers_admin)
        assert response.status_code == 404
