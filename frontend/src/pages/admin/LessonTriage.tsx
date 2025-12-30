import { useState, useEffect } from 'react';
import { lessonsApi, arenasApi } from '../../services/api';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, FormGroup, FormRow, Input, Select, Textarea } from '../../components/ui';
import type { LessonRequest, LessonEnums, Arena } from '../../types';
import { format } from 'date-fns';
import './Admin.css';

type StatusFilter = 'all' | 'pending' | 'accepted' | 'confirmed' | 'completed' | 'declined' | 'cancelled';

interface ConfirmFormData {
  confirmed_date: string;
  confirmed_start_time: string;
  confirmed_end_time: string;
  arena_id: number;
  admin_notes: string;
}

export function AdminLessonTriage() {
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [enums, setEnums] = useState<LessonEnums | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [selectedLesson, setSelectedLesson] = useState<LessonRequest | null>(null);

  // Request state
  const { loading, error, success, setError, setSuccess, setLoading } = useRequestState(true);

  // Confirm modal
  const confirmModal = useModalForm<ConfirmFormData>({
    confirmed_date: '',
    confirmed_start_time: '',
    confirmed_end_time: '',
    arena_id: 0,
    admin_notes: '',
  });

  // Decline modal
  const declineModal = useModalForm<{ reason: string }>({ reason: '' });

  // Cancel modal
  const cancelModal = useModalForm<{ reason: string }>({ reason: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [enumsData, requestsData, arenasData] = await Promise.all([
        lessonsApi.getEnums(),
        lessonsApi.listAllRequests(),
        arenasApi.listAll(),
      ]);
      setEnums(enumsData);
      setRequests(requestsData);
      setArenas(arenasData.filter(a => a.is_active));
    } catch {
      setError('Failed to load lesson requests');
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
    confirmModal.edit(lesson.id, {
      confirmed_date: lesson.requested_date || tomorrow.toISOString().split('T')[0],
      confirmed_start_time: lesson.requested_time || '09:00',
      confirmed_end_time: lesson.requested_time
        ? `${String(parseInt(lesson.requested_time.split(':')[0]) + 1).padStart(2, '0')}:00`
        : '10:00',
      arena_id: arenas.length > 0 ? arenas[0].id : 0,
      admin_notes: '',
    });
  };

  const openDeclineModal = (lesson: LessonRequest) => {
    setSelectedLesson(lesson);
    declineModal.edit(lesson.id, { reason: '' });
  };

  const openCancelModal = (lesson: LessonRequest) => {
    setSelectedLesson(lesson);
    cancelModal.edit(lesson.id, { reason: '' });
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return;

    try {
      await lessonsApi.adminAcceptLesson(selectedLesson.id, {
        confirmed_date: confirmModal.formData.confirmed_date,
        confirmed_start_time: confirmModal.formData.confirmed_start_time,
        confirmed_end_time: confirmModal.formData.confirmed_end_time,
        arena_id: confirmModal.formData.arena_id || undefined,
        admin_notes: confirmModal.formData.admin_notes || undefined,
      });
      confirmModal.close();
      setSelectedLesson(null);
      setSuccess('Lesson confirmed successfully');
      await loadData();
    } catch {
      setError('Failed to confirm lesson');
    }
  };

  const handleDecline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return;

    try {
      await lessonsApi.adminDeclineLesson(selectedLesson.id, {
        declined_reason: declineModal.formData.reason,
      });
      declineModal.close();
      setSelectedLesson(null);
      setSuccess('Lesson declined');
      await loadData();
    } catch {
      setError('Failed to decline lesson');
    }
  };

  const handleComplete = async (lesson: LessonRequest) => {
    try {
      await lessonsApi.adminCompleteLesson(lesson.id);
      setSuccess('Lesson marked as complete');
      await loadData();
    } catch {
      setError('Failed to complete lesson');
    }
  };

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLesson) return;

    try {
      await lessonsApi.adminCancelLesson(selectedLesson.id, cancelModal.formData.reason);
      cancelModal.close();
      setSelectedLesson(null);
      setSuccess('Lesson cancelled');
      await loadData();
    } catch {
      setError('Failed to cancel lesson');
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
    return <div className="ds-loading">Loading lesson requests...</div>;
  }

  return (
    <div className="admin-page">
      {error && <div className="ds-alert ds-alert-error">{error}</div>}
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
        <div className="ds-empty">
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
      <Modal
        isOpen={confirmModal.isOpen && !!selectedLesson}
        onClose={() => {
          confirmModal.close();
          setSelectedLesson(null);
        }}
        title="Confirm Lesson"
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              confirmModal.close();
              setSelectedLesson(null);
            }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-success" onClick={handleConfirm}>
              Confirm Lesson
            </button>
          </>
        }
      >
        {selectedLesson && (
          <>
            <p>
              <strong>{selectedLesson.user_name || selectedLesson.guest_name}</strong> with{' '}
              <strong>{selectedLesson.coach_name}</strong>
            </p>
            <p className="text-muted">
              Requested: {formatDate(selectedLesson.requested_date)}
              {selectedLesson.requested_time && ` at ${formatTime(selectedLesson.requested_time)}`}
            </p>

            <form onSubmit={handleConfirm}>
              <FormGroup label="Confirmed Date" required>
                <Input
                  type="date"
                  value={confirmModal.formData.confirmed_date}
                  onChange={(e) => confirmModal.updateField('confirmed_date', e.target.value)}
                  required
                />
              </FormGroup>

              <FormRow>
                <FormGroup label="Start Time" required>
                  <Input
                    type="time"
                    value={confirmModal.formData.confirmed_start_time}
                    onChange={(e) => confirmModal.updateField('confirmed_start_time', e.target.value)}
                    required
                  />
                </FormGroup>
                <FormGroup label="End Time" required>
                  <Input
                    type="time"
                    value={confirmModal.formData.confirmed_end_time}
                    onChange={(e) => confirmModal.updateField('confirmed_end_time', e.target.value)}
                    required
                  />
                </FormGroup>
              </FormRow>

              <FormGroup label="Arena">
                <Select
                  value={confirmModal.formData.arena_id}
                  onChange={(e) => confirmModal.updateField('arena_id', parseInt(e.target.value))}
                >
                  <option value={0}>No arena (off-site)</option>
                  {arenas.map((arena) => (
                    <option key={arena.id} value={arena.id}>
                      {arena.name}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup label="Notes">
                <Textarea
                  value={confirmModal.formData.admin_notes}
                  onChange={(e) => confirmModal.updateField('admin_notes', e.target.value)}
                  rows={2}
                  placeholder="Any notes..."
                />
              </FormGroup>
            </form>
          </>
        )}
      </Modal>

      {/* Decline Modal */}
      <Modal
        isOpen={declineModal.isOpen && !!selectedLesson}
        onClose={() => {
          declineModal.close();
          setSelectedLesson(null);
        }}
        title="Decline Lesson Request"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              declineModal.close();
              setSelectedLesson(null);
            }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-danger" onClick={handleDecline}>
              Decline
            </button>
          </>
        }
      >
        {selectedLesson && (
          <>
            <p>
              <strong>{selectedLesson.user_name || selectedLesson.guest_name}</strong> with{' '}
              <strong>{selectedLesson.coach_name}</strong>
            </p>

            <form onSubmit={handleDecline}>
              <FormGroup label="Reason for declining" required>
                <Textarea
                  value={declineModal.formData.reason}
                  onChange={(e) => declineModal.updateField('reason', e.target.value)}
                  rows={3}
                  placeholder="Please provide a reason..."
                  required
                />
              </FormGroup>
            </form>
          </>
        )}
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModal.isOpen && !!selectedLesson}
        onClose={() => {
          cancelModal.close();
          setSelectedLesson(null);
        }}
        title="Cancel Lesson"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              cancelModal.close();
              setSelectedLesson(null);
            }}>
              Keep Lesson
            </button>
            <button className="ds-btn ds-btn-danger" onClick={handleCancel}>
              Cancel Lesson
            </button>
          </>
        }
      >
        {selectedLesson && (
          <>
            <p>
              <strong>{selectedLesson.user_name || selectedLesson.guest_name}</strong> with{' '}
              <strong>{selectedLesson.coach_name}</strong>
            </p>

            <form onSubmit={handleCancel}>
              <FormGroup label="Reason for cancellation" required>
                <Textarea
                  value={cancelModal.formData.reason}
                  onChange={(e) => cancelModal.updateField('reason', e.target.value)}
                  rows={3}
                  placeholder="Please provide a reason..."
                  required
                />
              </FormGroup>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
