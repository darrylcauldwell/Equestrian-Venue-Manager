import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar } from '../components/Calendar';
import { BookingForm } from '../components/BookingForm';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { arenasApi, bookingsApi, horsesApi, lessonsApi } from '../services/api';
import type { Arena, Booking, CreateBookingData, Horse, CoachCalendarSlot } from '../types';
import './BookingCalendar.css';

export function BookingCalendar() {
  const { user, isMember, isAdmin } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [coachAvailability, setCoachAvailability] = useState<CoachCalendarSlot[]>([]);
  const [selectedArena, setSelectedArena] = useState<number | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect coaches to clinics page - they don't need access to booking calendar
  useEffect(() => {
    if (user?.role === 'coach') {
      navigate('/book/clinics', { replace: true });
    }
  }, [user, navigate]);

  const loadData = async () => {
    try {
      const promises: [Promise<Arena[]>, Promise<Booking[]>, Promise<Horse[]>?] = [
        arenasApi.list(),
        bookingsApi.list(),
      ];

      // Load horses for livery users and admins (admin can optionally assign booking to a horse)
      if (isMember || isAdmin) {
        promises.push(horsesApi.list());
      }

      const results = await Promise.all(promises);
      setArenas(results[0]);
      setBookings(results[1]);
      if (results[2]) {
        setHorses(results[2]);
      }

      // Load coach availability for calendar display (3 months ahead)
      try {
        const today = new Date();
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

        const fromDate = today.toISOString().split('T')[0];
        const toDate = threeMonthsLater.toISOString().split('T')[0];

        const availabilityResponse = await lessonsApi.getCalendarAvailability(fromDate, toDate);
        setCoachAvailability(availabilityResponse.slots);
      } catch {
        // Silently fail - coach availability is optional enhancement
        console.warn('Could not load coach availability');
      }
    } catch {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDateSelect = (start: Date, end: Date) => {
    setSelectedStart(start);
    setSelectedEnd(end);
    setShowBookingForm(true);
  };

  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const handleEventClick = (bookingId: number) => {
    const booking = bookings.find((b) => b.id === bookingId);
    if (booking) {
      setSelectedBooking(booking);
    }
  };

  const closeBookingModal = () => {
    setSelectedBooking(null);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCreateBooking = async (data: CreateBookingData) => {
    await bookingsApi.create(data);
    setShowBookingForm(false);
    setSelectedStart(null);
    setSelectedEnd(null);
    await loadData();
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  if (error) {
    return <div className="ds-alert ds-alert-error">{error}</div>;
  }

  return (
    <div className="booking-calendar-page">
      <div className="page-header">
        <h1>Book an Arena</h1>
        <p>Select a time slot on the calendar to make a booking</p>
      </div>

      <div className="arena-filter">
        <label htmlFor="arenaFilter">Filter by Arena:</label>
        <select
          id="arenaFilter"
          value={selectedArena || ''}
          onChange={(e) => setSelectedArena(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">All Arenas</option>
          {arenas.map((arena) => (
            <option key={arena.id} value={arena.id}>
              {arena.name}
            </option>
          ))}
        </select>
        <button
          className="new-booking-btn"
          onClick={() => setShowBookingForm(true)}
        >
          + New Booking
        </button>
      </div>

      <Calendar
        bookings={bookings}
        arenas={arenas}
        selectedArena={selectedArena}
        onDateSelect={handleDateSelect}
        onEventClick={handleEventClick}
        coachAvailability={coachAvailability}
        maxAdvanceDays={settings?.livery_max_advance_days}
      />

      {showBookingForm && (
        <BookingForm
          arenas={arenas}
          horses={horses}
          selectedArena={selectedArena}
          startTime={selectedStart}
          endTime={selectedEnd}
          onSubmit={handleCreateBooking}
          onCancel={() => {
            setShowBookingForm(false);
            setSelectedStart(null);
            setSelectedEnd(null);
          }}
        />
      )}

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="ds-modal-overlay" onClick={closeBookingModal}>
          <div className="ds-modal booking-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>{selectedBooking.title || 'Booking Details'}</h2>
              <button className="close-btn" onClick={closeBookingModal}>&times;</button>
            </div>
            <div className="ds-modal-body">
              <div className="booking-detail-grid">
                <div className="detail-item">
                  <span className="label">Arena:</span>
                  <span>{selectedBooking.arena_name || 'Unknown'}</span>
                </div>
                <div className="detail-item">
                  <span className="label">Type:</span>
                  <span className={`booking-type-badge ${selectedBooking.booking_type}`}>
                    {selectedBooking.booking_type.replace('_', ' ')}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="label">Start:</span>
                  <span>{formatDateTime(selectedBooking.start_time)}</span>
                </div>
                <div className="detail-item">
                  <span className="label">End:</span>
                  <span>{formatDateTime(selectedBooking.end_time)}</span>
                </div>
                {selectedBooking.horse_name && (
                  <div className="detail-item">
                    <span className="label">Horse:</span>
                    <span>{selectedBooking.horse_name}</span>
                  </div>
                )}
                {selectedBooking.booked_by_name && (
                  <div className="detail-item">
                    <span className="label">Booked by:</span>
                    <span>{selectedBooking.booked_by_name}</span>
                  </div>
                )}
                {selectedBooking.open_to_share && (
                  <div className="detail-item full-width sharing-indicator">
                    <span className="sharing-badge">Open to Sharing</span>
                    <span className="sharing-hint">Other livery clients may join this session</span>
                  </div>
                )}
                {selectedBooking.notes && (
                  <div className="detail-item full-width">
                    <span className="label">Notes:</span>
                    <span>{selectedBooking.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={closeBookingModal}>Close</button>
              {(isAdmin || selectedBooking.booked_by_id === user?.id) && (
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    if (confirm('Are you sure you want to cancel this booking?')) {
                      try {
                        await bookingsApi.delete(selectedBooking.id);
                        closeBookingModal();
                        await loadData();
                      } catch {
                        setError('Failed to cancel booking');
                      }
                    }
                  }}
                >
                  Cancel Booking
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
