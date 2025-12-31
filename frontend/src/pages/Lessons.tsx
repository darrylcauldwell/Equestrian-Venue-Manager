import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { lessonsApi, horsesApi, arenasApi } from '../services/api';
import { useRequestState } from '../hooks';
import { ConfirmModal, FormGroup, Select, Input, Textarea } from '../components/ui';
import type {
  CoachProfile,
  LessonRequest,
  CreateLessonRequest,
  CreateLessonBook,
  LessonEnums,
  Horse,
  Arena,
  RecurringSchedule,
  AvailabilitySlot,
  CoachAvailability,
  CombinedAvailabilityResponse,
  TimeSlotAvailability,
} from '../types';
import type {
  CoachProfileCreate,
  CoachProfileUpdate,
  RecurringScheduleCreate,
  AvailabilitySlotCreate,
  CoachAcceptLesson,
  CoachBookLesson,
  StudentInfo,
} from '../services/api';
import './Lessons.css';

type ViewTab = 'coaches' | 'my-requests' | 'my-profile' | 'incoming';

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function Lessons() {
  const { user } = useAuth();
  const isCoach = user?.role === 'coach';

  // Coaches default to Upcoming Lessons tab, others to browse coaches
  const [activeTab, setActiveTab] = useState<ViewTab>(isCoach ? 'my-requests' : 'coaches');

  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [myRequests, setMyRequests] = useState<LessonRequest[]>([]);
  const [myProfile, setMyProfile] = useState<CoachProfile | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<LessonRequest[]>([]);
  const [enums, setEnums] = useState<LessonEnums | null>(null);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);

  const [selectedCoach, setSelectedCoach] = useState<CoachProfile | null>(null);
  const [coachAvailability, setCoachAvailability] = useState<CoachAvailability | null>(null);
  const [combinedAvailability, setCombinedAvailability] = useState<CombinedAvailabilityResponse | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<TimeSlotAvailability | null>(null);
  const [selectedArenaId, setSelectedArenaId] = useState<number | null>(null);
  const [requestWeekStart, setRequestWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [loadingRequestAvailability, setLoadingRequestAvailability] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LessonRequest | null>(null);

  // Request state
  const { loading, error, setError, setLoading } = useRequestState(true);

  // Confirm modals for actions that used confirm()
  const [cancelRequestTarget, setCancelRequestTarget] = useState<LessonRequest | null>(null);
  const [removeScheduleTarget, setRemoveScheduleTarget] = useState<RecurringSchedule | null>(null);
  const [removeSlotTarget, setRemoveSlotTarget] = useState<AvailabilitySlot | null>(null);

  // Modals
  const [showCoachModal, setShowCoachModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);

  // Filter
  const [disciplineFilter, setDisciplineFilter] = useState<string>('');

  // Forms
  const [requestForm, setRequestForm] = useState<CreateLessonRequest | CreateLessonBook>({
    coach_profile_id: 0,
    requested_date: '',
    requested_time: '',
  });

  const [profileForm, setProfileForm] = useState<CoachProfileCreate | CoachProfileUpdate>({
    coach_fee: 0,
    lesson_duration_minutes: 45,
    availability_mode: 'always',
    booking_mode: 'request_first',
    disciplines: [],
    arena_id: undefined,
    teaching_description: '',
    bio: '',
  });

  const [scheduleForm, setScheduleForm] = useState<RecurringScheduleCreate>({
    day_of_week: 0,
    start_time: '09:00',
    end_time: '17:00',
  });

  const [slotForm, setSlotForm] = useState<AvailabilitySlotCreate>({
    slot_date: '',
    start_time: '09:00',
    end_time: '10:00',
  });

  const [acceptForm, setAcceptForm] = useState<CoachAcceptLesson>({
    confirmed_date: '',
    confirmed_start_time: '',
    confirmed_end_time: '',
  });

  const [declineReason, setDeclineReason] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [lessonToCancel, setLessonToCancel] = useState<LessonRequest | null>(null);

  // Coach booking (for coaches to book lessons for students)
  const [showCoachBookModal, setShowCoachBookModal] = useState(false);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [coachBookForm, setCoachBookForm] = useState<CoachBookLesson>({
    booking_date: '',
    start_time: '',
    end_time: '',
  });
  const [bookingWeekStart, setBookingWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [bookingAvailability, setBookingAvailability] = useState<CombinedAvailabilityResponse | null>(null);
  const [loadingBookingAvailability, setLoadingBookingAvailability] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, disciplineFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [enumsData, coachesData, arenasData] = await Promise.all([
        lessonsApi.getEnums(),
        lessonsApi.listCoaches(disciplineFilter || undefined),
        arenasApi.list(),
      ]);
      setEnums(enumsData);
      setCoaches(coachesData);
      setArenas(arenasData);

      if (user) {
        const horsesData = await horsesApi.list();
        setHorses(horsesData);

        // Load my requests
        const requests = await lessonsApi.getMyLessons();
        setMyRequests(requests);
      }

      if (isCoach) {
        const profile = await lessonsApi.getMyProfile();
        setMyProfile(profile);

        if (profile) {
          const [incoming, studentsList] = await Promise.all([
            lessonsApi.getIncoming(),
            lessonsApi.getStudents(),
          ]);
          setIncomingRequests(incoming);
          setStudents(studentsList);
        }
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewCoach = async (coach: CoachProfile) => {
    setSelectedCoach(coach);
    try {
      const availability = await lessonsApi.getCoachAvailability(coach.id);
      setCoachAvailability(availability);
    } catch (err) {
      console.error('Failed to load availability', err);
    }
    setShowCoachModal(true);
  };

  const getRequestWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(requestWeekStart);
      day.setDate(requestWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const loadRequestAvailability = async (coach: CoachProfile, weekStart: Date) => {
    setLoadingRequestAvailability(true);
    try {
      const weekDays = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(weekStart);
        day.setDate(weekStart.getDate() + i);
        weekDays.push(day);
      }
      const fromDate = formatDateForApi(weekDays[0]);
      const toDate = formatDateForApi(weekDays[6]);

      const availability = await lessonsApi.getCombinedAvailability(coach.id, fromDate, toDate);
      setCombinedAvailability(availability);
    } catch (err) {
      console.error('Failed to load availability', err);
    } finally {
      setLoadingRequestAvailability(false);
    }
  };

  const handleOpenRequest = async (coach: CoachProfile) => {
    setSelectedCoach(coach);
    setRequestForm({
      coach_profile_id: coach.id,
      requested_date: '',
      requested_time: '',
    });
    setCombinedAvailability(null);
    setSelectedTimeSlot(null);
    setSelectedArenaId(null);

    // Reset to current week
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(today);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);
    setRequestWeekStart(monday);

    // Load availability for current week
    await loadRequestAvailability(coach, monday);

    setShowRequestModal(true);
  };

  const handleSelectTimeSlot = (slot: TimeSlotAvailability, arenaId?: number) => {
    setSelectedTimeSlot(slot);
    setSelectedArenaId(arenaId || null);
    setRequestForm({
      ...requestForm,
      requested_date: slot.slot_date,
      requested_time: slot.start_time.substring(0, 5),
      arena_id: arenaId,
    });
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoach) return;

    try {
      if (selectedCoach.booking_mode === 'auto_accept' && requestForm.requested_time) {
        await lessonsApi.book({
          ...requestForm,
          arena_id: selectedArenaId || undefined,
        } as CreateLessonBook);
      } else {
        await lessonsApi.request(requestForm as CreateLessonRequest);
      }
      setShowRequestModal(false);
      setRequestForm({ coach_profile_id: 0, requested_date: '', requested_time: '' });
      setCombinedAvailability(null);
      setSelectedTimeSlot(null);
      setSelectedArenaId(null);
      alert('Lesson request submitted successfully!');
      loadData();
    } catch (err) {
      setError('Failed to submit request');
      console.error(err);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelRequestTarget) return;
    try {
      await lessonsApi.cancelLesson(cancelRequestTarget.id);
      setCancelRequestTarget(null);
      loadData();
    } catch (err) {
      setError('Failed to cancel request');
      console.error(err);
    }
  };

  // Coach profile management
  const handleOpenProfile = () => {
    if (myProfile) {
      setProfileForm({
        disciplines: myProfile.disciplines || [],
        arena_id: myProfile.arena_id,
        teaching_description: myProfile.teaching_description || '',
        bio: myProfile.bio || '',
        availability_mode: myProfile.availability_mode,
        booking_mode: myProfile.booking_mode,
        lesson_duration_minutes: myProfile.lesson_duration_minutes,
        coach_fee: Number(myProfile.coach_fee),
      });
    } else {
      setProfileForm({
        coach_fee: 0,
        lesson_duration_minutes: 45,
        availability_mode: 'always',
        booking_mode: 'request_first',
        disciplines: [],
        arena_id: undefined,
        teaching_description: '',
        bio: '',
      });
    }
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (myProfile) {
        await lessonsApi.updateProfile(profileForm);
      } else {
        await lessonsApi.createProfile(profileForm as CoachProfileCreate);
      }
      setShowProfileModal(false);
      alert(myProfile ? 'Profile updated!' : 'Profile created! It will be visible once approved by an admin.');
      loadData();
    } catch (err) {
      setError('Failed to save profile');
      console.error(err);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await lessonsApi.addRecurringSchedule(scheduleForm);
      setShowScheduleModal(false);
      loadData();
    } catch (err) {
      setError('Failed to add schedule');
      console.error(err);
    }
  };

  const handleRemoveSchedule = async () => {
    if (!removeScheduleTarget) return;
    try {
      await lessonsApi.removeRecurringSchedule(removeScheduleTarget.id);
      setRemoveScheduleTarget(null);
      loadData();
    } catch (err) {
      setError('Failed to remove schedule');
      console.error(err);
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await lessonsApi.addAvailabilitySlot(slotForm);
      setShowSlotModal(false);
      loadData();
    } catch (err) {
      setError('Failed to add slot');
      console.error(err);
    }
  };

  const handleRemoveSlot = async () => {
    if (!removeSlotTarget) return;
    try {
      await lessonsApi.removeAvailabilitySlot(removeSlotTarget.id);
      setRemoveSlotTarget(null);
      loadData();
    } catch (err) {
      setError('Failed to remove slot');
      console.error(err);
    }
  };

  // Handle incoming requests (coach)
  const handleAcceptRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;
    try {
      await lessonsApi.acceptLesson(selectedRequest.id, acceptForm);
      setShowAcceptModal(false);
      setSelectedRequest(null);
      loadData();
    } catch (err) {
      setError('Failed to accept request');
      console.error(err);
    }
  };

  const handleDeclineRequest = async () => {
    if (!selectedRequest || !declineReason.trim()) return;
    try {
      await lessonsApi.declineLesson(selectedRequest.id, { declined_reason: declineReason });
      setShowAcceptModal(false);
      setSelectedRequest(null);
      setDeclineReason('');
      loadData();
    } catch (err) {
      setError('Failed to decline request');
      console.error(err);
    }
  };

  const handleOpenCancelModal = (lesson: LessonRequest) => {
    setLessonToCancel(lesson);
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleCancelLesson = async () => {
    if (!lessonToCancel || !cancelReason.trim()) return;
    try {
      await lessonsApi.coachCancelLesson(lessonToCancel.id, { cancellation_reason: cancelReason });
      setShowCancelModal(false);
      setLessonToCancel(null);
      setCancelReason('');
      loadData();
    } catch (err) {
      setError('Failed to cancel lesson');
      console.error(err);
    }
  };

  // Coach booking handlers
  const getBookingWeekDays = (): Date[] => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(bookingWeekStart);
      day.setDate(bookingWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const formatDateForApi = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const formatDayHeader = (date: Date): string => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return `${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
  };

  const loadBookingAvailability = async () => {
    if (!myProfile) return;
    setLoadingBookingAvailability(true);
    try {
      const weekDays = getBookingWeekDays();
      const fromDate = formatDateForApi(weekDays[0]);
      const toDate = formatDateForApi(weekDays[6]);
      const data = await lessonsApi.getCombinedAvailability(myProfile.id, fromDate, toDate);
      setBookingAvailability(data);
    } catch (err) {
      console.error('Failed to load availability', err);
    } finally {
      setLoadingBookingAvailability(false);
    }
  };

  // Load availability when modal opens or week changes
  useEffect(() => {
    if (showCoachBookModal && myProfile) {
      loadBookingAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCoachBookModal, bookingWeekStart, myProfile?.id]);

  const calculateEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMins = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };

  const handleBookingCellClick = (date: Date, slot: TimeSlotAvailability) => {
    if (!myProfile || !bookingAvailability) return;
    const dateStr = formatDateForApi(date);
    const endTime = calculateEndTime(slot.start_time, myProfile.lesson_duration_minutes);

    // Find a free arena for this slot
    const bookedArenaIds = slot.arena_bookings.map(b => b.arena_id);
    const freeArena = bookingAvailability.arenas.find(a => !bookedArenaIds.includes(a.id));

    setCoachBookForm({
      ...coachBookForm,
      booking_date: dateStr,
      start_time: slot.start_time,
      end_time: endTime,
      arena_id: freeArena?.id,
    });
  };

  const getSlotStatus = (slot: TimeSlotAvailability): 'free' | 'busy' => {
    if (!bookingAvailability) return 'busy';
    // With single arena per coach, just check if any arenas are free
    const bookedArenaIds = slot.arena_bookings.map(b => b.arena_id);
    const hasAvailableArena = bookingAvailability.arenas.some(a => !bookedArenaIds.includes(a.id));
    return hasAvailableArena ? 'free' : 'busy';
  };

  const getFreeArenasForSlot = (slot: TimeSlotAvailability) => {
    if (!bookingAvailability) return [];
    const bookedArenaIds = slot.arena_bookings.map(b => b.arena_id);
    return bookingAvailability.arenas.filter(a => !bookedArenaIds.includes(a.id));
  };

  const handleCoachBookSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!myProfile) return;

    // Validate: must have either user_id or guest_name
    if (!coachBookForm.user_id && !coachBookForm.guest_name) {
      setError('Please select a student or enter guest details');
      return;
    }

    try {
      await lessonsApi.coachBookLesson(coachBookForm);
      setShowCoachBookModal(false);
      setCoachBookForm({ booking_date: '', start_time: '', end_time: '' });
      alert('Lesson booked successfully!');
      loadData();
    } catch (err) {
      setError('Failed to book lesson');
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

  const renderCoachCard = (coach: CoachProfile) => {
    const totalPrice = Number(coach.total_price || 0);
    const liveryPrice = Number(coach.livery_total_price || 0);

    return (
      <div key={coach.id} className="coach-card">
        <div className="coach-card-header">
          <h3>{coach.coach_name}</h3>
          <span className={`badge ${coach.booking_mode === 'auto_accept' ? 'badge-success' : 'badge-info'}`}>
            {coach.booking_mode === 'auto_accept' ? 'Book Directly' : 'Request First'}
          </span>
        </div>

        <div className="coach-card-body">
          {coach.disciplines && coach.disciplines.length > 0 && (
            <div className="coach-info-row">
              <span className="label">Disciplines:</span>
              <span>{coach.disciplines.map(d => getEnumLabel(d, enums?.disciplines)).join(', ')}</span>
            </div>
          )}
          {coach.arena_name && (
            <div className="coach-info-row">
              <span className="label">Arena:</span>
              <span>{coach.arena_name}</span>
            </div>
          )}
          {coach.teaching_description && (
            <div className="coach-info-row full-width">
              <span className="label">Teaching:</span>
              <span>{coach.teaching_description}</span>
            </div>
          )}
          <div className="coach-info-row">
            <span className="label">Duration:</span>
            <span>{coach.lesson_duration_minutes} minutes</span>
          </div>
          <div className="coach-info-row">
            <span className="label">Price:</span>
            <span>&pound;{totalPrice.toFixed(2)}</span>
          </div>
          {user?.role === 'livery' && liveryPrice !== totalPrice && (
            <div className="coach-info-row">
              <span className="label">Livery Price:</span>
              <span className="text-success">&pound;{liveryPrice.toFixed(2)}</span>
            </div>
          )}
          <div className="coach-info-row">
            <span className="label">Availability:</span>
            <span>{getEnumLabel(coach.availability_mode, enums?.availability_modes)}</span>
          </div>
        </div>

        <div className="coach-card-actions">
          <button
            className="btn btn-secondary"
            onClick={() => handleViewCoach(coach)}
          >
            View Details
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleOpenRequest(coach)}
          >
            {coach.booking_mode === 'auto_accept' ? 'Book Lesson' : 'Request Lesson'}
          </button>
        </div>
      </div>
    );
  };

  const renderRequestCard = (request: LessonRequest) => (
    <div key={request.id} className="request-card">
      <div className="request-card-header">
        <h3>{request.coach_name}</h3>
        <span className={`badge ${getStatusBadgeClass(request.status)}`}>
          {getEnumLabel(request.status, enums?.statuses)}
        </span>
      </div>

      <div className="request-card-body">
        <div className="request-info-row">
          <span className="label">Requested Date:</span>
          <span>{formatDate(request.requested_date)}</span>
        </div>
        {request.requested_time && (
          <div className="request-info-row">
            <span className="label">Requested Time:</span>
            <span>{formatTime(request.requested_time)}</span>
          </div>
        )}
        {request.confirmed_date && (
          <div className="request-info-row confirmed">
            <span className="label">Confirmed:</span>
            <span>
              {formatDate(request.confirmed_date)}
              {request.confirmed_start_time && ` ${formatTime(request.confirmed_start_time)}`}
              {request.confirmed_end_time && ` - ${formatTime(request.confirmed_end_time)}`}
            </span>
          </div>
        )}
        {request.discipline && (
          <div className="request-info-row">
            <span className="label">Discipline:</span>
            <span>{getEnumLabel(request.discipline, enums?.disciplines)}</span>
          </div>
        )}
        {request.horse_name && (
          <div className="request-info-row">
            <span className="label">Horse:</span>
            <span>{request.horse_name}</span>
          </div>
        )}
        <div className="request-info-row">
          <span className="label">Price:</span>
          <span>&pound;{Number(request.total_price).toFixed(2)}</span>
        </div>
        {request.coach_response && (
          <div className="request-info-row full-width">
            <span className="label">Coach Response:</span>
            <span>{request.coach_response}</span>
          </div>
        )}
        {request.declined_reason && (
          <div className="request-info-row full-width text-danger">
            <span className="label">Declined Reason:</span>
            <span>{request.declined_reason}</span>
          </div>
        )}
      </div>

      {(request.status === 'pending' || request.status === 'accepted') && (
        <div className="request-card-actions">
          <button
            className="btn btn-danger"
            onClick={() => setCancelRequestTarget(request)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="lessons-page">
      <div className="page-header">
        <h1>{isCoach ? 'My Lessons' : 'Lessons'}</h1>
        <p>{isCoach ? 'Manage your coaching schedule and student bookings' : 'Book individual lessons with our available coaches'}</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Tab Navigation */}
      <div className="tabs-container">
        {/* Coaches see their own tabs (like My Clinics), non-coaches see Find a Coach */}
        {isCoach ? (
          <>
            <button
              className={`ds-tab ${activeTab === 'my-requests' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-requests')}
            >
              My Lessons {incomingRequests.filter(r => r.status === 'confirmed').length > 0 &&
                `(${incomingRequests.filter(r => r.status === 'confirmed').length})`}
            </button>
            {myProfile && (
              <button
                className={`ds-tab ${activeTab === 'incoming' ? 'active' : ''}`}
                onClick={() => setActiveTab('incoming')}
              >
                Lesson Requests {incomingRequests.filter(r => r.status === 'pending').length > 0 &&
                  `(${incomingRequests.filter(r => r.status === 'pending').length})`}
              </button>
            )}
            <button
              className={`ds-tab ${activeTab === 'my-profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-profile')}
            >
              My Profile
            </button>
          </>
        ) : (
          <>
            <button
              className={`ds-tab ${activeTab === 'coaches' ? 'active' : ''}`}
              onClick={() => setActiveTab('coaches')}
            >
              Find a Coach
            </button>
            {user && (
              <button
                className={`ds-tab ${activeTab === 'my-requests' ? 'active' : ''}`}
                onClick={() => setActiveTab('my-requests')}
              >
                My Lessons {myRequests.length > 0 && `(${myRequests.length})`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Filter */}
      {activeTab === 'coaches' && (
        <div className="filter-bar">
          <FormGroup label="Filter by Discipline">
            <Select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value)}
            >
              <option value="">All Disciplines</option>
              {enums?.disciplines.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </Select>
          </FormGroup>
        </div>
      )}

      {/* Find a Coach Tab */}
      {activeTab === 'coaches' && (
        <div className="coaches-section">
          <h2>Available Coaches</h2>
          {coaches.length === 0 ? (
            <p className="no-data">No coaches available at the moment. Check back soon!</p>
          ) : (
            <div className="coaches-grid">
              {coaches.map(coach => renderCoachCard(coach))}
            </div>
          )}
        </div>
      )}

      {/* My Requests Tab - Shows different content for coaches vs users */}
      {activeTab === 'my-requests' && user && (
        <div className="requests-section">
          {isCoach ? (
            <>
              <h2>My Lessons</h2>
              {(() => {
                const upcomingLessons = incomingRequests.filter(r => r.status === 'confirmed');
                if (upcomingLessons.length === 0) {
                  return (
                    <div className="no-data">
                      <p>No upcoming lessons scheduled.</p>
                    </div>
                  );
                }
                return (
                  <div className="requests-grid">
                    {upcomingLessons.map(request => (
                      <div key={request.id} className="request-card incoming">
                        <div className="request-card-header">
                          <h3>{request.user_name || request.guest_name || 'Guest'}</h3>
                          <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                            {getEnumLabel(request.status, enums?.statuses)}
                          </span>
                        </div>
                        <div className="request-card-body">
                          {request.confirmed_date && (
                            <div className="request-info-row confirmed">
                              <span className="label">Date:</span>
                              <span>{formatDate(request.confirmed_date)}</span>
                            </div>
                          )}
                          {request.confirmed_start_time && (
                            <div className="request-info-row">
                              <span className="label">Time:</span>
                              <span>
                                {formatTime(request.confirmed_start_time)}
                                {request.confirmed_end_time && ` - ${formatTime(request.confirmed_end_time)}`}
                              </span>
                            </div>
                          )}
                          {request.arena_name && (
                            <div className="request-info-row">
                              <span className="label">Arena:</span>
                              <span>{request.arena_name}</span>
                            </div>
                          )}
                          {request.discipline && (
                            <div className="request-info-row">
                              <span className="label">Discipline:</span>
                              <span>{getEnumLabel(request.discipline, enums?.disciplines)}</span>
                            </div>
                          )}
                          {request.horse_name && (
                            <div className="request-info-row">
                              <span className="label">Horse:</span>
                              <span>{request.horse_name}</span>
                            </div>
                          )}
                          <div className="request-info-row">
                            <span className="label">Price:</span>
                            <span>&pound;{Number(request.total_price).toFixed(2)}</span>
                          </div>
                          {request.notes && (
                            <div className="request-info-row full-width">
                              <span className="label">Notes:</span>
                              <span>{request.notes}</span>
                            </div>
                          )}
                        </div>
                        <div className="request-card-actions">
                          {request.status !== 'completed' && request.status !== 'cancelled' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleOpenCancelModal(request)}
                            >
                              Cancel Lesson
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          ) : (
            <>
              <h2>My Lessons</h2>
              {myRequests.length === 0 ? (
                <div className="no-data">
                  <p>You haven't requested any lessons yet.</p>
                  <button className="btn btn-primary" onClick={() => setActiveTab('coaches')}>
                    Find a Coach
                  </button>
                </div>
              ) : (
                <div className="requests-grid">
                  {myRequests.map(request => renderRequestCard(request))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* My Coach Profile Tab */}
      {activeTab === 'my-profile' && isCoach && (
        <div className="profile-section">
          <div className="profile-header">
            <h2>My Coach Profile</h2>
            <div className="header-actions">
              <button className="btn btn-primary" onClick={handleOpenProfile}>
                {myProfile ? 'Edit Profile' : 'Create Profile'}
              </button>
            </div>
          </div>

          {!myProfile ? (
            <div className="no-profile">
              <p>You haven't created a coach profile yet.</p>
              <p>Create your profile to start accepting lesson requests from students.</p>
            </div>
          ) : (
            <div className="profile-content">
              <div className="profile-status">
                <span className={`badge ${myProfile.is_active ? 'badge-success' : 'badge-warning'}`}>
                  {myProfile.is_active ? 'Active' : 'Pending Approval'}
                </span>
              </div>

              <div className="profile-details">
                <div className="detail-section">
                  <h3>Profile Information</h3>
                  {myProfile.disciplines && myProfile.disciplines.length > 0 && (
                    <div className="detail-row">
                      <span className="label">Disciplines:</span>
                      <span>{myProfile.disciplines.map(d => getEnumLabel(d, enums?.disciplines)).join(', ')}</span>
                    </div>
                  )}
                  {myProfile.arena_name && (
                    <div className="detail-row">
                      <span className="label">Arena:</span>
                      <span>{myProfile.arena_name}</span>
                    </div>
                  )}
                  {!myProfile.arena_id && (
                    <div className="detail-row">
                      <span className="label">Arena:</span>
                      <span className="text-muted">Not specified</span>
                    </div>
                  )}
                  {myProfile.teaching_description && (
                    <div className="detail-row">
                      <span className="label">Teaching Description:</span>
                      <span>{myProfile.teaching_description}</span>
                    </div>
                  )}
                  {myProfile.bio && (
                    <div className="detail-row">
                      <span className="label">Bio:</span>
                      <span>{myProfile.bio}</span>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Settings</h3>
                  <div className="detail-row">
                    <span className="label">Availability Mode:</span>
                    <span>{getEnumLabel(myProfile.availability_mode, enums?.availability_modes)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Booking Mode:</span>
                    <span>{getEnumLabel(myProfile.booking_mode, enums?.booking_modes)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Lesson Duration:</span>
                    <span>{myProfile.lesson_duration_minutes} minutes</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Your Fee:</span>
                    <span>&pound;{Number(myProfile.coach_fee).toFixed(2)}</span>
                  </div>
                  {myProfile.venue_fee !== null && myProfile.venue_fee !== undefined && (
                    <div className="detail-row">
                      <span className="label">Venue Fee:</span>
                      <span>&pound;{Number(myProfile.venue_fee).toFixed(2)}</span>
                    </div>
                  )}
                  {myProfile.total_price && (
                    <div className="detail-row">
                      <span className="label">Total Price (to student):</span>
                      <span className="text-success">&pound;{Number(myProfile.total_price).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Availability Management */}
              {myProfile.availability_mode === 'recurring' && (
                <div className="availability-section">
                  <div className="section-header">
                    <h3>Recurring Schedule</h3>
                    <button className="btn btn-secondary" onClick={() => setShowScheduleModal(true)}>
                      Add Schedule
                    </button>
                  </div>
                  {myProfile.recurring_schedules && myProfile.recurring_schedules.length > 0 ? (
                    <div className="schedules-list">
                      {myProfile.recurring_schedules.map((schedule: RecurringSchedule) => (
                        <div key={schedule.id} className="schedule-item">
                          <span>{DAY_NAMES[schedule.day_of_week]}</span>
                          <span>{formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}</span>
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => setRemoveScheduleTarget(schedule)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No recurring schedules set</p>
                  )}
                </div>
              )}

              {myProfile.availability_mode === 'specific' && (
                <div className="availability-section">
                  <div className="section-header">
                    <h3>Specific Availability Slots</h3>
                    <button className="btn btn-secondary" onClick={() => setShowSlotModal(true)}>
                      Add Slot
                    </button>
                  </div>
                  {myProfile.availability_slots && myProfile.availability_slots.length > 0 ? (
                    <div className="slots-list">
                      {myProfile.availability_slots.map((slot: AvailabilitySlot) => (
                        <div key={slot.id} className={`slot-item ${slot.is_booked ? 'booked' : ''}`}>
                          <span>{formatDate(slot.slot_date)}</span>
                          <span>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                          <span className={`badge ${slot.is_booked ? 'badge-secondary' : 'badge-success'}`}>
                            {slot.is_booked ? 'Booked' : 'Available'}
                          </span>
                          {!slot.is_booked && (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => setRemoveSlotTarget(slot)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-data">No availability slots set</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Incoming Requests Tab (Coach) */}
      {activeTab === 'incoming' && isCoach && myProfile && (
        <div className="incoming-section">
          <h2>Lesson Requests</h2>
          {incomingRequests.length === 0 ? (
            <p className="no-data">No incoming requests</p>
          ) : (
            <div className="requests-grid">
              {incomingRequests.map(request => (
                <div key={request.id} className="request-card incoming">
                  <div className="request-card-header">
                    <h3>{request.user_name}</h3>
                    <span className={`badge ${getStatusBadgeClass(request.status)}`}>
                      {getEnumLabel(request.status, enums?.statuses)}
                    </span>
                  </div>

                  <div className="request-card-body">
                    <div className="request-info-row">
                      <span className="label">Requested Date:</span>
                      <span>{formatDate(request.requested_date)}</span>
                    </div>
                    {request.requested_time && (
                      <div className="request-info-row">
                        <span className="label">Requested Time:</span>
                        <span>{formatTime(request.requested_time)}</span>
                      </div>
                    )}
                    {request.alternative_dates && (
                      <div className="request-info-row full-width">
                        <span className="label">Alternative Dates:</span>
                        <span>{request.alternative_dates}</span>
                      </div>
                    )}
                    {request.discipline && (
                      <div className="request-info-row">
                        <span className="label">Discipline:</span>
                        <span>{getEnumLabel(request.discipline, enums?.disciplines)}</span>
                      </div>
                    )}
                    {request.horse_name && (
                      <div className="request-info-row">
                        <span className="label">Horse:</span>
                        <span>{request.horse_name}</span>
                      </div>
                    )}
                    {request.notes && (
                      <div className="request-info-row full-width">
                        <span className="label">Notes:</span>
                        <span>{request.notes}</span>
                      </div>
                    )}
                    <div className="request-info-row">
                      <span className="label">Total Price:</span>
                      <span>&pound;{Number(request.total_price).toFixed(2)}</span>
                    </div>
                  </div>

                  {request.status === 'pending' && (
                    <div className="request-card-actions">
                      <button
                        className="btn btn-success"
                        onClick={() => {
                          setSelectedRequest(request);
                          setAcceptForm({
                            confirmed_date: request.requested_date,
                            confirmed_start_time: request.requested_time || '09:00',
                            confirmed_end_time: '',
                          });
                          setShowAcceptModal(true);
                        }}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-danger"
                        onClick={() => {
                          setSelectedRequest(request);
                          setShowAcceptModal(true);
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Coach Detail Modal */}
      {showCoachModal && selectedCoach && (
        <div className="ds-modal-overlay" onClick={() => setShowCoachModal(false)}>
          <div className="ds-modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>{selectedCoach.coach_name}</h2>
              <button className="close-btn" onClick={() => setShowCoachModal(false)}>&times;</button>
            </div>
            <div className="ds-modal-body">
              <div className="detail-grid">
                <div className="detail-section">
                  <h3>Coach Information</h3>
                  {selectedCoach.disciplines && selectedCoach.disciplines.length > 0 && (
                    <div className="detail-row">
                      <span className="label">Disciplines:</span>
                      <span>{selectedCoach.disciplines.map(d => getEnumLabel(d, enums?.disciplines)).join(', ')}</span>
                    </div>
                  )}
                  {selectedCoach.arena_name && (
                    <div className="detail-row">
                      <span className="label">Arena:</span>
                      <span>{selectedCoach.arena_name}</span>
                    </div>
                  )}
                  {selectedCoach.teaching_description && (
                    <div className="detail-row full-width">
                      <span className="label">Teaching:</span>
                      <p>{selectedCoach.teaching_description}</p>
                    </div>
                  )}
                  {selectedCoach.bio && (
                    <div className="detail-row full-width">
                      <span className="label">Bio:</span>
                      <p>{selectedCoach.bio}</p>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h3>Lesson Details</h3>
                  <div className="detail-row">
                    <span className="label">Duration:</span>
                    <span>{selectedCoach.lesson_duration_minutes} minutes</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Price:</span>
                    <span>&pound;{Number(selectedCoach.total_price || 0).toFixed(2)}</span>
                  </div>
                  {user?.role === 'livery' && Number(selectedCoach.livery_total_price) !== Number(selectedCoach.total_price) && (
                    <div className="detail-row">
                      <span className="label">Livery Price:</span>
                      <span className="text-success">&pound;{Number(selectedCoach.livery_total_price || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="label">Booking Mode:</span>
                    <span>{getEnumLabel(selectedCoach.booking_mode, enums?.booking_modes)}</span>
                  </div>
                </div>
              </div>

              {coachAvailability && (
                <div className="availability-info">
                  <h3>Availability</h3>
                  <p className="availability-mode">
                    Mode: {getEnumLabel(coachAvailability.availability_mode, enums?.availability_modes)}
                  </p>

                  {coachAvailability.recurring_schedules.length > 0 && (
                    <div className="schedules-display">
                      <h4>Weekly Schedule</h4>
                      {coachAvailability.recurring_schedules.map((s: RecurringSchedule) => (
                        <div key={s.id} className="schedule-item">
                          <span>{DAY_NAMES[s.day_of_week]}</span>
                          <span>{formatTime(s.start_time)} - {formatTime(s.end_time)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {coachAvailability.available_slots.length > 0 && (
                    <div className="slots-display">
                      <h4>Available Slots</h4>
                      {coachAvailability.available_slots.map((slot: AvailabilitySlot) => (
                        <div key={slot.id} className="slot-item">
                          <span>{formatDate(slot.slot_date)}</span>
                          <span>{formatTime(slot.start_time)} - {formatTime(slot.end_time)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="ds-modal-footer">
              {user && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setShowCoachModal(false);
                    handleOpenRequest(selectedCoach);
                  }}
                >
                  {selectedCoach.booking_mode === 'auto_accept' ? 'Book Lesson' : 'Request Lesson'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setShowCoachModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Lesson Modal */}
      {showRequestModal && selectedCoach && (
        <div className="ds-modal-overlay" onClick={() => setShowRequestModal(false)}>
          <div className="ds-modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>{selectedCoach.booking_mode === 'auto_accept' ? 'Book Lesson' : 'Request Lesson'}</h2>
              <button className="close-btn" onClick={() => setShowRequestModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmitRequest}>
              <div className="ds-modal-body">
                <div className="booking-info-bar">
                  <span>With: <strong>{selectedCoach.coach_name}</strong></span>
                  <span>Duration: <strong>{selectedCoach.lesson_duration_minutes} mins</strong></span>
                  <span>Price: <strong>&pound;{user?.role === 'livery'
                    ? Number(selectedCoach.livery_total_price || selectedCoach.total_price || 0).toFixed(2)
                    : Number(selectedCoach.total_price || 0).toFixed(2)
                  }</strong></span>
                </div>

                <h3>Select Available Time</h3>

                {/* Week navigation */}
                <div className="week-nav">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      const newStart = new Date(requestWeekStart);
                      newStart.setDate(newStart.getDate() - 7);
                      setRequestWeekStart(newStart);
                      if (selectedCoach) loadRequestAvailability(selectedCoach, newStart);
                    }}
                  >
                    &larr; Previous
                  </button>
                  <span className="week-label">
                    {formatDayHeader(getRequestWeekDays()[0])} - {formatDayHeader(getRequestWeekDays()[6])}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      const newStart = new Date(requestWeekStart);
                      newStart.setDate(newStart.getDate() + 7);
                      setRequestWeekStart(newStart);
                      if (selectedCoach) loadRequestAvailability(selectedCoach, newStart);
                    }}
                  >
                    Next &rarr;
                  </button>
                </div>

                {/* Available slots list - grouped by date */}
                {loadingRequestAvailability ? (
                  <div className="loading-grid">Loading availability...</div>
                ) : combinedAvailability && combinedAvailability.time_slots.length > 0 ? (
                  <div className="available-slots-list">
                    {(() => {
                      // Filter to only available slots (has free arenas) and not in the past
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);

                      const availableSlots = combinedAvailability.time_slots.filter(slot => {
                        const slotDate = new Date(slot.slot_date);
                        if (slotDate < today) return false;
                        const bookedArenaIds = slot.arena_bookings.map(b => b.arena_id);
                        const freeArenas = combinedAvailability.arenas.filter(a => !bookedArenaIds.includes(a.id));
                        return freeArenas.length > 0;
                      });

                      if (availableSlots.length === 0) {
                        return (
                          <div className="no-slots">
                            <p>No available slots this week.</p>
                            <p className="text-muted">Try the next week.</p>
                          </div>
                        );
                      }

                      // Group by date
                      const slotsByDate = availableSlots.reduce((acc, slot) => {
                        if (!acc[slot.slot_date]) acc[slot.slot_date] = [];
                        acc[slot.slot_date].push(slot);
                        return acc;
                      }, {} as Record<string, TimeSlotAvailability[]>);

                      return Object.entries(slotsByDate)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([date, slots]) => (
                          <div key={date} className="date-slots-group">
                            <div className="date-header">
                              {formatDate(date)}
                            </div>
                            <div className="time-slots-row">
                              {slots
                                .sort((a, b) => a.start_time.localeCompare(b.start_time))
                                .map(slot => {
                                  const isSelected = selectedTimeSlot?.slot_date === slot.slot_date &&
                                    selectedTimeSlot?.start_time === slot.start_time;
                                  const bookedArenaIds = slot.arena_bookings.map(b => b.arena_id);
                                  const freeArenas = combinedAvailability.arenas.filter(a => !bookedArenaIds.includes(a.id));

                                  return (
                                    <button
                                      key={`${slot.slot_date}-${slot.start_time}`}
                                      type="button"
                                      className={`time-slot-btn ${isSelected ? 'selected' : ''}`}
                                      onClick={() => handleSelectTimeSlot(slot, freeArenas[0]?.id)}
                                    >
                                      {formatTime(slot.start_time)}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        ));
                    })()}
                  </div>
                ) : (
                  <div className="no-slots">
                    <p>No time slots available for this week.</p>
                    <p className="text-muted">Try another week or the coach may have limited availability.</p>
                  </div>
                )}

                {/* Selected slot summary */}
                {selectedTimeSlot && (
                  <div className="selected-slot-summary">
                    <strong>Selected:</strong> {formatDate(selectedTimeSlot.slot_date)} at {formatTime(selectedTimeSlot.start_time)} - {formatTime(selectedTimeSlot.end_time)}
                  </div>
                )}

                {/* Arena Selection (when slot selected) */}
                {selectedTimeSlot && combinedAvailability && (
                  <div className="arena-selection">
                    <h4>Select Arena for {formatDate(selectedTimeSlot.slot_date)} at {formatTime(selectedTimeSlot.start_time)}</h4>
                    <div className="arena-options">
                      {combinedAvailability.arenas.map(arena => {
                        const isBooked = selectedTimeSlot.arena_bookings.some(b => b.arena_id === arena.id);
                        const booking = selectedTimeSlot.arena_bookings.find(b => b.arena_id === arena.id);
                        const isSelected = selectedArenaId === arena.id;

                        return (
                          <div
                            key={arena.id}
                            className={`arena-option ${isBooked ? 'booked' : 'available'} ${isSelected ? 'selected' : ''}`}
                            onClick={() => !isBooked && setSelectedArenaId(arena.id)}
                          >
                            <span className="arena-name">{arena.name}</span>
                            {isBooked ? (
                              <span className="arena-status booked">
                                Booked ({booking?.booking_type.replace('_', ' ')})
                              </span>
                            ) : (
                              <span className="arena-status available">Available</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedCoach.booking_mode !== 'auto_accept' && (
                  <>
                    <hr />
                    <FormGroup label="Alternative Dates (optional)">
                      <Textarea
                        value={(requestForm as CreateLessonRequest).alternative_dates || ''}
                        onChange={e => setRequestForm({ ...requestForm, alternative_dates: e.target.value })}
                        placeholder="If your preferred times aren't shown, suggest alternative dates here..."
                        rows={2}
                      />
                    </FormGroup>
                  </>
                )}

                {/* Guest fields (only shown when not logged in) */}
                {!user && (
                  <div className="guest-fields">
                    <h4>Your Details</h4>
                    <FormGroup label="Name" required>
                      <Input
                        type="text"
                        value={(requestForm as CreateLessonRequest).guest_name || ''}
                        onChange={e => setRequestForm({ ...requestForm, guest_name: e.target.value })}
                        required
                        placeholder="Your full name"
                      />
                    </FormGroup>
                    <div className="form-row">
                      <FormGroup label="Email" required>
                        <Input
                          type="email"
                          value={(requestForm as CreateLessonRequest).guest_email || ''}
                          onChange={e => setRequestForm({ ...requestForm, guest_email: e.target.value })}
                          required
                          placeholder="your@email.com"
                        />
                      </FormGroup>
                      <FormGroup label="Phone">
                        <Input
                          type="tel"
                          value={(requestForm as CreateLessonRequest).guest_phone || ''}
                          onChange={e => setRequestForm({ ...requestForm, guest_phone: e.target.value })}
                          placeholder="Your phone number"
                        />
                      </FormGroup>
                    </div>
                  </div>
                )}

                <FormGroup label="Discipline">
                  <Select
                    value={(requestForm as CreateLessonRequest).discipline || ''}
                    onChange={e => setRequestForm({ ...requestForm, discipline: (e.target.value || undefined) as CreateLessonRequest['discipline'] })}
                  >
                    <option value="">Select discipline (optional)</option>
                    {enums?.disciplines.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </Select>
                </FormGroup>

                {user && horses.length > 0 && (
                  <FormGroup label="Horse">
                    <Select
                      value={requestForm.horse_id || ''}
                      onChange={e => setRequestForm({ ...requestForm, horse_id: parseInt(e.target.value) || undefined })}
                    >
                      <option value="">Select a horse (optional)</option>
                      {horses.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </Select>
                  </FormGroup>
                )}

                <FormGroup label="Notes">
                  <Textarea
                    value={(requestForm as CreateLessonRequest).notes || ''}
                    onChange={e => setRequestForm({ ...requestForm, notes: e.target.value })}
                    placeholder="Any specific requests or information..."
                    rows={3}
                  />
                </FormGroup>
              </div>
              <div className="ds-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRequestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {selectedCoach.booking_mode === 'auto_accept' ? 'Book Now' : 'Send Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Profile Edit Modal */}
      {showProfileModal && (
        <div className="ds-modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>{myProfile ? 'Edit Coach Profile' : 'Create Coach Profile'}</h2>
              <button className="close-btn" onClick={() => setShowProfileModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="ds-modal-body">
                <h3>What You Teach</h3>
                <label>
                  Disciplines
                  <select
                    multiple
                    value={profileForm.disciplines || []}
                    onChange={e => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setProfileForm({ ...profileForm, disciplines: selected });
                    }}
                    style={{ height: '120px' }}
                  >
                    {enums?.disciplines.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  <small>Hold Ctrl/Cmd to select multiple</small>
                </label>

                <label>
                  Arena Where You Teach
                  <select
                    value={profileForm.arena_id || ''}
                    onChange={e => {
                      const value = e.target.value ? parseInt(e.target.value) : undefined;
                      setProfileForm({ ...profileForm, arena_id: value });
                    }}
                  >
                    <option value="">-- Select Arena --</option>
                    {arenas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <small>Select the arena where you hold lessons.</small>
                </label>

                <label>
                  Teaching Description
                  <textarea
                    value={profileForm.teaching_description || ''}
                    onChange={e => setProfileForm({ ...profileForm, teaching_description: e.target.value })}
                    placeholder="Describe your teaching style and what students can expect..."
                    rows={3}
                  />
                </label>

                <label>
                  Bio
                  <textarea
                    value={profileForm.bio || ''}
                    onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                    placeholder="Your background, qualifications, experience..."
                    rows={3}
                  />
                </label>

                <h3>Settings</h3>
                <div className="form-row">
                  <label>
                    Availability Mode
                    <select
                      value={profileForm.availability_mode || 'always'}
                      onChange={e => setProfileForm({ ...profileForm, availability_mode: e.target.value })}
                    >
                      {enums?.availability_modes.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Booking Mode
                    <select
                      value={profileForm.booking_mode || 'request_first'}
                      onChange={e => setProfileForm({ ...profileForm, booking_mode: e.target.value })}
                    >
                      {enums?.booking_modes.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-row">
                  <label>
                    Lesson Duration (minutes) *
                    <input
                      type="number"
                      value={profileForm.lesson_duration_minutes || 45}
                      onChange={e => setProfileForm({ ...profileForm, lesson_duration_minutes: parseInt(e.target.value) || 45 })}
                      min={15}
                      max={120}
                      required
                    />
                  </label>

                  <label>
                    Your Fee (&pound;) *
                    <input
                      type="number"
                      step="0.01"
                      value={profileForm.coach_fee || ''}
                      onChange={e => setProfileForm({ ...profileForm, coach_fee: parseFloat(e.target.value) || 0 })}
                      required
                      min={0}
                    />
                  </label>
                </div>

                <p className="form-hint">
                  The venue will add their facility fee during approval. Students will see the combined total price.
                </p>
              </div>
              <div className="ds-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {myProfile ? 'Save Changes' : 'Create Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Recurring Schedule Modal */}
      {showScheduleModal && (
        <div className="ds-modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="ds-modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Add Recurring Schedule</h2>
              <button className="close-btn" onClick={() => setShowScheduleModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddSchedule}>
              <div className="ds-modal-body">
                <label>
                  Day of Week
                  <select
                    value={scheduleForm.day_of_week}
                    onChange={e => setScheduleForm({ ...scheduleForm, day_of_week: parseInt(e.target.value) })}
                  >
                    {DAY_NAMES.map((day, idx) => (
                      <option key={idx} value={idx}>{day}</option>
                    ))}
                  </select>
                </label>

                <div className="form-row">
                  <label>
                    Start Time
                    <input
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={e => setScheduleForm({ ...scheduleForm, start_time: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    End Time
                    <input
                      type="time"
                      value={scheduleForm.end_time}
                      onChange={e => setScheduleForm({ ...scheduleForm, end_time: e.target.value })}
                      required
                    />
                  </label>
                </div>
              </div>
              <div className="ds-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Add Schedule</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Availability Slot Modal */}
      {showSlotModal && (
        <div className="ds-modal-overlay" onClick={() => setShowSlotModal(false)}>
          <div className="ds-modal modal-small" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Add Availability Slot</h2>
              <button className="close-btn" onClick={() => setShowSlotModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddSlot}>
              <div className="ds-modal-body">
                <label>
                  Date
                  <input
                    type="date"
                    value={slotForm.slot_date}
                    onChange={e => setSlotForm({ ...slotForm, slot_date: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                  />
                </label>

                <div className="form-row">
                  <label>
                    Start Time
                    <input
                      type="time"
                      value={slotForm.start_time}
                      onChange={e => setSlotForm({ ...slotForm, start_time: e.target.value })}
                      required
                    />
                  </label>

                  <label>
                    End Time
                    <input
                      type="time"
                      value={slotForm.end_time}
                      onChange={e => setSlotForm({ ...slotForm, end_time: e.target.value })}
                      required
                    />
                  </label>
                </div>
              </div>
              <div className="ds-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSlotModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Add Slot</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Accept/Decline Request Modal */}
      {showAcceptModal && selectedRequest && (
        <div className="ds-modal-overlay" onClick={() => setShowAcceptModal(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Respond to Lesson Request</h2>
              <button className="close-btn" onClick={() => setShowAcceptModal(false)}>&times;</button>
            </div>
            <div className="ds-modal-body">
              <p><strong>From:</strong> {selectedRequest.user_name}</p>
              <p><strong>Requested:</strong> {formatDate(selectedRequest.requested_date)}
                {selectedRequest.requested_time && ` at ${formatTime(selectedRequest.requested_time)}`}
              </p>

              <h3>Accept</h3>
              <form onSubmit={handleAcceptRequest}>
                <div className="form-row">
                  <label>
                    Confirmed Date *
                    <input
                      type="date"
                      value={acceptForm.confirmed_date}
                      onChange={e => setAcceptForm({ ...acceptForm, confirmed_date: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    Start Time *
                    <input
                      type="time"
                      value={acceptForm.confirmed_start_time}
                      onChange={e => setAcceptForm({ ...acceptForm, confirmed_start_time: e.target.value })}
                      required
                    />
                  </label>
                  <label>
                    End Time *
                    <input
                      type="time"
                      value={acceptForm.confirmed_end_time}
                      onChange={e => setAcceptForm({ ...acceptForm, confirmed_end_time: e.target.value })}
                      required
                    />
                  </label>
                </div>
                <label>
                  Arena
                  <select
                    value={acceptForm.arena_id || ''}
                    onChange={e => setAcceptForm({ ...acceptForm, arena_id: parseInt(e.target.value) || undefined })}
                  >
                    <option value="">Select arena (optional)</option>
                    {arenas.map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Response Message
                  <textarea
                    value={acceptForm.coach_response || ''}
                    onChange={e => setAcceptForm({ ...acceptForm, coach_response: e.target.value })}
                    placeholder="Any message for the student..."
                    rows={2}
                  />
                </label>
                <button type="submit" className="btn btn-success">Accept Request</button>
              </form>

              <hr />

              <h3>Decline</h3>
              <label>
                Reason for Declining *
                <textarea
                  value={declineReason}
                  onChange={e => setDeclineReason(e.target.value)}
                  placeholder="Please provide a reason..."
                  rows={2}
                />
              </label>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeclineRequest}
                disabled={!declineReason.trim()}
              >
                Decline Request
              </button>
            </div>
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={() => {
                setShowAcceptModal(false);
                setSelectedRequest(null);
                setDeclineReason('');
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Lesson Modal */}
      {showCancelModal && lessonToCancel && (
        <div className="ds-modal-overlay" onClick={() => setShowCancelModal(false)}>
          <div className="ds-modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Cancel Lesson</h2>
              <button className="close-btn" onClick={() => setShowCancelModal(false)}>&times;</button>
            </div>
            <div className="ds-modal-body">
              <p>
                Are you sure you want to cancel this lesson with{' '}
                <strong>{lessonToCancel.user_name || lessonToCancel.guest_name || 'the student'}</strong>?
              </p>
              {lessonToCancel.confirmed_date && (
                <p className="lesson-details">
                  Scheduled for {formatDate(lessonToCancel.confirmed_date)}
                  {lessonToCancel.confirmed_start_time && ` at ${formatTime(lessonToCancel.confirmed_start_time)}`}
                </p>
              )}
              <label>
                Reason for Cancellation *
                <textarea
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Please provide a reason for cancelling..."
                  rows={3}
                  required
                />
              </label>
            </div>
            <div className="ds-modal-footer">
              <button
                className="btn btn-danger"
                onClick={handleCancelLesson}
                disabled={!cancelReason.trim()}
              >
                Confirm Cancellation
              </button>
              <button className="btn btn-secondary" onClick={() => {
                setShowCancelModal(false);
                setLessonToCancel(null);
                setCancelReason('');
              }}>
                Keep Lesson
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Coach Book Lesson Modal */}
      {showCoachBookModal && myProfile && (
        <div className="ds-modal-overlay" onClick={() => setShowCoachBookModal(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Book a Lesson</h2>
              <button className="close-btn" onClick={() => setShowCoachBookModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCoachBookSubmit}>
              <div className="ds-modal-body">
                <p className="form-hint">
                  Book a lesson for a student. Useful for scheduling follow-up lessons.
                </p>

                <h3>Student</h3>
                <label>
                  Select Existing Student
                  <select
                    value={coachBookForm.user_id || ''}
                    onChange={e => {
                      const userId = parseInt(e.target.value) || undefined;
                      setCoachBookForm({
                        ...coachBookForm,
                        user_id: userId,
                        guest_name: userId ? undefined : coachBookForm.guest_name,
                        guest_email: userId ? undefined : coachBookForm.guest_email,
                        guest_phone: userId ? undefined : coachBookForm.guest_phone,
                      });
                    }}
                  >
                    <option value="">-- Select a student --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.email}) - {s.role}
                      </option>
                    ))}
                  </select>
                </label>

                {!coachBookForm.user_id && (
                  <div className="guest-fields">
                    <h4>Or Enter Guest Details</h4>
                    <label>
                      Name *
                      <input
                        type="text"
                        value={coachBookForm.guest_name || ''}
                        onChange={e => setCoachBookForm({ ...coachBookForm, guest_name: e.target.value })}
                        placeholder="Student name"
                        required={!coachBookForm.user_id}
                      />
                    </label>
                    <div className="form-row">
                      <label>
                        Email
                        <input
                          type="email"
                          value={coachBookForm.guest_email || ''}
                          onChange={e => setCoachBookForm({ ...coachBookForm, guest_email: e.target.value })}
                          placeholder="student@email.com"
                        />
                      </label>
                      <label>
                        Phone
                        <input
                          type="tel"
                          value={coachBookForm.guest_phone || ''}
                          onChange={e => setCoachBookForm({ ...coachBookForm, guest_phone: e.target.value })}
                          placeholder="Phone number"
                        />
                      </label>
                    </div>
                  </div>
                )}

                <h3>Select Time Slot</h3>

                {/* Week navigation */}
                <div className="week-nav">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      const newStart = new Date(bookingWeekStart);
                      newStart.setDate(newStart.getDate() - 7);
                      setBookingWeekStart(newStart);
                    }}
                  >
                    &larr; Previous Week
                  </button>
                  <span className="week-label">
                    {formatDayHeader(getBookingWeekDays()[0])} - {formatDayHeader(getBookingWeekDays()[6])}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      const newStart = new Date(bookingWeekStart);
                      newStart.setDate(newStart.getDate() + 7);
                      setBookingWeekStart(newStart);
                    }}
                  >
                    Next Week &rarr;
                  </button>
                </div>

                {/* Booking grid legend */}
                <div className="booking-legend">
                  <span className="legend-item"><span className="legend-box slot-free"></span> Available</span>
                  <span className="legend-item"><span className="legend-box slot-busy"></span> Booked</span>
                  <span className="legend-item"><span className="legend-box slot-selected"></span> Selected</span>
                </div>

                {/* Time slot grid */}
                {loadingBookingAvailability ? (
                  <div className="loading-grid">Loading availability...</div>
                ) : bookingAvailability && bookingAvailability.time_slots.length > 0 ? (
                  <div className="booking-grid-container">
                    <table className="booking-grid">
                      <thead>
                        <tr>
                          <th className="time-col">Time</th>
                          {getBookingWeekDays().map((day, idx) => (
                            <th
                              key={idx}
                              className={`day-header ${day.toDateString() === new Date().toDateString() ? 'today' : ''}`}
                            >
                              {formatDayHeader(day)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {/* Get unique times from all slots */}
                        {(() => {
                          const uniqueTimes = [...new Set(bookingAvailability.time_slots.map(s => s.start_time))].sort();
                          return uniqueTimes.map(time => (
                            <tr key={time}>
                              <td className="time-label">{time.substring(0, 5)}</td>
                              {getBookingWeekDays().map((day, dayIdx) => {
                                const dateStr = formatDateForApi(day);
                                const slot = bookingAvailability.time_slots.find(
                                  s => s.slot_date === dateStr && s.start_time === time
                                );
                                const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                                const isSelected = coachBookForm.booking_date === dateStr &&
                                  coachBookForm.start_time === time;

                                if (!slot || isPast) {
                                  return (
                                    <td
                                      key={dayIdx}
                                      className="booking-cell unavailable"
                                      title={isPast ? 'Past date' : 'Not available'}
                                    >
                                      -
                                    </td>
                                  );
                                }

                                const status = getSlotStatus(slot);
                                const isAvailable = status === 'free';

                                return (
                                  <td
                                    key={dayIdx}
                                    className={`booking-cell slot-${status} ${isSelected ? 'selected' : ''} ${isAvailable ? 'clickable' : ''}`}
                                    onClick={() => isAvailable && handleBookingCellClick(day, slot)}
                                    title={isAvailable ? 'Available' : 'Booked'}
                                  >
                                    {isSelected ? '✓' : (isAvailable ? '✓' : '✗')}
                                  </td>
                                );
                              })}
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="no-slots">
                    <p>No time slots available for this week.</p>
                    <p className="text-muted">This may be because your availability mode is set to "specific slots" and you haven't added any.</p>
                  </div>
                )}

                {/* Selected slot summary */}
                {coachBookForm.booking_date && coachBookForm.start_time && (
                  <div className="selected-slot-summary">
                    <strong>Selected:</strong> {formatDate(coachBookForm.booking_date)} at {coachBookForm.start_time} - {coachBookForm.end_time}
                  </div>
                )}

                {/* Arena selection for selected slot */}
                {coachBookForm.booking_date && coachBookForm.start_time && (
                  <label>
                    Arena
                    <select
                      value={coachBookForm.arena_id || ''}
                      onChange={e => setCoachBookForm({ ...coachBookForm, arena_id: parseInt(e.target.value) || undefined })}
                    >
                      <option value="">Select arena</option>
                      {(() => {
                        const slot = bookingAvailability?.time_slots.find(
                          s => s.slot_date === coachBookForm.booking_date && s.start_time === coachBookForm.start_time
                        );
                        if (slot && bookingAvailability) {
                          const freeArenas = getFreeArenasForSlot(slot);
                          return freeArenas.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ));
                        }
                        // Fallback to coach's arena
                        return (myProfile.arena_id
                          ? arenas.filter(a => a.id === myProfile.arena_id)
                          : arenas
                        ).map(a => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ));
                      })()}
                    </select>
                  </label>
                )}

                <label>
                  Discipline
                  <select
                    value={coachBookForm.discipline || ''}
                    onChange={e => setCoachBookForm({ ...coachBookForm, discipline: e.target.value || undefined })}
                  >
                    <option value="">Select discipline (optional)</option>
                    {enums?.disciplines.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Notes
                  <textarea
                    value={coachBookForm.notes || ''}
                    onChange={e => setCoachBookForm({ ...coachBookForm, notes: e.target.value })}
                    placeholder="Any notes about the lesson..."
                    rows={2}
                  />
                </label>

                {/* Price info */}
                <div className="price-summary">
                  <span>Coach Fee: &pound;{Number(myProfile.coach_fee).toFixed(2)}</span>
                  <span>Venue Fee: &pound;{Number(myProfile.venue_fee || 0).toFixed(2)}</span>
                  <span className="total">Total: &pound;{Number(myProfile.total_price || 0).toFixed(2)}</span>
                </div>
              </div>
              <div className="ds-modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCoachBookModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success">
                  Book Lesson
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Modals */}
      <ConfirmModal
        isOpen={!!cancelRequestTarget}
        onClose={() => setCancelRequestTarget(null)}
        onConfirm={handleCancelRequest}
        title="Cancel Request"
        message={`Are you sure you want to cancel this lesson request with ${cancelRequestTarget?.coach_name}?`}
        confirmLabel="Cancel Request"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!removeScheduleTarget}
        onClose={() => setRemoveScheduleTarget(null)}
        onConfirm={handleRemoveSchedule}
        title="Remove Schedule"
        message={`Remove this recurring schedule (${removeScheduleTarget ? DAY_NAMES[removeScheduleTarget.day_of_week] : ''})?`}
        confirmLabel="Remove"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!removeSlotTarget}
        onClose={() => setRemoveSlotTarget(null)}
        onConfirm={handleRemoveSlot}
        title="Remove Slot"
        message={`Remove this availability slot (${removeSlotTarget?.slot_date})?`}
        confirmLabel="Remove"
        variant="danger"
      />
    </div>
  );
}
