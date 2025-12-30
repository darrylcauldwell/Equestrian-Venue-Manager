import pytest
from datetime import datetime

from app.models.contract import ContractTemplate, ContractVersion, ContractSignature, ContractType, SignatureStatus


class TestContractTemplates:
    """Tests for contract template management."""

    def test_create_template_admin(self, client, auth_headers_admin):
        """Admin can create a contract template."""
        response = client.post(
            "/api/contracts/templates",
            json={
                "name": "Standard Livery Agreement",
                "contract_type": "livery",
                "description": "Standard livery contract for all clients",
                "html_content": "<h1>Standard Livery Agreement</h1><p>Terms and conditions...</p>"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Standard Livery Agreement"
        assert data["contract_type"] == "livery"
        assert data["is_active"] is True

    def test_create_template_non_admin_forbidden(self, client, auth_headers_livery):
        """Non-admin users cannot create templates."""
        response = client.post(
            "/api/contracts/templates",
            json={
                "name": "Unauthorized Template",
                "contract_type": "livery",
                "html_content": "<p>Content</p>"
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 403

    def test_list_templates_admin(self, client, auth_headers_admin, db, admin_user):
        """Admin can list all templates."""
        # Create a template first
        template = ContractTemplate(
            name="Test Template",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()

        response = client.get("/api/contracts/templates", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(t["name"] == "Test Template" for t in data)

    def test_get_template_detail(self, client, auth_headers_admin, db, admin_user):
        """Admin can get template details."""
        template = ContractTemplate(
            name="Detail Test Template",
            contract_type=ContractType.EMPLOYMENT,
            description="Employment contract template",
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        response = client.get(f"/api/contracts/templates/{template.id}", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Detail Test Template"
        assert data["contract_type"] == "employment"

    def test_update_template(self, client, auth_headers_admin, db, admin_user):
        """Admin can update a template."""
        template = ContractTemplate(
            name="Original Name",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        response = client.put(
            f"/api/contracts/templates/{template.id}",
            json={"name": "Updated Name", "is_active": False},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["is_active"] is False

    def test_delete_template(self, client, auth_headers_admin, db, admin_user):
        """Admin can delete a template."""
        template = ContractTemplate(
            name="To Delete",
            contract_type=ContractType.CUSTOM,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        response = client.delete(f"/api/contracts/templates/{template.id}", headers=auth_headers_admin)
        assert response.status_code == 200

        # Verify deletion
        response = client.get(f"/api/contracts/templates/{template.id}", headers=auth_headers_admin)
        assert response.status_code == 404


class TestContractVersions:
    """Tests for contract version management."""

    @pytest.fixture
    def template_with_version(self, db, admin_user):
        """Create a template with an initial version."""
        template = ContractTemplate(
            name="Versioned Template",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        version = ContractVersion(
            template_id=template.id,
            version_number=1,
            html_content="<h1>Contract Version 1</h1><p>Initial terms...</p>",
            is_current=True,
            created_by_id=admin_user.id
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        return template, version

    def test_create_version(self, client, auth_headers_admin, db, admin_user):
        """Admin can create a new version for a template."""
        template = ContractTemplate(
            name="Template for Version",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        response = client.post(
            f"/api/contracts/templates/{template.id}/versions",
            json={
                "html_content": "<h1>Contract Content</h1><p>Terms and conditions...</p>",
                "change_summary": "Initial version"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version_number"] == 1
        assert data["is_current"] is True

    def test_create_second_version(self, client, auth_headers_admin, template_with_version):
        """Creating a new version marks it as current and old as non-current."""
        template, first_version = template_with_version

        response = client.post(
            f"/api/contracts/templates/{template.id}/versions",
            json={
                "html_content": "<h1>Updated Contract</h1><p>New terms...</p>",
                "change_summary": "Updated pricing section"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version_number"] == 2
        assert data["is_current"] is True

    def test_list_versions(self, client, auth_headers_admin, template_with_version):
        """Admin can list all versions for a template."""
        template, version = template_with_version

        response = client.get(
            f"/api/contracts/templates/{template.id}/versions",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_version_diff(self, client, auth_headers_admin, db, admin_user):
        """Admin can get a diff between two versions."""
        template = ContractTemplate(
            name="Diff Template",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        # Create version 1
        v1 = ContractVersion(
            template_id=template.id,
            version_number=1,
            html_content="<p>Original content here</p>",
            is_current=False,
            created_by_id=admin_user.id
        )
        db.add(v1)
        db.commit()
        db.refresh(v1)

        # Create version 2
        v2 = ContractVersion(
            template_id=template.id,
            version_number=2,
            html_content="<p>Modified content here with changes</p>",
            is_current=True,
            created_by_id=admin_user.id
        )
        db.add(v2)
        db.commit()
        db.refresh(v2)

        # Use the correct endpoint path with version_id and compare_to query param
        response = client.get(
            f"/api/contracts/templates/{template.id}/versions/{v2.id}/diff?compare_to={v1.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert "diff_html" in data


class TestContractSignatures:
    """Tests for contract signature management."""

    @pytest.fixture
    def template_ready_for_signing(self, db, admin_user):
        """Create a template with a version ready for signing."""
        template = ContractTemplate(
            name="Signing Template",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        version = ContractVersion(
            template_id=template.id,
            version_number=1,
            html_content="<h1>Livery Agreement</h1><p>Terms here...</p>",
            is_current=True,
            created_by_id=admin_user.id
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        return template, version

    def test_request_signature(self, client, auth_headers_admin, template_ready_for_signing, livery_user):
        """Admin can request a signature from a user."""
        template, version = template_ready_for_signing

        response = client.post(
            f"/api/contracts/templates/{template.id}/request-signature",
            json={"user_id": livery_user.id},
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "pending"

    def test_list_signatures_admin(self, client, auth_headers_admin, db, admin_user, livery_user):
        """Admin can list all signature requests."""
        # Create template and version
        template = ContractTemplate(
            name="Sig List Template",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        version = ContractVersion(
            template_id=template.id,
            version_number=1,
            html_content="<p>Content</p>",
            is_current=True,
            created_by_id=admin_user.id
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        # Create a signature request
        sig = ContractSignature(
            contract_version_id=version.id,
            user_id=livery_user.id,
            status=SignatureStatus.PENDING,
            requested_by_id=admin_user.id
        )
        db.add(sig)
        db.commit()

        response = client.get("/api/contracts/signatures", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_void_signature(self, client, auth_headers_admin, db, admin_user, livery_user):
        """Admin can void a pending signature request."""
        # Create template, version, and signature
        template = ContractTemplate(
            name="Void Test Template",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        version = ContractVersion(
            template_id=template.id,
            version_number=1,
            html_content="<p>Content</p>",
            is_current=True,
            created_by_id=admin_user.id
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        sig = ContractSignature(
            contract_version_id=version.id,
            user_id=livery_user.id,
            status=SignatureStatus.PENDING,
            requested_by_id=admin_user.id
        )
        db.add(sig)
        db.commit()
        db.refresh(sig)

        # Use query parameter for reason, not JSON body
        response = client.post(
            f"/api/contracts/signatures/{sig.id}/void?reason=Changed+contract+terms",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "voided"


class TestMyContracts:
    """Tests for user contract access."""

    @pytest.fixture
    def user_with_pending_contract(self, db, admin_user, livery_user):
        """Create a livery user with a pending contract."""
        template = ContractTemplate(
            name="My Contract Template",
            contract_type=ContractType.LIVERY,
            is_active=True,
            created_by_id=admin_user.id
        )
        db.add(template)
        db.commit()
        db.refresh(template)

        version = ContractVersion(
            template_id=template.id,
            version_number=1,
            html_content="<h1>My Livery Agreement</h1><p>Please read and sign...</p>",
            is_current=True,
            created_by_id=admin_user.id
        )
        db.add(version)
        db.commit()
        db.refresh(version)

        sig = ContractSignature(
            contract_version_id=version.id,
            user_id=livery_user.id,
            status=SignatureStatus.PENDING,
            requested_by_id=admin_user.id
        )
        db.add(sig)
        db.commit()
        db.refresh(sig)

        return template, version, sig

    def test_get_my_contracts_livery(self, client, auth_headers_livery, user_with_pending_contract):
        """Livery user can see their pending contracts."""
        template, version, sig = user_with_pending_contract

        response = client.get("/api/contracts/my-contracts", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(c["signature_id"] == sig.id for c in data)

    def test_get_my_contract_content(self, client, auth_headers_livery, user_with_pending_contract):
        """Livery user can view the content of their contract."""
        template, version, sig = user_with_pending_contract

        response = client.get(
            f"/api/contracts/my-contracts/{sig.id}/content",
            headers=auth_headers_livery
        )
        assert response.status_code == 200
        data = response.json()
        assert "html_content" in data
        assert "My Livery Agreement" in data["html_content"]

    def test_initiate_signing(self, client, auth_headers_livery, user_with_pending_contract):
        """Livery user can initiate signing process."""
        template, version, sig = user_with_pending_contract

        response = client.post(
            f"/api/contracts/signatures/{sig.id}/initiate",
            headers=auth_headers_livery
        )
        # Without DocuSign configured, expect 500 error with configuration message
        # In a fully configured environment, would return 200 with signing_url
        if response.status_code == 500:
            data = response.json()
            assert "DocuSign" in data.get("detail", "") or "not configured" in data.get("detail", "")
        else:
            assert response.status_code == 200
            data = response.json()
            # In test mode, should return success with test_mode flag
            assert data.get("success") is True or data.get("test_mode") is True

    def test_cannot_view_other_user_contract(self, client, auth_headers_public, user_with_pending_contract):
        """Public user cannot view another user's contract."""
        template, version, sig = user_with_pending_contract

        response = client.get(
            f"/api/contracts/my-contracts/{sig.id}/content",
            headers=auth_headers_public
        )
        # Should be 404 (not found for this user) or 403 (forbidden)
        assert response.status_code in [403, 404]


class TestDocuSignSettings:
    """Tests for DocuSign settings management."""

    def test_get_docusign_settings_admin(self, client, auth_headers_admin):
        """Admin can view DocuSign settings."""
        response = client.get("/api/contracts/docusign/settings", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "docusign_enabled" in data

    def test_update_docusign_settings_admin(self, client, auth_headers_admin):
        """Admin can update DocuSign settings."""
        response = client.put(
            "/api/contracts/docusign/settings",
            json={
                "docusign_enabled": True,
                "docusign_test_mode": True,
                "docusign_integration_key": "test-key-123"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["docusign_enabled"] is True

    def test_docusign_settings_non_admin_forbidden(self, client, auth_headers_livery):
        """Non-admin cannot access DocuSign settings."""
        response = client.get("/api/contracts/docusign/settings", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_test_docusign_connection(self, client, auth_headers_admin):
        """Admin can test DocuSign connection."""
        response = client.post("/api/contracts/docusign/test", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "success" in data
        assert "message" in data
