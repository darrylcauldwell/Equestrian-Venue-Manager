import { useState } from 'react';
import type { Arena, BookingType, Horse } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { validateRequired, validateFutureDate } from '../utils/validation';
import './BookingForm.css';

interface BookingFormProps {
  arenas: Arena[];
  horses?: Horse[];  // User's horses for livery bookings
  selectedArena: number | null;
  startTime: Date | null;
  endTime: Date | null;
  onSubmit: (data: {
    arena_id: number;
    horse_id?: number;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    booking_type?: BookingType;
    open_to_share?: boolean;
  }) => Promise<void>;
  onCancel: () => void;
}

export function BookingForm({ arenas, horses = [], selectedArena, startTime, endTime, onSubmit, onCancel }: BookingFormProps) {
  const { isAdmin, isMember } = useAuth();
  const [arenaId, setArenaId] = useState(selectedArena || (arenas[0]?.id ?? 0));
  const [horseId, setHorseId] = useState<number | ''>(horses[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bookingType, setBookingType] = useState<BookingType | ''>('');
  const [openToShare, setOpenToShare] = useState(false);
  const [start, setStart] = useState(startTime ? format(startTime, "yyyy-MM-dd'T'HH:mm") : '');
  const [end, setEnd] = useState(endTime ? format(endTime, "yyyy-MM-dd'T'HH:mm") : '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Determine if this is a livery booking (livery user or admin selected livery type)
  const isLiveryBooking = isMember || bookingType === 'livery';
  // Horse is only required for livery members, optional for admins
  const isHorseRequired = isMember && !isAdmin;

  const validateField = (field: string, value: string): string | undefined => {
    switch (field) {
      case 'title': {
        const result = validateRequired(value, 'Title');
        return result.isValid ? undefined : result.message;
      }
      case 'start': {
        const required = validateRequired(value, 'Start time');
        if (!required.isValid) return required.message;
        const future = validateFutureDate(value, 'Start time');
        return future.isValid ? undefined : future.message;
      }
      case 'end': {
        const required = validateRequired(value, 'End time');
        if (!required.isValid) return required.message;
        if (start && new Date(value) <= new Date(start)) {
          return 'End time must be after start time';
        }
        return undefined;
      }
      case 'horse': {
        if (isHorseRequired && !value) {
          return 'Please select a horse for this booking';
        }
        return undefined;
      }
      default:
        return undefined;
    }
  };

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const error = validateField(field, value);
    setFieldErrors((prev) => ({ ...prev, [field]: error || '' }));
  };

  const validateAllFields = (): boolean => {
    const errors: Record<string, string> = {};
    const titleError = validateField('title', title);
    const startError = validateField('start', start);
    const endError = validateField('end', end);
    const horseError = validateField('horse', horseId ? String(horseId) : '');

    if (titleError) errors.title = titleError;
    if (startError) errors.start = startError;
    if (endError) errors.end = endError;
    if (horseError) errors.horse = horseError;

    setFieldErrors(errors);
    setTouched({ title: true, start: true, end: true, horse: true });
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!validateAllFields()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        arena_id: arenaId,
        horse_id: isLiveryBooking && horseId ? horseId : undefined,
        title,
        description: description || undefined,
        start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(),
        booking_type: bookingType || undefined,
        open_to_share: isLiveryBooking ? openToShare : undefined,
      });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="booking-form-overlay">
      <div className="booking-form">
        <h2>Create Booking</h2>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="ds-form-group">
            <label htmlFor="arena">Arena</label>
            <select
              id="arena"
              value={arenaId}
              onChange={(e) => setArenaId(parseInt(e.target.value))}
              required
            >
              {arenas.map((arena) => (
                <option key={arena.id} value={arena.id}>
                  {arena.name}
                </option>
              ))}
            </select>
          </div>

          {/* Show horse selection for admins (optional) or livery members (required) */}
          {(isAdmin || isLiveryBooking) && horses.length > 0 && (
            <div className={`form-group ${touched.horse && fieldErrors.horse ? 'has-error' : ''}`}>
              <label htmlFor="horse">
                Horse {isAdmin && !isHorseRequired && <span className="optional-label">(optional)</span>}
              </label>
              <select
                id="horse"
                value={horseId}
                onChange={(e) => setHorseId(e.target.value ? parseInt(e.target.value) : '')}
                onBlur={(e) => handleBlur('horse', e.target.value)}
                required={isHorseRequired}
              >
                <option value="">{isAdmin ? 'No horse (general booking)' : 'Select a horse...'}</option>
                {horses.map((horse) => (
                  <option key={horse.id} value={horse.id}>
                    {horse.name}
                  </option>
                ))}
              </select>
              {touched.horse && fieldErrors.horse && (
                <span className="field-error">{fieldErrors.horse}</span>
              )}
            </div>
          )}

          {isHorseRequired && horses.length === 0 && (
            <div className="form-error">
              You don&apos;t have any horses registered. Please add a horse before making a booking.
            </div>
          )}

          <div className={`form-group ${touched.title && fieldErrors.title ? 'has-error' : ''}`}>
            <label htmlFor="title">Title</label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={(e) => handleBlur('title', e.target.value)}
              placeholder="e.g., Jumping Lesson"
              required
            />
            {touched.title && fieldErrors.title && (
              <span className="field-error">{fieldErrors.title}</span>
            )}
          </div>

          <div className="ds-form-group">
            <label htmlFor="description">Description (optional)</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className={`form-group ${touched.start && fieldErrors.start ? 'has-error' : ''}`}>
              <label htmlFor="start">Start Time</label>
              <input
                id="start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                onBlur={(e) => handleBlur('start', e.target.value)}
                required
              />
              {touched.start && fieldErrors.start && (
                <span className="field-error">{fieldErrors.start}</span>
              )}
            </div>

            <div className={`form-group ${touched.end && fieldErrors.end ? 'has-error' : ''}`}>
              <label htmlFor="end">End Time</label>
              <input
                id="end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                onBlur={(e) => handleBlur('end', e.target.value)}
                required
              />
              {touched.end && fieldErrors.end && (
                <span className="field-error">{fieldErrors.end}</span>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="ds-form-group">
              <label htmlFor="bookingType">Booking Type</label>
              <select
                id="bookingType"
                value={bookingType}
                onChange={(e) => setBookingType(e.target.value as BookingType)}
              >
                <option value="">Default (based on user role)</option>
                <option value="public">Public</option>
                <option value="livery">Livery</option>
                <option value="event">Event</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
          )}

          {isMember && (
            <>
              <div className="livery-notice">
                <span className="no-fee-badge">No Fee</span>
                <span>Arena bookings are included with your livery package</span>
              </div>
              <div className="ds-form-group sharing-option">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={openToShare}
                    onChange={(e) => setOpenToShare(e.target.checked)}
                  />
                  <span>Open to sharing with other liveries</span>
                </label>
                <span className="field-hint">
                  If checked, other livery clients can see this booking and may join you in the arena
                </span>
              </div>
            </>
          )}

          {!isMember && !isAdmin && (
            <div className="payment-notice">
              <span>Payment will be required to confirm your booking</span>
            </div>
          )}

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="ds-btn ds-btn-secondary">
              Cancel
            </button>
            <button type="submit" className="ds-btn ds-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
