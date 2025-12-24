import { useState, useEffect } from 'react';
import { holidayLiveryApi, stablesApi } from '../../services/api';
import type {
  HolidayLiveryRequestSummary,
  HolidayLiveryRequestResponse,
  HolidayLiveryStatus,
  Stable,
} from '../../types';
import { format } from 'date-fns';
import './Admin.css';

type StatusFilter = 'all' | HolidayLiveryStatus;

export function AdminHolidayLiveryRequests() {
  const [requests, setRequests] = useState<HolidayLiveryRequestSummary[]>([]);
  const [stables, setStables] = useState<Stable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // Selected request for modals
  const [selectedRequest, setSelectedRequest] = useState<HolidayLiveryRequestResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Approve modal state
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveForm, setApproveForm] = useState({
    confirmed_arrival: '',
    confirmed_departure: '',
    assigned_stable_id: 0,
    admin_notes: '',
  });

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectForm, setRejectForm] = useState({
    rejection_reason: '',
    admin_notes: '',
  });

  // Detail modal state
  const [showDetailModal, setShowDetailModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [requestsData, stablesData, statsData] = await Promise.all([
        holidayLiveryApi.list(),
        stablesApi.list(true),  // Get active stables only
        holidayLiveryApi.getStats(),
      ]);
      setRequests(requestsData);
      setStables(stablesData);
      setStats(statsData);
    } catch (err) {
      setError('Failed to load holiday livery requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
      setApproveForm({
        confirmed_arrival: detail.requested_arrival,
        confirmed_departure: detail.requested_departure,
        assigned_stable_id: stables.length > 0 ? stables[0].id : 0,
        admin_notes: '',
      });
      setShowApproveModal(true);
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
      setRejectForm({
        rejection_reason: '',
        admin_notes: '',
      });
      setShowRejectModal(true);
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
        confirmed_arrival: approveForm.confirmed_arrival,
        confirmed_departure: approveForm.confirmed_departure,
        assigned_stable_id: approveForm.assigned_stable_id,
        admin_notes: approveForm.admin_notes || undefined,
      });
      setShowApproveModal(false);
      setSelectedRequest(null);
      setSuccess('Request approved - user account and horse record created');
      setTimeout(() => setSuccess(''), 5000);
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to approve request');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await holidayLiveryApi.reject(selectedRequest.id, {
        rejection_reason: rejectForm.rejection_reason,
        admin_notes: rejectForm.admin_notes || undefined,
      });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setSuccess('Request rejected');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch {
      setError('Failed to reject request');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCancel = async (request: HolidayLiveryRequestSummary) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    try {
      await holidayLiveryApi.cancel(request.id);
      setSuccess('Request cancelled');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch {
      setError('Failed to cancel request');
      setTimeout(() => setError(''), 3000);
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
                        onClick={() => handleCancel(request)}
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
      {showDetailModal && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Request Details</h2>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
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
            </div>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowApproveModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approve Request</h2>
              <button className="modal-close" onClick={() => setShowApproveModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleApprove}>
              <div className="modal-body">
                <p>
                  Approving this request will create a user account for{' '}
                  <strong>{selectedRequest.guest_name}</strong> and register{' '}
                  <strong>{selectedRequest.horse_name}</strong> as a holiday livery horse.
                </p>

                <div className="form-group">
                  <label>Confirmed Arrival Date *</label>
                  <input
                    type="date"
                    value={approveForm.confirmed_arrival}
                    onChange={(e) => setApproveForm({ ...approveForm, confirmed_arrival: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Confirmed Departure Date *</label>
                  <input
                    type="date"
                    value={approveForm.confirmed_departure}
                    onChange={(e) => setApproveForm({ ...approveForm, confirmed_departure: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Assign Stable *</label>
                  <select
                    value={approveForm.assigned_stable_id}
                    onChange={(e) => setApproveForm({ ...approveForm, assigned_stable_id: parseInt(e.target.value) })}
                    required
                  >
                    <option value="">Select a stable...</option>
                    {stables.map((stable) => (
                      <option key={stable.id} value={stable.id}>
                        {stable.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Admin Notes</label>
                  <textarea
                    rows={3}
                    value={approveForm.admin_notes}
                    onChange={(e) => setApproveForm({ ...approveForm, admin_notes: e.target.value })}
                    placeholder="Internal notes (not shown to guest)"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowApproveModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  Approve & Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Request</h2>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleReject}>
              <div className="modal-body">
                <p>
                  Rejecting the request from <strong>{selectedRequest.guest_name}</strong> for{' '}
                  <strong>{selectedRequest.horse_name}</strong>.
                </p>

                <div className="form-group">
                  <label>Rejection Reason *</label>
                  <textarea
                    rows={3}
                    value={rejectForm.rejection_reason}
                    onChange={(e) => setRejectForm({ ...rejectForm, rejection_reason: e.target.value })}
                    placeholder="This will be shared with the guest"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Admin Notes</label>
                  <textarea
                    rows={2}
                    value={rejectForm.admin_notes}
                    onChange={(e) => setRejectForm({ ...rejectForm, admin_notes: e.target.value })}
                    placeholder="Internal notes (not shown to guest)"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  Reject Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminHolidayLiveryRequests;
