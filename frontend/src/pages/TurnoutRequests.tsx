import { useState, useEffect } from 'react';
import { turnoutApi, horsesApi } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import type { TurnoutRequest, Horse, CreateTurnoutRequest } from '../types';
import './TurnoutRequests.css';

export function TurnoutRequests() {
  const { settings } = useSettings();
  const [requests, setRequests] = useState<TurnoutRequest[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Check if cutoff is active for today
  const todayStr = new Date().toISOString().split('T')[0];
  const isCutoffActive = settings?.turnout_cutoff_date === todayStr;

  // Check if a request can be cancelled
  const canCancelRequest = (request: TurnoutRequest): boolean => {
    // Can always cancel pending requests
    if (request.status === 'pending') return true;
    // For approved requests on today's date, check cutoff
    if (request.request_date === todayStr && isCutoffActive) {
      return false;
    }
    return true;
  };

  const [formData, setFormData] = useState<CreateTurnoutRequest>({
    horse_id: 0,
    request_date: '',
    turnout_type: 'in',  // Always "stay in" request
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [requestsData, horsesData] = await Promise.all([
        turnoutApi.getMyRequests(true),
        horsesApi.list(),
      ]);
      setRequests(requestsData);
      setHorses(horsesData);
    } catch {
      setError('Failed to load turnout requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.horse_id || !formData.request_date) return;

    setSubmitting(true);
    try {
      const newRequest = await turnoutApi.create(formData);
      setRequests([newRequest, ...requests]);
      setShowForm(false);
      resetForm();
    } catch {
      setError('Failed to create turnout request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this turnout request?')) return;
    try {
      await turnoutApi.delete(id);
      setRequests(requests.filter(r => r.id !== id));
    } catch {
      setError('Failed to delete request');
    }
  };

  const resetForm = () => {
    setFormData({
      horse_id: horses.length === 1 ? horses[0].id : 0,
      request_date: '',
      turnout_type: 'in',  // Always "stay in" request
      notes: '',
    });
  };

  const openForm = () => {
    resetForm();
    setShowForm(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'approved': return 'status-approved';
      case 'declined': return 'status-declined';
      default: return 'status-pending';
    }
  };

  
  // Group requests by status
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved');
  const declinedRequests = requests.filter(r => r.status === 'declined');

  if (isLoading) {
    return <div className="ds-loading">Loading turnout requests...</div>;
  }

  return (
    <div className="turnout-requests-page">
      <div className="page-header">
        <div>
          <h1>Stay In Requests</h1>
          <p className="page-subtitle">Request for your horse to stay in instead of being turned out</p>
        </div>
        <button className="add-btn" onClick={openForm}>
          + Request Stay In
        </button>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {horses.length === 0 ? (
        <div className="ds-empty">
          <p>You need to register a horse before making turnout requests.</p>
        </div>
      ) : (
        <>
          {/* New Request Form */}
          {showForm && (
            <div className="request-form-container">
              <form onSubmit={handleSubmit} className="request-form">
                <h2>Request to Stay In</h2>
                <p className="form-description">Request for your horse to stay in their stable instead of being turned out.</p>

                <div className="form-row">
                  <div className="ds-form-group">
                    <label htmlFor="horse">Horse *</label>
                    <select
                      id="horse"
                      value={formData.horse_id}
                      onChange={(e) => setFormData({ ...formData, horse_id: parseInt(e.target.value) })}
                      required
                    >
                      <option value="">Select horse</option>
                      {horses.map(horse => (
                        <option key={horse.id} value={horse.id}>{horse.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="ds-form-group">
                    <label htmlFor="date">Date *</label>
                    <div className="date-input-group">
                      <input
                        id="date"
                        type="date"
                        value={formData.request_date}
                        onChange={(e) => setFormData({ ...formData, request_date: e.target.value })}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                      <button
                        type="button"
                        className="today-btn"
                        onClick={() => setFormData({ ...formData, request_date: new Date().toISOString().split('T')[0] })}
                      >
                        Today
                      </button>
                    </div>
                  </div>
                </div>

                <div className="ds-form-group">
                  <label htmlFor="notes">Reason for staying in *</label>
                  <textarea
                    id="notes"
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g., Riding at 10am, Vet visit at 2pm, Farrier appointment..."
                    rows={2}
                    required
                  />
                </div>

                <div className="form-actions">
                  <button type="button" className="ds-btn ds-btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="ds-btn ds-btn-primary" disabled={submitting}>
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Pending Requests */}
          {pendingRequests.length > 0 && (
            <div className="requests-section">
              <h2>Pending Approval ({pendingRequests.length})</h2>
              <div className="requests-list">
                {pendingRequests.map(request => (
                  <div key={request.id} className="request-card pending">
                    <div className="request-header">
                      <strong>{request.horse_name}</strong>
                      <span className={`status-badge ${getStatusClass(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="request-details">
                      <span className="request-date">{formatDate(request.request_date)}</span>
                      <span className="request-type">Stay In</span>
                    </div>
                    {request.notes && (
                      <p className="request-reason"><strong>Reason:</strong> {request.notes}</p>
                    )}
                    <div className="request-actions">
                      <button className="delete-btn" onClick={() => handleDelete(request.id)}>
                        Cancel Request
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Approved Requests */}
          {approvedRequests.length > 0 && (
            <div className="requests-section">
              <h2>Approved ({approvedRequests.length})</h2>
              <div className="requests-list">
                {approvedRequests.map(request => (
                  <div key={request.id} className="request-card approved">
                    <div className="request-header">
                      <strong>{request.horse_name}</strong>
                      <span className={`status-badge ${getStatusClass(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="request-details">
                      <span className="request-date">{formatDate(request.request_date)}</span>
                      <span className="request-type">Stay In</span>
                    </div>
                    {request.notes && (
                      <p className="request-reason"><strong>Reason:</strong> {request.notes}</p>
                    )}
                    {request.response_message && (
                      <p className="staff-message">
                        <strong>Staff note:</strong> {request.response_message}
                      </p>
                    )}
                    {canCancelRequest(request) && (
                      <div className="request-actions">
                        <button className="delete-btn" onClick={() => handleDelete(request.id)}>
                          Cancel Request
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Declined Requests */}
          {declinedRequests.length > 0 && (
            <div className="requests-section">
              <h2>Declined ({declinedRequests.length})</h2>
              <div className="requests-list">
                {declinedRequests.map(request => (
                  <div key={request.id} className="request-card declined">
                    <div className="request-header">
                      <strong>{request.horse_name}</strong>
                      <span className={`status-badge ${getStatusClass(request.status)}`}>
                        {request.status}
                      </span>
                    </div>
                    <div className="request-details">
                      <span className="request-date">{formatDate(request.request_date)}</span>
                      <span className="request-type">Stay In</span>
                    </div>
                    {request.notes && (
                      <p className="request-reason"><strong>Reason:</strong> {request.notes}</p>
                    )}
                    {request.response_message && (
                      <p className="staff-message declined-reason">
                        <strong>Staff response:</strong> {request.response_message}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {requests.length === 0 && !showForm && (
            <div className="ds-empty">
              <p>No stay in requests yet.</p>
              <p>Use the button above to request your horse stays in their stable.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
