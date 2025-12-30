import { useState, useEffect } from 'react';
import { clinicsApi, arenasApi } from '../../services/api';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../../components/ui';
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

interface ApprovalFormData {
  approvalNotes: string;
  venueFeePrivate: number;
  venueFeeGroup: number;
  liveryVenueFeePrivate: number;
  liveryVenueFeeGroup: number;
}

interface RejectFormData {
  reason: string;
}

interface ChangesFormData {
  notes: string;
}

type SlotFormData = CreateClinicSlot;

type ViewTab = 'pending' | 'approved' | 'past';

export function AdminEventTriage() {
  const [activeTab, setActiveTab] = useState<ViewTab>('pending');
  const [pending, setPending] = useState<ClinicRequest[]>([]);
  const [approved, setApproved] = useState<ClinicRequest[]>([]);
  const [past, setPast] = useState<ClinicRequest[]>([]);
  const [enums, setEnums] = useState<ClinicEnums | null>(null);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<ClinicRequest | null>(null);

  // Request state
  const { loading, error, success, setError, setSuccess, setLoading } = useRequestState(true);

  // Approval modal
  const approvalModal = useModalForm<ApprovalFormData>({
    approvalNotes: '',
    venueFeePrivate: 10,
    venueFeeGroup: 5,
    liveryVenueFeePrivate: 0,
    liveryVenueFeeGroup: 0,
  });

  // Reject modal
  const rejectModal = useModalForm<RejectFormData>({ reason: '' });

  // Changes modal
  const changesModal = useModalForm<ChangesFormData>({ notes: '' });

  // Slot form modal
  const slotModal = useModalForm<SlotFormData>({
    slot_date: '',
    start_time: '',
    end_time: '',
    group_name: '',
    description: '',
    arena_id: undefined,
    is_group_slot: false,
    max_participants: 1,
  });

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<ClinicRequest | null>(null);

  // Delete slot confirmation
  const [deleteSlotTarget, setDeleteSlotTarget] = useState<number | null>(null);

  // Event management modal state
  const [showManageModal, setShowManageModal] = useState(false);
  const [managedClinic, setManagedClinic] = useState<ClinicRequestDetail | null>(null);
  const [managedSlots, setManagedSlots] = useState<ClinicSlotWithParticipants[]>([]);
  const [manageLoading, setManageLoading] = useState(false);
  const [manageTab, setManageTab] = useState<'participants' | 'slots'>('participants');

  // Participant assignment state
  const [assigningParticipant, setAssigningParticipant] = useState<ClinicParticipant | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
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
    } catch {
      setError('Failed to load events');
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
    approvalModal.edit(clinic.id, {
      approvalNotes: '',
      venueFeePrivate: clinic.venue_fee_private || 10,
      venueFeeGroup: clinic.venue_fee_group || 5,
      liveryVenueFeePrivate: clinic.livery_venue_fee_private || 0,
      liveryVenueFeeGroup: clinic.livery_venue_fee_group || 0,
    });
  };

  const openRejectModal = (clinic: ClinicRequest) => {
    setSelectedClinic(clinic);
    rejectModal.edit(clinic.id, { reason: '' });
  };

  const openChangesModal = (clinic: ClinicRequest) => {
    setSelectedClinic(clinic);
    changesModal.edit(clinic.id, { notes: '' });
  };

  const handleApprove = async () => {
    if (!selectedClinic) return;
    try {
      await clinicsApi.approve(selectedClinic.id, approvalModal.formData.approvalNotes || undefined, {
        venue_fee_private: approvalModal.formData.venueFeePrivate,
        venue_fee_group: approvalModal.formData.venueFeeGroup,
        livery_venue_fee_private: approvalModal.formData.liveryVenueFeePrivate,
        livery_venue_fee_group: approvalModal.formData.liveryVenueFeeGroup,
      });
      setSuccess('Event approved successfully');
      approvalModal.close();
      setSelectedClinic(null);
      loadData();
    } catch {
      setError('Failed to approve event');
    }
  };

  const handleReject = async () => {
    if (!selectedClinic || !rejectModal.formData.reason.trim()) return;
    try {
      await clinicsApi.reject(selectedClinic.id, rejectModal.formData.reason);
      setSuccess('Event rejected');
      rejectModal.close();
      setSelectedClinic(null);
      loadData();
    } catch {
      setError('Failed to reject event');
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedClinic || !changesModal.formData.notes.trim()) return;
    try {
      await clinicsApi.requestChanges(selectedClinic.id, changesModal.formData.notes);
      setSuccess('Changes requested');
      changesModal.close();
      setSelectedClinic(null);
      loadData();
    } catch {
      setError('Failed to request changes');
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await clinicsApi.cancel(cancelTarget.id, 'Cancelled by admin');
      setSuccess('Event cancelled');
      setCancelTarget(null);
      loadData();
    } catch {
      setError('Failed to cancel event');
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
    slotModal.close();
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
      slotModal.edit(slot.id, {
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
      slotModal.open({
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
  };

  const handleSlotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managedClinic) return;

    try {
      if (slotModal.editingId) {
        await clinicsApi.updateSlot(managedClinic.id, slotModal.editingId, slotModal.formData);
        setSuccess('Slot updated');
      } else {
        await clinicsApi.createSlot(managedClinic.id, slotModal.formData);
        setSuccess('Slot created');
      }
      slotModal.close();
      refreshManagedClinic();
    } catch {
      setError('Failed to save slot');
    }
  };

  const handleDeleteSlot = async () => {
    if (!managedClinic || deleteSlotTarget === null) return;

    try {
      await clinicsApi.deleteSlot(managedClinic.id, deleteSlotTarget);
      setSuccess('Slot deleted');
      setDeleteSlotTarget(null);
      refreshManagedClinic();
    } catch {
      setError('Failed to delete slot');
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
              onClick={() => setCancelTarget(clinic)}
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
    return <div className="ds-loading">Loading events...</div>;
  }

  return (
    <div className="admin-page">
      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Tab Navigation */}
      <div className="tabs-container">
        <button
          className={`ds-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approval ({pending.length})
        </button>
        <button
          className={`ds-tab ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          Upcoming Events ({approved.length})
        </button>
        <button
          className={`ds-tab ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Past Events ({past.length})
        </button>
      </div>

      {/* Content */}
      {activeTab === 'pending' && (
        <div className="admin-section">
          {pending.length === 0 ? (
            <div className="ds-empty">
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
            <div className="ds-empty">
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
            <div className="ds-empty">
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
      <Modal
        isOpen={approvalModal.isOpen && !!selectedClinic}
        onClose={() => {
          approvalModal.close();
          setSelectedClinic(null);
        }}
        title="Approve Event"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              approvalModal.close();
              setSelectedClinic(null);
            }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleApprove}>
              Approve Event
            </button>
          </>
        }
      >
        {selectedClinic && (
          <>
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

            <FormRow>
              <FormGroup label="Venue Fee - Private (£)">
                <Input
                  type="number"
                  step="0.01"
                  value={approvalModal.formData.venueFeePrivate}
                  onChange={e => approvalModal.updateField('venueFeePrivate', parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </FormGroup>
              <FormGroup label="Venue Fee - Group (£)">
                <Input
                  type="number"
                  step="0.01"
                  value={approvalModal.formData.venueFeeGroup}
                  onChange={e => approvalModal.updateField('venueFeeGroup', parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </FormGroup>
            </FormRow>

            <FormRow>
              <FormGroup label="Livery Fee - Private (£)">
                <Input
                  type="number"
                  step="0.01"
                  value={approvalModal.formData.liveryVenueFeePrivate}
                  onChange={e => approvalModal.updateField('liveryVenueFeePrivate', parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </FormGroup>
              <FormGroup label="Livery Fee - Group (£)">
                <Input
                  type="number"
                  step="0.01"
                  value={approvalModal.formData.liveryVenueFeeGroup}
                  onChange={e => approvalModal.updateField('liveryVenueFeeGroup', parseFloat(e.target.value) || 0)}
                  min={0}
                />
              </FormGroup>
            </FormRow>

            <FormGroup label="Approval Notes (optional)">
              <Textarea
                value={approvalModal.formData.approvalNotes}
                onChange={e => approvalModal.updateField('approvalNotes', e.target.value)}
                placeholder="Any notes for the coach..."
                rows={3}
              />
            </FormGroup>
          </>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModal.isOpen && !!selectedClinic}
        onClose={() => {
          rejectModal.close();
          setSelectedClinic(null);
        }}
        title="Reject Event"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              rejectModal.close();
              setSelectedClinic(null);
            }}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-danger"
              onClick={handleReject}
              disabled={!rejectModal.formData.reason.trim()}
            >
              Reject Event
            </button>
          </>
        }
      >
        {selectedClinic && (
          <>
            <p>Rejecting: <strong>{selectedClinic.title || getDisciplineLabel(selectedClinic.discipline)}</strong></p>
            <FormGroup label="Reason for rejection" required>
              <Textarea
                value={rejectModal.formData.reason}
                onChange={e => rejectModal.updateField('reason', e.target.value)}
                placeholder="Please provide a reason..."
                rows={3}
                required
              />
            </FormGroup>
          </>
        )}
      </Modal>

      {/* Request Changes Modal */}
      <Modal
        isOpen={changesModal.isOpen && !!selectedClinic}
        onClose={() => {
          changesModal.close();
          setSelectedClinic(null);
        }}
        title="Request Changes"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              changesModal.close();
              setSelectedClinic(null);
            }}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleRequestChanges}
              disabled={!changesModal.formData.notes.trim()}
            >
              Request Changes
            </button>
          </>
        }
      >
        {selectedClinic && (
          <>
            <p>Requesting changes to: <strong>{selectedClinic.title || getDisciplineLabel(selectedClinic.discipline)}</strong></p>
            <FormGroup label="What changes are needed?" required>
              <Textarea
                value={changesModal.formData.notes}
                onChange={e => changesModal.updateField('notes', e.target.value)}
                placeholder="Describe the changes needed..."
                rows={3}
                required
              />
            </FormGroup>
          </>
        )}
      </Modal>

      {/* Event Management Modal */}
      {showManageModal && (
        <div className="ds-modal-overlay" onClick={closeManageModal}>
          <div className="ds-modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>
                Manage Event: {managedClinic?.title || getDisciplineLabel(managedClinic?.discipline || '')}
              </h2>
              <button className="close-btn" onClick={closeManageModal}>&times;</button>
            </div>
            <div className="ds-modal-body">
              {manageLoading ? (
                <div className="ds-loading">Loading event details...</div>
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
                      className={`ds-tab ${manageTab === 'participants' ? 'active' : ''}`}
                      onClick={() => setManageTab('participants')}
                    >
                      Participants ({managedClinic.participants.length})
                    </button>
                    <button
                      className={`ds-tab ${manageTab === 'slots' ? 'active' : ''}`}
                      onClick={() => setManageTab('slots')}
                    >
                      Slots ({managedSlots.length})
                    </button>
                  </div>

                  {/* Participants Tab */}
                  {manageTab === 'participants' && (
                    <div className="manage-section">
                      {managedClinic.participants.length === 0 ? (
                        <div className="ds-empty">
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
                        <div className="ds-empty">
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
                                    onClick={() => setDeleteSlotTarget(slot.id)}
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
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={closeManageModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Assignment Modal */}
      {assigningParticipant && managedClinic && (
        <div className="ds-modal-overlay" onClick={() => setAssigningParticipant(null)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Assign Slot</h2>
              <button className="close-btn" onClick={() => setAssigningParticipant(null)}>&times;</button>
            </div>
            <div className="ds-modal-body">
              <p>Assign <strong>{assigningParticipant.participant_name}</strong> to a slot:</p>
              {assigningParticipant.preferred_lesson_type && (
                <p className="text-muted">
                  Preference: {assigningParticipant.preferred_lesson_type}
                  {assigningParticipant.lesson_time && ` at ${assigningParticipant.lesson_time}`}
                </p>
              )}

              {managedSlots.length === 0 ? (
                <div className="ds-empty">
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
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={() => setAssigningParticipant(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Form Modal */}
      <Modal
        isOpen={slotModal.isOpen && !!managedClinic}
        onClose={() => slotModal.close()}
        title={slotModal.editingId ? 'Edit Slot' : 'Create Slot'}
        footer={
          <>
            <button type="button" className="ds-btn ds-btn-secondary" onClick={() => slotModal.close()}>
              Cancel
            </button>
            <button type="submit" form="slot-form" className="ds-btn ds-btn-primary">
              {slotModal.editingId ? 'Update Slot' : 'Create Slot'}
            </button>
          </>
        }
      >
        <form id="slot-form" onSubmit={handleSlotSubmit}>
          <FormRow>
            <FormGroup label="Date" required>
              <Input
                type="date"
                value={slotModal.formData.slot_date}
                onChange={e => slotModal.updateField('slot_date', e.target.value)}
                required
              />
            </FormGroup>
            <FormGroup label="Start Time" required>
              <Input
                type="time"
                value={slotModal.formData.start_time}
                onChange={e => slotModal.updateField('start_time', e.target.value)}
                required
              />
            </FormGroup>
            <FormGroup label="End Time" required>
              <Input
                type="time"
                value={slotModal.formData.end_time}
                onChange={e => slotModal.updateField('end_time', e.target.value)}
                required
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Slot Name">
            <Input
              type="text"
              value={slotModal.formData.group_name || ''}
              onChange={e => slotModal.updateField('group_name', e.target.value)}
              placeholder="e.g., Group A, Morning Session..."
            />
          </FormGroup>

          <FormGroup label="Arena">
            <Select
              value={slotModal.formData.arena_id || ''}
              onChange={e => slotModal.updateField('arena_id', e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">-- Select Arena --</option>
              {arenas.map(arena => (
                <option key={arena.id} value={arena.id}>{arena.name}</option>
              ))}
            </Select>
          </FormGroup>

          <FormRow>
            <FormGroup label="">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={slotModal.formData.is_group_slot}
                  onChange={e => {
                    slotModal.updateField('is_group_slot', e.target.checked);
                    slotModal.updateField('max_participants', e.target.checked ? 4 : 1);
                  }}
                />
                Group Slot (multiple participants)
              </label>
            </FormGroup>
            {slotModal.formData.is_group_slot && (
              <FormGroup label="Max Participants">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={slotModal.formData.max_participants}
                  onChange={e => slotModal.updateField('max_participants', parseInt(e.target.value) || 1)}
                />
              </FormGroup>
            )}
          </FormRow>

          <FormGroup label="Description">
            <Textarea
              value={slotModal.formData.description || ''}
              onChange={e => slotModal.updateField('description', e.target.value)}
              placeholder="Any notes about this slot..."
              rows={2}
            />
          </FormGroup>
        </form>
      </Modal>

      {/* Cancel Event Confirmation */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel Event"
        message={`Are you sure you want to cancel "${cancelTarget?.title || cancelTarget?.discipline}"? This cannot be undone.`}
        confirmLabel="Cancel Event"
        variant="danger"
      />

      {/* Delete Slot Confirmation */}
      <ConfirmModal
        isOpen={deleteSlotTarget !== null}
        onClose={() => setDeleteSlotTarget(null)}
        onConfirm={handleDeleteSlot}
        title="Delete Slot"
        message="Delete this slot? Any assigned participants will be unassigned."
        confirmLabel="Delete Slot"
        variant="danger"
      />
    </div>
  );
}
