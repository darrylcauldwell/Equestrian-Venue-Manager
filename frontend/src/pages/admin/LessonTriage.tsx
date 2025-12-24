import { useState, useEffect } from 'react';
import { lessonsApi, arenasApi } from '../../services/api';
import type { LessonRequest, LessonEnums, Arena } from '../../types';
import { format } from 'date-fns';
import './Admin.css';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'confirmed' | 'completed' | 'declined' | 'cancelled';

export function AdminLessonTriage() {
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [enums, setEnums] = useState<LessonEnums | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');

  // Confirm modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonRequest | null>(null);
  const [confirmForm, setConfirmForm] = useState({
    confirmed_date: '',
    confirmed_start_time: '',
    confirmed_end_time: '',
    arena_id: 0,
    admin_notes: '',
  });

  // Decline modal state
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [enumsData, requestsData, arenasData] = await Promise.all([
        lessonsApi.getEnums(),
        lessonsApi.listAllRequests(),
        arenasApi.listAll(),
      ]);
      setEnums(enumsData);
      setRequests(requestsData);
      setArenas(arenasData.filter(a => a.is_active));
    } catch (err) {
      setError('Failed to load lesson requests');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy');
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'badge-warning';
      case 'accepted': return 'badge-info';
      case 'declined': return 'badge-danger';
      case 'confirmed': return 'badge-success';
      case 'cancelled': return 'badge-secondary';
      case 'completed': return 'badge-primary';
      default: return '';
    }
  };

  const getEnumLabel = (value: string, enumList?: { value: string; label: string }[]) => {
    if (!enumList) return value;
    const item = enumList.find(e => e.value === value);
    return item?.label || value;
  };

  const openConfirmModal = (lesson: LessonRequest) => {
    setSelectedLesson(lesson);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setConfirmForm({
      confirmed_date: lesson.requested_date || tomorrow.toISOString().split('T')[0],
      confirmed_start_time: lesson.requested_time || '09:00',
      confirmed_end_time: lesson.requested_time
        ? `${String(parseInt(lesson.requested_time.split(':')[0]) + 1).padStart(2, '0')}:00`
        : '10:00',
      arena_id: arenas.length > 0 ? arenas[0].id : 0,
      admin_notes: '',
    });
    setShowConfirmModal(true);
  };

  const openDeclineModal = (lesson: LessonRequest) => {
    setSelectedLesson(lesson);
    setDeclineReason('');
    setShowDeclineModal(true);
  };

  const openCancelModal = (lesson: LessonRequest) => {
    setSelectedLesson(lesson);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return;

    try {
      await lessonsApi.adminAcceptLesson(selectedLesson.id, {
        confirmed_date: confirmForm.confirmed_date,
        confirmed_start_time: confirmForm.confirmed_start_time,
        confirmed_end_time: confirmForm.confirmed_end_time,
        arena_id: confirmForm.arena_id || undefined,
        admin_notes: confirmForm.admin_notes || undefined,
      });
      setShowConfirmModal(false);
      setSelectedLesson(null);
      setSuccess('Lesson confirmed successfully');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch {
      setError('Failed to confirm lesson');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return;

    try {
      await lessonsApi.adminDeclineLesson(selectedLesson.id, {
        declined_reason: declineReason,
      });
      setShowDeclineModal(false);
      setSelectedLesson(null);
      setSuccess('Lesson declined');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch {
      setError('Failed to decline lesson');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleComplete = async (lesson: LessonRequest) => {
    try {
      await lessonsApi.adminCompleteLesson(lesson.id);
      setSuccess('Lesson marked as complete');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch {
      setError('Failed to complete lesson');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return;

    try {
      await lessonsApi.adminCancelLesson(selectedLesson.id, cancelReason);
      setShowCancelModal(false);
      setSelectedLesson(null);
      setSuccess('Lesson cancelled');
      setTimeout(() => setSuccess(''), 3000);
      await loadData();
    } catch {
      setError('Failed to cancel lesson');
      setTimeout(() => setError(''), 3000);
    }
  };

  const filteredRequests = requests.filter(r => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  const statusCounts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    accepted: requests.filter(r => r.status === 'accepted').length,
    confirmed: requests.filter(r => r.status === 'confirmed').length,
    completed: requests.filter(r => r.status === 'completed').length,
    declined: requests.filter(r => r.status === 'declined').length,
    cancelled: requests.filter(r => r.status === 'cancelled').length,
  };

  if (loading) {
    return <div className="loading">Loading lesson requests...</div>;
  }

  return (
    <div className="admin-page">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Status Filter Tabs */}
      <div className="triage-filters">
        <button
          className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`}
          onClick={() => setStatusFilter('pending')}
        >
          Pending ({statusCounts.pending})
        </button>
        <button
          className={`filter-btn ${statusFilter === 'accepted' ? 'active' : ''}`}
          onClick={() => setStatusFilter('accepted')}
        >
          Accepted ({statusCounts.accepted})
        </button>
        <button
          className={`filter-btn ${statusFilter === 'confirmed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('confirmed')}
        >
          Confirmed ({statusCounts.confirmed})
        </button>
        <button
          className={`filter-btn ${statusFilter === 'completed' ? 'active' : ''}`}
          onClick={() => setStatusFilter('completed')}
        >
          Completed ({statusCounts.completed})
        </button>
        <button
          className={`filter-btn ${statusFilter === 'declined' ? 'active' : ''}`}
          onClick={() => setStatusFilter('declined')}
        >
          Declined ({statusCounts.declined})
        </button>
        <button
          className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All ({statusCounts.all})
        </button>
      </div>

      {/* Requests Table */}
      {filteredRequests.length === 0 ? (
        <div className="empty-state">
          <p>No lesson requests {statusFilter !== 'all' ? `with status "${statusFilter}"` : ''}</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Coach</th>
                <th>Date</th>
                <th>Time</th>
                <th>Discipline</th>
                <th>Price</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map(request => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.user_name || request.guest_name || 'Unknown'}</strong>
                    {request.horse_name && (
                      <div className="text-muted">Horse: {request.horse_name}</div>
                    )}
                  </td>
                  <td>{request.coach_name}</td>
                  <td>
                    {request.confirmed_date
                      ? formatDate(request.confirmed_date)
                      : formatDate(request.requested_date)
                    }
                    {request.confirmed_date && request.confirmed_date !== request.requested_date && (
                      <div className="text-muted">
                        (Requested: {formatDate(request.requested_date)})
                      </div>
                    )}
                  </td>
                  <td>
                    {request.confirmed_start_time
                      ? `${formatTime(request.confirmed_start_time)}${request.confirmed_end_time ? ` - ${formatTime(request.confirmed_end_time)}` : ''}`
                      : request.requested_time
                        ? formatTime(request.requested_time)
                        : '-'
                    }
                  </td>
                  <td>
                    {request.discipline
                      ? getEnumLabel(request.discipline, enums?.disciplines)
                      : '-'
                    }
                  </td>
                  <td>&pound;{Number(request.total_price).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                      {getEnumLabel(request.status, enums?.statuses)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${request.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                      {request.payment_status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {request.status === 'pending' && (
                        <>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => openConfirmModal(request)}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => openDeclineModal(request)}
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {request.status === 'accepted' && (
                        <>
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => openConfirmModal(request)}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openCancelModal(request)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {request.status === 'confirmed' && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleComplete(request)}
                          >
                            Complete
                          </button>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openCancelModal(request)}
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && selectedLesson && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Lesson</h2>
              <button className="close-btn" onClick={() => setShowConfirmModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                <strong>{selectedLesson.user_name || selectedLesson.guest_name}</strong> with{' '}
                <strong>{selectedLesson.coach_name}</strong>
              </p>
              <p className="text-muted">
                Requested: {formatDate(selectedLesson.requested_date)}
                {selectedLesson.requested_time && ` at ${formatTime(selectedLesson.requested_time)}`}
              </p>

              <form onSubmit={handleConfirm}>
                <div className="form-group">
                  <label>Confirmed Date</label>
                  <input
                    type="date"
                    value={confirmForm.confirmed_date}
                    onChange={(e) => setConfirmForm({ ...confirmForm, confirmed_date: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time</label>
                    <input
                      type="time"
                      value={confirmForm.confirmed_start_time}
                      onChange={(e) => setConfirmForm({ ...confirmForm, confirmed_start_time: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input
                      type="time"
                      value={confirmForm.confirmed_end_time}
                      onChange={(e) => setConfirmForm({ ...confirmForm, confirmed_end_time: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Arena</label>
                  <select
                    value={confirmForm.arena_id}
                    onChange={(e) => setConfirmForm({ ...confirmForm, arena_id: parseInt(e.target.value) })}
                  >
                    <option value={0}>No arena (off-site)</option>
                    {arenas.map((arena) => (
                      <option key={arena.id} value={arena.id}>
                        {arena.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Notes (optional)</label>
                  <textarea
                    value={confirmForm.admin_notes}
                    onChange={(e) => setConfirmForm({ ...confirmForm, admin_notes: e.target.value })}
                    rows={2}
                    placeholder="Any notes..."
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success">
                    Confirm Lesson
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {showDeclineModal && selectedLesson && (
        <div className="modal-overlay" onClick={() => setShowDeclineModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Decline Lesson Request</h2>
              <button className="close-btn" onClick={() => setShowDeclineModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                <strong>{selectedLesson.user_name || selectedLesson.guest_name}</strong> with{' '}
                <strong>{selectedLesson.coach_name}</strong>
              </p>

              <form onSubmit={handleDecline}>
                <div className="form-group">
                  <label>Reason for declining</label>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    rows={3}
                    placeholder="Please provide a reason..."
                    required
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowDeclineModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger">
                    Decline
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && selectedLesson && (
        <div className="modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Cancel Lesson</h2>
              <button className="close-btn" onClick={() => setShowCancelModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                <strong>{selectedLesson.user_name || selectedLesson.guest_name}</strong> with{' '}
                <strong>{selectedLesson.coach_name}</strong>
              </p>

              <form onSubmit={handleCancel}>
                <div className="form-group">
                  <label>Reason for cancellation</label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    rows={3}
                    placeholder="Please provide a reason..."
                    required
                  />
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCancelModal(false)}>
                    Keep Lesson
                  </button>
                  <button type="submit" className="btn btn-danger">
                    Cancel Lesson
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
