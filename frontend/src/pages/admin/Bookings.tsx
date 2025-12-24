import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { bookingsApi, arenasApi, BlockSlotData } from '../../services/api';
import type { Booking, Arena } from '../../types';
import { PageActions } from '../../components/admin';
import './Admin.css';

type SortColumn = 'title' | 'arena' | 'user' | 'type' | 'date' | 'payment';
type SortDirection = 'asc' | 'desc';

export function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterArena, setFilterArena] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Block slot form state
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockFormData, setBlockFormData] = useState({
    arena_id: 0,
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    booking_type: 'maintenance' as 'maintenance' | 'event',
  });
  const [isBlocking, setIsBlocking] = useState(false);

  const loadData = async () => {
    try {
      const [bookingsData, arenasData] = await Promise.all([
        bookingsApi.list(),
        arenasApi.listAll(),
      ]);
      setBookings(bookingsData);
      setArenas(arenasData);
    } catch {
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleBlockSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsBlocking(true);

    try {
      const data: BlockSlotData = {
        arena_id: blockFormData.arena_id,
        title: blockFormData.title,
        description: blockFormData.description || undefined,
        start_time: new Date(blockFormData.start_time).toISOString(),
        end_time: new Date(blockFormData.end_time).toISOString(),
        booking_type: blockFormData.booking_type,
      };
      await bookingsApi.blockSlot(data);
      setShowBlockForm(false);
      setBlockFormData({
        arena_id: arenas[0]?.id || 0,
        title: '',
        description: '',
        start_time: '',
        end_time: '',
        booking_type: 'maintenance',
      });
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to block slot');
    } finally {
      setIsBlocking(false);
    }
  };

  const openBlockForm = () => {
    setBlockFormData({
      ...blockFormData,
      arena_id: arenas[0]?.id || 0,
    });
    setShowBlockForm(true);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return ' ↕';
    return sortDirection === 'asc' ? ' ↑' : ' ↓';
  };

  const getArenaName = (booking: Booking) => {
    return booking.arena_name || arenas.find((a) => a.id === booking.arena_id)?.name || '-';
  };

  const filteredBookings = bookings
    .filter((b) => !filterArena || b.arena_id === filterArena)
    .filter((b) => !filterType || b.booking_type === filterType)
    .sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'arena':
          comparison = getArenaName(a).localeCompare(getArenaName(b));
          break;
        case 'user':
          comparison = (a.user_name || '').localeCompare(b.user_name || '');
          break;
        case 'type':
          comparison = a.booking_type.localeCompare(b.booking_type);
          break;
        case 'date':
          comparison = new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
          break;
        case 'payment':
          comparison = a.payment_status.localeCompare(b.payment_status);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="btn-primary" onClick={openBlockForm}>
          Block Arena Slot
        </button>
      </PageActions>

      {error && <div className="error-message">{error}</div>}

      <div className="filters">
        <div className="filter-group">
          <label>Arena:</label>
          <select
            value={filterArena || ''}
            onChange={(e) => setFilterArena(e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">All Arenas</option>
            {arenas.map((arena) => (
              <option key={arena.id} value={arena.id}>
                {arena.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">All Types</option>
            <option value="public">Public</option>
            <option value="livery">Livery</option>
            <option value="event">Event</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      <table className="admin-table sortable-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => handleSort('title')}>
              Title{getSortIndicator('title')}
            </th>
            <th className="sortable" onClick={() => handleSort('arena')}>
              Arena{getSortIndicator('arena')}
            </th>
            <th className="sortable" onClick={() => handleSort('user')}>
              User{getSortIndicator('user')}
            </th>
            <th className="sortable" onClick={() => handleSort('type')}>
              Type{getSortIndicator('type')}
            </th>
            <th className="sortable" onClick={() => handleSort('date')}>
              Date/Time{getSortIndicator('date')}
            </th>
            <th className="sortable" onClick={() => handleSort('payment')}>
              Payment{getSortIndicator('payment')}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredBookings.map((booking) => {
            const isPast = new Date(booking.end_time) < new Date();
            return (
              <tr key={booking.id} className={isPast ? 'past-booking' : ''}>
                <td>{booking.title}</td>
                <td>{getArenaName(booking)}</td>
                <td>{booking.user_name || '-'}</td>
                <td>
                  <span className={`badge ${booking.booking_type}`}>
                    {booking.booking_type}
                  </span>
                </td>
                <td>
                  {format(new Date(booking.start_time), 'MMM d, yyyy h:mm a')}
                </td>
                <td>
                  <span className={`badge payment-${booking.payment_status}`}>
                    {booking.payment_status.replace('_', ' ')}
                  </span>
                </td>
                <td>
                  {!isPast && (
                    <button
                      className="btn-small btn-danger"
                      onClick={() => handleCancel(booking.id)}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filteredBookings.length === 0 && (
        <p className="no-results">No bookings found matching the filters</p>
      )}

      {showBlockForm && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Block Arena Slot</h2>
            <p className="modal-subtitle">
              Create a maintenance or event block to prevent bookings
            </p>

            <form onSubmit={handleBlockSlot}>
              <div className="form-group">
                <label htmlFor="block-arena">Arena</label>
                <select
                  id="block-arena"
                  value={blockFormData.arena_id}
                  onChange={(e) =>
                    setBlockFormData({ ...blockFormData, arena_id: parseInt(e.target.value) })
                  }
                  required
                >
                  {arenas.map((arena) => (
                    <option key={arena.id} value={arena.id}>
                      {arena.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="block-type">Block Type</label>
                <select
                  id="block-type"
                  value={blockFormData.booking_type}
                  onChange={(e) =>
                    setBlockFormData({
                      ...blockFormData,
                      booking_type: e.target.value as 'maintenance' | 'event',
                    })
                  }
                  required
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="event">Event (visible to public)</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="block-title">Title</label>
                <input
                  id="block-title"
                  type="text"
                  value={blockFormData.title}
                  onChange={(e) => setBlockFormData({ ...blockFormData, title: e.target.value })}
                  placeholder={blockFormData.booking_type === 'event' ? 'e.g., Christmas Show' : 'e.g., Arena Maintenance'}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="block-description">Description (optional)</label>
                <textarea
                  id="block-description"
                  value={blockFormData.description}
                  onChange={(e) =>
                    setBlockFormData({ ...blockFormData, description: e.target.value })
                  }
                  placeholder="Additional details..."
                  rows={2}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="block-start">Start Time</label>
                  <input
                    id="block-start"
                    type="datetime-local"
                    value={blockFormData.start_time}
                    onChange={(e) =>
                      setBlockFormData({ ...blockFormData, start_time: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="block-end">End Time</label>
                  <input
                    id="block-end"
                    type="datetime-local"
                    value={blockFormData.end_time}
                    onChange={(e) =>
                      setBlockFormData({ ...blockFormData, end_time: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowBlockForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isBlocking}>
                  {isBlocking ? 'Blocking...' : 'Block Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
