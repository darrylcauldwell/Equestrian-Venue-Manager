import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { clinicsApi, horsesApi, arenasApi } from '../services/api';
import type {
  ClinicRequest,
  ClinicRequestDetail,
  CreateClinicRequest,
  ClinicParticipant,
  CreateClinicParticipant,
  ClinicsListResponse,
  PublicClinicsResponse,
  ClinicEnums,
  Horse,
  Arena,
  Discipline,
  MyClinicRegistration,
} from '../types';
import SocialShare from '../components/SocialShare';
import { validateEmail, validatePhone } from '../utils/validation';
import './Clinics.css';

type ViewTab = 'upcoming' | 'submit' | 'my-registrations' | 'my-clinics' | 'manage';
type ManageTab = 'pending' | 'approved' | 'past';

export default function Clinics() {
  const { user } = useAuth();
  const { venueName } = useSettings();
  const isManager = user?.role === 'admin';
  const isCoach = user?.role === 'coach';

  // Coaches default to My Clinics tab, others to Upcoming
  const [activeTab, setActiveTab] = useState<ViewTab>(isCoach ? 'my-clinics' : 'upcoming');
  const [manageTab, setManageTab] = useState<ManageTab>('pending');

  const [publicClinics, setPublicClinics] = useState<PublicClinicsResponse | null>(null);
  const [manageClinics, setManageClinics] = useState<ClinicsListResponse | null>(null);
  const [myClinics, setMyClinics] = useState<ClinicRequest[]>([]);
  const [myRegistrations, setMyRegistrations] = useState<MyClinicRegistration[]>([]);
  const [enums, setEnums] = useState<ClinicEnums | null>(null);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);

  const [selectedClinic, setSelectedClinic] = useState<ClinicRequestDetail | null>(null);
  const [isManagementView, setIsManagementView] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Form states - auto-fill coach details if user is a coach
  const [submitForm, setSubmitForm] = useState<CreateClinicRequest>({
    coach_name: isCoach && user ? user.name : '',
    coach_email: isCoach && user?.email ? user.email : '',
    coach_phone: isCoach && user?.phone ? user.phone : '',
    discipline: 'flatwork' as Discipline,
    proposed_date: '',
  });

  const [registerForm, setRegisterForm] = useState<CreateClinicParticipant>({});
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState<Discipline | ''>('');
  // Venue fee state for approval
  const [venueFeePrivate, setVenueFeePrivate] = useState<number | undefined>();
  const [venueFeeGroup, setVenueFeeGroup] = useState<number | undefined>();
  const [liveryVenueFeePrivate, setLiveryVenueFeePrivate] = useState<number>(0);
  const [liveryVenueFeeGroup, setLiveryVenueFeeGroup] = useState<number>(0);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, disciplineFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [enumsData, publicData, arenasData] = await Promise.all([
        clinicsApi.getEnums(),
        clinicsApi.listPublic(disciplineFilter || undefined),
        arenasApi.list(),
      ]);
      setEnums(enumsData);
      setPublicClinics(publicData);
      setArenas(arenasData);

      if (isManager) {
        const manageData = await clinicsApi.listAll(disciplineFilter || undefined);
        setManageClinics(manageData);
      }

      if (isCoach) {
        const myProposals = await clinicsApi.listMyProposals();
        setMyClinics(myProposals);
      }

      // Load registrations for logged-in users (livery/admin)
      if (user && !isCoach) {
        try {
          const registrations = await clinicsApi.getMyRegistrations();
          setMyRegistrations(registrations);
        } catch {
          // User might not have any registrations, that's ok
        }
        // Load horses for registration
        const horsesData = await horsesApi.list();
        setHorses(horsesData);
      }
    } catch (err) {
      setError('Failed to load clinics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitClinic = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email
    const emailResult = validateEmail(submitForm.coach_email);
    if (!emailResult.isValid) {
      setError(emailResult.message || 'Invalid email');
      return;
    }

    // Validate phone if provided
    const phoneResult = validatePhone(submitForm.coach_phone);
    if (!phoneResult.isValid) {
      setError(phoneResult.message || 'Invalid phone number');
      return;
    }

    try {
      await clinicsApi.submit(submitForm);
      setShowSubmitModal(false);
      // Reset form but keep coach details if user is a coach
      setSubmitForm({
        coach_name: isCoach && user ? user.name : '',
        coach_email: isCoach && user?.email ? user.email : '',
        coach_phone: isCoach && user?.phone ? user.phone : '',
        discipline: 'flatwork' as Discipline,
        proposed_date: '',
      });
      alert('Clinic request submitted successfully! You will be notified once reviewed.');
      loadData();
    } catch (err) {
      setError('Failed to submit clinic request');
      console.error(err);
    }
  };

  const handleViewDetails = async (clinicId: number, forManagement: boolean = false, showModal: boolean = true) => {
    try {
      const details = forManagement
        ? await clinicsApi.getDetails(clinicId)
        : await clinicsApi.getPublic(clinicId);
      setSelectedClinic(details);
      setIsManagementView(forManagement);
      if (showModal) {
        setShowDetailModal(true);
      }
    } catch (err) {
      setError('Failed to load clinic details');
      console.error(err);
    }
  };

  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic) return;

    // Validate guest registration fields
    if (!user) {
      const emailResult = validateEmail(registerForm.participant_email);
      if (!emailResult.isValid) {
        setError(emailResult.message || 'Invalid email');
        return;
      }

      const phoneResult = validatePhone(registerForm.participant_phone);
      if (!phoneResult.isValid) {
        setError(phoneResult.message || 'Invalid phone number');
        return;
      }
    }

    try {
      await clinicsApi.register(selectedClinic.id, registerForm);
      setShowRegisterModal(false);
      setRegisterForm({});

      if (user) {
        // Logged-in user - refresh details
        handleViewDetails(selectedClinic.id, isManager);
      } else {
        // Guest registration - show success message
        setRegistrationSuccess(true);
        loadData(); // Refresh clinic list
      }
    } catch (err) {
      setError('Failed to register for clinic');
      console.error(err);
    }
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
      setShowApprovalModal(false);
      setApprovalNotes('');
      setVenueFeePrivate(undefined);
      setVenueFeeGroup(undefined);
      setLiveryVenueFeePrivate(0);
      setLiveryVenueFeeGroup(0);
      setShowDetailModal(false);
      loadData();
    } catch (err) {
      setError('Failed to approve clinic');
      console.error(err);
    }
  };

  const handleReject = async () => {
    if (!selectedClinic || !rejectionReason.trim()) return;
    try {
      await clinicsApi.reject(selectedClinic.id, rejectionReason);
      setShowApprovalModal(false);
      setRejectionReason('');
      setShowDetailModal(false);
      loadData();
    } catch (err) {
      setError('Failed to reject clinic');
      console.error(err);
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedClinic || !approvalNotes.trim()) return;
    try {
      await clinicsApi.requestChanges(selectedClinic.id, approvalNotes);
      setShowApprovalModal(false);
      setApprovalNotes('');
      setShowDetailModal(false);
      loadData();
    } catch (err) {
      setError('Failed to request changes');
      console.error(err);
    }
  };

  const handleCancel = async (reason?: string) => {
    if (!selectedClinic) return;
    try {
      await clinicsApi.cancel(selectedClinic.id, reason);
      setShowDetailModal(false);
      loadData();
    } catch (err) {
      setError('Failed to cancel clinic');
      console.error(err);
    }
  };

  const handleComplete = async () => {
    if (!selectedClinic) return;
    try {
      await clinicsApi.complete(selectedClinic.id);
      setShowDetailModal(false);
      loadData();
    } catch (err) {
      setError('Failed to complete clinic');
      console.error(err);
    }
  };

  const handleConfirmParticipant = async (participant: ClinicParticipant) => {
    if (!selectedClinic) return;
    try {
      await clinicsApi.updateParticipant(selectedClinic.id, participant.id, {
        is_confirmed: !participant.is_confirmed
      });
      handleViewDetails(selectedClinic.id, true);
    } catch (err) {
      setError('Failed to update participant');
      console.error(err);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'short',
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
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-danger';
      case 'changes_requested': return 'badge-info';
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

  const renderClinicCard = (clinic: ClinicRequest, showManageActions: boolean = false) => (
    <div key={clinic.id} className="clinic-card">
      <div className="clinic-card-header">
        <h3>{clinic.title || `${clinic.coach_name} - ${getEnumLabel(clinic.discipline, enums?.disciplines)}`}</h3>
        {/* Only show status badge for admin/coach management views */}
        {showManageActions && (
          <span className={`badge ${getStatusBadgeClass(clinic.status)}`}>
            {getEnumLabel(clinic.status, enums?.statuses)}
          </span>
        )}
      </div>

      <div className="clinic-card-body">
        <div className="clinic-info-row">
          <span className="label">Coach:</span>
          <span>{clinic.coach_name}</span>
        </div>
        <div className="clinic-info-row">
          <span className="label">Discipline:</span>
          <span>{getEnumLabel(clinic.discipline, enums?.disciplines)}</span>
        </div>
        <div className="clinic-info-row">
          <span className="label">Date:</span>
          <span>
            {formatDate(clinic.proposed_date)}
            {clinic.proposed_end_date && clinic.proposed_end_date !== clinic.proposed_date && (
              <> - {formatDate(clinic.proposed_end_date)}</>
            )}
          </span>
        </div>
        {clinic.proposed_start_time && (
          <div className="clinic-info-row">
            <span className="label">Time:</span>
            <span>
              {formatTime(clinic.proposed_start_time)}
              {clinic.proposed_end_time && <> - {formatTime(clinic.proposed_end_time)}</>}
            </span>
          </div>
        )}
        <div className="clinic-info-row">
          <span className="label">Format:</span>
          <span>{getEnumLabel(clinic.lesson_format, enums?.lesson_formats)}</span>
        </div>
        {/* Price display - show total price (coach + venue fee) */}
        {clinic.coach_fee_private && (
          <div className="clinic-info-row">
            <span className="label">Private:</span>
            <span>&pound;{(Number(clinic.coach_fee_private) + Number(clinic.venue_fee_private || 0)).toFixed(2)}</span>
          </div>
        )}
        {clinic.coach_fee_group && (
          <div className="clinic-info-row">
            <span className="label">Group:</span>
            <span>&pound;{(Number(clinic.coach_fee_group) + Number(clinic.venue_fee_group || 0)).toFixed(2)}/person</span>
          </div>
        )}
        {/* Spaces/bookings count - only show for admin/coach management views */}
        {showManageActions && clinic.max_participants && (
          <div className="clinic-info-row">
            <span className="label">Spaces:</span>
            <span>
              {clinic.participant_count || 0} / {clinic.max_participants}
            </span>
          </div>
        )}
      </div>

      <div className="clinic-card-actions">
        <button
          className="btn btn-secondary"
          onClick={() => handleViewDetails(clinic.id, showManageActions)}
        >
          View Details
        </button>
        {clinic.status === 'approved' && clinic.proposed_by_id !== user?.id && (
          <button
            className="btn btn-primary"
            onClick={() => {
              handleViewDetails(clinic.id, false, false).then(() => {
                setShowRegisterModal(true);
              });
            }}
          >
            Register
          </button>
        )}
        {clinic.status === 'approved' && (
          <SocialShare
            title={clinic.title || `${clinic.coach_name} - ${getEnumLabel(clinic.discipline, enums?.disciplines)}`}
            description={`Training clinic with ${clinic.coach_name}`}
            date={formatDate(clinic.proposed_date)}
            time={clinic.proposed_start_time ? formatTime(clinic.proposed_start_time) : undefined}
            location={venueName}
            price={clinic.coach_fee_private ? `£${(Number(clinic.coach_fee_private) + Number(clinic.venue_fee_private || 0)).toFixed(2)} per lesson` : undefined}
            type="clinic"
          />
        )}
      </div>
    </div>
  );

  if (loading) {
    return <div className="ds-loading">Loading clinics...</div>;
  }

  return (
    <div className="clinics-page">
      <div className="page-header">
        <h1>Training Clinics</h1>
        <p>Browse upcoming clinics or submit a request to run your own</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Guest registration success banner */}
      {registrationSuccess && (
        <div className="success-banner">
          <h3>Registration Successful!</h3>
          <p>
            Thank you for registering. An account has been created for you.
            Check your email for login details to track your booking.
          </p>
          <button className="btn btn-primary" onClick={() => setRegistrationSuccess(false)}>
            OK
          </button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tabs-container">
        {/* Coach tab order: My Clinics, Request Clinic, Upcoming Clinics */}
        {isCoach ? (
          <>
            <button
              className={`ds-tab ${activeTab === 'my-clinics' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-clinics')}
            >
              My Clinics ({myClinics.length})
            </button>
            <button
              className={`ds-tab ${activeTab === 'submit' ? 'active' : ''}`}
              onClick={() => setActiveTab('submit')}
            >
              Request Clinic
            </button>
            <button
              className={`ds-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              Other Clinics
            </button>
          </>
        ) : (
          <>
            <button
              className={`ds-tab ${activeTab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setActiveTab('upcoming')}
            >
              Upcoming Clinics
            </button>
            <button
              className={`ds-tab ${activeTab === 'submit' ? 'active' : ''}`}
              onClick={() => setActiveTab('submit')}
            >
              Request Clinic
            </button>
            {user && (
              <button
                className={`ds-tab ${activeTab === 'my-registrations' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-registrations')}
              >
                My Registrations {myRegistrations.length > 0 && `(${myRegistrations.length})`}
              </button>
            )}
          </>
        )}
        {isManager && (
          <button
            className={`ds-tab ${activeTab === 'manage' ? 'active' : ''}`}
            onClick={() => setActiveTab('manage')}
          >
            Manage Requests
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <label>
          Filter by Discipline:
          <select
            value={disciplineFilter}
            onChange={(e) => setDisciplineFilter(e.target.value as Discipline | '')}
          >
            <option value="">All Disciplines</option>
            {enums?.disciplines.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Upcoming Clinics Tab */}
      {activeTab === 'upcoming' && (
        <div className="clinics-section">
          <h2>Upcoming Clinics</h2>
          {publicClinics?.upcoming.length === 0 ? (
            <p className="no-data">No upcoming clinics at the moment. Check back soon!</p>
          ) : (
            <div className="clinics-grid">
              {publicClinics?.upcoming.map(clinic => renderClinicCard(clinic))}
            </div>
          )}

          {publicClinics?.past && publicClinics.past.length > 0 && (
            <>
              <h2>Past Clinics</h2>
              <div className="clinics-grid past">
                {publicClinics.past.map(clinic => renderClinicCard(clinic))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Submit Request Tab */}
      {activeTab === 'submit' && (
        <div className="submit-section">
          <div className="submit-info">
            <h2>Request to Run a Clinic</h2>
            <p>
              Are you a coach or instructor looking to run a training clinic at our venue?
              Submit your request below and we'll review it and get back to you.
            </p>
            <button className="btn btn-primary" onClick={() => setShowSubmitModal(true)}>
              Submit Clinic Request
            </button>
          </div>

          <div className="submit-guidelines">
            <h3>Guidelines</h3>
            <ul>
              <li>Requests should be submitted at least 4 weeks in advance</li>
              <li>Include details about your coaching qualifications and experience</li>
              <li>Specify any special arena or equipment requirements</li>
              <li>Provide information about lesson format and pricing</li>
              <li>We will review your request and respond within 5 working days</li>
            </ul>
          </div>
        </div>
      )}

      {/* My Registrations Tab (Livery/Admin - non-coach users) */}
      {activeTab === 'my-registrations' && user && !isCoach && (
        <div className="my-registrations-section">
          <h2>My Clinic Registrations</h2>
          <p className="section-intro">View your clinic registrations and assigned slot times.</p>

          {myRegistrations.length === 0 ? (
            <div className="no-data">
              <p>You haven't registered for any clinics yet.</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('upcoming')}>
                Browse Upcoming Clinics
              </button>
            </div>
          ) : (
            <div className="registrations-list">
              {myRegistrations.map(reg => (
                <div key={reg.id} className="registration-card">
                  <div className="registration-header">
                    <h3>{reg.clinic_title}</h3>
                    <span className={`badge ${reg.is_confirmed ? 'badge-success' : 'badge-warning'}`}>
                      {reg.is_confirmed ? 'Confirmed' : 'Pending Confirmation'}
                    </span>
                  </div>

                  <div className="registration-details">
                    <div className="detail-row">
                      <span className="label">Clinic Date:</span>
                      <span>{formatDate(reg.clinic_date)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Discipline:</span>
                      <span>{getEnumLabel(reg.discipline || '', enums?.disciplines)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Coach:</span>
                      <span>{reg.coach_name}</span>
                    </div>

                    {/* Slot time information */}
                    {reg.slot_id ? (
                      <div className="slot-info">
                        <h4>Your Slot Time</h4>
                        <div className="detail-row">
                          <span className="label">Date:</span>
                          <span>{formatDate(reg.slot_date!)}</span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Time:</span>
                          <span>
                            {formatTime(reg.slot_start_time!)}
                            {reg.slot_end_time && <> - {formatTime(reg.slot_end_time)}</>}
                          </span>
                        </div>
                        {reg.slot_group_name && (
                          <div className="detail-row">
                            <span className="label">Group:</span>
                            <span>{reg.slot_group_name}</span>
                          </div>
                        )}
                        {reg.slot_arena_name && (
                          <div className="detail-row">
                            <span className="label">Arena:</span>
                            <span>{reg.slot_arena_name}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="slot-info pending">
                        <p>Slot time not yet assigned. Check back later for your scheduled time.</p>
                      </div>
                    )}
                  </div>

                  <div className="registration-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleViewDetails(reg.clinic_id, false)}
                    >
                      View Clinic Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My Clinics Tab (Coach only) */}
      {activeTab === 'my-clinics' && isCoach && (
        <div className="my-clinics-section">
          <h2>My Clinics</h2>
          <p className="section-intro">View and manage your clinic requests and upcoming sessions.</p>

          {myClinics.length === 0 ? (
            <div className="no-data">
              <p>You haven't submitted any clinic requests yet.</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('submit')}>
                Submit Your First Clinic Request
              </button>
            </div>
          ) : (
            <div className="clinics-grid">
              {myClinics.map(clinic => (
                <div key={clinic.id} className="clinic-card coach-view">
                  <div className="clinic-card-header">
                    <h3>{clinic.title || `${getEnumLabel(clinic.discipline, enums?.disciplines)} Clinic`}</h3>
                    <span className={`badge ${getStatusBadgeClass(clinic.status)}`}>
                      {getEnumLabel(clinic.status, enums?.statuses)}
                    </span>
                  </div>

                  <div className="clinic-card-body">
                    <div className="clinic-info-row">
                      <span className="label">Date:</span>
                      <span>
                        {formatDate(clinic.proposed_date)}
                        {clinic.proposed_end_date && clinic.proposed_end_date !== clinic.proposed_date && (
                          <> - {formatDate(clinic.proposed_end_date)}</>
                        )}
                      </span>
                    </div>
                    {clinic.proposed_start_time && (
                      <div className="clinic-info-row">
                        <span className="label">Time:</span>
                        <span>
                          {formatTime(clinic.proposed_start_time)}
                          {clinic.proposed_end_time && <> - {formatTime(clinic.proposed_end_time)}</>}
                        </span>
                      </div>
                    )}
                    {clinic.arena_required && (
                      <div className="clinic-info-row">
                        <span className="label">Arena:</span>
                        <span>{clinic.arena_required}</span>
                      </div>
                    )}
                    <div className="clinic-info-row">
                      <span className="label">Format:</span>
                      <span>{getEnumLabel(clinic.lesson_format, enums?.lesson_formats)}</span>
                    </div>
                    {clinic.max_participants && (
                      <div className="clinic-info-row">
                        <span className="label">Bookings:</span>
                        <span className={clinic.participant_count === clinic.max_participants ? 'text-success' : ''}>
                          {clinic.participant_count || 0} / {clinic.max_participants}
                          {clinic.participant_count === clinic.max_participants && ' (Full)'}
                        </span>
                      </div>
                    )}
                    {clinic.coach_fee_private && (
                      <div className="clinic-info-row">
                        <span className="label">Your Rate (Private):</span>
                        <span>&pound;{Number(clinic.coach_fee_private).toFixed(2)}
                          {clinic.venue_fee_private && ` + £${Number(clinic.venue_fee_private).toFixed(2)} venue`}
                        </span>
                      </div>
                    )}
                    {clinic.coach_fee_group && (
                      <div className="clinic-info-row">
                        <span className="label">Your Rate (Group):</span>
                        <span>&pound;{Number(clinic.coach_fee_group).toFixed(2)}/person
                          {clinic.venue_fee_group && ` + £${Number(clinic.venue_fee_group).toFixed(2)} venue`}
                          {clinic.max_group_size && ` (max ${clinic.max_group_size})`}
                        </span>
                      </div>
                    )}
                    {clinic.review_notes && (
                      <div className="clinic-info-row full-width">
                        <span className="label">Admin Notes:</span>
                        <span className="review-notes">{clinic.review_notes}</span>
                      </div>
                    )}
                    {clinic.rejection_reason && (
                      <div className="clinic-info-row full-width">
                        <span className="label">Rejection Reason:</span>
                        <span className="text-danger">{clinic.rejection_reason}</span>
                      </div>
                    )}
                  </div>

                  <div className="clinic-card-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleViewDetails(clinic.id, true)}
                    >
                      View Details
                    </button>
                    {clinic.status === 'approved' && (
                      <SocialShare
                        title={clinic.title || `${clinic.coach_name} - ${getEnumLabel(clinic.discipline, enums?.disciplines)}`}
                        description={`Training clinic with ${clinic.coach_name}`}
                        date={formatDate(clinic.proposed_date)}
                        time={clinic.proposed_start_time ? formatTime(clinic.proposed_start_time) : undefined}
                        location={venueName}
                        price={clinic.coach_fee_private ? `£${(Number(clinic.coach_fee_private) + Number(clinic.venue_fee_private || 0)).toFixed(2)} per lesson` : undefined}
                        type="clinic"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manage Tab (Manager only) */}
      {activeTab === 'manage' && isManager && (
        <div className="manage-section">
          <div className="manage-tabs">
            <button
              className={`ds-tab ${manageTab === 'pending' ? 'active' : ''}`}
              onClick={() => setManageTab('pending')}
            >
              Pending ({manageClinics?.pending.length || 0})
            </button>
            <button
              className={`ds-tab ${manageTab === 'approved' ? 'active' : ''}`}
              onClick={() => setManageTab('approved')}
            >
              Approved ({manageClinics?.approved.length || 0})
            </button>
            <button
              className={`ds-tab ${manageTab === 'past' ? 'active' : ''}`}
              onClick={() => setManageTab('past')}
            >
              Past ({manageClinics?.past.length || 0})
            </button>
          </div>

          {manageTab === 'pending' && (
            <div className="clinics-grid">
              {manageClinics?.pending.length === 0 ? (
                <p className="no-data">No pending requests</p>
              ) : (
                manageClinics?.pending.map(clinic => renderClinicCard(clinic, true))
              )}
            </div>
          )}

          {manageTab === 'approved' && (
            <div className="clinics-grid">
              {manageClinics?.approved.length === 0 ? (
                <p className="no-data">No approved clinics</p>
              ) : (
                manageClinics?.approved.map(clinic => renderClinicCard(clinic, true))
              )}
            </div>
          )}

          {manageTab === 'past' && (
            <div className="clinics-grid past">
              {manageClinics?.past.length === 0 ? (
                <p className="no-data">No past clinics</p>
              ) : (
                manageClinics?.past.map(clinic => renderClinicCard(clinic, true))
              )}
            </div>
          )}
        </div>
      )}

      {/* Submit Clinic Modal */}
      {showSubmitModal && (
        <div className="ds-modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Submit Clinic Request</h2>
              <button className="close-btn" onClick={() => setShowSubmitModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitClinic}>
              <div className="ds-modal-body">
                <h3>Coach Information</h3>
                <div className="form-row">
                  <label>
                    Name *
                    <input
                      type="text"
                      value={submitForm.coach_name}
                      onChange={e => setSubmitForm({ ...submitForm, coach_name: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    Email *
                    <input
                      type="email"
                      value={submitForm.coach_email}
                      onChange={e => setSubmitForm({ ...submitForm, coach_email: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Phone
                    <input
                      type="tel"
                      value={submitForm.coach_phone || ''}
                      onChange={e => setSubmitForm({ ...submitForm, coach_phone: e.target.value })}
                    />
                  </label>
                </div>
                <label>
                  Bio / Qualifications
                  <textarea
                    value={submitForm.coach_bio || ''}
                    onChange={e => setSubmitForm({ ...submitForm, coach_bio: e.target.value })}
                    placeholder="Tell us about your experience and qualifications..."
                    rows={3}
                  />
                </label>

                <h3>Clinic Details</h3>
                <div className="form-row">
                  <label>
                    Discipline *
                    <select
                      value={submitForm.discipline}
                      onChange={e => setSubmitForm({ ...submitForm, discipline: e.target.value as Discipline })}
                      required
                    >
                      {enums?.disciplines.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Lesson Format
                    <select
                      value={submitForm.lesson_format || 'group'}
                      onChange={e => setSubmitForm({ ...submitForm, lesson_format: e.target.value as 'private' | 'semi_private' | 'group' | 'mixed' })}
                    >
                      {enums?.lesson_formats.map(f => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  Clinic Title
                  <input
                    type="text"
                    value={submitForm.title || ''}
                    onChange={e => setSubmitForm({ ...submitForm, title: e.target.value })}
                    placeholder="e.g., Introduction to Polework"
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={submitForm.description || ''}
                    onChange={e => setSubmitForm({ ...submitForm, description: e.target.value })}
                    placeholder="Describe what the clinic will cover..."
                    rows={3}
                  />
                </label>

                <h3>Date & Time</h3>
                <div className="form-row">
                  <label>
                    Proposed Date *
                    <input
                      type="date"
                      value={submitForm.proposed_date}
                      onChange={e => setSubmitForm({ ...submitForm, proposed_date: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    End Date (if multiple days)
                    <input
                      type="date"
                      value={submitForm.proposed_end_date || ''}
                      onChange={e => setSubmitForm({ ...submitForm, proposed_end_date: e.target.value })}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Proposed Start Time
                    <input
                      type="time"
                      value={submitForm.proposed_start_time || ''}
                      onChange={e => setSubmitForm({ ...submitForm, proposed_start_time: e.target.value })}
                    />
                  </label>
                  <label>
                    Proposed End Time
                    <input
                      type="time"
                      value={submitForm.proposed_end_time || ''}
                      onChange={e => setSubmitForm({ ...submitForm, proposed_end_time: e.target.value })}
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Lesson Duration (minutes)
                    <input
                      type="number"
                      value={submitForm.lesson_duration_minutes || ''}
                      onChange={e => setSubmitForm({ ...submitForm, lesson_duration_minutes: parseInt(e.target.value) || undefined })}
                      placeholder="e.g., 45"
                    />
                  </label>
                </div>

                <h3>Your Fee & Capacity</h3>
                <p className="form-hint">Set your coaching fee. The venue will add their facility fee during approval.</p>
                <div className="form-row">
                  <label>
                    Max Participants
                    <input
                      type="number"
                      value={submitForm.max_participants || ''}
                      onChange={e => setSubmitForm({ ...submitForm, max_participants: parseInt(e.target.value) || undefined })}
                    />
                  </label>
                  <label>
                    Your Fee - Private Lesson (&pound;)
                    <input
                      type="number"
                      step="0.01"
                      value={submitForm.coach_fee_private || ''}
                      onChange={e => setSubmitForm({ ...submitForm, coach_fee_private: parseFloat(e.target.value) || undefined })}
                      placeholder="Your rate for 1:1 lessons"
                    />
                  </label>
                </div>
                {(submitForm.lesson_format === 'group' || submitForm.lesson_format === 'mixed' || submitForm.lesson_format === 'semi_private') && (
                  <div className="form-row">
                    <label>
                      Your Fee - Group per Person (&pound;)
                      <input
                        type="number"
                        step="0.01"
                        value={submitForm.coach_fee_group || ''}
                        onChange={e => setSubmitForm({ ...submitForm, coach_fee_group: parseFloat(e.target.value) || undefined })}
                        placeholder="Your rate per person for group lessons"
                      />
                    </label>
                    <label>
                      Max Group Size
                      <input
                        type="number"
                        value={submitForm.max_group_size || ''}
                        onChange={e => setSubmitForm({ ...submitForm, max_group_size: parseInt(e.target.value) || undefined })}
                        placeholder="Max riders per group slot"
                      />
                    </label>
                  </div>
                )}

                <h3>Requirements</h3>
                <label>
                  Arena Required
                  <select
                    value={submitForm.arena_required || ''}
                    onChange={e => setSubmitForm({ ...submitForm, arena_required: e.target.value })}
                  >
                    <option value="">Select an arena (optional)</option>
                    {arenas.map(arena => (
                      <option key={arena.id} value={arena.name}>{arena.name}</option>
                    ))}
                    <option value="Any">Any Available</option>
                  </select>
                </label>
                <label>
                  Special Requirements
                  <textarea
                    value={submitForm.special_requirements || ''}
                    onChange={e => setSubmitForm({ ...submitForm, special_requirements: e.target.value })}
                    placeholder="Any special equipment or facility needs..."
                    rows={2}
                  />
                </label>
              </div>
              <div className="ds-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedClinic && (
        <div className="ds-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="ds-modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>{selectedClinic.title || `${selectedClinic.coach_name} Clinic`}</h2>
              <button className="close-btn" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>
            <div className="ds-modal-body">
              <div className="detail-grid">
                <div className="detail-section">
                  <h3>Coach Information</h3>
                  <div className="detail-row">
                    <span className="label">Name:</span>
                    <span>{selectedClinic.coach_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Email:</span>
                    <span>{selectedClinic.coach_email}</span>
                  </div>
                  {selectedClinic.coach_phone && (
                    <div className="detail-row">
                      <span className="label">Phone:</span>
                      <span>{selectedClinic.coach_phone}</span>
                    </div>
                  )}
                  {selectedClinic.coach_bio && (
                    <div className="detail-row">
                      <span className="label">Bio:</span>
                      <span>{selectedClinic.coach_bio}</span>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Clinic Details</h3>
                  <div className="detail-row">
                    <span className="label">Discipline:</span>
                    <span>{getEnumLabel(selectedClinic.discipline, enums?.disciplines)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Format:</span>
                    <span>{getEnumLabel(selectedClinic.lesson_format, enums?.lesson_formats)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Date:</span>
                    <span>
                      {formatDate(selectedClinic.proposed_date)}
                      {selectedClinic.proposed_end_date && selectedClinic.proposed_end_date !== selectedClinic.proposed_date && (
                        <> - {formatDate(selectedClinic.proposed_end_date)}</>
                      )}
                    </span>
                  </div>
                  {selectedClinic.proposed_start_time && (
                    <div className="detail-row">
                      <span className="label">Time:</span>
                      <span>
                        {formatTime(selectedClinic.proposed_start_time)}
                        {selectedClinic.proposed_end_time && <> - {formatTime(selectedClinic.proposed_end_time)}</>}
                      </span>
                    </div>
                  )}
                  {selectedClinic.lesson_duration_minutes && (
                    <div className="detail-row">
                      <span className="label">Lesson Duration:</span>
                      <span>{selectedClinic.lesson_duration_minutes} minutes</span>
                    </div>
                  )}
                  {/* Show pricing - public sees total, admin/coach sees breakdown */}
                  {selectedClinic.coach_fee_private && (
                    <div className="detail-row">
                      <span className="label">Private Lesson:</span>
                      <span>
                        {isManagementView ? (
                          <>
                            &pound;{Number(selectedClinic.coach_fee_private).toFixed(2)} coach
                            {selectedClinic.venue_fee_private && ` + £${Number(selectedClinic.venue_fee_private).toFixed(2)} venue`}
                            {' = '}
                            <strong>&pound;{(Number(selectedClinic.coach_fee_private) + Number(selectedClinic.venue_fee_private || 0)).toFixed(2)}</strong>
                          </>
                        ) : (
                          <>&pound;{(Number(selectedClinic.coach_fee_private) + Number(selectedClinic.venue_fee_private || 0)).toFixed(2)}</>
                        )}
                      </span>
                    </div>
                  )}
                  {selectedClinic.coach_fee_group && (
                    <div className="detail-row">
                      <span className="label">Group Lesson:</span>
                      <span>
                        {isManagementView ? (
                          <>
                            &pound;{Number(selectedClinic.coach_fee_group).toFixed(2)} coach
                            {selectedClinic.venue_fee_group && ` + £${Number(selectedClinic.venue_fee_group).toFixed(2)} venue`}
                            {' = '}
                            <strong>&pound;{(Number(selectedClinic.coach_fee_group) + Number(selectedClinic.venue_fee_group || 0)).toFixed(2)}/person</strong>
                            {selectedClinic.max_group_size && ` (max ${selectedClinic.max_group_size} riders)`}
                          </>
                        ) : (
                          <>
                            &pound;{(Number(selectedClinic.coach_fee_group) + Number(selectedClinic.venue_fee_group || 0)).toFixed(2)}/person
                            {selectedClinic.max_group_size && ` (max ${selectedClinic.max_group_size} riders)`}
                          </>
                        )}
                      </span>
                    </div>
                  )}
                  {/* Show livery discount info for admin */}
                  {isManagementView && isManager && (selectedClinic.livery_venue_fee_private !== undefined || selectedClinic.livery_venue_fee_group !== undefined) && (
                    <div className="detail-row">
                      <span className="label">Livery Discount:</span>
                      <span>
                        Venue fee reduced to &pound;{Number(selectedClinic.livery_venue_fee_private || 0).toFixed(2)} (private)
                        {selectedClinic.livery_venue_fee_group !== undefined && ` / £${Number(selectedClinic.livery_venue_fee_group || 0).toFixed(2)} (group)`}
                      </span>
                    </div>
                  )}
                  {selectedClinic.description && (
                    <div className="detail-row full-width">
                      <span className="label">Description:</span>
                      <p>{selectedClinic.description}</p>
                    </div>
                  )}
                </div>

                {/* Status & Review section - only show for admin/coach management views */}
                {isManagementView && (
                  <div className="detail-section">
                    <h3>Status & Review</h3>
                    <div className="detail-row">
                      <span className="label">Status:</span>
                      <span className={`badge ${getStatusBadgeClass(selectedClinic.status)}`}>
                        {getEnumLabel(selectedClinic.status, enums?.statuses)}
                      </span>
                    </div>
                    {selectedClinic.reviewed_by_name && (
                      <div className="detail-row">
                        <span className="label">Reviewed By:</span>
                        <span>{selectedClinic.reviewed_by_name}</span>
                      </div>
                    )}
                    {selectedClinic.review_notes && (
                      <div className="detail-row">
                        <span className="label">Notes:</span>
                        <span>{selectedClinic.review_notes}</span>
                      </div>
                    )}
                    {selectedClinic.rejection_reason && (
                      <div className="detail-row">
                        <span className="label">Rejection Reason:</span>
                        <span className="text-danger">{selectedClinic.rejection_reason}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Participants Section - show for admin/manager or coaches viewing their own clinics */}
              {(isManagementView || selectedClinic.proposed_by_id === user?.id) && (selectedClinic.status === 'approved' || selectedClinic.status === 'completed') && (
                <div className="participants-section">
                  <h3>
                    Participants ({selectedClinic.participants?.length || 0}
                    {selectedClinic.max_participants && ` / ${selectedClinic.max_participants}`})
                  </h3>
                  {selectedClinic.participants?.length === 0 ? (
                    <p className="no-data">No registrations yet</p>
                  ) : (
                    <table className="participants-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Horse</th>
                          <th>Contact</th>
                          <th>Lesson Time</th>
                          <th>Confirmed</th>
                          {isManager && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedClinic.participants?.map(p => (
                          <tr key={p.id}>
                            <td>{p.user_name || p.participant_name || '-'}</td>
                            <td>{p.horse_name || '-'}</td>
                            <td>{p.participant_email || p.participant_phone || '-'}</td>
                            <td>{p.lesson_time ? formatTime(p.lesson_time) : '-'}</td>
                            <td>
                              <span className={`badge ${p.is_confirmed ? 'badge-success' : 'badge-warning'}`}>
                                {p.is_confirmed ? 'Confirmed' : 'Pending'}
                              </span>
                            </td>
                            {isManager && (
                              <td>
                                <button
                                  className="btn btn-sm"
                                  onClick={() => handleConfirmParticipant(p)}
                                >
                                  {p.is_confirmed ? 'Unconfirm' : 'Confirm'}
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Share Links */}
              {selectedClinic.status === 'approved' && (
                <div className="share-section">
                  <h3>Share This Clinic</h3>
                  <div className="share-buttons">
                    <SocialShare
                      title={selectedClinic.title || `${selectedClinic.coach_name} Training Clinic`}
                      description={selectedClinic.description || `Join ${selectedClinic.coach_name} for a ${getEnumLabel(selectedClinic.discipline, enums?.disciplines)} clinic`}
                      date={formatDate(selectedClinic.proposed_date)}
                      time={selectedClinic.proposed_start_time ? formatTime(selectedClinic.proposed_start_time) : undefined}
                      location={venueName}
                      price={selectedClinic.coach_fee_private ? `£${(Number(selectedClinic.coach_fee_private) + Number(selectedClinic.venue_fee_private || 0)).toFixed(2)} per lesson` : undefined}
                      type="clinic"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="ds-modal-footer">
              {/* Public actions */}
              {selectedClinic.status === 'approved' && user && selectedClinic.proposed_by_id !== user.id && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowDetailModal(false);
                    setShowRegisterModal(true);
                  }}
                >
                  Register for Clinic
                </button>
              )}

              {/* Manager actions */}
              {isManager && selectedClinic.status === 'pending' && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowApprovalModal(true)}
                >
                  Review Request
                </button>
              )}
              {isManager && selectedClinic.status === 'approved' && (
                <>
                  <button
                    className="btn btn-success"
                    onClick={handleComplete}
                  >
                    Mark Complete
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleCancel()}
                  >
                    Cancel Clinic
                  </button>
                </>
              )}

              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegisterModal && selectedClinic && (
        <div className="ds-modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Register for Clinic</h2>
              <button className="close-btn" onClick={() => setShowRegisterModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleRegister}>
              <div className="ds-modal-body">
                <p>Registering for: <strong>{selectedClinic.title || `${selectedClinic.coach_name} Clinic`}</strong></p>

                {/* Guest contact fields - only show when not logged in */}
                {!user && (
                  <>
                    <label>
                      Your Name *
                      <input
                        type="text"
                        value={registerForm.participant_name || ''}
                        onChange={e => setRegisterForm({ ...registerForm, participant_name: e.target.value })}
                        placeholder="Your full name"
                        required
                      />
                    </label>

                    <label>
                      Email *
                      <input
                        type="email"
                        value={registerForm.participant_email || ''}
                        onChange={e => setRegisterForm({ ...registerForm, participant_email: e.target.value })}
                        placeholder="your@email.com"
                        required
                      />
                    </label>

                    <label>
                      Phone *
                      <input
                        type="tel"
                        value={registerForm.participant_phone || ''}
                        onChange={e => setRegisterForm({ ...registerForm, participant_phone: e.target.value })}
                        placeholder="07700 900000"
                        required
                      />
                    </label>
                  </>
                )}

                {/* Horse selection - only for logged-in users with horses */}
                {user && horses.length > 0 && (
                  <label>
                    Horse
                    <select
                      value={registerForm.horse_id || ''}
                      onChange={e => setRegisterForm({ ...registerForm, horse_id: parseInt(e.target.value) || undefined })}
                    >
                      <option value="">Select a horse (optional)</option>
                      {horses.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                {/* Horse name for guests */}
                {!user && (
                  <label>
                    Horse Name
                    <input
                      type="text"
                      value={registerForm.notes?.includes('Horse:') ? '' : ''}
                      onChange={e => {
                        const horseName = e.target.value;
                        const existingNotes = registerForm.notes?.replace(/^Horse: .*\n?/, '') || '';
                        setRegisterForm({
                          ...registerForm,
                          notes: horseName ? `Horse: ${horseName}\n${existingNotes}`.trim() : existingNotes
                        });
                      }}
                      placeholder="Your horse's name (optional)"
                    />
                  </label>
                )}

                <label>
                  Preferred Lesson Time
                  {selectedClinic.proposed_start_time && selectedClinic.proposed_end_time && (
                    <span className="time-range-hint">
                      (Available: {selectedClinic.proposed_start_time.slice(0, 5)} - {selectedClinic.proposed_end_time.slice(0, 5)})
                    </span>
                  )}
                  <input
                    type="time"
                    value={registerForm.lesson_time || ''}
                    onChange={e => setRegisterForm({ ...registerForm, lesson_time: e.target.value })}
                    min={selectedClinic.proposed_start_time?.slice(0, 5)}
                    max={selectedClinic.proposed_end_time?.slice(0, 5)}
                  />
                </label>

                {/* Lesson type selector - show when clinic offers both private and group */}
                {selectedClinic.lesson_format === 'mixed' && (
                  <label>
                    Lesson Type *
                    <select
                      value={registerForm.preferred_lesson_type || ''}
                      onChange={e => setRegisterForm({
                        ...registerForm,
                        preferred_lesson_type: e.target.value as 'private' | 'group' | undefined || undefined
                      })}
                      required
                    >
                      <option value="">Select lesson type</option>
                      {selectedClinic.coach_fee_private && (
                        <option value="private">
                          Private Lesson - £{(Number(selectedClinic.coach_fee_private) + Number(selectedClinic.venue_fee_private || 0)).toFixed(2)}
                        </option>
                      )}
                      {selectedClinic.coach_fee_group && (
                        <option value="group">
                          Group Lesson - £{(Number(selectedClinic.coach_fee_group) + Number(selectedClinic.venue_fee_group || 0)).toFixed(2)}/person
                        </option>
                      )}
                    </select>
                  </label>
                )}

                <label>
                  {registerForm.preferred_lesson_type === 'group' ? 'Notes & Grouping Preferences' : 'Notes'}
                  <textarea
                    value={registerForm.notes || ''}
                    onChange={e => setRegisterForm({ ...registerForm, notes: e.target.value })}
                    placeholder={
                      registerForm.preferred_lesson_type === 'group'
                        ? "Who would you like to be grouped with? (e.g., name of friend, or 'with competitors' / 'with beginners')"
                        : "Any special requirements or information..."
                    }
                    rows={3}
                  />
                </label>

                {!user && (
                  <p className="guest-note">
                    An account will be created for you to track your registration.
                  </p>
                )}
              </div>
              <div className="ds-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRegisterModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approval Modal */}
      {showApprovalModal && selectedClinic && (
        <div className="ds-modal-overlay" onClick={() => setShowApprovalModal(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Review Clinic Request</h2>
              <button className="close-btn" onClick={() => setShowApprovalModal(false)}>&times;</button>
            </div>
            <div className="ds-modal-body">
              <p>Reviewing request from: <strong>{selectedClinic.coach_name}</strong></p>
              <p>Date: {formatDate(selectedClinic.proposed_date)}</p>

              {/* Coach fees display */}
              <div className="coach-fees-summary">
                <h4>Coach Fees (set by coach)</h4>
                {selectedClinic.coach_fee_private && (
                  <p>Private Lesson: &pound;{Number(selectedClinic.coach_fee_private).toFixed(2)}</p>
                )}
                {selectedClinic.coach_fee_group && (
                  <p>Group Lesson: &pound;{Number(selectedClinic.coach_fee_group).toFixed(2)}/person</p>
                )}
              </div>

              {/* Venue fees section */}
              <h4>Venue Fees (your arena hire charge)</h4>
              <div className="form-row">
                {selectedClinic.coach_fee_private && (
                  <label>
                    Venue Fee - Private (&pound;)
                    <input
                      type="number"
                      step="0.01"
                      value={venueFeePrivate ?? ''}
                      onChange={e => setVenueFeePrivate(parseFloat(e.target.value) || undefined)}
                      placeholder="e.g., 10.00"
                    />
                    {venueFeePrivate !== undefined && (
                      <span className="fee-total">
                        Total: &pound;{(Number(selectedClinic.coach_fee_private) + venueFeePrivate).toFixed(2)}
                      </span>
                    )}
                  </label>
                )}
                {selectedClinic.coach_fee_group && (
                  <label>
                    Venue Fee - Group/person (&pound;)
                    <input
                      type="number"
                      step="0.01"
                      value={venueFeeGroup ?? ''}
                      onChange={e => setVenueFeeGroup(parseFloat(e.target.value) || undefined)}
                      placeholder="e.g., 5.00"
                    />
                    {venueFeeGroup !== undefined && (
                      <span className="fee-total">
                        Total: &pound;{(Number(selectedClinic.coach_fee_group) + venueFeeGroup).toFixed(2)}/person
                      </span>
                    )}
                  </label>
                )}
              </div>

              {/* Livery discount */}
              <h4>Livery Member Discount</h4>
              <p className="form-hint">Livery members can get reduced or waived venue fees.</p>
              <div className="form-row">
                {selectedClinic.coach_fee_private && (
                  <label>
                    Livery Venue Fee - Private (&pound;)
                    <input
                      type="number"
                      step="0.01"
                      value={liveryVenueFeePrivate}
                      onChange={e => setLiveryVenueFeePrivate(parseFloat(e.target.value) || 0)}
                      placeholder="0 for free"
                    />
                  </label>
                )}
                {selectedClinic.coach_fee_group && (
                  <label>
                    Livery Venue Fee - Group (&pound;)
                    <input
                      type="number"
                      step="0.01"
                      value={liveryVenueFeeGroup}
                      onChange={e => setLiveryVenueFeeGroup(parseFloat(e.target.value) || 0)}
                      placeholder="0 for free"
                    />
                  </label>
                )}
              </div>

              <label>
                Notes / Reason
                <textarea
                  value={approvalNotes || rejectionReason}
                  onChange={e => {
                    setApprovalNotes(e.target.value);
                    setRejectionReason(e.target.value);
                  }}
                  placeholder="Add notes for approval or reason for rejection/changes..."
                  rows={3}
                />
              </label>
            </div>
            <div className="modal-footer approval-actions">
              <button
                className="btn btn-success"
                onClick={handleApprove}
              >
                Approve
              </button>
              <button
                className="btn btn-warning"
                onClick={handleRequestChanges}
                disabled={!approvalNotes.trim()}
              >
                Request Changes
              </button>
              <button
                className="btn btn-danger"
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
              >
                Reject
              </button>
              <button className="btn btn-secondary" onClick={() => setShowApprovalModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
