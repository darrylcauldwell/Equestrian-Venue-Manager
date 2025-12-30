import pytest


class TestStableBlocks:
    """Tests for stable block endpoints."""

    def test_list_blocks_requires_auth(self, client, stable_block):
        """Listing blocks requires authentication."""
        response = client.get("/api/stables/blocks")
        assert response.status_code == 401

    def test_list_blocks_as_livery(self, client, stable_block, auth_headers_livery):
        """Livery users can list blocks."""
        response = client.get("/api/stables/blocks", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Front Block"

    def test_get_block_with_stables(self, client, stable, auth_headers_livery):
        """Can get a block with its stables."""
        response = client.get(f"/api/stables/blocks/{stable.block_id}", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Front Block"
        assert len(data["stables"]) == 1

    def test_get_block_not_found(self, client, auth_headers_livery):
        """Returns 404 for non-existent block."""
        response = client.get("/api/stables/blocks/999", headers=auth_headers_livery)
        assert response.status_code == 404

    def test_create_block_as_admin(self, client, auth_headers_admin):
        """Admin can create blocks."""
        response = client.post("/api/stables/blocks", json={
            "name": "Brown Block",
            "sequence": 2
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Brown Block"
        assert data["is_active"] == True

    def test_create_block_as_livery_forbidden(self, client, auth_headers_livery):
        """Livery users cannot create blocks."""
        response = client.post("/api/stables/blocks", json={
            "name": "New Block"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_update_block_as_admin(self, client, stable_block, auth_headers_admin):
        """Admin can update blocks."""
        response = client.put(f"/api/stables/blocks/{stable_block.id}", json={
            "name": "Updated Block Name",
            "is_active": False
        }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Block Name"
        assert data["is_active"] == False

    def test_delete_empty_block_as_admin(self, client, stable_block, auth_headers_admin):
        """Admin can delete empty blocks."""
        response = client.delete(f"/api/stables/blocks/{stable_block.id}", headers=auth_headers_admin)
        assert response.status_code == 204

    def test_delete_block_with_stables_fails(self, client, stable, auth_headers_admin):
        """Cannot delete block that has stables."""
        response = client.delete(f"/api/stables/blocks/{stable.block_id}", headers=auth_headers_admin)
        assert response.status_code == 400
        assert "stable" in response.json()["detail"].lower()


class TestStables:
    """Tests for individual stable endpoints."""

    def test_list_stables_requires_auth(self, client, stable):
        """Listing stables requires authentication."""
        response = client.get("/api/stables/")
        assert response.status_code == 401

    def test_list_stables_as_livery(self, client, stable, auth_headers_livery):
        """Livery users can list stables."""
        response = client.get("/api/stables/", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Front Block 1"
        assert "horse_count" in data[0]

    def test_list_stables_filter_by_block(self, client, stable, auth_headers_livery, db):
        """Can filter stables by block ID."""
        from app.models.stable import Stable, StableBlock

        # Create another block with stable
        other_block = StableBlock(name="Other Block", sequence=2)
        db.add(other_block)
        db.flush()
        other_stable = Stable(name="Other Block 1", block_id=other_block.id, number=1)
        db.add(other_stable)
        db.commit()

        response = client.get(f"/api/stables/?block_id={stable.block_id}", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["name"] == "Front Block 1"

    def test_get_stable(self, client, stable, auth_headers_livery):
        """Can get a specific stable."""
        response = client.get(f"/api/stables/{stable.id}", headers=auth_headers_livery)
        assert response.status_code == 200
        assert response.json()["name"] == "Front Block 1"

    def test_create_stable_as_admin(self, client, stable_block, auth_headers_admin):
        """Admin can create stables."""
        response = client.post("/api/stables/", json={
            "name": "Front Block 2",
            "block_id": stable_block.id,
            "number": 2,
            "sequence": 2
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Front Block 2"
        assert data["number"] == 2

    def test_create_stable_as_livery_forbidden(self, client, stable_block, auth_headers_livery):
        """Livery users cannot create stables."""
        response = client.post("/api/stables/", json={
            "name": "New Stable",
            "block_id": stable_block.id
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_update_stable_as_admin(self, client, stable, auth_headers_admin):
        """Admin can update stables."""
        response = client.put(f"/api/stables/{stable.id}", json={
            "name": "Renamed Stable",
            "is_active": False
        }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Renamed Stable"
        assert data["is_active"] == False

    def test_delete_empty_stable_as_admin(self, client, stable, auth_headers_admin):
        """Admin can delete stables without horses."""
        response = client.delete(f"/api/stables/{stable.id}", headers=auth_headers_admin)
        assert response.status_code == 204

    def test_delete_stable_with_horses_fails(self, client, stable, horse, db, auth_headers_admin):
        """Cannot delete stable that has horses assigned."""
        # Assign horse to stable
        horse.stable_id = stable.id
        db.commit()

        response = client.delete(f"/api/stables/{stable.id}", headers=auth_headers_admin)
        assert response.status_code == 400
        assert "horse" in response.json()["detail"].lower()


class TestHorseAssignment:
    """Tests for horse-to-stable assignment endpoints."""

    def test_assign_horse_to_stable(self, client, stable, horse, auth_headers_admin):
        """Admin can assign horses to stables."""
        response = client.put(
            f"/api/stables/{stable.id}/assign/{horse.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert "assigned" in response.json()["message"].lower()

    def test_assign_horse_as_livery_forbidden(self, client, stable, horse, auth_headers_livery):
        """Livery users cannot assign horses."""
        response = client.put(
            f"/api/stables/{stable.id}/assign/{horse.id}",
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_unassign_horse_from_stable(self, client, stable, horse, db, auth_headers_admin):
        """Admin can unassign horses from stables."""
        # First assign the horse
        horse.stable_id = stable.id
        db.commit()

        response = client.delete(
            f"/api/stables/{stable.id}/unassign/{horse.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert "removed" in response.json()["message"].lower()

    def test_unassign_horse_not_in_stable(self, client, stable, horse, auth_headers_admin):
        """Returns 404 when horse is not in the specified stable."""
        response = client.delete(
            f"/api/stables/{stable.id}/unassign/{horse.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 404
