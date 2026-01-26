import { useState, useEffect, useCallback } from 'react';
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
const getShiftDefaultTimes = (shiftType: string): { clockIn: string; clockOut: string; breakMinutes: number } => {
  switch (shiftType) {
    case 'morning':
      return { clockIn: '07:30', clockOut: '12:30', breakMinutes: 0 };
    case 'afternoon':
      return { clockIn: '12:30', clockOut: '17:30', breakMinutes: 0 };
    case 'full_day':
      return { clockIn: '07:30', clockOut: '17:30', breakMinutes: 60 };
    case 'split':
      return { clockIn: '07:30', clockOut: '17:30', breakMinutes: 60 };
    default:
      return { clockIn: '09:00', clockOut: '17:00', breakMinutes: 30 };
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

  // Submitted section collapsed state
  const [submittedExpanded, setSubmittedExpanded] = useState(false);

  const loadWeekData = useCallback(async () => {
    try {
      const startDate = formatDateForApi(weekStart);
      // Calculate end date from weekStart directly
      const endOfWeek = new Date(weekStart);
      endOfWeek.setDate(weekStart.getDate() + 6);
      const endDate = formatDateForApi(endOfWeek);

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
  }, [weekStart, user?.id]);

  const loadInitialData = useCallback(async () => {
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
  }, [loadWeekData]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

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
        break_minutes: defaults.breakMinutes,
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

  // Filter to only show days that need data entry (not submitted or approved)
  const actionableDays = weekDays.filter(day => {
    const dateStr = formatDateForApi(day);
    const dayTimesheet = timesheets.get(dateStr);
    const dayShift = shifts.find(s => s.date === dateStr);
    const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

    // Show if: no timesheet yet (and has shift or is past), or status is draft/rejected
    if (!dayTimesheet) {
      return dayShift || isPast;
    }
    return dayTimesheet.status === 'draft' || dayTimesheet.status === 'rejected';
  });

  // Get submitted and approved timesheets for the week (read-only display)
  const submittedTimesheets = Array.from(timesheets.values())
    .filter(ts => ts.status === 'submitted' || ts.status === 'approved')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate total hours for submitted entries
  const submittedTotalHours = submittedTimesheets.reduce((sum, ts) => {
    if (!ts.clock_out) return sum;
    const hours = parseFloat(calculateHours(ts.clock_in, ts.clock_out, ts.break_minutes));
    return isNaN(hours) ? sum : sum + hours;
  }, 0);

  if (loading && !enums) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="my-timesheet-page">
      <div className="page-header">
        <h1>My Timesheet</h1>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Timesheet Matrix - only actionable days */}
      <div className="timesheet-matrix">
        {actionableDays.length === 0 ? (
          <div className="no-actions-needed">
            <p>All timesheets for this week are submitted or approved.</p>
          </div>
        ) : (
          actionableDays.map(day => {
            const dateStr = formatDateForApi(day);
            const dayShift = shifts.find(s => s.date === dateStr);
            const dayTimesheet = timesheets.get(dateStr);
            const isToday = dateStr === formatDateForApi(new Date());
            const isEditing = editingDate === dateStr;
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
                    {canEdit ? (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => handleStartEditing(dateStr, dayShift)}
                      >
                        + Add Hours
                      </button>
                    ) : (
                      <span className="no-entry">No entry</span>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Submitted Hours Section */}
      {submittedTimesheets.length > 0 && (
        <div className="submitted-section">
          <button
            className="submitted-section-header"
            onClick={() => setSubmittedExpanded(!submittedExpanded)}
            aria-expanded={submittedExpanded}
          >
            <span className="submitted-section-toggle">
              {submittedExpanded ? '▼' : '▶'}
            </span>
            <span className="submitted-section-title">
              Submitted Hours This Week
            </span>
            <span className="submitted-section-total">
              {submittedTotalHours.toFixed(1)} hrs
            </span>
          </button>

          {submittedExpanded && (
            <div className="submitted-section-content">
              <table className="submitted-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Break</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {submittedTimesheets.map(ts => (
                    <tr key={ts.id}>
                      <td>{new Date(ts.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                      <td>{ts.clock_in}</td>
                      <td>{ts.clock_out || '-'}</td>
                      <td>{ts.break_minutes}m</td>
                      <td>{calculateHours(ts.clock_in, ts.clock_out, ts.break_minutes)}</td>
                      <td>
                        <span className={`ds-badge ds-badge-${ts.status === 'approved' ? 'success' : 'warning'}`}>
                          {ts.status === 'approved' ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Footer with navigation */}
      <div className="timesheet-footer">
        <div className="week-navigation">
          <button className="nav-arrow" onClick={() => navigateWeek('prev')} aria-label="Previous week">
            ←
          </button>
          <button className="nav-arrow" onClick={() => navigateWeek('next')} aria-label="Next week">
            →
          </button>
        </div>
      </div>
    </div>
  );
}
