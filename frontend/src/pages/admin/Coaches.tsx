import { useState, useEffect } from 'react';
import { lessonsApi } from '../../services/api';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, Input } from '../../components/ui';
import type { CoachProfile, LessonRequest, LessonEnums } from '../../types';
import './Admin.css';

type ViewTab = 'pending' | 'active' | 'all-requests';

export function AdminCoaches() {
  const [activeTab, setActiveTab] = useState<ViewTab>('pending');
  const [profiles, setProfiles] = useState<CoachProfile[]>([]);
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [enums, setEnums] = useState<LessonEnums | null>(null);

  // Request state
  const { loading, error, setError, setLoading } = useRequestState(true);

  // Approval modal
  const approvalModal = useModalForm<{ venueFee: number; liveryVenueFee: number }>({
    venueFee: 10,
    liveryVenueFee: 0,
  });
  const [selectedProfile, setSelectedProfile] = useState<CoachProfile | null>(null);

  // Toggle confirmation
  const [toggleTarget, setToggleTarget] = useState<CoachProfile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [enumsData, profilesData, requestsData] = await Promise.all([
        lessonsApi.getEnums(),
        lessonsApi.listProfiles(false),
        lessonsApi.listAllRequests(),
      ]);
      setEnums(enumsData);
      setProfiles(profilesData);
      setRequests(requestsData);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedProfile) return;
    try {
      await lessonsApi.approveProfile(
        selectedProfile.id,
        approvalModal.formData.venueFee,
        approvalModal.formData.liveryVenueFee
      );
      approvalModal.close();
      setSelectedProfile(null);
      loadData();
    } catch {
      setError('Failed to approve profile');
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    const newStatus = !toggleTarget.is_active;
    try {
      await lessonsApi.updateProfileAdmin(toggleTarget.id, { is_active: newStatus });
      setToggleTarget(null);
      loadData();
    } catch {
      setError('Failed to update profile');
    }
  };

  const openApprovalModal = (profile: CoachProfile) => {
    setSelectedProfile(profile);
    approvalModal.edit(profile.id, { venueFee: 10, liveryVenueFee: 0 });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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

  const pendingProfiles = profiles.filter(p => !p.is_active);
  const activeProfiles = profiles.filter(p => p.is_active);

  if (loading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={`ds-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending Approval ({pendingProfiles.length})
        </button>
        <button
          className={`ds-tab ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          Active Coaches ({activeProfiles.length})
        </button>
        <button
          className={`ds-tab ${activeTab === 'all-requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('all-requests')}
        >
          All Lesson Requests ({requests.length})
        </button>
      </div>

      {/* Pending Profiles */}
      {activeTab === 'pending' && (
        <div className="admin-section">
          {pendingProfiles.length === 0 ? (
            <p className="no-data">No pending coach profiles</p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Coach</th>
                    <th>Disciplines</th>
                    <th>Coach Fee</th>
                    <th>Duration</th>
                    <th>Booking Mode</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingProfiles.map(profile => (
                    <tr key={profile.id}>
                      <td>
                        <strong>{profile.coach_name}</strong>
                        {profile.coach_email && (
                          <div className="text-muted">{profile.coach_email}</div>
                        )}
                      </td>
                      <td>
                        {profile.disciplines?.map(d => getEnumLabel(d, enums?.disciplines)).join(', ') || '-'}
                      </td>
                      <td>&pound;{Number(profile.coach_fee).toFixed(2)}</td>
                      <td>{profile.lesson_duration_minutes} min</td>
                      <td>
                        <span className={`badge ${profile.booking_mode === 'auto_accept' ? 'badge-success' : 'badge-info'}`}>
                          {getEnumLabel(profile.booking_mode, enums?.booking_modes)}
                        </span>
                      </td>
                      <td>{formatDate(profile.created_at)}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openApprovalModal(profile)}
                        >
                          Approve
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Active Profiles */}
      {activeTab === 'active' && (
        <div className="admin-section">
          {activeProfiles.length === 0 ? (
            <p className="no-data">No active coaches</p>
          ) : (
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Coach</th>
                    <th>Disciplines</th>
                    <th>Coach Fee</th>
                    <th>Venue Fee</th>
                    <th>Total Price</th>
                    <th>Livery Price</th>
                    <th>Approved</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeProfiles.map(profile => (
                    <tr key={profile.id}>
                      <td>
                        <strong>{profile.coach_name}</strong>
                        {profile.coach_email && (
                          <div className="text-muted">{profile.coach_email}</div>
                        )}
                      </td>
                      <td>
                        {profile.disciplines?.map(d => getEnumLabel(d, enums?.disciplines)).join(', ') || '-'}
                      </td>
                      <td>&pound;{Number(profile.coach_fee).toFixed(2)}</td>
                      <td>&pound;{Number(profile.venue_fee || 0).toFixed(2)}</td>
                      <td className="text-success">
                        &pound;{Number(profile.total_price || 0).toFixed(2)}
                      </td>
                      <td>
                        &pound;{Number(profile.livery_total_price || 0).toFixed(2)}
                      </td>
                      <td>{profile.approved_at ? formatDate(profile.approved_at) : '-'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => setToggleTarget(profile)}
                        >
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* All Lesson Requests */}
      {activeTab === 'all-requests' && (
        <div className="admin-section">
          {requests.length === 0 ? (
            <p className="no-data">No lesson requests</p>
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
                  </tr>
                </thead>
                <tbody>
                  {requests.map(request => (
                    <tr key={request.id}>
                      <td>{request.user_name}</td>
                      <td>{request.coach_name}</td>
                      <td>
                        {request.confirmed_date
                          ? formatDate(request.confirmed_date)
                          : formatDate(request.requested_date)
                        }
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Approval Modal */}
      <Modal
        isOpen={approvalModal.isOpen && !!selectedProfile}
        onClose={() => {
          approvalModal.close();
          setSelectedProfile(null);
        }}
        title="Approve Coach Profile"
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => {
              approvalModal.close();
              setSelectedProfile(null);
            }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleApprove}>
              Approve Profile
            </button>
          </>
        }
      >
        {selectedProfile && (
          <>
            <div className="profile-summary">
              <h3>{selectedProfile.coach_name}</h3>
              {selectedProfile.disciplines && selectedProfile.disciplines.length > 0 && (
                <p><strong>Disciplines:</strong> {selectedProfile.disciplines.map(d => getEnumLabel(d, enums?.disciplines)).join(', ')}</p>
              )}
              {selectedProfile.teaching_description && (
                <p><strong>Teaching:</strong> {selectedProfile.teaching_description}</p>
              )}
              {selectedProfile.bio && (
                <p><strong>Bio:</strong> {selectedProfile.bio}</p>
              )}
              <p><strong>Availability Mode:</strong> {getEnumLabel(selectedProfile.availability_mode, enums?.availability_modes)}</p>
              <p><strong>Booking Mode:</strong> {getEnumLabel(selectedProfile.booking_mode, enums?.booking_modes)}</p>
              <p><strong>Lesson Duration:</strong> {selectedProfile.lesson_duration_minutes} minutes</p>
              <p><strong>Coach Fee:</strong> &pound;{Number(selectedProfile.coach_fee).toFixed(2)}</p>
            </div>

            <hr />

            <h4>Set Venue Fees</h4>
            <p className="form-hint">
              The venue fee is added to the coach's fee to get the total price shown to students.
            </p>

            <FormGroup label="Standard Venue Fee (£)">
              <Input
                type="number"
                step="0.01"
                value={approvalModal.formData.venueFee}
                onChange={e => approvalModal.updateField('venueFee', parseFloat(e.target.value) || 0)}
                min="0"
              />
              <div className="fee-preview">
                Total price: &pound;{(Number(selectedProfile.coach_fee) + approvalModal.formData.venueFee).toFixed(2)}
              </div>
            </FormGroup>

            <FormGroup label="Livery Venue Fee (£)">
              <Input
                type="number"
                step="0.01"
                value={approvalModal.formData.liveryVenueFee}
                onChange={e => approvalModal.updateField('liveryVenueFee', parseFloat(e.target.value) || 0)}
                min="0"
              />
              <div className="fee-preview">
                Livery price: &pound;{(Number(selectedProfile.coach_fee) + approvalModal.formData.liveryVenueFee).toFixed(2)}
              </div>
            </FormGroup>
          </>
        )}
      </Modal>

      {/* Toggle Active Confirmation */}
      <ConfirmModal
        isOpen={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        onConfirm={handleToggleActive}
        title={toggleTarget?.is_active ? 'Deactivate Coach' : 'Activate Coach'}
        message={`${toggleTarget?.is_active ? 'Deactivate' : 'Activate'} ${toggleTarget?.coach_name}'s coach profile?`}
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Activate'}
        variant={toggleTarget?.is_active ? 'danger' : 'primary'}
      />
    </div>
  );
}
