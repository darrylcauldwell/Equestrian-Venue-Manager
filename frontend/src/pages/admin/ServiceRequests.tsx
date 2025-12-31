import { useState, useEffect, useCallback } from 'react';
import { servicesApi, usersApi } from '../../services/api';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, FormGroup, Input, Select, Textarea } from '../../components/ui';
import type { StaffServiceRequestsSummary, ServiceRequest, User } from '../../types';
import './Admin.css';

type ViewTab = 'needs-quote' | 'ready-to-schedule' | 'scheduled' | 'completed';

interface QuoteFormData {
  quote_amount: string;
  quote_notes: string;
}

interface ScheduleFormData {
  assigned_to_id: number;
  scheduled_datetime: string;
  notes: string;
}

export function AdminServiceRequests() {
  const [activeTab, setActiveTab] = useState<ViewTab>('needs-quote');
  const [requests, setRequests] = useState<StaffServiceRequestsSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);

  // Request state
  const { loading: isLoading, error, success, setError, setSuccess, setLoading } = useRequestState(true);

  // Quote modal
  const quoteModal = useModalForm<QuoteFormData>({ quote_amount: '', quote_notes: '' });

  // Schedule modal
  const scheduleModal = useModalForm<ScheduleFormData>({
    assigned_to_id: 0,
    scheduled_datetime: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [requestsData, usersData] = await Promise.all([
        servicesApi.getStaffRequests(),
        usersApi.list(),
      ]);
      setRequests(requestsData);
      setUsers(usersData.filter(u => u.role === 'admin' || u.is_yard_staff));
    } catch {
      setError('Failed to load service requests');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openQuoteModal = (request: ServiceRequest) => {
    setSelectedRequest(request);
    // Don't pre-fill if price is 0 (rehab assistance needs custom quote)
    const defaultPrice = request.service_price && parseFloat(request.service_price.toString()) > 0
      ? request.service_price.toString()
      : '';
    quoteModal.edit(request.id, {
      quote_amount: defaultPrice,
      quote_notes: '',
    });
  };

  const handleQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await servicesApi.quoteRequest(selectedRequest.id, {
        quote_amount: parseFloat(quoteModal.formData.quote_amount),
        quote_notes: quoteModal.formData.quote_notes || undefined,
      });
      quoteModal.close();
      setSelectedRequest(null);
      setSuccess('Quote sent to client');
      await loadData();
    } catch {
      setError('Failed to add quote');
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      await servicesApi.scheduleRequest(selectedRequest.id, {
        assigned_to_id: scheduleModal.formData.assigned_to_id,
        scheduled_datetime: scheduleModal.formData.scheduled_datetime,
        notes: scheduleModal.formData.notes || undefined,
      });
      scheduleModal.close();
      setSelectedRequest(null);
      setSuccess('Service scheduled');
      await loadData();
    } catch {
      setError('Failed to schedule request');
    }
  };

  const handleComplete = async (requestId: number) => {
    try {
      await servicesApi.completeRequest(requestId, {});
      setSuccess('Service marked as complete');
      await loadData();
    } catch {
      setError('Failed to complete request');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (price: number | string | undefined) => {
    if (price === undefined) return '-';
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `£${numPrice.toFixed(2)}`;
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      pending: 'badge-warning',
      approved: 'badge-warning',
      scheduled: 'badge-info',
      completed: 'badge-success',
      cancelled: 'badge-secondary',
    };
    return classes[status] || '';
  };

  const openScheduleModal = (request: ServiceRequest) => {
    setSelectedRequest(request);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    scheduleModal.edit(request.id, {
      assigned_to_id: users.length > 0 ? users[0].id : 0,
      scheduled_datetime: tomorrow.toISOString().slice(0, 16),
      notes: '',
    });
  };

  if (isLoading) {
    return <div className="ds-loading">Loading service requests...</div>;
  }

  // Needs Quote = pending approval (status = pending, no quote yet)
  const needsQuoteRequests = requests?.pending_approval || [];
  // Ready to Schedule = pending scheduling (status = approved, quote accepted)
  const readyToScheduleRequests = requests?.pending_scheduling || [];
  // Scheduled = scheduled_today (scheduled but not complete)
  const scheduledRequests = requests?.scheduled_today || [];
  const completedRequests = requests?.completed || [];

  const counts = {
    'needs-quote': needsQuoteRequests.length,
    'ready-to-schedule': readyToScheduleRequests.length,
    scheduled: scheduledRequests.length,
    completed: completedRequests.length,
  };

  const getActiveRequests = (): ServiceRequest[] => {
    switch (activeTab) {
      case 'needs-quote': return needsQuoteRequests;
      case 'ready-to-schedule': return readyToScheduleRequests;
      case 'scheduled': return scheduledRequests;
      case 'completed': return completedRequests;
      default: return [];
    }
  };

  return (
    <div className="admin-page">
      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Tab Navigation */}
      <div className="triage-filters">
        <button
          className={`filter-btn ${activeTab === 'needs-quote' ? 'active' : ''}`}
          onClick={() => setActiveTab('needs-quote')}
        >
          Needs Quote ({counts['needs-quote']})
        </button>
        <button
          className={`filter-btn ${activeTab === 'ready-to-schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('ready-to-schedule')}
        >
          Ready to Schedule ({counts['ready-to-schedule']})
        </button>
        <button
          className={`filter-btn ${activeTab === 'scheduled' ? 'active' : ''}`}
          onClick={() => setActiveTab('scheduled')}
        >
          Scheduled ({counts.scheduled})
        </button>
        <button
          className={`filter-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          Completed ({counts.completed})
        </button>
      </div>

      {/* Requests Table */}
      {getActiveRequests().length === 0 ? (
        <div className="ds-empty">
          <p>No {activeTab.replace(/-/g, ' ')} service requests</p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Horse</th>
                <th>Requested By</th>
                <th>Requested For</th>
                {(activeTab === 'scheduled' || activeTab === 'completed') && <th>Assigned To</th>}
                {activeTab === 'scheduled' && <th>Scheduled</th>}
                <th>Price</th>
                <th>Status</th>
                {activeTab !== 'completed' && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {getActiveRequests().map((request) => (
                <tr key={request.id}>
                  <td>
                    <strong>{request.service_name}</strong>
                    {request.special_instructions && (
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                        {request.special_instructions}
                      </div>
                    )}
                  </td>
                  <td>{request.horse_name}</td>
                  <td>{request.requested_by_name}</td>
                  <td>
                    {formatDate(request.requested_date)}
                    {request.preferred_time && (
                      <div className="text-muted">{request.preferred_time}</div>
                    )}
                  </td>
                  {(activeTab === 'scheduled' || activeTab === 'completed') && (
                    <td>{request.assigned_to_name || '-'}</td>
                  )}
                  {activeTab === 'scheduled' && (
                    <td>
                      {request.scheduled_datetime ? formatDateTime(request.scheduled_datetime) : '-'}
                    </td>
                  )}
                  <td>
                    {activeTab === 'needs-quote' ? formatPrice(request.service_price) :
                     request.quote_amount ? formatPrice(request.quote_amount) : formatPrice(request.service_price)}
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                      {activeTab === 'needs-quote' ? 'Pending Quote' :
                       activeTab === 'ready-to-schedule' ? (request.status === 'approved' ? 'Quote Accepted' : 'Ready') :
                       activeTab === 'scheduled' ? 'Scheduled' : 'Completed'}
                    </span>
                  </td>
                  {activeTab === 'needs-quote' && (
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openQuoteModal(request)}
                      >
                        Add Quote
                      </button>
                    </td>
                  )}
                  {activeTab === 'ready-to-schedule' && (
                    <td>
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => openScheduleModal(request)}
                      >
                        Schedule
                      </button>
                    </td>
                  )}
                  {activeTab === 'scheduled' && (
                    <td>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleComplete(request.id)}
                      >
                        Complete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule Modal */}
      <Modal
        isOpen={scheduleModal.isOpen && !!selectedRequest}
        onClose={() => {
          scheduleModal.close();
          setSelectedRequest(null);
        }}
        title="Schedule Service"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              scheduleModal.close();
              setSelectedRequest(null);
            }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleSchedule}>
              Schedule
            </button>
          </>
        }
      >
        {selectedRequest && (
          <>
            <p><strong>{selectedRequest.service_name}</strong> for {selectedRequest.horse_name}</p>
            <p className="text-muted">Requested by: {selectedRequest.requested_by_name}</p>

            <form onSubmit={handleSchedule}>
              <FormGroup label="Assign To" required>
                <Select
                  value={scheduleModal.formData.assigned_to_id}
                  onChange={(e) => scheduleModal.updateField('assigned_to_id', parseInt(e.target.value))}
                  required
                >
                  <option value="">Select staff member</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup label="Scheduled Date & Time" required>
                <Input
                  type="datetime-local"
                  value={scheduleModal.formData.scheduled_datetime}
                  onChange={(e) => scheduleModal.updateField('scheduled_datetime', e.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="Notes">
                <Textarea
                  value={scheduleModal.formData.notes}
                  onChange={(e) => scheduleModal.updateField('notes', e.target.value)}
                  rows={3}
                  placeholder="Any notes for the assigned staff member..."
                />
              </FormGroup>
            </form>
          </>
        )}
      </Modal>

      {/* Quote Modal */}
      <Modal
        isOpen={quoteModal.isOpen && !!selectedRequest}
        onClose={() => {
          quoteModal.close();
          setSelectedRequest(null);
        }}
        title="Add Quote"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              quoteModal.close();
              setSelectedRequest(null);
            }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleQuote}>
              Send Quote
            </button>
          </>
        }
      >
        {selectedRequest && (
          <>
            <p><strong>{selectedRequest.service_name}</strong> for {selectedRequest.horse_name}</p>
            <p className="text-muted">Requested by: {selectedRequest.requested_by_name}</p>
            <p className="text-muted">Requested date: {formatDate(selectedRequest.requested_date)}</p>
            {selectedRequest.special_instructions && (
              <p className="text-muted">Notes: {selectedRequest.special_instructions}</p>
            )}

            <form onSubmit={handleQuote}>
              <FormGroup label="Quote Amount (£)" required>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quoteModal.formData.quote_amount}
                  onChange={(e) => quoteModal.updateField('quote_amount', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </FormGroup>

              <FormGroup label="Quote Notes">
                <Textarea
                  value={quoteModal.formData.quote_notes}
                  onChange={(e) => quoteModal.updateField('quote_notes', e.target.value)}
                  rows={3}
                  placeholder="Any notes about this quote..."
                />
              </FormGroup>
            </form>
          </>
        )}
      </Modal>
    </div>
  );
}
