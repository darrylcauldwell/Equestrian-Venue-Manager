import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { staffApi } from '../services/api';
import type {
  Shift,
  Timesheet,
  CreateTimesheet,
  StaffManagementEnums,
  WorkType,
} from '../types';
import './MyTimesheet.css';

// Helper to get start of week (Monday)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Get array of 7 days starting from a date
const getWeekDays = (startDate: Date): Date[] => {
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    days.push(day);
  }
  return days;
};

// Format date as YYYY-MM-DD for API
const formatDateForApi = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

// Get default times based on shift type
const getShiftDefaultTimes = (shiftType: string): { clockIn: string; clockOut: string } => {
  switch (shiftType) {
    case 'morning':
      return { clockIn: '06:00', clockOut: '14:00' };
    case 'afternoon':
      return { clockIn: '14:00', clockOut: '22:00' };
    case 'full_day':
      return { clockIn: '08:00', clockOut: '17:00' };
    case 'split':
      return { clockIn: '07:00', clockOut: '19:00' };
    default:
      return { clockIn: '09:00', clockOut: '17:00' };
  }
};

export default function MyTimesheet() {
  const { user } = useAuth();

  const [enums, setEnums] = useState<StaffManagementEnums | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Week navigation
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const weekDays = getWeekDays(weekStart);

  // Shifts (rota) state
  const [shifts, setShifts] = useState<Shift[]>([]);

  // Timesheets state - keyed by date
  const [timesheets, setTimesheets] = useState<Map<string, Timesheet>>(new Map());

  // Editing state
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<CreateTimesheet>>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadWeekData();
  }, [weekStart]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const enumsData = await staffApi.getEnums();
      setEnums(enumsData);
      await loadWeekData();
    } catch (e) {
      setError('Failed to load data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadWeekData = async () => {
    try {
      const startDate = formatDateForApi(weekStart);
      const endDate = formatDateForApi(weekDays[6]);

      // Load shifts and timesheets in parallel
      const [shiftsResponse, timesheetsResponse] = await Promise.all([
        staffApi.listShifts(user?.id, startDate, endDate),
        staffApi.listTimesheets(user?.id, undefined, startDate, endDate),
      ]);

      setShifts(shiftsResponse.shifts);

      // Convert timesheets to a map keyed by date
      const tsMap = new Map<string, Timesheet>();
      for (const ts of timesheetsResponse.timesheets) {
        tsMap.set(ts.date, ts);
      }
      setTimesheets(tsMap);
    } catch (e) {
      console.error('Failed to load week data:', e);
    }
  };

  const getEnumLabel = (enumType: string, value: string): string => {
    if (!enums) return value;
    const enumList = enums[enumType as keyof StaffManagementEnums] as Array<{ value: string; label: string }>;
    const item = enumList?.find(e => e.value === value);
    return item?.label || value;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + (direction === 'prev' ? -7 : 7));
    setWeekStart(newStart);
    setEditingDate(null);
  };

  const calculateHours = (clockIn: string, clockOut?: string, breakMinutes: number = 0): string => {
    if (!clockOut) return '-';
    const start = new Date(`2000-01-01T${clockIn}`);
    const end = new Date(`2000-01-01T${clockOut}`);
    const diffMs = end.getTime() - start.getTime();
    const hours = (diffMs / (1000 * 60 * 60)) - (breakMinutes / 60);
    return hours.toFixed(1);
  };

  const formatTime = (timeStr: string): string => {
    return timeStr.substring(0, 5);
  };

  const handleStartEditing = (dateStr: string, shift?: Shift, existingTimesheet?: Timesheet) => {
    setEditingDate(dateStr);

    if (existingTimesheet) {
      // Edit existing timesheet
      setEditingData({
        date: dateStr,
        clock_in: existingTimesheet.clock_in,
        clock_out: existingTimesheet.clock_out,
        lunch_start: existingTimesheet.lunch_start,
        lunch_end: existingTimesheet.lunch_end,
        break_minutes: existingTimesheet.break_minutes,
        work_type: existingTimesheet.work_type as WorkType,
        notes: existingTimesheet.notes,
      });
    } else if (shift) {
      // Pre-populate from shift
      const defaults = getShiftDefaultTimes(shift.shift_type);
      setEditingData({
        date: dateStr,
        clock_in: defaults.clockIn,
        clock_out: defaults.clockOut,
        work_type: 'yard_duties' as WorkType,
        break_minutes: 30,
      });
    } else {
      // New entry without shift
      setEditingData({
        date: dateStr,
        clock_in: '09:00',
        clock_out: '17:00',
        work_type: 'yard_duties' as WorkType,
        break_minutes: 30,
      });
    }
  };

  const handleSaveTimesheet = async () => {
    if (!editingDate || !editingData.clock_in) return;

    try {
      const existingTs = timesheets.get(editingDate);

      if (existingTs) {
        // Update existing
        await staffApi.updateTimesheet(existingTs.id, {
          clock_in: editingData.clock_in!,
          clock_out: editingData.clock_out,
          lunch_start: editingData.lunch_start,
          lunch_end: editingData.lunch_end,
          break_minutes: editingData.break_minutes,
          work_type: editingData.work_type as WorkType,
          notes: editingData.notes,
        });
      } else {
        // Create new
        await staffApi.createTimesheet({
          date: editingDate,
          clock_in: editingData.clock_in!,
          clock_out: editingData.clock_out,
          lunch_start: editingData.lunch_start,
          lunch_end: editingData.lunch_end,
          break_minutes: editingData.break_minutes,
          work_type: editingData.work_type as WorkType,
          notes: editingData.notes,
        });
      }

      setEditingDate(null);
      setEditingData({});
      await loadWeekData();
    } catch (e) {
      setError('Failed to save timesheet');
      console.error(e);
    }
  };

  const handleSubmitTimesheet = async (timesheetId: number) => {
    try {
      await staffApi.submitTimesheet(timesheetId);
      await loadWeekData();
    } catch (e) {
      setError('Failed to submit timesheet');
      console.error(e);
    }
  };

  const getStatusBadgeClass = (status: string): string => {
    switch (status) {
      case 'draft': return 'badge-secondary';
      case 'submitted': return 'badge-warning';
      case 'approved': return 'badge-success';
      case 'rejected': return 'badge-danger';
      default: return '';
    }
  };

  // Calculate week totals
  const weekTotals = (() => {
    let totalHours = 0;
    let totalBreak = 0;
    timesheets.forEach(ts => {
      if (ts.clock_out) {
        const hours = parseFloat(calculateHours(ts.clock_in, ts.clock_out, ts.break_minutes || 0));
        if (!isNaN(hours)) totalHours += hours;
      }
      totalBreak += ts.break_minutes || 0;
    });
    return { hours: totalHours.toFixed(1), breaks: totalBreak };
  })();

  if (loading && !enums) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="my-timesheet-page">
      <div className="page-header">
        <h1>My Timesheet</h1>
        <p>Enter your hours based on your scheduled shifts</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Week Navigation */}
      <div className="week-navigation">
        <button className="btn btn-secondary" onClick={() => navigateWeek('prev')}>
          &larr; Previous Week
        </button>
        <span className="current-week">
          Week of {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button className="btn btn-secondary" onClick={() => navigateWeek('next')}>
          Next Week &rarr;
        </button>
      </div>

      {/* Week Totals */}
      <div className="week-totals">
        <span>Week Total: <strong>{weekTotals.hours}h</strong></span>
        <span>Break Total: <strong>{weekTotals.breaks} min</strong></span>
      </div>

      {/* Timesheet Matrix */}
      <div className="timesheet-matrix">
        {weekDays.map(day => {
          const dateStr = formatDateForApi(day);
          const dayShift = shifts.find(s => s.date === dateStr);
          const dayTimesheet = timesheets.get(dateStr);
          const isToday = dateStr === formatDateForApi(new Date());
          const isEditing = editingDate === dateStr;
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
          const canEdit = dayTimesheet?.status === 'draft' || dayTimesheet?.status === 'rejected' || !dayTimesheet;

          return (
            <div key={dateStr} className={`matrix-day ${isToday ? 'today' : ''} ${dayShift ? 'has-shift' : 'no-shift'}`}>
              {/* Day Header */}
              <div className="day-header">
                <span className="day-name">{day.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <span className="day-date">{day.getDate()}</span>
              </div>

              {/* Shift Info */}
              {dayShift ? (
                <div className={`shift-info shift-${dayShift.shift_type}`}>
                  <span className="shift-type">{getEnumLabel('shift_types', dayShift.shift_type)}</span>
                  <span className="shift-role">{getEnumLabel('shift_roles', dayShift.role)}</span>
                </div>
              ) : (
                <div className="shift-info no-shift-scheduled">
                  <span>No shift</span>
                </div>
              )}

              {/* Timesheet Entry/Display */}
              {isEditing ? (
                <div className="timesheet-edit">
                  <div className="time-inputs">
                    <label>
                      In
                      <input
                        type="time"
                        value={editingData.clock_in || ''}
                        onChange={e => setEditingData({ ...editingData, clock_in: e.target.value })}
                      />
                    </label>
                    <label>
                      Out
                      <input
                        type="time"
                        value={editingData.clock_out || ''}
                        onChange={e => setEditingData({ ...editingData, clock_out: e.target.value || undefined })}
                      />
                    </label>
                  </div>
                  <div className="time-inputs">
                    <label>
                      Break (min)
                      <input
                        type="number"
                        value={editingData.break_minutes || 0}
                        onChange={e => setEditingData({ ...editingData, break_minutes: parseInt(e.target.value) || 0 })}
                        min="0"
                        step="15"
                      />
                    </label>
                  </div>
                  <label>
                    Type
                    <select
                      value={editingData.work_type || 'yard_duties'}
                      onChange={e => setEditingData({ ...editingData, work_type: e.target.value as WorkType })}
                    >
                      {enums?.work_types.map(wt => (
                        <option key={wt.value} value={wt.value}>{wt.label}</option>
                      ))}
                    </select>
                  </label>
                  <div className="edit-actions">
                    <button className="btn btn-sm btn-primary" onClick={handleSaveTimesheet}>Save</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditingDate(null)}>Cancel</button>
                  </div>
                </div>
              ) : dayTimesheet ? (
                <div className="timesheet-display">
                  <div className="timesheet-times">
                    <span>{formatTime(dayTimesheet.clock_in)} - {dayTimesheet.clock_out ? formatTime(dayTimesheet.clock_out) : '...'}</span>
                  </div>
                  <div className="timesheet-details">
                    <span className="hours">{calculateHours(dayTimesheet.clock_in, dayTimesheet.clock_out, dayTimesheet.break_minutes)}h</span>
                    <span className={`badge ${getStatusBadgeClass(dayTimesheet.status)}`}>
                      {dayTimesheet.status}
                    </span>
                  </div>
                  <div className="timesheet-actions">
                    {dayTimesheet.status === 'draft' && (
                      <>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleStartEditing(dateStr, dayShift, dayTimesheet)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleSubmitTimesheet(dayTimesheet.id)}
                        >
                          Submit
                        </button>
                      </>
                    )}
                    {dayTimesheet.status === 'rejected' && (
                      <>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handleStartEditing(dateStr, dayShift, dayTimesheet)}
                        >
                          Edit & Resubmit
                        </button>
                        <span className="rejection-reason" title={dayTimesheet.rejection_reason}>
                          {dayTimesheet.rejection_reason}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="timesheet-empty">
                  {(dayShift || isPast) && canEdit ? (
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => handleStartEditing(dateStr, dayShift)}
                    >
                      + Add Hours
                    </button>
                  ) : !dayShift ? (
                    <span className="no-entry">-</span>
                  ) : (
                    <span className="no-entry">No entry</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
