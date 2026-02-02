import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { staffApi } from '../services/api';
import type { Shift, StaffManagementEnums, HolidayRequest, SickLeaveRecord, StaffLeaveSummary } from '../types';
import './MyRota.css';

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

export default function MyRota() {
  const { user } = useAuth();

  const [enums, setEnums] = useState<StaffManagementEnums | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Week navigation
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const weekDays = getWeekDays(weekStart);

  // Shifts state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<HolidayRequest[]>([]);
  const [absences, setAbsences] = useState<SickLeaveRecord[]>([]);
  const [leaveSummary, setLeaveSummary] = useState<StaffLeaveSummary | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const loadLeaveSummary = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await staffApi.getLeaveSummary(selectedYear);
      const mySummary = response.staff_summaries.find(s => s.staff_id === user.id);
      setLeaveSummary(mySummary || null);
    } catch (e) {
      console.error('Failed to load leave summary:', e);
    }
  }, [selectedYear, user?.id]);

  const loadWeekData = useCallback(async () => {
    if (!user?.id) return;

    try {
      const startDate = formatDateForApi(weekStart);
      // Calculate end date from weekStart directly
      const endOfWeek = new Date(weekStart);
      endOfWeek.setDate(weekStart.getDate() + 6);
      const endDate = formatDateForApi(endOfWeek);

      // Load shifts, holidays, and absences for the current user
      const [shiftsResponse, holidaysResponse, absencesResponse] = await Promise.all([
        staffApi.listShifts(user.id, startDate, endDate),
        staffApi.listHolidays(),
        staffApi.listSickLeave(),
      ]);

      setShifts(shiftsResponse.shifts);
      // Filter holidays to approved ones for current user
      setHolidays((holidaysResponse.approved || []).filter(h => h.staff_id === user.id));
      // Filter absences for current user
      setAbsences((absencesResponse.records || []).filter(a => a.staff_id === user.id));
    } catch (e) {
      console.error('Failed to load week data:', e);
    }
  }, [weekStart, user?.id]);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);
      const enumsData = await staffApi.getEnums();
      setEnums(enumsData);
      await Promise.all([loadWeekData(), loadLeaveSummary()]);
    } catch (e) {
      setError('Failed to load data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [loadWeekData, loadLeaveSummary]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadWeekData();
  }, [loadWeekData]);

  useEffect(() => {
    loadLeaveSummary();
  }, [loadLeaveSummary]);

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
  };

  const goToCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  // Get shift for a specific date
  const getShiftForDate = (date: Date): Shift | undefined => {
    const dateStr = formatDateForApi(date);
    return shifts.find(s => s.date === dateStr);
  };

  // Check if user has approved holiday on a specific date
  const getHolidayForDate = (date: Date): HolidayRequest | undefined => {
    const dateStr = formatDateForApi(date);
    return holidays.find(h => h.start_date <= dateStr && h.end_date >= dateStr);
  };

  // Check if user has an absence on a specific date
  const getAbsenceForDate = (date: Date): SickLeaveRecord | undefined => {
    const dateStr = formatDateForApi(date);
    return absences.find(a => {
      if (a.date === dateStr) return true;
      if (a.date <= dateStr) {
        if (a.actual_return && dateStr >= a.actual_return) return false;
        if (a.expected_return && dateStr < a.expected_return) return true;
        if (!a.expected_return && !a.actual_return && a.date === dateStr) return true;
      }
      return false;
    });
  };

  // Get shift time description
  const getShiftTimeDesc = (shiftType: string): string => {
    switch (shiftType) {
      case 'morning': return '06:00 - 14:00';
      case 'afternoon': return '14:00 - 22:00';
      case 'full_day': return '08:00 - 17:00';
      case 'split': return '07:00 - 19:00';
      default: return '';
    }
  };

  if (loading && !enums) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="my-rota-page">
      <div className="page-header">
        <h1>My Rota</h1>
        <p>View your scheduled shifts</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Leave Balance Card */}
      {leaveSummary && (
        <div className="leave-balance-card">
          <div className="leave-balance-header">
            <h2>My Leave Balance</h2>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="year-selector"
            >
              {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {leaveSummary.annual_leave_entitlement !== null && leaveSummary.annual_leave_entitlement !== undefined ? (
            <>
              <div className="leave-entitlement">
                <span className="entitlement-label">Annual Entitlement:</span>
                <span className="entitlement-value">{leaveSummary.annual_leave_entitlement} days</span>
              </div>

              <div className="leave-progress-container">
                <div className="leave-progress-bar">
                  <div
                    className="progress-taken"
                    style={{ width: `${(leaveSummary.annual_leave_taken / leaveSummary.annual_leave_entitlement) * 100}%` }}
                    title={`Taken: ${leaveSummary.annual_leave_taken} days`}
                  />
                  <div
                    className="progress-pending"
                    style={{
                      width: `${(leaveSummary.annual_leave_pending / leaveSummary.annual_leave_entitlement) * 100}%`,
                      left: `${(leaveSummary.annual_leave_taken / leaveSummary.annual_leave_entitlement) * 100}%`
                    }}
                    title={`Pending: ${leaveSummary.annual_leave_pending} days`}
                  />
                </div>
              </div>

              <div className="leave-breakdown">
                <div className="leave-stat taken">
                  <span className="stat-label">Taken</span>
                  <span className="stat-value">{leaveSummary.annual_leave_taken} days</span>
                </div>
                <div className="leave-stat pending">
                  <span className="stat-label">Pending</span>
                  <span className="stat-value">{leaveSummary.annual_leave_pending} days</span>
                </div>
                <div className={`leave-stat remaining ${(leaveSummary.annual_leave_remaining || 0) < 5 ? 'low' : ''}`}>
                  <span className="stat-label">Remaining</span>
                  <span className="stat-value">{leaveSummary.annual_leave_remaining ?? 0} days</span>
                </div>
              </div>
            </>
          ) : (
            <div className="leave-entitlement">
              <span className="entitlement-label">Staff Type:</span>
              <span className="entitlement-value">{leaveSummary.staff_type || 'Casual/On-call'}</span>
              <p className="entitlement-note">No fixed annual entitlement</p>
            </div>
          )}

          <div className="absence-summary">
            <span className="absence-label">Unplanned Absences ({selectedYear}):</span>
            <span className={`absence-value ${leaveSummary.unplanned_absences_this_year > 3 ? 'high' : ''}`}>
              {leaveSummary.unplanned_absences_this_year}
            </span>
          </div>
        </div>
      )}

      {/* Week Navigation */}
      <div className="week-navigation">
        <button className="btn btn-secondary" onClick={() => navigateWeek('prev')}>
          &larr; Prev
        </button>
        <button className="btn btn-secondary" onClick={goToCurrentWeek}>
          Today
        </button>
        <span className="current-week">
          Week of {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <button className="btn btn-secondary" onClick={() => navigateWeek('next')}>
          Next &rarr;
        </button>
      </div>

      {/* Weekly Summary */}
      <div className="week-summary">
        <span>Shifts this week: <strong>{shifts.length}</strong></span>
      </div>

      {/* Rota Grid */}
      <div className="rota-grid">
        {weekDays.map(day => {
          const dateStr = formatDateForApi(day);
          const shift = getShiftForDate(day);
          const holiday = getHolidayForDate(day);
          const absence = getAbsenceForDate(day);
          const isToday = dateStr === formatDateForApi(new Date());
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div
              key={dateStr}
              className={`rota-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${shift ? 'has-shift' : ''} ${holiday ? 'on-holiday' : ''} ${absence ? 'on-absence' : ''}`}
            >
              {/* Day Header */}
              <div className="day-header">
                <span className="day-name">{day.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                <span className="day-date">{day.getDate()}</span>
              </div>

              {/* Content */}
              <div className="day-content">
                {holiday ? (
                  <div className="status-block holiday">
                    <span className="status-icon">H</span>
                    <span className="status-text">{getEnumLabel('leave_types', holiday.leave_type)}</span>
                  </div>
                ) : absence ? (
                  <div className="status-block absence">
                    <span className="status-icon">A</span>
                    <span className="status-text">Absent</span>
                  </div>
                ) : shift ? (
                  <div className="shift-block">
                    <div className={`shift-type shift-${shift.shift_type}`}>
                      {getEnumLabel('shift_types', shift.shift_type)}
                    </div>
                    <div className="shift-role">
                      {getEnumLabel('shift_roles', shift.role)}
                    </div>
                    <div className="shift-time">
                      {getShiftTimeDesc(shift.shift_type)}
                    </div>
                    {shift.notes && (
                      <div className="shift-notes" title={shift.notes}>
                        {shift.notes}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-shift">
                    <span>Not scheduled</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="rota-legend">
        <span className="legend-item"><span className="legend-box shift-morning"></span> Morning</span>
        <span className="legend-item"><span className="legend-box shift-afternoon"></span> Afternoon</span>
        <span className="legend-item"><span className="legend-box shift-full"></span> Full Day</span>
        <span className="legend-item"><span className="legend-box on-holiday"></span> Holiday</span>
        <span className="legend-item"><span className="legend-box on-absence"></span> Absent</span>
      </div>
    </div>
  );
}
