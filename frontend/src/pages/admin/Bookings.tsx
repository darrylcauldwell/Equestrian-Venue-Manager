import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { bookingsApi, arenasApi, BlockSlotData } from '../../services/api';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../../components/ui';
import type { Booking, Arena } from '../../types';
import { PageActions } from '../../components/admin';
import './Admin.css';

type SortColumn = 'title' | 'arena' | 'user' | 'type' | 'date' | 'payment';
type SortDirection = 'asc' | 'desc';

interface BlockFormData {
  arena_id: number;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  booking_type: 'maintenance' | 'event';
}

export function AdminBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [filterArena, setFilterArena] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isBlocking, setIsBlocking] = useState(false);

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);

  // Block slot modal
  const blockModal = useModalForm<BlockFormData>({
    arena_id: 0,
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    booking_type: 'maintenance',
  });

  // Cancel confirmation
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await bookingsApi.delete(cancelTarget.id);
      setCancelTarget(null);
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
        arena_id: blockModal.formData.arena_id,
        title: blockModal.formData.title,
        description: blockModal.formData.description || undefined,
        start_time: new Date(blockModal.formData.start_time).toISOString(),
        end_time: new Date(blockModal.formData.end_time).toISOString(),
        booking_type: blockModal.formData.booking_type,
      };
      await bookingsApi.blockSlot(data);
      blockModal.close();
      await loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to block slot');
    } finally {
      setIsBlocking(false);
    }
  };

  const openBlockForm = () => {
    blockModal.open();
    blockModal.updateField('arena_id', arenas[0]?.id || 0);
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
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="ds-btn ds-btn-primary" onClick={openBlockForm}>
          Block Arena Slot
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

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
                      onClick={() => setCancelTarget(booking)}
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

      {/* Block Slot Modal */}
      <Modal
        isOpen={blockModal.isOpen}
        onClose={blockModal.close}
        title="Block Arena Slot"
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={blockModal.close}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleBlockSlot} disabled={isBlocking}>
              {isBlocking ? 'Blocking...' : 'Block Slot'}
            </button>
          </>
        }
      >
        <p className="modal-subtitle">
          Create a maintenance or event block to prevent bookings
        </p>

        <form onSubmit={handleBlockSlot}>
          <FormRow>
            <FormGroup label="Arena" required>
              <Select
                value={blockModal.formData.arena_id}
                onChange={(e) => blockModal.updateField('arena_id', parseInt(e.target.value))}
                required
              >
                {arenas.map((arena) => (
                  <option key={arena.id} value={arena.id}>
                    {arena.name}
                  </option>
                ))}
              </Select>
            </FormGroup>

            <FormGroup label="Block Type" required>
              <Select
                value={blockModal.formData.booking_type}
                onChange={(e) => blockModal.updateField('booking_type', e.target.value as 'maintenance' | 'event')}
                required
              >
                <option value="maintenance">Maintenance</option>
                <option value="event">Event (visible to public)</option>
              </Select>
            </FormGroup>
          </FormRow>

          <FormGroup label="Title" required>
            <Input
              value={blockModal.formData.title}
              onChange={(e) => blockModal.updateField('title', e.target.value)}
              placeholder={blockModal.formData.booking_type === 'event' ? 'e.g., Christmas Show' : 'e.g., Arena Maintenance'}
              required
            />
          </FormGroup>

          <FormGroup label="Description">
            <Textarea
              value={blockModal.formData.description}
              onChange={(e) => blockModal.updateField('description', e.target.value)}
              placeholder="Additional details..."
              rows={2}
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Start Time" required>
              <Input
                type="datetime-local"
                value={blockModal.formData.start_time}
                onChange={(e) => blockModal.updateField('start_time', e.target.value)}
                required
              />
            </FormGroup>

            <FormGroup label="End Time" required>
              <Input
                type="datetime-local"
                value={blockModal.formData.end_time}
                onChange={(e) => blockModal.updateField('end_time', e.target.value)}
                required
              />
            </FormGroup>
          </FormRow>
        </form>
      </Modal>

      {/* Cancel Booking Confirmation */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Cancel Booking"
        message={`Are you sure you want to cancel the booking "${cancelTarget?.title}"?`}
        confirmLabel="Cancel Booking"
        variant="danger"
      />
    </div>
  );
}
