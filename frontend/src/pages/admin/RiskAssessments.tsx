import { useState, useEffect, useCallback } from 'react';
import { riskAssessmentsApi } from '../../services/api';
import { useModalForm, useRequestState } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Textarea, Select } from '../../components/ui';
import type {
  RiskAssessmentSummary,
  RiskAssessment,
  CreateRiskAssessment,
  UpdateRiskAssessment,
  UpdateRiskAssessmentContent,
  RiskAssessmentReview,
  AssessmentStaffStatus,
  ComplianceSummary,
  StaffAcknowledgementStatus,
  RiskAssessmentCategory,
  ReviewTrigger,
} from '../../types';
import {
  PageActions,
  ActiveBadge,
} from '../../components/admin';
import './Admin.css';

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

const TRIGGERS: { value: ReviewTrigger; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled Review' },
  { value: 'incident', label: 'Following Incident' },
  { value: 'change', label: 'Process/Equipment Change' },
  { value: 'new_hazard', label: 'New Hazard Identified' },
  { value: 'legislation', label: 'Legislation Change' },
  { value: 'other', label: 'Other' },
];

const getCategoryLabel = (category: RiskAssessmentCategory): string => {
  return CATEGORIES.find(c => c.value === category)?.label || category;
};

const emptyAssessmentForm: CreateRiskAssessment = {
  title: '',
  category: 'general_workplace',
  summary: '',
  content: '',
  review_period_months: 12,
  required_for_induction: true,
  applies_to_roles: [],
};

export function AdminRiskAssessments() {
  const [assessments, setAssessments] = useState<RiskAssessmentSummary[]>([]);
  const [compliance, setCompliance] = useState<ComplianceSummary | null>(null);
  const [staffStatus, setStaffStatus] = useState<StaffAcknowledgementStatus[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(true);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [reviews, setReviews] = useState<RiskAssessmentReview[]>([]);
  const [assessmentStaffStatus, setAssessmentStaffStatus] = useState<AssessmentStaffStatus[]>([]);

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showReacknowledgementModal, setShowReacknowledgementModal] = useState(false);

  // Content update form
  const [contentUpdate, setContentUpdate] = useState<UpdateRiskAssessmentContent>({
    content: '',
    review_trigger: 'change',
    trigger_details: '',
    changes_summary: '',
  });

  // Review form
  const [reviewForm, setReviewForm] = useState({
    trigger: 'scheduled' as ReviewTrigger,
    trigger_details: '',
    notes: '',
  });

  // Re-acknowledgement form
  const [reackForm, setReackForm] = useState({
    trigger: 'incident' as ReviewTrigger,
    trigger_details: '',
    notes: '',
  });

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal hooks
  const assessmentModal = useModalForm<CreateRiskAssessment>(emptyAssessmentForm);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<RiskAssessmentSummary | null>(null);

  const loadAssessments = useCallback(async () => {
    try {
      const params: Record<string, unknown> = {};
      if (filterCategory) params.category = filterCategory;
      if (filterActive !== undefined) params.is_active = filterActive;
      const data = await riskAssessmentsApi.list(params as { category?: string; is_active?: boolean });
      setAssessments(data);
    } catch {
      setError('Failed to load risk assessments');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterActive, setError, setLoading]);

  const loadCompliance = useCallback(async () => {
    try {
      const data = await riskAssessmentsApi.getComplianceSummary();
      setCompliance(data);
    } catch {
      // Non-critical
    }
  }, []);

  const loadStaffStatus = useCallback(async () => {
    try {
      const data = await riskAssessmentsApi.getStaffStatus();
      setStaffStatus(data);
    } catch {
      // Non-critical
    }
  }, []);

  const loadAssessmentDetails = async (id: number) => {
    try {
      const [assessment, reviewHistory, staffStatusData] = await Promise.all([
        riskAssessmentsApi.get(id),
        riskAssessmentsApi.getReviewHistory(id),
        riskAssessmentsApi.getAssessmentStaffStatus(id),
      ]);
      setSelectedAssessment(assessment);
      setReviews(reviewHistory);
      setAssessmentStaffStatus(staffStatusData);
    } catch {
      setError('Failed to load assessment details');
    }
  };

  useEffect(() => {
    loadAssessments();
    loadCompliance();
    loadStaffStatus();
  }, [loadAssessments, loadCompliance, loadStaffStatus]);

  const handleSubmitAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (assessmentModal.isEditing && assessmentModal.editingId) {
        await riskAssessmentsApi.update(assessmentModal.editingId, assessmentModal.formData as UpdateRiskAssessment);
      } else {
        await riskAssessmentsApi.create(assessmentModal.formData);
      }
      assessmentModal.close();
      await loadAssessments();
      await loadCompliance();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save assessment';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditAssessment = async (assessment: RiskAssessmentSummary) => {
    try {
      const full = await riskAssessmentsApi.get(assessment.id);
      assessmentModal.edit(assessment.id, {
        title: full.title,
        category: full.category,
        summary: full.summary || '',
        content: full.content,
        review_period_months: full.review_period_months,
        required_for_induction: full.required_for_induction,
        applies_to_roles: full.applies_to_roles || [],
      });
    } catch {
      setError('Failed to load assessment for editing');
    }
  };

  const handleViewDetails = async (assessment: RiskAssessmentSummary) => {
    await loadAssessmentDetails(assessment.id);
    setShowDetailModal(true);
  };

  const handleEditContent = () => {
    if (!selectedAssessment) return;
    setContentUpdate({
      content: selectedAssessment.content,
      review_trigger: 'change',
      trigger_details: '',
      changes_summary: '',
    });
    setShowContentModal(true);
  };

  const handleSubmitContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessment) return;
    setError('');
    setIsSubmitting(true);

    try {
      const updated = await riskAssessmentsApi.updateContent(selectedAssessment.id, contentUpdate);
      setSelectedAssessment(updated);
      setShowContentModal(false);
      await loadAssessments();
      await loadAssessmentDetails(selectedAssessment.id);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update content';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordReview = () => {
    setReviewForm({
      trigger: 'scheduled',
      trigger_details: '',
      notes: '',
    });
    setShowReviewModal(true);
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessment) return;
    setError('');
    setIsSubmitting(true);

    try {
      await riskAssessmentsApi.recordReview(selectedAssessment.id, reviewForm);
      setShowReviewModal(false);
      await loadAssessmentDetails(selectedAssessment.id);
      await loadAssessments();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to record review';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequireReacknowledgement = () => {
    setReackForm({
      trigger: 'incident',
      trigger_details: '',
      notes: '',
    });
    setShowReacknowledgementModal(true);
  };

  const handleSubmitReacknowledgement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssessment) return;
    setError('');
    setIsSubmitting(true);

    try {
      const updated = await riskAssessmentsApi.requireReacknowledgement(selectedAssessment.id, reackForm);
      setSelectedAssessment(updated);
      setShowReacknowledgementModal(false);
      await loadAssessments();
      await loadAssessmentDetails(selectedAssessment.id);
      await loadCompliance();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to require re-acknowledgement';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (assessment: RiskAssessmentSummary) => {
    try {
      await riskAssessmentsApi.update(assessment.id, { is_active: !assessment.is_active });
      await loadAssessments();
    } catch {
      setError('Failed to update assessment status');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await riskAssessmentsApi.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadAssessments();
      await loadCompliance();
    } catch {
      setError('Failed to delete assessment');
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="admin-page">
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading risk assessments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="ds-page-header">
        <div className="ds-page-title-section">
          <h1>Risk Assessments</h1>
          <p className="ds-page-subtitle">Manage health & safety risk assessments and staff acknowledgements</p>
        </div>
        <PageActions>
          <button className="ds-btn ds-btn-primary" onClick={() => assessmentModal.open()}>
            + New Assessment
          </button>
        </PageActions>
      </div>

      {error && (
        <div className="ds-alert ds-alert-error" style={{ marginBottom: 'var(--space-4)' }}>
          {error}
          <button onClick={() => setError('')} className="ds-alert-close">&times;</button>
        </div>
      )}

      {/* Compliance Overview */}
      {compliance && (
        <div className="ds-card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="ds-card-header">
            <h3>Compliance Overview</h3>
            <button
              className="ds-btn ds-btn-secondary ds-btn-sm"
              onClick={() => setShowStaffModal(true)}
            >
              View Staff Status
            </button>
          </div>
          <div className="ds-card-body">
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 'var(--space-4)' }}>
              <div className="stat-card">
                <div className="stat-value">{compliance.compliance_percentage.toFixed(0)}%</div>
                <div className="stat-label">Overall Compliance</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{compliance.fully_compliant_staff}</div>
                <div className="stat-label">Fully Compliant Staff</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: compliance.non_compliant_staff > 0 ? 'var(--color-warning)' : 'inherit' }}>
                  {compliance.non_compliant_staff}
                </div>
                <div className="stat-label">Non-Compliant Staff</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: compliance.assessments_needing_review > 0 ? 'var(--color-warning)' : 'inherit' }}>
                  {compliance.assessments_needing_review}
                </div>
                <div className="stat-label">Needing Review</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="ds-card" style={{ marginBottom: 'var(--space-4)' }}>
        <div className="ds-card-body">
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ minWidth: '200px' }}>
              <FormGroup label="Category">
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </Select>
              </FormGroup>
            </div>
            <div style={{ minWidth: '150px' }}>
              <FormGroup label="Status">
                <Select
                  value={filterActive === undefined ? '' : filterActive.toString()}
                  onChange={(e) => setFilterActive(e.target.value === '' ? undefined : e.target.value === 'true')}
                >
                  <option value="">All</option>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </Select>
              </FormGroup>
            </div>
          </div>
        </div>
      </div>

      {/* Assessments List */}
      <div className="ds-card">
        <div className="ds-table-wrapper">
          <table className="ds-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Version</th>
                <th>Last Reviewed</th>
                <th>Next Review</th>
                <th>Acknowledgements</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assessments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                    No risk assessments found
                  </td>
                </tr>
              ) : (
                assessments.map((assessment) => (
                  <tr key={assessment.id}>
                    <td>
                      <strong>{assessment.title}</strong>
                      {assessment.required_for_induction && (
                        <span className="ds-badge ds-badge-info" style={{ marginLeft: 'var(--space-2)' }}>
                          Induction
                        </span>
                      )}
                    </td>
                    <td>{getCategoryLabel(assessment.category)}</td>
                    <td>v{assessment.version}</td>
                    <td>{formatDate(assessment.last_reviewed_at)}</td>
                    <td>
                      {assessment.next_review_due ? (
                        <span style={{
                          color: new Date(assessment.next_review_due) < new Date() ? 'var(--color-error)' : 'inherit'
                        }}>
                          {formatDate(assessment.next_review_due)}
                        </span>
                      ) : '-'}
                    </td>
                    <td>
                      <span style={{
                        color: assessment.staff_needing_acknowledgement > 0 ? 'var(--color-warning)' : 'var(--color-success)'
                      }}>
                        {assessment.acknowledgement_count} / {assessment.acknowledgement_count + assessment.staff_needing_acknowledgement}
                      </span>
                    </td>
                    <td>
                      <ActiveBadge isActive={assessment.is_active} />
                      {assessment.needs_review && (
                        <span className="ds-badge ds-badge-warning" style={{ marginLeft: 'var(--space-2)' }}>
                          Needs Review
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="ds-btn ds-btn-secondary ds-btn-sm"
                          onClick={() => handleViewDetails(assessment)}
                        >
                          View
                        </button>
                        <button
                          className="ds-btn ds-btn-secondary ds-btn-sm"
                          onClick={() => handleEditAssessment(assessment)}
                        >
                          Edit
                        </button>
                        <button
                          className="ds-btn ds-btn-secondary ds-btn-sm"
                          onClick={() => handleToggleActive(assessment)}
                        >
                          {assessment.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="ds-btn ds-btn-danger ds-btn-sm"
                          onClick={() => setDeleteConfirm(assessment)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Assessment Modal */}
      <Modal isOpen={assessmentModal.isOpen} onClose={() => assessmentModal.close()} size="lg">
          <form onSubmit={handleSubmitAssessment}>
            <div className="ds-modal-header">
              <h2>{assessmentModal.isEditing ? 'Edit Assessment' : 'New Risk Assessment'}</h2>
              <button type="button" className="ds-modal-close" onClick={() => assessmentModal.close()}>
                &times;
              </button>
            </div>
            <div className="ds-modal-body">
              <FormRow>
                <FormGroup label="Title" required>
                  <Input
                    value={assessmentModal.formData.title}
                    onChange={(e) => assessmentModal.setFormData({ ...assessmentModal.formData, title: e.target.value })}
                    required
                    placeholder="e.g., Horse Handling Safety"
                  />
                </FormGroup>
                <FormGroup label="Category" required>
                  <Select
                    value={assessmentModal.formData.category}
                    onChange={(e) => assessmentModal.setFormData({ ...assessmentModal.formData, category: e.target.value as RiskAssessmentCategory })}
                    required
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </Select>
                </FormGroup>
              </FormRow>

              <FormGroup label="Summary">
                <Input
                  value={assessmentModal.formData.summary || ''}
                  onChange={(e) => assessmentModal.setFormData({ ...assessmentModal.formData, summary: e.target.value })}
                  placeholder="Brief description of the assessment"
                />
              </FormGroup>

              <FormGroup label="Content" required>
                <Textarea
                  value={assessmentModal.formData.content}
                  onChange={(e) => assessmentModal.setFormData({ ...assessmentModal.formData, content: e.target.value })}
                  required
                  rows={10}
                  placeholder="Full risk assessment content (supports markdown)"
                />
              </FormGroup>

              <FormRow>
                <FormGroup label="Review Period (months)">
                  <Input
                    type="number"
                    value={assessmentModal.formData.review_period_months || 12}
                    onChange={(e) => assessmentModal.setFormData({ ...assessmentModal.formData, review_period_months: parseInt(e.target.value) || 12 })}
                    min={1}
                    max={60}
                  />
                </FormGroup>
                <FormGroup label="Required for Induction">
                  <Select
                    value={assessmentModal.formData.required_for_induction ? 'true' : 'false'}
                    onChange={(e) => assessmentModal.setFormData({ ...assessmentModal.formData, required_for_induction: e.target.value === 'true' })}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </Select>
                </FormGroup>
              </FormRow>
            </div>
            <div className="ds-modal-footer">
              <button type="button" className="ds-btn ds-btn-secondary" onClick={() => assessmentModal.close()}>
                Cancel
              </button>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : assessmentModal.isEditing ? 'Save Changes' : 'Create Assessment'}
              </button>
            </div>
          </form>
      </Modal>

      {/* Assessment Detail Modal */}
      {selectedAssessment && (
        <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} size="lg">
          <div className="ds-modal-header">
            <h2>{selectedAssessment.title}</h2>
            <button type="button" className="ds-modal-close" onClick={() => setShowDetailModal(false)}>
              &times;
            </button>
          </div>
          <div className="ds-modal-body">
            <div style={{ marginBottom: 'var(--space-4)' }}>
              <span className="ds-badge ds-badge-info">{getCategoryLabel(selectedAssessment.category)}</span>
              <span className="ds-badge" style={{ marginLeft: 'var(--space-2)' }}>v{selectedAssessment.version}</span>
              <ActiveBadge isActive={selectedAssessment.is_active} />
            </div>

            {selectedAssessment.summary && (
              <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                {selectedAssessment.summary}
              </p>
            )}

            <div className="ds-card" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="ds-card-header">
                <h4>Content</h4>
                <button className="ds-btn ds-btn-secondary ds-btn-sm" onClick={handleEditContent}>
                  Update Content
                </button>
              </div>
              <div className="ds-card-body">
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
                  {selectedAssessment.content}
                </pre>
              </div>
            </div>

            <div className="ds-card" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="ds-card-header">
                <h4>Review History</h4>
                <button className="ds-btn ds-btn-secondary ds-btn-sm" onClick={handleRecordReview}>
                  Record Review
                </button>
              </div>
              <div className="ds-card-body">
                {reviews.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No review history</p>
                ) : (
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reviewer</th>
                        <th>Trigger</th>
                        <th>Version</th>
                        <th>Changes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reviews.map((review) => (
                        <tr key={review.id}>
                          <td>{formatDate(review.reviewed_at)}</td>
                          <td>{review.reviewed_by_name}</td>
                          <td>{TRIGGERS.find(t => t.value === review.trigger)?.label || review.trigger}</td>
                          <td>v{review.version_before} → v{review.version_after}</td>
                          <td>{review.changes_made ? review.changes_summary : 'No changes'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="ds-card">
              <div className="ds-card-header">
                <h4>Staff Acknowledgements</h4>
                <button
                  className="ds-btn ds-btn-warning ds-btn-sm"
                  onClick={handleRequireReacknowledgement}
                  title="Require all staff to re-acknowledge this assessment"
                >
                  Require Re-acknowledgement
                </button>
              </div>
              <div className="ds-card-body">
                {assessmentStaffStatus.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)' }}>No staff members found for this assessment</p>
                ) : (
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th>Acknowledged</th>
                        <th>Version</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assessmentStaffStatus.map((staff) => (
                        <tr key={staff.user_id}>
                          <td>{staff.user_name}</td>
                          <td>{staff.acknowledged_at ? formatDate(staff.acknowledged_at) : '—'}</td>
                          <td>{staff.acknowledged_version ? `v${staff.acknowledged_version}` : '—'}</td>
                          <td>
                            {staff.status === 'acknowledged' && (
                              <span className="ds-badge ds-badge-success">Acknowledged</span>
                            )}
                            {staff.status === 'outdated' && (
                              <span className="ds-badge ds-badge-warning">Outdated</span>
                            )}
                            {staff.status === 'pending' && (
                              <span className="ds-badge ds-badge-error">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          <div className="ds-modal-footer">
            <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setShowDetailModal(false)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Update Content Modal */}
      {selectedAssessment && (
        <Modal isOpen={showContentModal} onClose={() => setShowContentModal(false)} size="lg">
          <form onSubmit={handleSubmitContent}>
            <div className="ds-modal-header">
              <h2>Update Assessment Content</h2>
              <button type="button" className="ds-modal-close" onClick={() => setShowContentModal(false)}>
                &times;
              </button>
            </div>
            <div className="ds-modal-body">
              <div className="ds-alert ds-alert-info" style={{ marginBottom: 'var(--space-4)' }}>
                Updating content will increment the version number. Staff will need to re-acknowledge the new version.
              </div>

              <FormGroup label="Content" required>
                <Textarea
                  value={contentUpdate.content}
                  onChange={(e) => setContentUpdate({ ...contentUpdate, content: e.target.value })}
                  required
                  rows={12}
                />
              </FormGroup>

              <FormRow>
                <FormGroup label="Review Trigger" required>
                  <Select
                    value={contentUpdate.review_trigger}
                    onChange={(e) => setContentUpdate({ ...contentUpdate, review_trigger: e.target.value as ReviewTrigger })}
                    required
                  >
                    {TRIGGERS.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup label="Trigger Details">
                  <Input
                    value={contentUpdate.trigger_details || ''}
                    onChange={(e) => setContentUpdate({ ...contentUpdate, trigger_details: e.target.value })}
                    placeholder="e.g., Following incident on..."
                  />
                </FormGroup>
              </FormRow>

              <FormGroup label="Summary of Changes" required>
                <Input
                  value={contentUpdate.changes_summary}
                  onChange={(e) => setContentUpdate({ ...contentUpdate, changes_summary: e.target.value })}
                  required
                  placeholder="Brief description of what changed"
                />
              </FormGroup>
            </div>
            <div className="ds-modal-footer">
              <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setShowContentModal(false)}>
                Cancel
              </button>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Update Content'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Record Review Modal */}
      {selectedAssessment && (
        <Modal isOpen={showReviewModal} onClose={() => setShowReviewModal(false)}>
          <form onSubmit={handleSubmitReview}>
            <div className="ds-modal-header">
              <h2>Record Review</h2>
              <button type="button" className="ds-modal-close" onClick={() => setShowReviewModal(false)}>
                &times;
              </button>
            </div>
            <div className="ds-modal-body">
              <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                Record that you have reviewed this assessment without making changes to the content.
              </p>

              <FormGroup label="Review Trigger" required>
                <Select
                  value={reviewForm.trigger}
                  onChange={(e) => setReviewForm({ ...reviewForm, trigger: e.target.value as ReviewTrigger })}
                  required
                >
                  {TRIGGERS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup label="Trigger Details">
                <Input
                  value={reviewForm.trigger_details}
                  onChange={(e) => setReviewForm({ ...reviewForm, trigger_details: e.target.value })}
                  placeholder="Additional context"
                />
              </FormGroup>

              <FormGroup label="Notes">
                <Textarea
                  value={reviewForm.notes}
                  onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Any observations or notes from the review"
                />
              </FormGroup>
            </div>
            <div className="ds-modal-footer">
              <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setShowReviewModal(false)}>
                Cancel
              </button>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Record Review'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Staff Status Modal */}
      <Modal isOpen={showStaffModal} onClose={() => setShowStaffModal(false)} size="lg">
          <div className="ds-modal-header">
            <h2>Staff Acknowledgement Status</h2>
            <button type="button" className="ds-modal-close" onClick={() => setShowStaffModal(false)}>
              &times;
            </button>
          </div>
          <div className="ds-modal-body">
            <table className="ds-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Acknowledged</th>
                  <th>Pending</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {staffStatus.map((staff) => (
                  <tr key={staff.user_id}>
                    <td>{staff.user_name}</td>
                    <td>{staff.acknowledged_count} / {staff.total_assessments}</td>
                    <td>{staff.pending_count}</td>
                    <td>
                      {staff.is_compliant ? (
                        <span className="ds-badge ds-badge-success">Compliant</span>
                      ) : (
                        <span className="ds-badge ds-badge-warning">Non-Compliant</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="ds-modal-footer">
            <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setShowStaffModal(false)}>
              Close
            </button>
          </div>
      </Modal>

      {/* Require Re-acknowledgement Modal */}
      {selectedAssessment && (
        <Modal isOpen={showReacknowledgementModal} onClose={() => setShowReacknowledgementModal(false)}>
          <form onSubmit={handleSubmitReacknowledgement}>
            <div className="ds-modal-header">
              <h2>Require Re-acknowledgement</h2>
              <button type="button" className="ds-modal-close" onClick={() => setShowReacknowledgementModal(false)}>
                &times;
              </button>
            </div>
            <div className="ds-modal-body">
              <div className="ds-alert ds-alert-warning" style={{ marginBottom: 'var(--space-4)' }}>
                <strong>Important:</strong> This will increment the version number and invalidate all existing acknowledgements.
                All staff will need to re-read and acknowledge this assessment.
              </div>

              <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}>
                Use this after an incident, near-miss, or when you need to ensure all staff re-read
                the assessment (e.g., after a fire, all staff should review fire safety procedures).
              </p>

              <FormGroup label="Reason" required>
                <Select
                  value={reackForm.trigger}
                  onChange={(e) => setReackForm({ ...reackForm, trigger: e.target.value as ReviewTrigger })}
                  required
                >
                  {TRIGGERS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup label="Details" required>
                <Input
                  value={reackForm.trigger_details}
                  onChange={(e) => setReackForm({ ...reackForm, trigger_details: e.target.value })}
                  placeholder="e.g., Following fire alarm incident on 15th Dec"
                  required
                />
              </FormGroup>

              <FormGroup label="Notes">
                <Textarea
                  value={reackForm.notes}
                  onChange={(e) => setReackForm({ ...reackForm, notes: e.target.value })}
                  rows={3}
                  placeholder="Additional notes for the review record"
                />
              </FormGroup>
            </div>
            <div className="ds-modal-footer">
              <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setShowReacknowledgementModal(false)}>
                Cancel
              </button>
              <button type="submit" className="ds-btn ds-btn-warning" disabled={isSubmitting}>
                {isSubmitting ? 'Processing...' : 'Require Re-acknowledgement'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Risk Assessment"
        message={`Are you sure you want to delete "${deleteConfirm?.title}"? This will also delete all acknowledgement records.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

export default AdminRiskAssessments;
