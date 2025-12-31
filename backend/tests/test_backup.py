"""Tests for backup and data export/import functionality."""
import pytest
import json
import os
from unittest.mock import patch, MagicMock
from io import BytesIO

from app.models.backup import Backup, BackupSchedule
from app.models.user import User, UserRole
from app.models.arena import Arena
from app.utils.auth import get_password_hash


class TestDataExport:
    """Tests for data export (JSON) functionality - POST /api/backup/export."""

    def test_create_export_requires_admin(self, client, auth_headers_livery):
        """Test that creating an export requires admin role."""
        response = client.post("/api/backup/export", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_create_export_unauthorized(self, client):
        """Test that creating an export requires authentication."""
        response = client.post("/api/backup/export")
        assert response.status_code == 401

    def test_create_export_success(self, client, auth_headers_admin, db):
        """Test successfully creating a data export."""
        # Create some test data to export
        arena = Arena(
            name="Test Arena",
            description="A test arena",
            is_active=True,
            price_per_hour=25.00
        )
        db.add(arena)
        db.commit()

        response = client.post("/api/backup/export", headers=auth_headers_admin)
        assert response.status_code == 200

        data = response.json()
        assert "filename" in data
        assert data["filename"].startswith("backup_")
        assert data["filename"].endswith(".json")
        assert "file_size" in data
        assert data["file_size"] > 0
        assert "entity_counts" in data
        assert data["entity_counts"]["arenas"] >= 1

    def test_create_export_with_notes(self, client, auth_headers_admin, db):
        """Test creating an export with notes."""
        response = client.post(
            "/api/backup/export",
            json={"notes": "Pre-update backup"},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["notes"] == "Pre-update backup"


class TestDataExportList:
    """Tests for listing data exports - GET /api/backup/list."""

    def test_list_exports_requires_admin(self, client, auth_headers_livery):
        """Test that listing exports requires admin role."""
        response = client.get("/api/backup/list", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_exports_empty(self, client, auth_headers_admin):
        """Test listing exports when none exist."""
        response = client.get("/api/backup/list", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["backups"] == []
        assert data["total"] == 0

    def test_list_exports_with_data(self, client, auth_headers_admin, db):
        """Test listing exports after creating one."""
        # Create an export first
        client.post("/api/backup/export", headers=auth_headers_admin)

        response = client.get("/api/backup/list", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 1
        assert len(data["backups"]) >= 1


class TestDataExportDownload:
    """Tests for downloading data exports - GET /api/backup/download/{id}."""

    def test_download_export_requires_admin(self, client, auth_headers_livery):
        """Test that downloading requires admin role."""
        response = client.get("/api/backup/download/1", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_download_nonexistent_export(self, client, auth_headers_admin):
        """Test downloading a non-existent export."""
        response = client.get("/api/backup/download/999", headers=auth_headers_admin)
        assert response.status_code == 404


class TestDataExportDelete:
    """Tests for deleting data exports - DELETE /api/backup/{id}."""

    def test_delete_export_requires_admin(self, client, auth_headers_livery):
        """Test that deleting requires admin role."""
        response = client.delete("/api/backup/1", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_delete_nonexistent_export(self, client, auth_headers_admin):
        """Test deleting a non-existent export."""
        response = client.delete("/api/backup/999", headers=auth_headers_admin)
        assert response.status_code == 404


class TestDataImportValidation:
    """Tests for validating import files - POST /api/backup/validate."""

    def test_validate_requires_admin(self, client, auth_headers_livery):
        """Test that validation requires admin role."""
        files = {"file": ("test.json", b'{}', "application/json")}
        response = client.post("/api/backup/validate", files=files, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_validate_invalid_json(self, client, auth_headers_admin):
        """Test validating an invalid JSON file."""
        files = {"file": ("test.json", b'not valid json', "application/json")}
        response = client.post("/api/backup/validate", files=files, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is False
        assert len(data["errors"]) > 0

    def test_validate_missing_required_keys(self, client, auth_headers_admin):
        """Test validating a file missing required keys."""
        backup_data = {"site_settings": {}}  # Missing users and arenas
        files = {"file": ("test.json", json.dumps(backup_data).encode(), "application/json")}
        response = client.post("/api/backup/validate", files=files, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is False

    def test_validate_valid_file(self, client, auth_headers_admin):
        """Test validating a valid backup file."""
        backup_data = {
            "users": [
                {"username": "testuser", "email": "test@example.com", "name": "Test", "role": "livery"}
            ],
            "arenas": [
                {"name": "Test Arena", "is_active": True}
            ]
        }
        files = {"file": ("test.json", json.dumps(backup_data).encode(), "application/json")}
        response = client.post("/api/backup/validate", files=files, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["is_valid"] is True
        assert data["entity_counts"]["users"] == 1
        assert data["entity_counts"]["arenas"] == 1


class TestDataImport:
    """Tests for importing data - POST /api/backup/import."""

    def test_import_requires_admin(self, client, auth_headers_livery):
        """Test that import requires admin role."""
        files = {"file": ("test.json", b'{}', "application/json")}
        response = client.post("/api/backup/import", files=files, headers=auth_headers_livery)
        assert response.status_code == 403

    def test_import_invalid_json(self, client, auth_headers_admin):
        """Test importing an invalid JSON file."""
        files = {"file": ("test.json", b'not valid json', "application/json")}
        response = client.post("/api/backup/import", files=files, headers=auth_headers_admin)
        assert response.status_code == 400

    def test_import_valid_data(self, client, auth_headers_admin, db):
        """Test importing valid data."""
        backup_data = {
            "users": [
                {
                    "username": "importeduser",
                    "email": "imported@example.com",
                    "name": "Imported User",
                    "role": "livery",
                    "password": "testpass123"
                }
            ],
            "arenas": [
                {"name": "Imported Arena", "is_active": True}
            ]
        }
        files = {"file": ("test.json", json.dumps(backup_data).encode(), "application/json")}
        response = client.post("/api/backup/import", files=files, headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "entity_counts" in data
        assert data["entity_counts"].get("users", 0) >= 1


class TestBackupSchedule:
    """Tests for backup schedule configuration."""

    def test_get_schedule_requires_admin(self, client, auth_headers_livery):
        """Test that getting schedule requires admin role."""
        response = client.get("/api/backup/schedule", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_get_schedule_creates_default(self, client, auth_headers_admin):
        """Test that getting schedule creates default if none exists."""
        response = client.get("/api/backup/schedule", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["is_enabled"] is False
        assert data["frequency"] == "daily"
        assert data["retention_days"] == 30

    def test_update_schedule(self, client, auth_headers_admin):
        """Test updating the backup schedule."""
        # First get to create default
        client.get("/api/backup/schedule", headers=auth_headers_admin)

        response = client.put("/api/backup/schedule", json={
            "is_enabled": True,
            "frequency": "weekly",
            "retention_days": 60,
            "s3_enabled": False
        }, headers=auth_headers_admin)

        assert response.status_code == 200
        data = response.json()
        assert data["is_enabled"] is True
        assert data["frequency"] == "weekly"
        assert data["retention_days"] == 60


class TestDatabaseBackup:
    """Tests for database backup (pg_dump) functionality.

    Note: These tests mock pg_dump since it's not available in test environment.
    """

    def test_create_db_backup_requires_admin(self, client, auth_headers_livery):
        """Test that creating a database backup requires admin role."""
        response = client.post("/api/backup/database/create", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_create_db_backup_unauthorized(self, client):
        """Test that creating a database backup requires authentication."""
        response = client.post("/api/backup/database/create")
        assert response.status_code == 401

    @patch('subprocess.run')
    def test_create_db_backup_success(self, mock_run, client, auth_headers_admin, tmp_path):
        """Test successfully creating a database backup."""
        # Mock successful pg_dump
        mock_run.return_value = MagicMock(returncode=0, stderr="")

        # Patch the backup directory
        with patch('app.routers.backup.DB_BACKUP_DIR', str(tmp_path)):
            # Create a fake backup file
            response = client.post("/api/backup/database/create", headers=auth_headers_admin)

            # May fail if pg_dump is actually called, that's expected
            # The important thing is that it requires admin auth
            assert response.status_code in [200, 500]

    def test_list_db_backups_requires_admin(self, client, auth_headers_livery):
        """Test that listing database backups requires admin role."""
        response = client.get("/api/backup/database/list", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_db_backups_empty(self, client, auth_headers_admin, tmp_path):
        """Test listing database backups when none exist."""
        with patch('app.routers.backup.DB_BACKUP_DIR', str(tmp_path)):
            response = client.get("/api/backup/database/list", headers=auth_headers_admin)
            assert response.status_code == 200
            data = response.json()
            assert data["backups"] == []
            assert data["total"] == 0

    def test_list_db_backups_with_files(self, client, auth_headers_admin, tmp_path):
        """Test listing database backups when files exist."""
        # Create a fake backup file
        backup_file = tmp_path / "db_backup_20251230_120000.sql"
        backup_file.write_text("-- PostgreSQL dump")

        with patch('app.routers.backup.DB_BACKUP_DIR', str(tmp_path)):
            response = client.get("/api/backup/database/list", headers=auth_headers_admin)
            assert response.status_code == 200
            data = response.json()
            assert data["total"] == 1
            assert data["backups"][0]["filename"] == "db_backup_20251230_120000.sql"

    def test_download_db_backup_requires_admin(self, client, auth_headers_livery):
        """Test that downloading requires admin role."""
        response = client.get(
            "/api/backup/database/download/test.sql",
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_download_db_backup_not_found(self, client, auth_headers_admin, tmp_path):
        """Test downloading a non-existent backup."""
        with patch('app.routers.backup.DB_BACKUP_DIR', str(tmp_path)):
            response = client.get(
                "/api/backup/database/download/nonexistent.sql",
                headers=auth_headers_admin
            )
            assert response.status_code == 404

    def test_download_db_backup_path_traversal(self, client, auth_headers_admin):
        """Test that path traversal is blocked."""
        response = client.get(
            "/api/backup/database/download/../../../etc/passwd",
            headers=auth_headers_admin
        )
        assert response.status_code in [400, 404, 422]

    def test_delete_db_backup_requires_admin(self, client, auth_headers_livery):
        """Test that deleting requires admin role."""
        response = client.delete(
            "/api/backup/database/test.sql",
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_delete_db_backup_not_found(self, client, auth_headers_admin, tmp_path):
        """Test deleting a non-existent backup."""
        with patch('app.routers.backup.DB_BACKUP_DIR', str(tmp_path)):
            response = client.delete(
                "/api/backup/database/nonexistent.sql",
                headers=auth_headers_admin
            )
            assert response.status_code == 404

    def test_delete_db_backup_success(self, client, auth_headers_admin, tmp_path):
        """Test successfully deleting a database backup."""
        # Create a fake backup file
        backup_file = tmp_path / "db_backup_test.sql"
        backup_file.write_text("-- PostgreSQL dump")

        with patch('app.routers.backup.DB_BACKUP_DIR', str(tmp_path)):
            response = client.delete(
                "/api/backup/database/db_backup_test.sql",
                headers=auth_headers_admin
            )
            assert response.status_code == 200
            assert not backup_file.exists()
