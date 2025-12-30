import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { bookingsApi, arenasApi } from '../services/api';
import type { Booking, Arena } from '../types';
import { useAuth } from '../contexts/AuthContext';
import './MyBookings.css';

export function MyBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [bookingsData, arenasData] = await Promise.all([
        bookingsApi.list(),
        arenasApi.list(),
      ]);
      const myBookings = bookingsData.filter((b) => b.user_id === user?.id);
      setBookings(myBookings);
      setArenas(arenasData);
    } catch {
      setError('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleCancel = async (bookingId: number) => {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    try {
      await bookingsApi.delete(bookingId);
      await loadData();
    } catch {
      setError('Failed to cancel booking');
    }
  };

  const getArenaName = (arenaId: number) => {
    return arenas.find((a) => a.id === arenaId)?.name || 'Unknown';
  };

  const upcomingBookings = bookings
    .filter((b) => new Date(b.start_time) > new Date())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const pastBookings = bookings
    .filter((b) => new Date(b.start_time) <= new Date())
    .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="my-bookings-page">
      <div className="page-header">
        <h1>My Bookings</h1>
        <p>Manage your arena bookings</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      <section className="bookings-section">
        <h2>Upcoming Bookings</h2>
        {upcomingBookings.length === 0 ? (
          <p className="no-bookings">No upcoming bookings</p>
        ) : (
          <div className="bookings-list">
            {upcomingBookings.map((booking) => (
              <div key={booking.id} className="booking-card">
                <div className="booking-info">
                  <h3>{booking.title}</h3>
                  <p className="booking-arena">{getArenaName(booking.arena_id)}</p>
                  <p className="booking-time">
                    {format(new Date(booking.start_time), 'PPP p')} -{' '}
                    {format(new Date(booking.end_time), 'p')}
                  </p>
                  <span className={`booking-type ${booking.booking_type}`}>
                    {booking.booking_type}
                  </span>
                  <span className={`payment-status ${booking.payment_status}`}>
                    {booking.payment_status.replace('_', ' ')}
                  </span>
                </div>
                <div className="booking-actions">
                  <button
                    className="cancel-btn"
                    onClick={() => handleCancel(booking.id)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bookings-section">
        <h2>Past Bookings</h2>
        {pastBookings.length === 0 ? (
          <p className="no-bookings">No past bookings</p>
        ) : (
          <div className="bookings-list past">
            {pastBookings.map((booking) => (
              <div key={booking.id} className="booking-card past">
                <div className="booking-info">
                  <h3>{booking.title}</h3>
                  <p className="booking-arena">{getArenaName(booking.arena_id)}</p>
                  <p className="booking-time">
                    {format(new Date(booking.start_time), 'PPP p')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
