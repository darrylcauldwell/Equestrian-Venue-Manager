import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { format, differenceInMinutes } from 'date-fns';
import { arenasApi, bookingsApi, paymentsApi, lessonsApi, GuestBookingData } from '../services/api';
import type { Arena, Booking, StripeConfig, CoachCalendarSlot } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { validateEmail, validatePhone } from '../utils/validation';
import './PublicBooking.css';

const PRICE_PER_HOUR = 25; // £25 per hour

export function PublicBooking() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [coachAvailability, setCoachAvailability] = useState<CoachCalendarSlot[]>([]);
  const [selectedArena, setSelectedArena] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [stripeConfig, setStripeConfig] = useState<StripeConfig | null>(null);

  // Booking form state
  const [showForm, setShowForm] = useState(false);
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Payment status
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentCanceled, setPaymentCanceled] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Account creation info (for guest bookings)
  const [accountCreated, setAccountCreated] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdUsername, setCreatedUsername] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [arenasData, bookingsData, stripeConfigData] = await Promise.all([
        arenasApi.list(),
        bookingsApi.listPublic(),
        paymentsApi.getConfig().catch(() => null),
      ]);
      setArenas(arenasData);
      setBookings(bookingsData);
      setStripeConfig(stripeConfigData);

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
  }, []);

  // Handle URL parameters for payment status
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    const bookingId = searchParams.get('booking_id');

    if (success === 'true' && bookingId) {
      // Verify payment with backend
      paymentsApi.verify(parseInt(bookingId))
        .then((status) => {
          if (status.payment_status === 'paid') {
            setPaymentSuccess(true);
          }
        })
        .catch(() => {
          // Still show success as Stripe redirect means payment likely succeeded
          setPaymentSuccess(true);
        });
      // Clean up URL
      setSearchParams({});
    } else if (canceled === 'true') {
      setPaymentCanceled(true);
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const calculatePrice = (start: Date, end: Date): number => {
    const minutes = differenceInMinutes(end, start);
    const hours = minutes / 60;
    return hours * PRICE_PER_HOUR;
  };

  const handleDateSelect = (start: Date, end: Date) => {
    setSelectedStart(start);
    setSelectedEnd(end);
    setShowForm(true);
    setPaymentSuccess(false);
    setPaymentCanceled(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStart || !selectedEnd || !selectedArena) return;

    setError('');

    // Validate email
    const emailResult = validateEmail(formData.guest_email);
    if (!emailResult.isValid) {
      setError(emailResult.message || 'Invalid email');
      return;
    }

    // Validate phone if provided
    if (formData.guest_phone) {
      const phoneResult = validatePhone(formData.guest_phone);
      if (!phoneResult.isValid) {
        setError(phoneResult.message || 'Invalid phone number');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const bookingData: GuestBookingData = {
        arena_id: selectedArena,
        title: formData.title,
        description: formData.description || undefined,
        start_time: selectedStart.toISOString(),
        end_time: selectedEnd.toISOString(),
        guest_name: formData.guest_name,
        guest_email: formData.guest_email,
        guest_phone: formData.guest_phone || undefined,
      };

      const booking = await bookingsApi.createGuest(bookingData);

      // Store account creation info if a new account was created
      if (booking.account_created) {
        setAccountCreated(true);
        setTempPassword(booking.temporary_password || null);
        setCreatedUsername(booking.username || null);
      }

      // If Stripe is configured, redirect to checkout
      if (stripeConfig?.is_configured) {
        setProcessingPayment(true);
        try {
          const checkout = await paymentsApi.createCheckout(booking.id);
          // Redirect to Stripe checkout
          window.location.href = checkout.checkout_url;
        } catch (paymentErr) {
          // If payment fails, still show booking was created but needs payment
          console.error('Payment setup failed:', paymentErr);
          setError('Booking created but payment setup failed. Please contact us to complete payment.');
          setProcessingPayment(false);
        }
      } else {
        // Stripe not configured - show manual payment message
        setFormData({ title: '', description: '', guest_name: '', guest_email: '', guest_phone: '' });
        await loadData();
        setError('');
        // Show success without payment redirect
        setPaymentSuccess(true);
        setShowForm(false);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to create booking');
      setIsSubmitting(false);
    }
  };

  const filteredBookings = selectedArena
    ? bookings.filter(b => b.arena_id === selectedArena)
    : bookings;

  const bookingEvents = filteredBookings.map(booking => ({
    id: booking.id.toString(),
    title: booking.title || 'Booked',
    start: booking.start_time,
    end: booking.end_time,
    backgroundColor: booking.booking_type === 'event' ? '#9c27b0' : '#999',
    borderColor: booking.booking_type === 'event' ? '#9c27b0' : '#999',
  }));

  // Create events from coach availability (non-blocking background indicators)
  const availabilityEvents = coachAvailability.map((slot, index) => ({
    id: `availability-${slot.coach_profile_id}-${index}`,
    title: `🎓 ${slot.coach_name}`,
    start: `${slot.slot_date}T${slot.start_time}`,
    end: `${slot.slot_date}T${slot.end_time}`,
    backgroundColor: '#e1bee7',
    borderColor: '#9c27b0',
    display: 'background',
    classNames: ['coach-availability'],
  }));

  const events = [...bookingEvents, ...availabilityEvents];

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="public-booking-page">
      <div className="booking-header">
        <h1>Book an Arena</h1>
        <p>Select an available time slot to make a booking</p>
        <p className="pricing-info">Arena hire: £{PRICE_PER_HOUR} per hour</p>
        {user ? (
          <p className="logged-in-notice">
            You're logged in. <Link to="/book">Go to your booking dashboard</Link> for a better experience.
          </p>
        ) : (
          <p className="login-notice">
            Have an account? <Link to="/login">Log in</Link> for easier booking management.
          </p>
        )}
      </div>

      {/* Payment Success Message */}
      {paymentSuccess && (
        <div className="payment-success-banner">
          <h2>Booking Confirmed!</h2>
          <p>Thank you for your booking. A confirmation email has been sent to you.</p>

          {accountCreated && tempPassword && createdUsername && (
            <div className="account-created-info">
              <h3>Your Account Has Been Created</h3>
              <p>You can now log in to view and manage your bookings:</p>
              <div className="credentials-box">
                <p><strong>Username:</strong> {createdUsername}</p>
                <p><strong>Temporary Password:</strong> {tempPassword}</p>
              </div>
              <p className="password-warning">
                Please save these details. You will be asked to change your password on first login.
              </p>
              <Link to="/login" className="ds-btn ds-btn-primary login-link">
                Log In Now
              </Link>
            </div>
          )}

          <button
            onClick={() => {
              setPaymentSuccess(false);
              setAccountCreated(false);
              setTempPassword(null);
              setCreatedUsername(null);
            }}
            className="ds-btn ds-btn-secondary"
          >
            Make Another Booking
          </button>
        </div>
      )}

      {/* Payment Canceled Message */}
      {paymentCanceled && (
        <div className="payment-canceled-banner">
          <h2>Payment Canceled</h2>
          <p>Your payment was canceled. The booking has not been confirmed.</p>
          <button onClick={() => setPaymentCanceled(false)} className="ds-btn ds-btn-secondary">
            Try Again
          </button>
        </div>
      )}

      <div className="arena-selector">
        <label htmlFor="arena">Select Arena:</label>
        <select
          id="arena"
          value={selectedArena || ''}
          onChange={(e) => setSelectedArena(e.target.value ? parseInt(e.target.value) : null)}
        >
          <option value="">-- Choose an Arena --</option>
          {arenas.map((arena) => (
            <option key={arena.id} value={arena.id}>
              {arena.name}
            </option>
          ))}
        </select>
      </div>

      {selectedArena && (() => {
        const arena = arenas.find(a => a.id === selectedArena);
        return arena ? (
          <div className="arena-details">
            <h3>{arena.name}</h3>
            {arena.description && <p className="arena-description">{arena.description}</p>}
            <div className="arena-features">
              {arena.size && <span className="arena-feature">Size: {arena.size}</span>}
              {arena.surface_type && <span className="arena-feature">Surface: {arena.surface_type}</span>}
              {arena.has_lights && <span className="arena-feature">Floodlights available</span>}
              {arena.jumps_type && <span className="arena-feature">Jumps: {arena.jumps_type.replace('_', ' ')}</span>}
            </div>
          </div>
        ) : null;
      })()}

      {selectedArena ? (
        <div className="calendar-section">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'timeGridWeek,timeGridDay',
            }}
            events={events}
            selectable={true}
            selectMirror={true}
            select={(info) => handleDateSelect(info.start, info.end)}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            height="auto"
            nowIndicator={true}
            validRange={settings?.livery_max_advance_days ? {
              start: new Date(),
              end: new Date(Date.now() + settings.livery_max_advance_days * 24 * 60 * 60 * 1000),
            } : undefined}
          />
          <div className="calendar-legend">
            <span className="legend-item"><span className="legend-color booked"></span> Booked</span>
            <span className="legend-item"><span className="legend-color event"></span> Event</span>
            <span className="legend-item"><span className="legend-color coach-available"></span> Coach Available for Lessons</span>
          </div>
          {coachAvailability.length > 0 && (
            <p className="coach-availability-note">
              Purple shaded areas indicate when coaches are available for lessons.
              Visit the <Link to="/book/lessons">Lessons page</Link> to book a lesson.
            </p>
          )}
        </div>
      ) : (
        <div className="select-arena-prompt">
          <p>Please select an arena above to view availability and make a booking.</p>
        </div>
      )}

      {showForm && selectedArena && (
        <div className="booking-form-overlay">
          <div className="booking-form">
            {processingPayment ? (
              <div className="processing-payment">
                <h2>Redirecting to Payment...</h2>
                <p>Please wait while we set up your secure payment.</p>
                <div className="spinner"></div>
              </div>
            ) : (
              <>
                <h2>Book Arena</h2>
                <p className="booking-time">
                  {format(selectedStart!, 'PPP p')} - {format(selectedEnd!, 'p')}
                </p>
                <p className="arena-name">{arenas.find(a => a.id === selectedArena)?.name}</p>

                <div className="price-display">
                  <span className="price-label">Total Price:</span>
                  <span className="price-amount">£{calculatePrice(selectedStart!, selectedEnd!).toFixed(2)}</span>
                </div>

                {error && <div className="form-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="ds-form-group">
                    <label htmlFor="title">Booking Title *</label>
                    <input
                      id="title"
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Private Lesson, Schooling Session"
                      required
                    />
                  </div>

                  <div className="ds-form-group">
                    <label htmlFor="description">Description</label>
                    <textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Any additional details..."
                      rows={2}
                    />
                  </div>

                  <h3>Your Details</h3>

                  <div className="ds-form-group">
                    <label htmlFor="guest_name">Full Name *</label>
                    <input
                      id="guest_name"
                      type="text"
                      value={formData.guest_name}
                      onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                      placeholder="Your full name"
                      required
                    />
                  </div>

                  <div className="form-row">
                    <div className="ds-form-group">
                      <label htmlFor="guest_email">Email *</label>
                      <input
                        id="guest_email"
                        type="email"
                        value={formData.guest_email}
                        onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <div className="ds-form-group">
                      <label htmlFor="guest_phone">Phone</label>
                      <input
                        id="guest_phone"
                        type="tel"
                        value={formData.guest_phone}
                        onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                        placeholder="Your phone number"
                      />
                    </div>
                  </div>

                  <div className="payment-info">
                    {stripeConfig?.is_configured ? (
                      <p>You will be redirected to our secure payment page after submitting.</p>
                    ) : (
                      <p>Payment details will be sent to your email after booking.</p>
                    )}
                  </div>

                  <div className="form-actions">
                    <button type="button" onClick={() => setShowForm(false)} className="ds-btn ds-btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="ds-btn ds-btn-primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Processing...' : `Pay £${calculatePrice(selectedStart!, selectedEnd!).toFixed(2)}`}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
