import { useState, useEffect, useCallback } from 'react';
import { holidayLiveryApi, stablesApi } from '../../services/api';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, Input, Select, Textarea } from '../../components/ui';
import type {
  HolidayLiveryRequestSummary,
  HolidayLiveryRequestResponse,
  HolidayLiveryStatus,
  Stable,
} from '../../types';
import { format } from 'date-fns';
import './Admin.css';

type StatusFilter = 'all' | HolidayLiveryStatus;

interface ApproveFormData {
  confirmed_arrival: string;
  confirmed_departure: string;
  assigned_stable_id: number;
  admin_notes: string;
}

interface RejectFormData {
  rejection_reason: string;
  admin_notes: string;
}

export function AdminHolidayLiveryRequests() {
  const [requests, setRequests] = useState<HolidayLiveryRequestSummary[]>([]);
  const [stables, setStables] = useState<Stable[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Request state
  const { loading, error, success, setError, setSuccess, setLoading } = useRequestState(true);

  // Selected request for modals
  const [selectedRequest, setSelectedRequest] = useState<HolidayLiveryRequestResponse | null>(null);

  // Modals
  const approveModal = useModalForm<ApproveFormData>({
    confirmed_arrival: '',
    confirmed_departure: '',
    assigned_stable_id: 0,
    admin_notes: '',
  });
  const rejectModal = useModalForm<RejectFormData>({
    rejection_reason: '',
    admin_notes: '',
  });
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<HolidayLiveryRequestSummary | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [requestsData, stablesData, statsData] = await Promise.all([
        holidayLiveryApi.list(),
        stablesApi.list(true),  // Get active stables only
        holidayLiveryApi.getStats(),
      ]);
      setRequests(requestsData);
      setStables(stablesData);
      setStats(statsData);
    } catch {
      setError('Failed to load holiday livery requests');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy');
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'badge-warning';
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-danger';
      case 'cancelled': return 'badge-secondary';
      default: return '';
    }
  };

  const filteredRequests = requests.filter(r =>
    statusFilter === 'all' || r.status === statusFilter
  );

  const openDetailModal = async (request: HolidayLiveryRequestSummary) => {
    setLoadingDetail(true);
    setShowDetailModal(true);
    try {
      const detail = await holidayLiveryApi.get(request.id);
      setSelectedRequest(detail);
    } catch {
      setError('Failed to load request details');
      setShowDetailModal(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  const openApproveModal = async (request: HolidayLiveryRequestSummary) => {
    setLoadingDetail(true);
    try {
      const detail = await holidayLiveryApi.get(request.id);
      setSelectedRequest(detail);
      approveModal.edit(request.id, {
        confirmed_arrival: detail.requested_arrival,
        confirmed_departure: detail.requested_departure,
        assigned_stable_id: stables.length > 0 ? stables[0].id : 0,
        admin_notes: '',
      });
    } catch {
      setError('Failed to load request details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openRejectModal = async (request: HolidayLiveryRequestSummary) => {
    setLoadingDetail(true);
    try {
      const detail = await holidayLiveryApi.get(request.id);
      setSelectedRequest(detail);
      rejectModal.edit(request.id, {
        rejection_reason: '',
        admin_notes: '',
      });
    } catch {
      setError('Failed to load request details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await holidayLiveryApi.approve(selectedRequest.id, {
        confirmed_arrival: approveModal.formData.confirmed_arrival,
        confirmed_departure: approveModal.formData.confirmed_departure,
        assigned_stable_id: approveModal.formData.assigned_stable_id,
        admin_notes: approveModal.formData.admin_notes || undefined,
      });
      approveModal.close();
      setSelectedRequest(null);
      setSuccess('Request approved - user account and horse record created');
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to approve request');
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await holidayLiveryApi.reject(selectedRequest.id, {
        rejection_reason: rejectModal.formData.rejection_reason,
        admin_notes: rejectModal.formData.admin_notes || undefined,
      });
      rejectModal.close();
      setSelectedRequest(null);
      setSuccess('Request rejected');
      await loadData();
    } catch {
      setError('Failed to reject request');
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;

    try {
      await holidayLiveryApi.cancel(cancelTarget.id);
      setCancelTarget(null);
      setSuccess('Request cancelled');
      await loadData();
    } catch {
      setError('Failed to cancel request');
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <h1>Holiday Livery Requests</h1>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <h1>Holiday Livery Requests</h1>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Requests</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-value">{stats.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card stat-danger">
          <div className="stat-value">{stats.rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Filter */}
      <div className="filters">
        <div className="filter-group">
          <label>Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Guest</th>
              <th>Horse</th>
              <th>Dates</th>
              <th>Nights</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={7} className="empty-row">
                  No requests found
                </td>
              </tr>
            ) : (
              filteredRequests.map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.guest_name}</strong>
                    <br />
                    <small>{request.guest_email}</small>
                  </td>
                  <td>{request.horse_name}</td>
                  <td>
                    {formatDate(request.requested_arrival)} - {formatDate(request.requested_departure)}
                  </td>
                  <td>{request.requested_nights}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                      {request.status}
                    </span>
                  </td>
                  <td>{formatDate(request.created_at)}</td>
                  <td className="actions-cell">
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => openDetailModal(request)}
                    >
                      View
                    </button>
                    {request.status === 'pending' && (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => openApproveModal(request)}
                        >
                          Approve
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => openRejectModal(request)}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {(request.status === 'pending' || request.status === 'approved') && (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => setCancelTarget(request)}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="Request Details"
        size="lg"
      >
        {loadingDetail ? (
          <p>Loading...</p>
        ) : selectedRequest ? (
          <div className="detail-grid">
            <div className="detail-section">
              <h3>Guest Information</h3>
              <dl>
                <dt>Name</dt>
                <dd>{selectedRequest.guest_name}</dd>
                <dt>Email</dt>
                <dd>{selectedRequest.guest_email}</dd>
                <dt>Phone</dt>
                <dd>{selectedRequest.guest_phone || '-'}</dd>
              </dl>
            </div>

            <div className="detail-section">
              <h3>Horse Information</h3>
              <dl>
                <dt>Name</dt>
                <dd>{selectedRequest.horse_name}</dd>
                <dt>Breed</dt>
                <dd>{selectedRequest.horse_breed || '-'}</dd>
                <dt>Age</dt>
                <dd>{selectedRequest.horse_age ? `${selectedRequest.horse_age} years` : '-'}</dd>
                <dt>Colour</dt>
                <dd>{selectedRequest.horse_colour || '-'}</dd>
                <dt>Gender</dt>
                <dd>{selectedRequest.horse_gender || '-'}</dd>
              </dl>
            </div>

            <div className="detail-section">
              <h3>Requested Dates</h3>
              <dl>
                <dt>Arrival</dt>
                <dd>{formatDate(selectedRequest.requested_arrival)}</dd>
                <dt>Departure</dt>
                <dd>{formatDate(selectedRequest.requested_departure)}</dd>
                <dt>Nights</dt>
                <dd>{selectedRequest.requested_nights}</dd>
              </dl>
            </div>

            {selectedRequest.special_requirements && (
              <div className="detail-section full-width">
                <h3>Special Requirements</h3>
                <p>{selectedRequest.special_requirements}</p>
              </div>
            )}

            {selectedRequest.message && (
              <div className="detail-section full-width">
                <h3>Message</h3>
                <p>{selectedRequest.message}</p>
              </div>
            )}

            {selectedRequest.status === 'approved' && (
              <div className="detail-section full-width">
                <h3>Approval Details</h3>
                <dl>
                  <dt>Confirmed Arrival</dt>
                  <dd>{selectedRequest.confirmed_arrival ? formatDate(selectedRequest.confirmed_arrival) : '-'}</dd>
                  <dt>Confirmed Departure</dt>
                  <dd>{selectedRequest.confirmed_departure ? formatDate(selectedRequest.confirmed_departure) : '-'}</dd>
                  <dt>Assigned Stable</dt>
                  <dd>{selectedRequest.assigned_stable_name || '-'}</dd>
                  <dt>User Account</dt>
                  <dd>{selectedRequest.created_user_name || '-'}</dd>
                  <dt>Processed By</dt>
                  <dd>{selectedRequest.processed_by_name || '-'}</dd>
                </dl>
              </div>
            )}

            {selectedRequest.status === 'rejected' && selectedRequest.rejection_reason && (
              <div className="detail-section full-width">
                <h3>Rejection Reason</h3>
                <p>{selectedRequest.rejection_reason}</p>
              </div>
            )}

            {selectedRequest.admin_notes && (
              <div className="detail-section full-width">
                <h3>Admin Notes</h3>
                <pre className="admin-notes">{selectedRequest.admin_notes}</pre>
              </div>
            )}
          </div>
        ) : null}
      </Modal>

      {/* Approve Modal */}
      <Modal
        isOpen={approveModal.isOpen && !!selectedRequest}
        onClose={() => {
          approveModal.close();
          setSelectedRequest(null);
        }}
        title="Approve Request"
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              approveModal.close();
              setSelectedRequest(null);
            }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-success" onClick={handleApprove}>
              Approve & Create Account
            </button>
          </>
        }
      >
        {selectedRequest && (
          <>
            <p>
              Approving this request will create a user account for{' '}
              <strong>{selectedRequest.guest_name}</strong> and register{' '}
              <strong>{selectedRequest.horse_name}</strong> as a holiday livery horse.
            </p>

            <form onSubmit={handleApprove}>
              <FormGroup label="Confirmed Arrival Date" required>
                <Input
                  type="date"
                  value={approveModal.formData.confirmed_arrival}
                  onChange={(e) => approveModal.updateField('confirmed_arrival', e.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="Confirmed Departure Date" required>
                <Input
                  type="date"
                  value={approveModal.formData.confirmed_departure}
                  onChange={(e) => approveModal.updateField('confirmed_departure', e.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="Assign Stable" required>
                <Select
                  value={approveModal.formData.assigned_stable_id}
                  onChange={(e) => approveModal.updateField('assigned_stable_id', parseInt(e.target.value))}
                  required
                >
                  <option value="">Select a stable...</option>
                  {stables.map((stable) => (
                    <option key={stable.id} value={stable.id}>
                      {stable.name}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup label="Admin Notes">
                <Textarea
                  rows={3}
                  value={approveModal.formData.admin_notes}
                  onChange={(e) => approveModal.updateField('admin_notes', e.target.value)}
                  placeholder="Internal notes (not shown to guest)"
                />
              </FormGroup>
            </form>
          </>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.isOpen && !!selectedRequest}
        onClose={() => {
          rejectModal.close();
          setSelectedRequest(null);
        }}
        title="Reject Request"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              rejectModal.close();
              setSelectedRequest(null);
            }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-danger" onClick={handleReject}>
              Reject Request
            </button>
          </>
        }
      >
        {selectedRequest && (
          <>
            <p>
              Rejecting the request from <strong>{selectedRequest.guest_name}</strong> for{' '}
              <strong>{selectedRequest.horse_name}</strong>.
            </p>

            <form onSubmit={handleReject}>
              <FormGroup label="Rejection Reason" required>
                <Textarea
                  rows={3}
                  value={rejectModal.formData.rejection_reason}
                  onChange={(e) => rejectModal.updateField('rejection_reason', e.target.value)}
                  placeholder="This will be shared with the guest"
                  required
                />
              </FormGroup>

              <FormGroup label="Admin Notes">
                <Textarea
                  rows={2}
                  value={rejectModal.formData.admin_notes}
                  onChange={(e) => rejectModal.updateField('admin_notes', e.target.value)}
                  placeholder="Internal notes (not shown to guest)"
                />
              </FormGroup>
            </form>
          </>
        )}
      </Modal>

      {/* Cancel Confirmation */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel Request"
        message={`Are you sure you want to cancel the request from ${cancelTarget?.guest_name} for ${cancelTarget?.horse_name}?`}
        confirmLabel="Cancel Request"
        variant="danger"
      />
    </div>
  );
}

export default AdminHolidayLiveryRequests;
