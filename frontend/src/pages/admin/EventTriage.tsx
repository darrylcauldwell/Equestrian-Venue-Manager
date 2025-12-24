import { useState, useEffect } from 'react';
import { clinicsApi, arenasApi } from '../../services/api';
import type {
  ClinicRequest,
  ClinicEnums,
  Arena,
  ClinicStatus,
  ClinicRequestDetail,
  ClinicParticipant,
  ClinicSlotWithParticipants,
  CreateClinicSlot
} from '../../types';
import { format } from 'date-fns';
import './Admin.css';

type ViewTab = 'pending' | 'approved' | 'past';

export function AdminEventTriage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('pending');
  const [pending, setPending] = useState<ClinicRequest[]>([]);
  const [approved, setApproved] = useState<ClinicRequest[]>([]);
  const [past, setPast] = useState<ClinicRequest[]>([]);
  const [enums, setEnums] = useState<ClinicEnums | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Approval modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedClinic, setSelectedClinic] = useState<ClinicRequest | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [venueFeePrivate, setVenueFeePrivate] = useState<number>(10);
  const [venueFeeGroup, setVenueFeeGroup] = useState<number>(5);
  const [liveryVenueFeePrivate, setLiveryVenueFeePrivate] = useState<number>(0);
  const [liveryVenueFeeGroup, setLiveryVenueFeeGroup] = useState<number>(0);

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Changes modal state
  const [showChangesModal, setShowChangesModal] = useState(false);
  const [changesNotes, setChangesNotes] = useState('');

  // Event management modal state
  const [showManageModal, setShowManageModal] = useState(false);
  const [managedClinic, setManagedClinic] = useState<ClinicRequestDetail | null>(null);
  const [managedSlots, setManagedSlots] = useState<ClinicSlotWithParticipants[]>([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageTab, setManageTab] = useState<'participants' | 'slots'>('participants');

  // Slot creation form state
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotFormData, setSlotFormData] = useState<CreateClinicSlot>({
    slot_date: '',
    start_time: '',
    end_time: '',
    group_name: '',
    description: '',
    arena_id: undefined,
    is_group_slot: false,
    max_participants: 1,
  });
  const [editingSlotId, setEditingSlotId] = useState<number | null>(null);

  // Participant assignment state
  const [assigningParticipant, setAssigningParticipant] = useState<ClinicParticipant | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [enumsData, clinicsData, arenasData] = await Promise.all([
        clinicsApi.getEnums(),
        clinicsApi.listAll(),
        arenasApi.listAll(),
      ]);
      setEnums(enumsData);
      setPending(clinicsData.pending || []);
      setApproved(clinicsData.approved || []);
      setPast(clinicsData.past || []);
      setArenas(arenasData);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), 'dd MMM yyyy');
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  const getStatusBadgeClass = (status: ClinicStatus) => {
    switch (status) {
      case 'pending': return 'badge-warning';
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-danger';
      case 'changes_requested': return 'badge-info';
      case 'cancelled': return 'badge-secondary';
      case 'completed': return 'badge-primary';
      default: return '';
    }
  };

  const getDisciplineLabel = (value: string) => {
    const item = enums?.disciplines?.find(d => d.value === value);
    return item?.label || value;
  };

  const getFormatLabel = (value: string) => {
    const item = enums?.lesson_formats?.find(f => f.value === value);
    return item?.label || value;
  };

  const openApprovalModal = (clinic: ClinicRequest) => {
    setSelectedClinic(clinic);
    setApprovalNotes('');
    setVenueFeePrivate(clinic.venue_fee_private || 10);
    setVenueFeeGroup(clinic.venue_fee_group || 5);
    setLiveryVenueFeePrivate(clinic.livery_venue_fee_private || 0);
    setLiveryVenueFeeGroup(clinic.livery_venue_fee_group || 0);
    setShowApprovalModal(true);
  };

  const openRejectModal = (clinic: ClinicRequest) => {
    setSelectedClinic(clinic);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const openChangesModal = (clinic: ClinicRequest) => {
    setSelectedClinic(clinic);
    setChangesNotes('');
    setShowChangesModal(true);
  };

  const handleApprove = async () => {
    if (!selectedClinic) return;
    try {
      await clinicsApi.approve(selectedClinic.id, approvalNotes || undefined, {
        venue_fee_private: venueFeePrivate,
        venue_fee_group: venueFeeGroup,
        livery_venue_fee_private: liveryVenueFeePrivate,
        livery_venue_fee_group: liveryVenueFeeGroup,
      });
      setSuccess('Event approved successfully');
      setShowApprovalModal(false);
      setSelectedClinic(null);
      loadData();
    } catch (err) {
      setError('Failed to approve event');
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!selectedClinic || !rejectReason.trim()) return;
    try {
      await clinicsApi.reject(selectedClinic.id, rejectReason);
      setSuccess('Event rejected');
      setShowRejectModal(false);
      setSelectedClinic(null);
      loadData();
    } catch (err) {
      setError('Failed to reject event');
      console.error(err);
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedClinic || !changesNotes.trim()) return;
    try {
      await clinicsApi.requestChanges(selectedClinic.id, changesNotes);
      setSuccess('Changes requested');
      setShowChangesModal(false);
      setSelectedClinic(null);
      loadData();
    } catch (err) {
      setError('Failed to request changes');
      console.error(err);
    }
  };

  const handleCancel = async (clinic: ClinicRequest) => {
    if (!confirm(`Cancel "${clinic.title || clinic.discipline}"? This cannot be undone.`)) return;
    try {
      await clinicsApi.cancel(clinic.id, 'Cancelled by admin');
      setSuccess('Event cancelled');
      loadData();
    } catch (err) {
      setError('Failed to cancel event');
      console.error(err);
    }
  };

  // ============== Event Management Functions ==============
  const openManageModal = async (clinic: ClinicRequest) => {
    setManageLoading(true);
    setShowManageModal(true);
    setManageTab('participants');
    try {
      const [details, slots] = await Promise.all([
        clinicsApi.getDetails(clinic.id),
        clinicsApi.listSlots(clinic.id)
      ]);
      setManagedClinic(details);
      setManagedSlots(slots);
    } catch (err) {
      setError('Failed to load event details');
      console.error(err);
    } finally {
      setManageLoading(false);
    }
  };

  const closeManageModal = () => {
    setShowManageModal(false);
    setManagedClinic(null);
    setManagedSlots([]);
    setShowSlotForm(false);
    setEditingSlotId(null);
    setAssigningParticipant(null);
  };

  const refreshManagedClinic = async () => {
    if (!managedClinic) return;
    try {
      const [details, slots] = await Promise.all([
        clinicsApi.getDetails(managedClinic.id),
        clinicsApi.listSlots(managedClinic.id)
      ]);
      setManagedClinic(details);
      setManagedSlots(slots);
    } catch (err) {
      console.error('Failed to refresh event:', err);
    }
  };

  // Slot form handlers
  const openSlotForm = (clinic: ClinicRequestDetail, slot?: ClinicSlotWithParticipants) => {
    if (slot) {
      setEditingSlotId(slot.id);
      setSlotFormData({
        slot_date: slot.slot_date,
        start_time: slot.start_time.substring(0, 5),
        end_time: slot.end_time.substring(0, 5),
        group_name: slot.group_name || '',
        description: slot.description || '',
        arena_id: slot.arena_id || undefined,
        is_group_slot: slot.is_group_slot,
        max_participants: slot.max_participants || 1,
      });
    } else {
      setEditingSlotId(null);
      setSlotFormData({
        slot_date: clinic.proposed_date,
        start_time: clinic.proposed_start_time?.substring(0, 5) || '09:00',
        end_time: '',
        group_name: '',
        description: '',
        arena_id: undefined,
        is_group_slot: false,
        max_participants: 1,
      });
    }
    setShowSlotForm(true);
  };

  const handleSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managedClinic) return;

    try {
      if (editingSlotId) {
        await clinicsApi.updateSlot(managedClinic.id, editingSlotId, slotFormData);
        setSuccess('Slot updated');
      } else {
        await clinicsApi.createSlot(managedClinic.id, slotFormData);
        setSuccess('Slot created');
      }
      setShowSlotForm(false);
      setEditingSlotId(null);
      refreshManagedClinic();
    } catch (err) {
      setError('Failed to save slot');
      console.error(err);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    if (!managedClinic) return;
    if (!confirm('Delete this slot? Any assigned participants will be unassigned.')) return;

    try {
      await clinicsApi.deleteSlot(managedClinic.id, slotId);
      setSuccess('Slot deleted');
      refreshManagedClinic();
    } catch (err) {
      setError('Failed to delete slot');
      console.error(err);
    }
  };

  // Participant assignment handlers
  const handleAssignSlot = async (participant: ClinicParticipant, slotId: number | null) => {
    if (!managedClinic) return;

    try {
      await clinicsApi.assignSlot(managedClinic.id, participant.id, slotId);
      setSuccess(slotId ? 'Participant assigned to slot' : 'Participant unassigned from slot');
      setAssigningParticipant(null);
      refreshManagedClinic();
    } catch (err) {
      setError('Failed to assign participant');
      console.error(err);
    }
  };

  const handleConfirmParticipant = async (participant: ClinicParticipant) => {
    if (!managedClinic) return;

    try {
      await clinicsApi.updateParticipant(managedClinic.id, participant.id, { is_confirmed: true });
      setSuccess('Participant confirmed');
      refreshManagedClinic();
    } catch (err) {
      setError('Failed to confirm participant');
      console.error(err);
    }
  };

  const getUnassignedParticipants = (): ClinicParticipant[] => {
    if (!managedClinic) return [];
    return managedClinic.participants.filter(p => !p.slot_id);
  };

  const getParticipantSlot = (participant: ClinicParticipant): ClinicSlotWithParticipants | undefined => {
    return managedSlots.find(s => s.id === participant.slot_id);
  };

  const renderClinicRow = (clinic: ClinicRequest, showActions: boolean = false) => (
    <tr key={clinic.id}>
      <td>
        <strong>{clinic.title || getDisciplineLabel(clinic.discipline)}</strong>
        <div className="text-muted">{clinic.coach_name}</div>
      </td>
      <td>{getDisciplineLabel(clinic.discipline)}</td>
      <td>{getFormatLabel(clinic.lesson_format)}</td>
      <td>
        {formatDate(clinic.proposed_date)}
        {clinic.proposed_end_date && clinic.proposed_end_date !== clinic.proposed_date && (
          <> - {formatDate(clinic.proposed_end_date)}</>
        )}
        {clinic.proposed_start_time && (
          <div className="text-muted">
            {formatTime(clinic.proposed_start_time)}
            {clinic.proposed_end_time && <> - {formatTime(clinic.proposed_end_time)}</>}
          </div>
        )}
      </td>
      <td>
        {clinic.max_participants || '-'}
        {clinic.max_group_size && <div className="text-muted">({clinic.max_group_size}/group)</div>}
      </td>
      <td>
        {clinic.coach_fee_private && (
          <div>&pound;{Number(clinic.coach_fee_private).toFixed(0)} private</div>
        )}
        {clinic.coach_fee_group && (
          <div>&pound;{Number(clinic.coach_fee_group).toFixed(0)} group</div>
        )}
      </td>
      <td>
        <span className={`badge ${getStatusBadgeClass(clinic.status)}`}>
          {clinic.status.replace('_', ' ')}
        </span>
      </td>
      <td>
        {showActions ? (
          <div className="action-buttons">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => openApprovalModal(clinic)}
            >
              Approve
            </button>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => openChangesModal(clinic)}
            >
              Request Changes
            </button>
            <button
              className="btn btn-sm btn-danger"
              onClick={() => openRejectModal(clinic)}
            >
              Reject
            </button>
          </div>
        ) : clinic.status === 'approved' ? (
          <div className="action-buttons">
            <button
              className="btn btn-sm btn-primary"
              onClick={() => openManageModal(clinic)}
            >
              Manage
            </button>
            <button
              className="btn btn-sm btn-warning"
              onClick={() => handleCancel(clinic)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
    </tr>
  );

  if (loading) {
    return <div className="loading">Loading events...</div>;
  }

  return (
    <div className="admin-page">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Tab Navigation */}
      <div className="tabs-container">
        <button
          className={`tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approval ({pending.length})
        </button>
        <button
          className={`tab ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Upcoming Events ({approved.length})
        </button>
        <button
          className={`tab ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Past Events ({past.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'pending' && (
        <div className="admin-section">
          {pending.length === 0 ? (
            <div className="empty-state">
              <p>No events pending approval</p>
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Discipline</th>
                    <th>Format</th>
                    <th>Date</th>
                    <th>Capacity</th>
                    <th>Coach Fee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map(clinic => renderClinicRow(clinic, true))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'approved' && (
        <div className="admin-section">
          {approved.length === 0 ? (
            <div className="empty-state">
              <p>No upcoming events</p>
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Discipline</th>
                    <th>Format</th>
                    <th>Date</th>
                    <th>Capacity</th>
                    <th>Coach Fee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approved.map(clinic => renderClinicRow(clinic, false))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'past' && (
        <div className="admin-section">
          {past.length === 0 ? (
            <div className="empty-state">
              <p>No past events</p>
            </div>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Discipline</th>
                    <th>Format</th>
                    <th>Date</th>
                    <th>Capacity</th>
                    <th>Coach Fee</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {past.map(clinic => renderClinicRow(clinic, false))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedClinic && (
        <div className="modal-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Approve Event</h2>
              <button className="close-btn" onClick={() => setShowApprovalModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="event-summary">
                <h3>{selectedClinic.title || getDisciplineLabel(selectedClinic.discipline)}</h3>
                <p><strong>Coach:</strong> {selectedClinic.coach_name}</p>
                <p><strong>Date:</strong> {formatDate(selectedClinic.proposed_date)}</p>
                <p><strong>Format:</strong> {getFormatLabel(selectedClinic.lesson_format)}</p>
                {selectedClinic.coach_fee_private && (
                  <p><strong>Coach Fee (Private):</strong> &pound;{Number(selectedClinic.coach_fee_private).toFixed(2)}</p>
                )}
                {selectedClinic.coach_fee_group && (
                  <p><strong>Coach Fee (Group):</strong> &pound;{Number(selectedClinic.coach_fee_group).toFixed(2)}</p>
                )}
              </div>

              <hr />

              <h4>Set Venue Fees</h4>
              <p className="form-hint">
                Venue fees are added to coach fees to get the total price shown to users.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label>Venue Fee - Private (&pound;)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={venueFeePrivate}
                    onChange={e => setVenueFeePrivate(parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label>Venue Fee - Group (&pound;)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={venueFeeGroup}
                    onChange={e => setVenueFeeGroup(parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Livery Fee - Private (&pound;)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={liveryVenueFeePrivate}
                    onChange={e => setLiveryVenueFeePrivate(parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label>Livery Fee - Group (&pound;)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={liveryVenueFeeGroup}
                    onChange={e => setLiveryVenueFeeGroup(parseFloat(e.target.value) || 0)}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Approval Notes (optional)</label>
                <textarea
                  value={approvalNotes}
                  onChange={e => setApprovalNotes(e.target.value)}
                  placeholder="Any notes for the coach..."
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowApprovalModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleApprove}>
                Approve Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedClinic && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reject Event</h2>
              <button className="close-btn" onClick={() => setShowRejectModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Rejecting: <strong>{selectedClinic.title || getDisciplineLabel(selectedClinic.discipline)}</strong></p>
              <div className="form-group">
                <label>Reason for rejection *</label>
                <textarea
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason..."
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={!rejectReason.trim()}
              >
                Reject Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {showChangesModal && selectedClinic && (
        <div className="modal-overlay" onClick={() => setShowChangesModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Request Changes</h2>
              <button className="close-btn" onClick={() => setShowChangesModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Requesting changes to: <strong>{selectedClinic.title || getDisciplineLabel(selectedClinic.discipline)}</strong></p>
              <div className="form-group">
                <label>What changes are needed? *</label>
                <textarea
                  value={changesNotes}
                  onChange={e => setChangesNotes(e.target.value)}
                  placeholder="Describe the changes needed..."
                  rows={3}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowChangesModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRequestChanges}
                disabled={!changesNotes.trim()}
              >
                Request Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Event Management Modal */}
      {showManageModal && (
        <div className="modal-overlay" onClick={closeManageModal}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                Manage Event: {managedClinic?.title || getDisciplineLabel(managedClinic?.discipline || '')}
              </h2>
              <button className="close-btn" onClick={closeManageModal}>&times;</button>
            </div>
            <div className="modal-body">
              {manageLoading ? (
                <div className="loading">Loading event details...</div>
              ) : managedClinic ? (
                <>
                  {/* Event Summary */}
                  <div className="event-summary-compact">
                    <span><strong>Coach:</strong> {managedClinic.coach_name}</span>
                    <span><strong>Date:</strong> {formatDate(managedClinic.proposed_date)}</span>
                    <span><strong>Format:</strong> {getFormatLabel(managedClinic.lesson_format)}</span>
                    <span>
                      <strong>Registered:</strong> {managedClinic.participants.length}
                      {managedClinic.max_participants && ` / ${managedClinic.max_participants}`}
                    </span>
                  </div>

                  {/* Tab Navigation */}
                  <div className="tabs-container manage-tabs">
                    <button
                      className={`tab ${manageTab === 'participants' ? 'active' : ''}`}
                      onClick={() => setManageTab('participants')}
                    >
                      Participants ({managedClinic.participants.length})
                    </button>
                    <button
                      className={`tab ${manageTab === 'slots' ? 'active' : ''}`}
                      onClick={() => setManageTab('slots')}
                    >
                      Slots ({managedSlots.length})
                    </button>
                  </div>

                  {/* Participants Tab */}
                  {manageTab === 'participants' && (
                    <div className="manage-section">
                      {managedClinic.participants.length === 0 ? (
                        <div className="empty-state">
                          <p>No participants registered yet</p>
                        </div>
                      ) : (
                        <table className="admin-table">
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Contact</th>
                              <th>Preference</th>
                              <th>Assigned Slot</th>
                              <th>Status</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {managedClinic.participants.map(p => {
                              const slot = getParticipantSlot(p);
                              return (
                                <tr key={p.id} className={p.is_confirmed ? '' : 'pending-row'}>
                                  <td>
                                    <strong>{p.participant_name || 'Unknown'}</strong>
                                    {p.notes && <div className="text-muted small">{p.notes}</div>}
                                  </td>
                                  <td>
                                    {p.participant_email && <div>{p.participant_email}</div>}
                                    {p.participant_phone && <div className="text-muted">{p.participant_phone}</div>}
                                  </td>
                                  <td>
                                    <span className={`badge ${p.preferred_lesson_type === 'private' ? 'badge-primary' : 'badge-secondary'}`}>
                                      {p.preferred_lesson_type || 'Any'}
                                    </span>
                                    {p.lesson_time && <div className="text-muted small">Preferred: {p.lesson_time}</div>}
                                  </td>
                                  <td>
                                    {slot ? (
                                      <div className="assigned-slot">
                                        <strong>{slot.group_name || `Slot #${slot.sequence}`}</strong>
                                        <div className="text-muted">
                                          {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-muted">Not assigned</span>
                                    )}
                                  </td>
                                  <td>
                                    <span className={`badge ${p.is_confirmed ? 'badge-success' : 'badge-warning'}`}>
                                      {p.is_confirmed ? 'Confirmed' : 'Pending'}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="action-buttons">
                                      {!p.is_confirmed && (
                                        <button
                                          className="btn btn-sm btn-success"
                                          onClick={() => handleConfirmParticipant(p)}
                                        >
                                          Confirm
                                        </button>
                                      )}
                                      <button
                                        className="btn btn-sm btn-secondary"
                                        onClick={() => setAssigningParticipant(p)}
                                      >
                                        {p.slot_id ? 'Reassign' : 'Assign Slot'}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* Slots Tab */}
                  {manageTab === 'slots' && (
                    <div className="manage-section">
                      <div className="section-header">
                        <button
                          className="btn btn-primary"
                          onClick={() => openSlotForm(managedClinic)}
                        >
                          + Add Slot
                        </button>
                      </div>

                      {managedSlots.length === 0 ? (
                        <div className="empty-state">
                          <p>No slots created yet</p>
                          <p className="text-muted">Create slots to assign participants to specific times</p>
                        </div>
                      ) : (
                        <div className="slots-grid">
                          {managedSlots.map(slot => (
                            <div key={slot.id} className={`slot-card ${slot.is_group_slot ? 'group-slot' : 'private-slot'}`}>
                              <div className="slot-header">
                                <div className="slot-title">
                                  <strong>{slot.group_name || `Slot #${slot.sequence}`}</strong>
                                  <span className={`badge ${slot.is_group_slot ? 'badge-info' : 'badge-primary'}`}>
                                    {slot.is_group_slot ? 'Group' : 'Private'}
                                  </span>
                                </div>
                                <div className="slot-actions">
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => openSlotForm(managedClinic, slot)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDeleteSlot(slot.id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <div className="slot-time">
                                {formatDate(slot.slot_date)} | {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                              </div>
                              {slot.arena_name && (
                                <div className="slot-arena text-muted">Arena: {slot.arena_name}</div>
                              )}
                              {slot.description && (
                                <div className="slot-description text-muted">{slot.description}</div>
                              )}
                              <div className="slot-participants">
                                <div className="slot-participants-header">
                                  <strong>Participants</strong>
                                  {slot.is_group_slot && slot.max_participants && (
                                    <span className="text-muted">
                                      ({slot.participants.length}/{slot.max_participants})
                                    </span>
                                  )}
                                </div>
                                {slot.participants.length === 0 ? (
                                  <div className="empty-slot">No participants assigned</div>
                                ) : (
                                  <ul className="participant-list">
                                    {slot.participants.map(p => (
                                      <li key={p.id}>
                                        {p.participant_name}
                                        <button
                                          className="btn-icon"
                                          onClick={() => handleAssignSlot(p, null)}
                                          title="Remove from slot"
                                        >
                                          &times;
                                        </button>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Unassigned Participants */}
                      {getUnassignedParticipants().length > 0 && (
                        <div className="unassigned-section">
                          <h4>Unassigned Participants ({getUnassignedParticipants().length})</h4>
                          <div className="unassigned-list">
                            {getUnassignedParticipants().map(p => (
                              <div key={p.id} className="unassigned-participant">
                                <span>{p.participant_name}</span>
                                <span className="text-muted">
                                  {p.preferred_lesson_type === 'private' ? 'Wants private' :
                                   p.preferred_lesson_type === 'group' ? 'Wants group' : ''}
                                </span>
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => setAssigningParticipant(p)}
                                >
                                  Assign
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="error-state">Failed to load event details</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeManageModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Assignment Modal */}
      {assigningParticipant && managedClinic && (
        <div className="modal-overlay" onClick={() => setAssigningParticipant(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Assign Slot</h2>
              <button className="close-btn" onClick={() => setAssigningParticipant(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>Assign <strong>{assigningParticipant.participant_name}</strong> to a slot:</p>
              {assigningParticipant.preferred_lesson_type && (
                <p className="text-muted">
                  Preference: {assigningParticipant.preferred_lesson_type}
                  {assigningParticipant.lesson_time && ` at ${assigningParticipant.lesson_time}`}
                </p>
              )}

              {managedSlots.length === 0 ? (
                <div className="empty-state">
                  <p>No slots available</p>
                  <p className="text-muted">Create slots first in the Slots tab</p>
                </div>
              ) : (
                <div className="slot-selection">
                  {managedSlots.map(slot => {
                    const isFull = slot.is_group_slot &&
                                   slot.max_participants != null &&
                                   slot.max_participants > 0 &&
                                   slot.participants.length >= slot.max_participants;
                    const isCurrentSlot = assigningParticipant.slot_id === slot.id;
                    return (
                      <div
                        key={slot.id}
                        className={`slot-option ${isFull ? 'full' : ''} ${isCurrentSlot ? 'current' : ''}`}
                      >
                        <div className="slot-option-info">
                          <strong>{slot.group_name || `Slot #${slot.sequence}`}</strong>
                          <span className={`badge ${slot.is_group_slot ? 'badge-info' : 'badge-primary'}`}>
                            {slot.is_group_slot ? 'Group' : 'Private'}
                          </span>
                          <div className="text-muted">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </div>
                          <div className="text-muted small">
                            {slot.participants.length} participant{slot.participants.length !== 1 ? 's' : ''}
                            {slot.max_participants && ` / ${slot.max_participants} max`}
                          </div>
                        </div>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleAssignSlot(assigningParticipant, slot.id)}
                          disabled={isFull && !isCurrentSlot}
                        >
                          {isCurrentSlot ? 'Current' : isFull ? 'Full' : 'Select'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {assigningParticipant.slot_id && (
                <div className="unassign-option">
                  <button
                    className="btn btn-warning"
                    onClick={() => handleAssignSlot(assigningParticipant, null)}
                  >
                    Remove from Current Slot
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setAssigningParticipant(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Form Modal */}
      {showSlotForm && managedClinic && (
        <div className="modal-overlay" onClick={() => setShowSlotForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingSlotId ? 'Edit Slot' : 'Create Slot'}</h2>
              <button className="close-btn" onClick={() => setShowSlotForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSlotSubmit}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="date"
                      value={slotFormData.slot_date}
                      onChange={e => setSlotFormData({...slotFormData, slot_date: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Start Time *</label>
                    <input
                      type="time"
                      value={slotFormData.start_time}
                      onChange={e => setSlotFormData({...slotFormData, start_time: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time *</label>
                    <input
                      type="time"
                      value={slotFormData.end_time}
                      onChange={e => setSlotFormData({...slotFormData, end_time: e.target.value})}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Slot Name</label>
                  <input
                    type="text"
                    value={slotFormData.group_name}
                    onChange={e => setSlotFormData({...slotFormData, group_name: e.target.value})}
                    placeholder="e.g., Group A, Morning Session..."
                  />
                </div>

                <div className="form-group">
                  <label>Arena</label>
                  <select
                    value={slotFormData.arena_id || ''}
                    onChange={e => setSlotFormData({
                      ...slotFormData,
                      arena_id: e.target.value ? parseInt(e.target.value) : undefined
                    })}
                  >
                    <option value="">-- Select Arena --</option>
                    {arenas.map(arena => (
                      <option key={arena.id} value={arena.id}>{arena.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={slotFormData.is_group_slot}
                        onChange={e => setSlotFormData({
                          ...slotFormData,
                          is_group_slot: e.target.checked,
                          max_participants: e.target.checked ? 4 : 1
                        })}
                      />
                      Group Slot (multiple participants)
                    </label>
                  </div>
                  {slotFormData.is_group_slot && (
                    <div className="form-group">
                      <label>Max Participants</label>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={slotFormData.max_participants}
                        onChange={e => setSlotFormData({
                          ...slotFormData,
                          max_participants: parseInt(e.target.value) || 1
                        })}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={slotFormData.description}
                    onChange={e => setSlotFormData({...slotFormData, description: e.target.value})}
                    placeholder="Any notes about this slot..."
                    rows={2}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSlotForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSlotId ? 'Update Slot' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
