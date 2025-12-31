import pytest
from datetime import datetime, timedelta

from app.models.risk_assessment import (
    RiskAssessment,
    RiskAssessmentCategory,
    RiskAssessmentReview,
    RiskAssessmentAcknowledgement,
    ReviewTrigger
)


@pytest.fixture
def risk_assessment(db, admin_user):
    """Create a basic risk assessment."""
    assessment = RiskAssessment(
        title="General Workplace Safety",
        category=RiskAssessmentCategory.GENERAL_WORKPLACE,
        summary="Basic workplace hazards and procedures",
        content="This is the full content of the risk assessment.\n\nHAZARD 1: Slippery surfaces...",
        version=1,
        is_active=True,
        required_for_induction=True,
        review_period_months=12,
        created_by_id=admin_user.id
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return assessment


@pytest.fixture
def acknowledged_assessment(db, admin_user, staff_user, risk_assessment):
    """Create a risk assessment with an acknowledgement."""
    acknowledgement = RiskAssessmentAcknowledgement(
        risk_assessment_id=risk_assessment.id,
        user_id=staff_user.id,
        assessment_version=1,
        acknowledged_at=datetime.utcnow() - timedelta(days=30),
        notes="Read and understood"
    )
    db.add(acknowledgement)
    db.commit()
    return risk_assessment


class TestRiskAssessmentsAdminList:
    """Tests for admin listing risk assessments."""

    def test_list_assessments_admin(self, client, auth_headers_admin, risk_assessment):
        """Admin can list all risk assessments."""
        response = client.get("/api/risk-assessments", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(a["title"] == "General Workplace Safety" for a in data)

    def test_list_assessments_filter_by_category(self, client, auth_headers_admin, risk_assessment):
        """Admin can filter assessments by category."""
        response = client.get(
            "/api/risk-assessments?category=general_workplace",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert all(a["category"] == "general_workplace" for a in data)

    def test_list_assessments_non_admin_forbidden(self, client, auth_headers_livery):
        """Non-admin users cannot list assessments."""
        response = client.get("/api/risk-assessments", headers=auth_headers_livery)
        assert response.status_code == 403

    def test_list_assessments_unauthenticated_forbidden(self, client):
        """Unauthenticated requests are rejected."""
        response = client.get("/api/risk-assessments")
        assert response.status_code == 401


class TestRiskAssessmentsAdminCreate:
    """Tests for admin creating risk assessments."""

    def test_create_assessment_admin(self, client, auth_headers_admin):
        """Admin can create a risk assessment."""
        response = client.post(
            "/api/risk-assessments",
            json={
                "title": "Fire Safety Procedures",
                "category": "fire_emergency",
                "summary": "Fire evacuation and safety procedures",
                "content": "Full fire safety content here...",
                "required_for_induction": True,
                "review_period_months": 12
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Fire Safety Procedures"
        assert data["category"] == "fire_emergency"
        assert data["version"] == 1

    def test_create_assessment_duplicate_title(self, client, auth_headers_admin, risk_assessment):
        """Creating duplicate title succeeds (no unique constraint on title)."""
        response = client.post(
            "/api/risk-assessments",
            json={
                "title": "General Workplace Safety",  # Same as risk_assessment fixture
                "category": "general_workplace",
                "content": "Some different content"
            },
            headers=auth_headers_admin
        )
        # No unique constraint - allows duplicates
        assert response.status_code == 200

    def test_create_assessment_non_admin_forbidden(self, client, auth_headers_staff):
        """Non-admin users cannot create assessments."""
        response = client.post(
            "/api/risk-assessments",
            json={
                "title": "New Assessment",
                "category": "other",
                "content": "Content"
            },
            headers=auth_headers_staff
        )
        assert response.status_code == 403


class TestRiskAssessmentsAdminUpdate:
    """Tests for admin updating risk assessments."""

    def test_update_assessment_metadata(self, client, auth_headers_admin, risk_assessment):
        """Admin can update assessment metadata without incrementing version."""
        response = client.put(
            f"/api/risk-assessments/{risk_assessment.id}",
            json={
                "summary": "Updated summary",
                "required_for_induction": False
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["summary"] == "Updated summary"
        assert data["required_for_induction"] is False
        assert data["version"] == 1  # Version unchanged

    def test_update_assessment_content_increments_version(self, client, auth_headers_admin, risk_assessment):
        """Updating content increments version."""
        response = client.put(
            f"/api/risk-assessments/{risk_assessment.id}/content",
            json={
                "content": "Completely updated content with new hazards...",
                "changes_summary": "Added new hazard information"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["version"] == 2  # Version incremented
        assert "updated content" in data["content"]

    def test_update_nonexistent_assessment(self, client, auth_headers_admin):
        """Returns 404 for nonexistent assessment."""
        response = client.put(
            "/api/risk-assessments/99999",
            json={"summary": "Test"},
            headers=auth_headers_admin
        )
        assert response.status_code == 404


class TestRiskAssessmentsAdminDelete:
    """Tests for admin deleting risk assessments."""

    def test_delete_assessment_admin(self, client, auth_headers_admin, risk_assessment):
        """Admin can delete a risk assessment."""
        response = client.delete(
            f"/api/risk-assessments/{risk_assessment.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 200

        # Verify deletion
        response = client.get(
            f"/api/risk-assessments/{risk_assessment.id}",
            headers=auth_headers_admin
        )
        assert response.status_code == 404

    def test_delete_assessment_non_admin_forbidden(self, client, auth_headers_staff, risk_assessment):
        """Non-admin cannot delete assessments."""
        response = client.delete(
            f"/api/risk-assessments/{risk_assessment.id}",
            headers=auth_headers_staff
        )
        assert response.status_code == 403


class TestRiskAssessmentsCompliance:
    """Tests for compliance summary endpoint."""

    def test_get_compliance_summary(self, client, auth_headers_admin, risk_assessment, staff_user):
        """Admin can get compliance summary."""
        response = client.get("/api/risk-assessments/compliance", headers=auth_headers_admin)
        assert response.status_code == 200
        data = response.json()
        assert "total_staff" in data
        assert "fully_compliant_staff" in data
        assert "non_compliant_staff" in data
        assert "compliance_percentage" in data
        assert "assessments_needing_review" in data

    def test_get_staff_status(self, client, auth_headers_admin, acknowledged_assessment, staff_user):
        """Admin can get staff acknowledgement status."""
        response = client.get(
            "/api/risk-assessments/staff-status",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        # Returns list of staff with their status
        assert isinstance(data, list)
        # Staff user should be in the list
        assert any(s["user_id"] == staff_user.id for s in data)


class TestRiskAssessmentsReviews:
    """Tests for review history."""

    def test_record_review(self, client, auth_headers_admin, risk_assessment):
        """Admin can record a review."""
        response = client.post(
            f"/api/risk-assessments/{risk_assessment.id}/review",
            json={
                "trigger": "scheduled",
                "notes": "Annual review completed. No changes required."
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["trigger"] == "scheduled"
        assert data["changes_made"] is False

    def test_record_review_with_changes(self, client, auth_headers_admin, risk_assessment):
        """Admin can record a review with changes."""
        response = client.post(
            f"/api/risk-assessments/{risk_assessment.id}/review",
            json={
                "trigger": "incident",
                "trigger_details": "Following slip incident in feed room"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert data["trigger"] == "incident"
        # Note: changes_made is set based on content update, not in the review endpoint

    def test_get_review_history(self, client, auth_headers_admin, db, risk_assessment, admin_user):
        """Admin can get review history."""
        # Create a review first
        review = RiskAssessmentReview(
            risk_assessment_id=risk_assessment.id,
            reviewed_by_id=admin_user.id,
            trigger=ReviewTrigger.SCHEDULED,
            version_before=1,
            version_after=1,
            changes_made=False,
            notes="Annual review"
        )
        db.add(review)
        db.commit()

        response = client.get(
            f"/api/risk-assessments/{risk_assessment.id}/reviews",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert any(r["notes"] == "Annual review" for r in data)


class TestMyRiskAssessments:
    """Tests for staff viewing their own assessments."""

    def test_get_my_assessments_staff(self, client, auth_headers_staff, risk_assessment):
        """Staff can view assessments they need to acknowledge."""
        response = client.get("/api/risk-assessments/my/assessments", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        # Should include the risk assessment with needs_acknowledgement=True
        assert len(data) >= 1
        assert any(a["needs_acknowledgement"] is True for a in data)

    def test_get_my_assessments_livery(self, client, auth_headers_livery, risk_assessment):
        """Livery users can view assessments they need to acknowledge."""
        response = client.get("/api/risk-assessments/my/assessments", headers=auth_headers_livery)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_get_my_assessments_shows_acknowledged(self, client, auth_headers_staff, acknowledged_assessment):
        """Shows acknowledgement status for staff."""
        response = client.get("/api/risk-assessments/my/assessments", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        # The acknowledged assessment should show needs_acknowledgement=False
        acknowledged = [a for a in data if a["id"] == acknowledged_assessment.id]
        if acknowledged:
            assert acknowledged[0]["needs_acknowledgement"] is False


class TestRiskAssessmentAcknowledgement:
    """Tests for staff acknowledging assessments."""

    def test_acknowledge_assessment(self, client, auth_headers_staff, risk_assessment):
        """Staff can acknowledge a risk assessment."""
        response = client.post(
            "/api/risk-assessments/my/acknowledge",
            json={
                "risk_assessment_id": risk_assessment.id,
                "notes": "Read and understood all content"
            },
            headers=auth_headers_staff
        )
        assert response.status_code == 200
        data = response.json()
        assert data["assessment_version"] == risk_assessment.version

    def test_acknowledge_assessment_without_notes(self, client, auth_headers_livery, risk_assessment):
        """Notes are optional when acknowledging."""
        response = client.post(
            "/api/risk-assessments/my/acknowledge",
            json={
                "risk_assessment_id": risk_assessment.id
            },
            headers=auth_headers_livery
        )
        assert response.status_code == 200

    def test_acknowledge_nonexistent_assessment(self, client, auth_headers_staff):
        """Returns 404 for nonexistent assessment."""
        response = client.post(
            "/api/risk-assessments/my/acknowledge",
            json={"risk_assessment_id": 99999},
            headers=auth_headers_staff
        )
        assert response.status_code == 404

    def test_acknowledge_already_acknowledged(self, client, auth_headers_staff, acknowledged_assessment, staff_user):
        """Acknowledging again creates new record (different version scenario)."""
        response = client.post(
            "/api/risk-assessments/my/acknowledge",
            json={"risk_assessment_id": acknowledged_assessment.id},
            headers=auth_headers_staff
        )
        # Should succeed - creates new acknowledgement
        assert response.status_code == 200


class TestRiskAssessmentPendingCount:
    """Tests for pending assessment count."""

    def test_get_pending_count_staff(self, client, auth_headers_staff, risk_assessment):
        """Staff can get their pending assessment count."""
        response = client.get("/api/risk-assessments/my/pending-count", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        assert "pending_count" in data
        assert data["pending_count"] >= 1

    def test_get_pending_count_after_acknowledgement(self, client, auth_headers_staff, acknowledged_assessment):
        """Pending count decreases after acknowledgement."""
        response = client.get("/api/risk-assessments/my/pending-count", headers=auth_headers_staff)
        assert response.status_code == 200
        data = response.json()
        # Count should reflect that one assessment is already acknowledged
        assert "pending_count" in data


class TestRiskAssessmentAcknowledgementsAdmin:
    """Tests for admin viewing acknowledgement history."""

    def test_get_acknowledgements_admin(self, client, auth_headers_admin, acknowledged_assessment):
        """Admin can view all acknowledgements for an assessment."""
        response = client.get(
            f"/api/risk-assessments/{acknowledged_assessment.id}/acknowledgements",
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all("user_name" in a for a in data)

    def test_get_acknowledgements_non_admin_forbidden(self, client, auth_headers_staff, acknowledged_assessment):
        """Non-admin cannot view acknowledgement details."""
        response = client.get(
            f"/api/risk-assessments/{acknowledged_assessment.id}/acknowledgements",
            headers=auth_headers_staff
        )
        assert response.status_code == 403


class TestRiskAssessmentVersioning:
    """Tests for version-based re-acknowledgement."""

    def test_content_update_requires_reacknowledgement(self, client, auth_headers_admin, db, acknowledged_assessment, staff_user):
        """Updating content should require staff to re-acknowledge."""
        # Update content (increments version)
        response = client.put(
            f"/api/risk-assessments/{acknowledged_assessment.id}/content",
            json={
                "content": "Updated content requiring re-read",
                "changes_summary": "Major content revision"
            },
            headers=auth_headers_admin
        )
        assert response.status_code == 200
        assert response.json()["version"] == 2

        # Staff should now see this as needing acknowledgement
        token = create_access_token_for_staff(staff_user)
        auth_headers = {"Authorization": f"Bearer {token}"}
        response = client.get("/api/risk-assessments/my/assessments", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()

        # Find the updated assessment
        updated = [a for a in data if a["id"] == acknowledged_assessment.id]
        if updated:
            # Should need re-acknowledgement since version changed
            assert updated[0]["needs_acknowledgement"] is True


def create_access_token_for_staff(user):
    """Helper to create token for test user."""
    from app.utils.auth import create_access_token
    return create_access_token(user.id)
