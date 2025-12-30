import pytest


class TestListNotices:
    """Tests for listing notices."""

    def test_list_notices_requires_auth(self, client, notice):
        """Listing notices requires authentication."""
        response = client.get("/api/notices/")
        assert response.status_code == 401

    def test_list_notices_as_livery(self, client, notice, auth_headers_livery):
        """Livery users can list notices."""
        response = client.get("/api/notices/", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        # Response has pinned, notices, and total fields
        assert "notices" in data
        assert "pinned" in data
        # Test notice is not pinned, so it's in notices array
        assert len(data["notices"]) == 1
        assert data["notices"][0]["title"] == "Test Notice"

    def test_list_notices_pinned_first(self, client, notice, pinned_notice, auth_headers_livery):
        """Pinned notices appear in separate pinned array."""
        response = client.get("/api/notices/", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        # Pinned notices are in separate array
        assert len(data["pinned"]) == 1
        assert data["pinned"][0]["is_pinned"] == True
        assert data["pinned"][0]["title"] == "Pinned Notice"
        # Regular notices in notices array
        assert len(data["notices"]) == 1


class TestGetNotice:
    def test_get_notice_success(self, client, notice, auth_headers_livery):
        """Can get a specific notice by ID."""
        response = client.get(f"/api/notices/{notice.id}", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Notice"
        assert data["content"] == "This is a test notice content"

    def test_get_notice_not_found(self, client, auth_headers_livery):
        """Returns 404 for non-existent notice."""
        response = client.get("/api/notices/999", headers=auth_headers_livery)
        assert response.status_code == 404


class TestCreateNotice:
    def test_create_notice_as_admin(self, client, auth_headers_admin):
        """Admin can create notices."""
        response = client.post("/api/notices/", json={
            "title": "New Announcement",
            "content": "This is an important announcement",
            "category": "general",
            "priority": "high",
            "is_pinned": True
        }, headers=auth_headers_admin)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Announcement"
        assert data["priority"] == "high"
        assert data["is_pinned"] == True

    def test_create_notice_as_livery_forbidden(self, client, auth_headers_livery):
        """Livery users cannot create notices (admin only)."""
        response = client.post("/api/notices/", json={
            "title": "Looking for sharer",
            "content": "Looking for someone to share my horse",
            "category": "social"
        }, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_create_notice_no_auth(self, client):
        """Unauthenticated users cannot create notices."""
        response = client.post("/api/notices/", json={
            "title": "Test",
            "content": "Test content"
        })
        assert response.status_code == 401


class TestUpdateNotice:
    def test_update_own_notice_as_livery(self, client, db, livery_user, auth_headers_livery):
        """Livery users can update their own notices."""
        from app.models.notice import Notice, NoticeCategory

        # Create a notice owned by livery user
        own_notice = Notice(
            title="My Notice",
            content="My content",
            category=NoticeCategory.SOCIAL,
            created_by_id=livery_user.id
        )
        db.add(own_notice)
        db.commit()
        db.refresh(own_notice)

        response = client.put(f"/api/notices/{own_notice.id}", json={
            "title": "Updated Title",
            "content": "Updated content"
        }, headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"

    def test_update_others_notice_as_livery_forbidden(self, client, notice, auth_headers_livery):
        """Livery users cannot update others' notices."""
        response = client.put(f"/api/notices/{notice.id}", json={
            "title": "Hacked Title"
        }, headers=auth_headers_livery)
        assert response.status_code == 404  # Returns 404 to hide existence

    def test_update_any_notice_as_admin(self, client, notice, auth_headers_admin):
        """Admin can update any notice."""
        response = client.put(f"/api/notices/{notice.id}", json={
            "title": "Admin Updated",
            "is_pinned": True
        }, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Admin Updated"
        assert data["is_pinned"] == True


class TestDeleteNotice:
    def test_delete_own_notice_as_livery(self, client, db, livery_user, auth_headers_livery):
        """Livery users can delete their own notices."""
        from app.models.notice import Notice, NoticeCategory

        # Create a notice owned by livery user
        own_notice = Notice(
            title="My Notice",
            content="My content",
            category=NoticeCategory.SOCIAL,
            created_by_id=livery_user.id
        )
        db.add(own_notice)
        db.commit()
        db.refresh(own_notice)

        response = client.delete(f"/api/notices/{own_notice.id}", headers=auth_headers_livery)
        assert response.status_code == 204

    def test_delete_others_notice_as_livery_forbidden(self, client, notice, auth_headers_livery):
        """Livery users cannot delete others' notices."""
        response = client.delete(f"/api/notices/{notice.id}", headers=auth_headers_livery)
        assert response.status_code == 404  # Returns 404 to hide existence

    def test_delete_any_notice_as_admin(self, client, notice, auth_headers_admin):
        """Admin can delete any notice."""
        response = client.delete(f"/api/notices/{notice.id}", headers=auth_headers_admin)
        assert response.status_code == 204

        # Verify deleted
        response = client.get(f"/api/notices/{notice.id}", headers=auth_headers_admin)
        assert response.status_code == 404
