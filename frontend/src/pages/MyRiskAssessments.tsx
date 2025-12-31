import { useState, useEffect } from 'react';
import { riskAssessmentsApi } from '../services/api';
import { Modal } from '../components/ui';
import type { MyRiskAssessment, RiskAssessmentCategory } from '../types';
import './MyRiskAssessments.css';

const CATEGORIES: { value: RiskAssessmentCategory; label: string }[] = [
  { value: 'general_workplace', label: 'General Workplace' },
  { value: 'horse_handling', label: 'Horse Handling' },
  { value: 'yard_environment', label: 'Yard Environment' },
  { value: 'fire_emergency', label: 'Fire & Emergency' },
  { value: 'biosecurity', label: 'Biosecurity' },
  { value: 'first_aid', label: 'First Aid' },
  { value: 'ppe_manual_handling', label: 'PPE & Manual Handling' },
  { value: 'other', label: 'Other' },
];

const getCategoryLabel = (category: RiskAssessmentCategory): string => {
  return CATEGORIES.find(c => c.value === category)?.label || category;
};

export function MyRiskAssessments() {
  const [assessments, setAssessments] = useState<MyRiskAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAssessment, setSelectedAssessment] = useState<MyRiskAssessment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmAcknowledge, setConfirmAcknowledge] = useState<MyRiskAssessment | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');

  const loadAssessments = async () => {
    try {
      setLoading(true);
      const data = await riskAssessmentsApi.getMyAssessments();
      setAssessments(data);
    } catch {
      setError('Failed to load risk assessments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessments();
  }, []);

  const handleView = (assessment: MyRiskAssessment) => {
    setSelectedAssessment(assessment);
    setShowModal(true);
  };

  const handleAcknowledge = async () => {
    if (!confirmAcknowledge) return;
    setIsSubmitting(true);

    try {
      await riskAssessmentsApi.acknowledge({
        risk_assessment_id: confirmAcknowledge.id,
        notes: notes || undefined,
      });
      setConfirmAcknowledge(null);
      setNotes('');
      await loadAssessments();
    } catch {
      setError('Failed to acknowledge assessment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const pendingAssessments = assessments.filter(a => a.needs_acknowledgement);
  const completedAssessments = assessments.filter(a => !a.needs_acknowledgement);

  if (loading) {
    return (
      <div className="my-risk-assessments-page">
        <div className="ds-loading">Loading risk assessments...</div>
      </div>
    );
  }

  return (
    <div className="my-risk-assessments-page">
      <header className="page-header">
        <h1>My Risk Assessments</h1>
        <p className="subtitle">Review and acknowledge health & safety assessments</p>
      </header>

      {error && (
        <div className="ds-alert ds-alert-error">
          {error}
          <button onClick={() => setError('')} className="ds-alert-close">&times;</button>
        </div>
      )}

      {/* Pending Assessments Section */}
      {pendingAssessments.length > 0 && (
        <section className="assessments-section">
          <h2>Action Required</h2>
          <p className="section-description">
            These assessments require your acknowledgement
          </p>
          <div className="assessments-grid">
            {pendingAssessments.map((assessment) => (
              <div key={assessment.id} className="assessment-card pending">
                <div className="assessment-header">
                  <h3>{assessment.title}</h3>
                  <span className="assessment-status status-pending">
                    Pending
                  </span>
                </div>
                <div className="assessment-meta">
                  <span className="assessment-category">{getCategoryLabel(assessment.category)}</span>
                  <span className="assessment-version">v{assessment.version}</span>
                </div>
                {assessment.summary && (
                  <p className="assessment-summary">{assessment.summary}</p>
                )}
                <div className="assessment-dates">
                  {assessment.last_acknowledged_at && (
                    <span className="outdated-note">
                      Previously acknowledged v{assessment.last_acknowledged_version} on {formatDate(assessment.last_acknowledged_at)}
                    </span>
                  )}
                </div>
                <div className="assessment-actions">
                  <button
                    className="ds-btn ds-btn-secondary"
                    onClick={() => handleView(assessment)}
                  >
                    View Assessment
                  </button>
                  <button
                    className="ds-btn ds-btn-primary"
                    onClick={() => {
                      setConfirmAcknowledge(assessment);
                      setNotes('');
                    }}
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* All Clear Message */}
      {pendingAssessments.length === 0 && (
        <div className="all-clear-message">
          <div className="check-icon">✓</div>
          <h2>All Up to Date</h2>
          <p>You have acknowledged all current risk assessments</p>
        </div>
      )}

      {/* Acknowledged Assessments Section */}
      {completedAssessments.length > 0 && (
        <section className="assessments-section">
          <h2>Acknowledged Assessments</h2>
          <div className="assessments-grid">
            {completedAssessments.map((assessment) => (
              <div key={assessment.id} className="assessment-card acknowledged">
                <div className="assessment-header">
                  <h3>{assessment.title}</h3>
                  <span className="assessment-status status-acknowledged">
                    Acknowledged
                  </span>
                </div>
                <div className="assessment-meta">
                  <span className="assessment-category">{getCategoryLabel(assessment.category)}</span>
                  <span className="assessment-version">v{assessment.version}</span>
                </div>
                {assessment.summary && (
                  <p className="assessment-summary">{assessment.summary}</p>
                )}
                <div className="assessment-dates">
                  <span>Acknowledged: {formatDate(assessment.last_acknowledged_at)}</span>
                </div>
                <div className="assessment-actions">
                  <button
                    className="ds-btn ds-btn-secondary"
                    onClick={() => handleView(assessment)}
                  >
                    View Assessment
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {assessments.length === 0 && (
        <div className="ds-empty">
          <p>No risk assessments assigned to you.</p>
        </div>
      )}

      {/* View Assessment Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedAssessment?.title || 'Risk Assessment'}
        size="lg"
        footer={
          <>
            <button
              className="ds-btn ds-btn-secondary"
              onClick={() => setShowModal(false)}
            >
              Close
            </button>
            {selectedAssessment?.needs_acknowledgement && (
              <button
                className="ds-btn ds-btn-primary"
                onClick={() => {
                  setShowModal(false);
                  setConfirmAcknowledge(selectedAssessment);
                  setNotes('');
                }}
              >
                Acknowledge
              </button>
            )}
          </>
        }
      >
        {selectedAssessment && (
          <>
            <div className="modal-meta-row">
              <span className="ds-badge ds-badge-info">{getCategoryLabel(selectedAssessment.category)}</span>
              <span className="ds-badge">Version {selectedAssessment.version}</span>
              {selectedAssessment.required_for_induction && (
                <span className="ds-badge ds-badge-warning">Required for Induction</span>
              )}
            </div>

            {selectedAssessment.summary && (
              <p className="modal-summary">{selectedAssessment.summary}</p>
            )}

            <div className="assessment-content">
              <pre>{selectedAssessment.content}</pre>
            </div>
          </>
        )}
      </Modal>

      {/* Acknowledge Confirmation Modal */}
      <Modal
        isOpen={!!confirmAcknowledge}
        onClose={() => setConfirmAcknowledge(null)}
        title="Acknowledge Assessment"
        footer={
          <>
            <button
              className="ds-btn ds-btn-secondary"
              onClick={() => setConfirmAcknowledge(null)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleAcknowledge}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Confirming...' : 'Confirm Acknowledgement'}
            </button>
          </>
        }
      >
        <p>
          By clicking Confirm, you acknowledge that you have read and understood the risk assessment:
        </p>
        <p style={{ fontWeight: 'var(--font-weight-semibold)', marginTop: 'var(--space-2)' }}>
          "{confirmAcknowledge?.title}" (Version {confirmAcknowledge?.version})
        </p>

        <div className="ds-form-group" style={{ marginTop: 'var(--space-4)' }}>
          <label>Notes (optional)</label>
          <textarea
            className="ds-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any questions or comments..."
          />
        </div>
      </Modal>
    </div>
  );
}

export default MyRiskAssessments;
