import pytest


class TestListHorses:
    def test_list_own_horses(self, client, horse, auth_headers_livery):
        response = client.get("/api/horses/", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Thunder"

    def test_list_horses_empty(self, client, auth_headers_public):
        response = client.get("/api/horses/", headers=auth_headers_public)
        assert response.status_code == 200
        assert len(response.json()) == 0

    def test_list_horses_no_auth(self, client):
        response = client.get("/api/horses/")
        assert response.status_code == 401


class TestCreateHorse:
    def test_create_horse(self, client, auth_headers_livery):
        response = client.post("/api/horses/", json={
            "name": "Lightning",
            "colour": "White",
            "birth_year": 2018
        }, headers=auth_headers_livery)

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Lightning"
        assert data["colour"] == "White"
        assert data["birth_year"] == 2018

    def test_create_horse_minimal(self, client, auth_headers_livery):
        response = client.post("/api/horses/", json={
            "name": "Storm"
        }, headers=auth_headers_livery)

        assert response.status_code == 201
        assert response.json()["name"] == "Storm"

    def test_create_horse_no_auth(self, client):
        response = client.post("/api/horses/", json={
            "name": "Storm"
        })
        assert response.status_code == 401


class TestGetHorse:
    def test_get_own_horse(self, client, horse, auth_headers_livery):
        response = client.get(f"/api/horses/{horse.id}", headers=auth_headers_livery)
        assert response.status_code == 200
        assert response.json()["name"] == "Thunder"

    def test_get_others_horse_not_found(self, client, horse, auth_headers_public):
        response = client.get(f"/api/horses/{horse.id}", headers=auth_headers_public)
        assert response.status_code == 404


class TestUpdateHorse:
    def test_update_own_horse(self, client, horse, auth_headers_livery):
        response = client.put(f"/api/horses/{horse.id}", json={
            "name": "Thunder II",
            "colour": "Dark Brown"
        }, headers=auth_headers_livery)

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Thunder II"
        assert data["colour"] == "Dark Brown"

    def test_update_others_horse_not_found(self, client, horse, auth_headers_public):
        response = client.put(f"/api/horses/{horse.id}", json={
            "name": "Stolen Horse"
        }, headers=auth_headers_public)
        assert response.status_code == 404


class TestDeleteHorse:
    def test_delete_own_horse(self, client, horse, auth_headers_livery):
        response = client.delete(f"/api/horses/{horse.id}", headers=auth_headers_livery)
        assert response.status_code == 204

    def test_delete_others_horse_not_found(self, client, horse, auth_headers_public):
        response = client.delete(f"/api/horses/{horse.id}", headers=auth_headers_public)
        assert response.status_code == 404
