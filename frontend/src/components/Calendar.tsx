import { useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventHoveringArg } from '@fullcalendar/core';
import type { Booking, Arena, BookingPublic, CoachCalendarSlot } from '../types';
import './Calendar.css';

interface CalendarProps {
  bookings: (Booking | BookingPublic)[];
  arenas: Arena[];
  selectedArena: number | null;
  onDateSelect: (start: Date, end: Date) => void;
  onEventClick: (bookingId: number) => void;
  coachAvailability?: CoachCalendarSlot[];
  maxAdvanceDays?: number;  // Restrict calendar to this many days ahead
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  booking: Booking | BookingPublic | null;
  arena: Arena | null;
}

const bookingTypeColors: Record<string, string> = {
  public: '#3788d8',
  livery: '#4a7c23',
  event: '#9c27b0',
  maintenance: '#f44336',
  training_clinic: '#ff9800',
  lesson: '#00bcd4',
};

const bookingTypeLabels: Record<string, string> = {
  public: 'Public Booking',
  livery: 'Livery',
  event: 'Event',
  maintenance: 'Maintenance',
  training_clinic: 'Training Clinic',
  lesson: 'Lesson',
};

const COACH_AVAILABILITY_COLOR = '#e1bee7'; // Light purple for coach availability indicator

interface CoachTooltipState {
  visible: boolean;
  x: number;
  y: number;
  slot: CoachCalendarSlot | null;
}

export function Calendar({ bookings, arenas, selectedArena, onDateSelect, onEventClick, coachAvailability = [], maxAdvanceDays }: CalendarProps) {
  // Calculate valid date range for calendar navigation
  const validRange = maxAdvanceDays ? {
    start: new Date(),  // Today
    end: new Date(Date.now() + maxAdvanceDays * 24 * 60 * 60 * 1000),  // maxAdvanceDays from now
  } : undefined;

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    booking: null,
    arena: null,
  });
  const [coachTooltip, setCoachTooltip] = useState<CoachTooltipState>({
    visible: false,
    x: 0,
    y: 0,
    slot: null,
  });
  const tooltipTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredBookings = selectedArena
    ? bookings.filter(b => b.arena_id === selectedArena)
    : bookings;

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const bookingEvents = filteredBookings.map(booking => {
    const arena = arenas.find(a => a.id === booking.arena_id);
    const isPending = 'booking_status' in booking && booking.booking_status === 'pending';
    const isShareable = 'open_to_share' in booking && booking.open_to_share;
    const baseColor = bookingTypeColors[booking.booking_type] || '#666';

    // Build title with indicators
    let titlePrefix = '';
    if (isPending) titlePrefix += '⏳ ';
    if (isShareable) titlePrefix += '👥 ';

    const title = 'title' in booking && booking.title
      ? `${titlePrefix}${booking.title}${arena ? ` - ${arena.name}` : ''}`
      : `${titlePrefix || 'Booked'}${arena ? ` - ${arena.name}` : ''}`;

    // Build class names
    const classNames: string[] = [];
    if (isPending) classNames.push('pending-booking');
    if (isShareable) classNames.push('shareable-booking');

    return {
      id: `booking-${booking.id}`,
      title,
      start: booking.start_time,
      end: booking.end_time,
      backgroundColor: isPending ? `${baseColor}80` : baseColor,
      borderColor: isShareable ? '#0ea5e9' : baseColor,  // Blue border for shareable
      classNames,
      extendedProps: {
        type: 'booking',
        booking,
        arena,
        isPending,
        isShareable,
      },
    };
  });

  // Create events from coach availability (non-blocking background indicators)
  const availabilityEvents = coachAvailability.map((slot, index) => {
    const startDateTime = `${slot.slot_date}T${slot.start_time}`;
    const endDateTime = `${slot.slot_date}T${slot.end_time}`;

    return {
      id: `availability-${slot.coach_profile_id}-${index}`,
      title: `🎓 ${slot.coach_name}`,
      start: startDateTime,
      end: endDateTime,
      backgroundColor: COACH_AVAILABILITY_COLOR,
      borderColor: '#9c27b0',
      borderStyle: 'dashed',
      classNames: ['coach-availability'],
      display: 'background', // Show as background event (non-blocking)
      extendedProps: {
        type: 'coach_availability',
        slot,
      },
    };
  });

  const events = [...bookingEvents, ...availabilityEvents];

  const handleEventMouseEnter = (arg: EventHoveringArg) => {
    if (tooltipTimeout.current) {
      clearTimeout(tooltipTimeout.current);
    }

    const eventType = arg.event.extendedProps.type;
    const rect = arg.el.getBoundingClientRect();

    if (eventType === 'coach_availability') {
      const slot = arg.event.extendedProps.slot;
      setCoachTooltip({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        slot,
      });
      setTooltip(prev => ({ ...prev, visible: false }));
    } else {
      const booking = arg.event.extendedProps.booking;
      const arena = arg.event.extendedProps.arena;
      setTooltip({
        visible: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        booking,
        arena,
      });
      setCoachTooltip(prev => ({ ...prev, visible: false }));
    }
  };

  const handleEventMouseLeave = () => {
    tooltipTimeout.current = setTimeout(() => {
      setTooltip(prev => ({ ...prev, visible: false }));
      setCoachTooltip(prev => ({ ...prev, visible: false }));
    }, 100);
  };

  const handleEventClick = (info: { event: { id: string; extendedProps: { type?: string } } }) => {
    // Only handle clicks on booking events, not coach availability
    if (info.event.extendedProps.type === 'booking') {
      const bookingId = info.event.id.replace('booking-', '');
      onEventClick(parseInt(bookingId));
    }
  };

  return (
    <div className="calendar-container">
      {/* Booking Tooltip */}
      {tooltip.visible && tooltip.booking && (
        <div
          className="booking-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="tooltip-header">
            {'title' in tooltip.booking && tooltip.booking.title ? tooltip.booking.title : 'Booking'}
          </div>
          <div className="tooltip-content">
            <div className="tooltip-row">
              <span className="tooltip-label">Type:</span>
              <span>{bookingTypeLabels[tooltip.booking.booking_type] || tooltip.booking.booking_type}</span>
            </div>
            {tooltip.arena && (
              <div className="tooltip-row">
                <span className="tooltip-label">Arena:</span>
                <span>{tooltip.arena.name}</span>
              </div>
            )}
            <div className="tooltip-row">
              <span className="tooltip-label">Time:</span>
              <span>{formatTime(tooltip.booking.start_time)} - {formatTime(tooltip.booking.end_time)}</span>
            </div>
            {'user_name' in tooltip.booking && tooltip.booking.user_name && (
              <div className="tooltip-row">
                <span className="tooltip-label">Booked by:</span>
                <span>{tooltip.booking.user_name}</span>
              </div>
            )}
            {'horse_name' in tooltip.booking && tooltip.booking.horse_name && (
              <div className="tooltip-row">
                <span className="tooltip-label">Horse:</span>
                <span>{tooltip.booking.horse_name}</span>
              </div>
            )}
            {'notes' in tooltip.booking && tooltip.booking.notes && (
              <div className="tooltip-row">
                <span className="tooltip-label">Notes:</span>
                <span>{tooltip.booking.notes}</span>
              </div>
            )}
            {'open_to_share' in tooltip.booking && tooltip.booking.open_to_share && (
              <div className="tooltip-row sharing">
                Open to sharing
              </div>
            )}
            {'booking_status' in tooltip.booking && tooltip.booking.booking_status === 'pending' && (
              <div className="tooltip-row pending-note">
                Pending confirmation
              </div>
            )}
          </div>
          <div className="tooltip-footer">Click to edit or cancel</div>
        </div>
      )}

      {/* Coach Availability Tooltip */}
      {coachTooltip.visible && coachTooltip.slot && (
        <div
          className="booking-tooltip coach-availability-tooltip"
          style={{
            left: coachTooltip.x,
            top: coachTooltip.y,
          }}
        >
          <div className="tooltip-header">🎓 Coach Available</div>
          <div className="tooltip-content">
            <div className="tooltip-row">
              <span className="tooltip-label">Coach:</span>
              <span>{coachTooltip.slot.coach_name}</span>
            </div>
            <div className="tooltip-row">
              <span className="tooltip-label">Time:</span>
              <span>{coachTooltip.slot.start_time.slice(0, 5)} - {coachTooltip.slot.end_time.slice(0, 5)}</span>
            </div>
            <div className="tooltip-row coach-note">
              Available for lessons (does not block arena)
            </div>
          </div>
          <div className="tooltip-footer">Visit Lessons to book</div>
        </div>
      )}

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay',
        }}
        events={events}
        selectable={true}
        selectMirror={true}
        select={(info) => onDateSelect(info.start, info.end)}
        eventClick={handleEventClick}
        eventMouseEnter={handleEventMouseEnter}
        eventMouseLeave={handleEventMouseLeave}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        height="auto"
        nowIndicator={true}
        validRange={validRange}
      />
      <div className="calendar-legend">
        <span className="legend-item"><span className="legend-color public"></span> Public</span>
        <span className="legend-item"><span className="legend-color livery"></span> Livery</span>
        <span className="legend-item"><span className="legend-color event"></span> Event</span>
        <span className="legend-item"><span className="legend-color maintenance"></span> Maintenance</span>
        <span className="legend-item"><span className="legend-color lesson"></span> Lesson</span>
        <span className="legend-item"><span className="legend-color pending"></span> Pending (doesn&apos;t block slot)</span>
        <span className="legend-item"><span className="legend-color shareable"></span> 👥 Open to Sharing</span>
        <span className="legend-item"><span className="legend-color coach-available"></span> Coach Available (doesn&apos;t block)</span>
      </div>
    </div>
  );
}
