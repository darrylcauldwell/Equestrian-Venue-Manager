import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { staffApi, usersApi } from '../services/api';
import type {
  CreateShift,
  ShiftsListResponse,
  CreateTimesheet,
  AdminCreateTimesheet,
  TimesheetsListResponse,
  CreateHolidayRequest,
  HolidayRequestsListResponse,
  HolidayRequest,
  CreateSickLeave,
  SickLeaveListResponse,
  SickLeaveRecord,
  StaffManagementEnums,
  User,
  ShiftType,
  ShiftRole,
  WorkType,
  LeaveType,
  AbsenceReason,
} from '../types';
import './StaffManagement.css';

type TabType = 'shifts' | 'timesheets' | 'holidays' | 'sick';
type ShiftsViewType = 'list' | 'calendar';

// Helper to get start of week (Monday)
const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
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

// Format date for display
const formatDayHeader = (date: Date): string => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;
};

export default function StaffManagement() {
  const { user, isAdmin } = useAuth();
  const isManager = user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<TabType>('shifts');
  const [enums, setEnums] = useState<StaffManagementEnums | null>(null);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Shifts state
  const [shifts, setShifts] = useState<ShiftsListResponse | null>(null);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [newShift, setNewShift] = useState<CreateShift>({
    staff_id: 0,
    date: '',
    shift_type: 'full_day',
    role: 'yard_duties',
  });
  const [shiftsView, setShiftsView] = useState<ShiftsViewType>('calendar');
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const weekDays = getWeekDays(weekStart);
  const [selectedRole, setSelectedRole] = useState<ShiftRole>('yard_duties');

  // Timesheets state
  const [timesheets, setTimesheets] = useState<TimesheetsListResponse | null>(null);
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [timesheetStaffId, setTimesheetStaffId] = useState<number>(0); // 0 = self, otherwise admin logging for staff
  const [newTimesheet, setNewTimesheet] = useState<CreateTimesheet>({
    date: new Date().toISOString().split('T')[0],
    clock_in: '09:00',
    work_type: 'yard_duties',
  });

  // Holidays state
  const [holidays, setHolidays] = useState<HolidayRequestsListResponse | null>(null);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [newHoliday, setNewHoliday] = useState<CreateHolidayRequest>({
    start_date: '',
    end_date: '',
    days_requested: 1,
    leave_type: 'annual',
  });

  // Sick leave state
  const [sickLeave, setSickLeave] = useState<SickLeaveListResponse | null>(null);
  const [showSickModal, setShowSickModal] = useState(false);
  const [newSickLeave, setNewSickLeave] = useState<CreateSickLeave>({
    staff_id: user?.id || 0,
    date: new Date().toISOString().split('T')[0],
  });

  // Calendar leave indicators - for showing holidays/absences in shift calendar
  const [calendarHolidays, setCalendarHolidays] = useState<HolidayRequest[]>([]);
  const [calendarAbsences, setCalendarAbsences] = useState<SickLeaveRecord[]>([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const enumsData = await staffApi.getEnums();
      setEnums(enumsData);

      // Load staff list for shifts view - managers see all, staff see all for read-only view
      const users = await usersApi.list();
      // Filter to users with yard staff access (admin or is_yard_staff flag)
      setStaffList(users.filter(u => u.role === 'admin' || u.is_yard_staff));
    } catch (e) {
      setError('Failed to load data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadTabData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'shifts': {
          // Load shifts, approved holidays, and absences for calendar view
          const [shiftsData, holidaysData, absencesData] = await Promise.all([
            staffApi.listShifts(),
            staffApi.listHolidays(),
            staffApi.listSickLeave(),
          ]);
          setShifts(shiftsData);
          // Store approved holidays for calendar indicators
          setCalendarHolidays(holidaysData.approved || []);
          // Store absences (those without actual_return are still off)
          setCalendarAbsences(absencesData.records || []);
          break;
        }
        case 'timesheets': {
          const tsData = await staffApi.listTimesheets();
          setTimesheets(tsData);
          break;
        }
        case 'holidays': {
          const holData = await staffApi.listHolidays();
          setHolidays(holData);
          break;
        }
        case 'sick': {
          const sickData = await staffApi.listSickLeave();
          setSickLeave(sickData);
          break;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Shift handlers
  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await staffApi.createShift(newShift);
      setShowShiftModal(false);
      setNewShift({
        staff_id: 0,
        date: '',
        shift_type: 'full_day',
        role: 'yard_duties',
      });
      loadTabData();
    } catch {
      setError('Failed to create shift');
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (!confirm('Delete this shift?')) return;
    try {
      await staffApi.deleteShift(shiftId);
      loadTabData();
    } catch {
      setError('Failed to delete shift');
    }
  };

  // Role abbreviations for display
  const getRoleAbbrev = (role: string): string => {
    switch (role) {
      case 'yard_duties': return 'Y';
      case 'maintenance': return 'M';
      case 'office': return 'O';
      case 'events': return 'E';
      case 'teaching': return 'T';
      case 'other': return '?';
      default: return '?';
    }
  };

  // Role colors for visual distinction
  const getRoleColorClass = (role: string): string => {
    switch (role) {
      case 'yard_duties': return 'role-yard';
      case 'maintenance': return 'role-maintenance';
      case 'office': return 'role-office';
      case 'events': return 'role-events';
      case 'teaching': return 'role-teaching';
      case 'other': return 'role-other';
      default: return '';
    }
  };

  // Get shift for a staff member on a specific date and period
  const getShiftForCell = (staffId: number, date: Date, period: 'morning' | 'afternoon') => {
    const dateStr = formatDateForApi(date);
    return shifts?.shifts.find(s =>
      s.staff_id === staffId &&
      s.date === dateStr &&
      (s.shift_type === period || s.shift_type === 'full_day')
    );
  };

  // Check if staff member has approved holiday on a specific date
  const getHolidayForDate = (staffId: number, date: Date): HolidayRequest | undefined => {
    const dateStr = formatDateForApi(date);
    return calendarHolidays.find(h =>
      h.staff_id === staffId &&
      h.start_date <= dateStr &&
      h.end_date >= dateStr
    );
  };

  // Check if staff member has an absence on a specific date
  const getAbsenceForDate = (staffId: number, date: Date): SickLeaveRecord | undefined => {
    const dateStr = formatDateForApi(date);
    return calendarAbsences.find(a => {
      if (a.staff_id !== staffId) return false;
      // Check if the absence date matches
      if (a.date === dateStr) return true;
      // Check if date is within absence period (date to expected_return or actual_return)
      if (a.date <= dateStr) {
        // If they've returned, check if date is before return
        if (a.actual_return && dateStr >= a.actual_return) return false;
        // If no actual return but expected return exists, show as absence until expected
        if (a.expected_return && dateStr <= a.expected_return) return true;
        // If no return dates, just show the initial absence date
        if (!a.expected_return && !a.actual_return && a.date === dateStr) return true;
      }
      return false;
    });
  };

  // Get leave status for a cell (holiday, absence, or none)
  const getLeaveStatus = (staffId: number, date: Date): 'holiday' | 'absence' | null => {
    if (getHolidayForDate(staffId, date)) return 'holiday';
    if (getAbsenceForDate(staffId, date)) return 'absence';
    return null;
  };

  // Handle clicking a cell in the calendar
  const handleCellClick = async (staffId: number, date: Date, period: 'morning' | 'afternoon') => {
    if (!isManager || loading) return;

    const dateStr = formatDateForApi(date);
    const existingShift = shifts?.shifts.find(s =>
      s.staff_id === staffId &&
      s.date === dateStr &&
      (s.shift_type === period || s.shift_type === 'full_day')
    );

    setError('');
    setLoading(true);

    try {
      if (existingShift) {
        if (existingShift.shift_type === 'full_day') {
          // Delete full day and create the opposite period
          await staffApi.deleteShift(existingShift.id);
          const oppositePeriod = period === 'morning' ? 'afternoon' : 'morning';
          await staffApi.createShift({
            staff_id: staffId,
            date: dateStr,
            shift_type: oppositePeriod,
            role: existingShift.role,
          });
        } else {
          // Just delete the existing shift
          await staffApi.deleteShift(existingShift.id);
        }
      } else {
        // Check if there's a shift for the other period
        const otherPeriod = period === 'morning' ? 'afternoon' : 'morning';
        const otherShift = shifts?.shifts.find(s =>
          s.staff_id === staffId &&
          s.date === dateStr &&
          s.shift_type === otherPeriod
        );

        if (otherShift && otherShift.role === selectedRole) {
          // Same role - convert to full day
          await staffApi.deleteShift(otherShift.id);
          await staffApi.createShift({
            staff_id: staffId,
            date: dateStr,
            shift_type: 'full_day',
            role: selectedRole,
          });
        } else {
          // Create new shift for this period with selected role
          await staffApi.createShift({
            staff_id: staffId,
            date: dateStr,
            shift_type: period,
            role: selectedRole,
          });
        }
      }
      await loadTabData();
    } catch (err: unknown) {
      console.error('Failed to update shift:', err);
      let errorMessage = 'Failed to update shift';
      if (err && typeof err === 'object') {
        const axiosErr = err as { response?: { data?: { detail?: string }; status?: number }; message?: string };
        if (axiosErr.response?.data?.detail) {
          errorMessage = axiosErr.response.data.detail;
        } else if (axiosErr.message) {
          errorMessage = axiosErr.message;
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Navigation for week
  const goToPreviousWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() - 7);
    setWeekStart(newStart);
  };

  const goToNextWeek = () => {
    const newStart = new Date(weekStart);
    newStart.setDate(newStart.getDate() + 7);
    setWeekStart(newStart);
  };

  const goToCurrentWeek = () => {
    setWeekStart(getWeekStart(new Date()));
  };

  // Timesheet handlers
  const handleCreateTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isManager && timesheetStaffId > 0) {
        // Admin logging hours for a staff member
        const adminData: AdminCreateTimesheet = {
          ...newTimesheet,
          staff_id: timesheetStaffId,
        };
        await staffApi.adminCreateTimesheet(adminData);
      } else {
        // Staff logging their own hours
        await staffApi.createTimesheet(newTimesheet);
      }
      setShowTimesheetModal(false);
      setTimesheetStaffId(0);
      setNewTimesheet({
        date: new Date().toISOString().split('T')[0],
        clock_in: '09:00',
        work_type: 'yard_duties',
      });
      loadTabData();
    } catch {
      setError('Failed to create timesheet');
    }
  };

  const handleSubmitTimesheet = async (timesheetId: number) => {
    try {
      await staffApi.submitTimesheet(timesheetId);
      loadTabData();
    } catch {
      setError('Failed to submit timesheet');
    }
  };

  const handleApproveTimesheet = async (timesheetId: number) => {
    try {
      await staffApi.approveTimesheet(timesheetId);
      loadTabData();
    } catch {
      setError('Failed to approve timesheet');
    }
  };

  const handleRejectTimesheet = async (timesheetId: number) => {
    const reason = prompt('Rejection reason (optional):');
    try {
      await staffApi.rejectTimesheet(timesheetId, reason || undefined);
      loadTabData();
    } catch {
      setError('Failed to reject timesheet');
    }
  };

  // Holiday handlers
  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await staffApi.createHoliday(newHoliday);
      setShowHolidayModal(false);
      setNewHoliday({
        start_date: '',
        end_date: '',
        days_requested: 1,
        leave_type: 'annual',
      });
      loadTabData();
    } catch {
      setError('Failed to create holiday request');
    }
  };

  const handleApproveHoliday = async (requestId: number) => {
    try {
      await staffApi.approveHoliday(requestId);
      loadTabData();
    } catch {
      setError('Failed to approve holiday');
    }
  };

  const handleRejectHoliday = async (requestId: number) => {
    const notes = prompt('Rejection reason (optional):');
    try {
      await staffApi.rejectHoliday(requestId, notes || undefined);
      loadTabData();
    } catch {
      setError('Failed to reject holiday');
    }
  };

  const handleCancelHoliday = async (requestId: number) => {
    if (!confirm('Cancel this holiday request?')) return;
    try {
      await staffApi.cancelHoliday(requestId);
      loadTabData();
    } catch {
      setError('Failed to cancel holiday');
    }
  };

  // Sick leave handlers
  const handleRecordSickLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await staffApi.recordSickLeave(newSickLeave);
      setShowSickModal(false);
      setNewSickLeave({
        staff_id: user?.id || 0,
        date: new Date().toISOString().split('T')[0],
      });
      loadTabData();
    } catch {
      setError('Failed to record sick leave');
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatTime = (timeStr: string): string => {
    return timeStr.substring(0, 5);
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'approved': return 'status-approved';
      case 'pending': case 'submitted': return 'status-pending';
      case 'rejected': return 'status-rejected';
      case 'draft': return 'status-draft';
      default: return '';
    }
  };

  if (!isAdmin) {
    return <div className="staff-management"><div className="error-message">Admin access required</div></div>;
  }

  if (loading && !enums) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="staff-management">
      <div className="staff-header">
        <h1>Staff Management</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Tabs */}
      <div className="staff-tabs">
        <button
          className={`tab ${activeTab === 'shifts' ? 'active' : ''}`}
          onClick={() => setActiveTab('shifts')}
        >
          Shifts
        </button>
        <button
          className={`tab ${activeTab === 'timesheets' ? 'active' : ''}`}
          onClick={() => setActiveTab('timesheets')}
        >
          Timesheets
        </button>
        <button
          className={`tab ${activeTab === 'holidays' ? 'active' : ''}`}
          onClick={() => setActiveTab('holidays')}
        >
          Holidays
        </button>
        <button
          className={`tab ${activeTab === 'sick' ? 'active' : ''}`}
          onClick={() => setActiveTab('sick')}
        >
          Unplanned Absences
        </button>
      </div>

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <div className="shifts-view">
          <div className="shifts-toolbar">
            <div className="view-toggle">
              <button
                className={`view-btn ${shiftsView === 'calendar' ? 'active' : ''}`}
                onClick={() => setShiftsView('calendar')}
              >
                Calendar
              </button>
              <button
                className={`view-btn ${shiftsView === 'list' ? 'active' : ''}`}
                onClick={() => setShiftsView('list')}
              >
                List
              </button>
            </div>
            {isManager && shiftsView === 'list' && (
              <button className="btn-primary" onClick={() => setShowShiftModal(true)}>
                Add Shift
              </button>
            )}
          </div>

          {/* Calendar View */}
          {shiftsView === 'calendar' && (
            <div className="rota-calendar">
              <div className="rota-toolbar">
                <div className="rota-nav">
                  <button className="btn-secondary btn-sm" onClick={goToPreviousWeek}>
                    &larr; Prev
                  </button>
                  <button className="btn-secondary btn-sm" onClick={goToCurrentWeek}>
                    Today
                  </button>
                  <span className="week-label">
                    Week of {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button className="btn-secondary btn-sm" onClick={goToNextWeek}>
                    Next &rarr;
                  </button>
                </div>
                {isManager && (
                  <div className="role-selector">
                    <label>Assign role:</label>
                    <select
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value as ShiftRole)}
                    >
                      {enums?.shift_roles.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="rota-grid">
                <table className="rota-table">
                  <colgroup>
                    <col className="staff-col" />
                    {weekDays.map((_, idx) => (
                      <React.Fragment key={idx}>
                        <col className="period-col" />
                        <col className="period-col" />
                      </React.Fragment>
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="staff-col">Staff</th>
                      {weekDays.map((day, idx) => (
                        <th key={idx} colSpan={2} className={`day-header ${day.toDateString() === new Date().toDateString() ? 'today' : ''}`}>
                          {formatDayHeader(day)}
                        </th>
                      ))}
                    </tr>
                    <tr className="period-row">
                      <th></th>
                      {weekDays.map((_, idx) => (
                        <React.Fragment key={idx}>
                          <th className="period-header">AM</th>
                          <th className="period-header">PM</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="empty">No staff members found</td>
                      </tr>
                    ) : (
                      staffList.map((staff) => (
                        <tr key={staff.id}>
                          <td className="staff-name">{staff.name}</td>
                          {weekDays.map((day, dayIdx) => {
                            const morningShift = getShiftForCell(staff.id, day, 'morning');
                            const afternoonShift = getShiftForCell(staff.id, day, 'afternoon');
                            const leaveStatus = getLeaveStatus(staff.id, day);
                            const holidayInfo = getHolidayForDate(staff.id, day);
                            const absenceInfo = getAbsenceForDate(staff.id, day);

                            // Build cell classes including leave status
                            const getCellClass = (hasShift: boolean, shiftRole?: string) => {
                              let classes = 'rota-cell';
                              if (leaveStatus === 'holiday') classes += ' on-holiday';
                              else if (leaveStatus === 'absence') classes += ' on-absence';
                              if (hasShift && shiftRole) classes += ` shift-active ${getRoleColorClass(shiftRole)}`;
                              if (isManager && !leaveStatus) classes += ' clickable';
                              return classes;
                            };

                            // Build title/tooltip
                            const getCellTitle = (shift: typeof morningShift) => {
                              if (leaveStatus === 'holiday') {
                                const leaveType = enums?.leave_types.find(t => t.value === holidayInfo?.leave_type)?.label || 'Holiday';
                                return `On ${leaveType} (${holidayInfo?.start_date} to ${holidayInfo?.end_date})`;
                              }
                              if (leaveStatus === 'absence') {
                                return `Absent${absenceInfo?.expected_return ? ` - Expected back ${absenceInfo.expected_return}` : ''}`;
                              }
                              if (shift) {
                                return `${enums?.shift_roles.find(r => r.value === shift.role)?.label || shift.role} - Click to remove`;
                              }
                              return `Click to add ${enums?.shift_roles.find(r => r.value === selectedRole)?.label || selectedRole}`;
                            };

                            return (
                              <React.Fragment key={dayIdx}>
                                <td
                                  className={getCellClass(!!morningShift, morningShift?.role)}
                                  onClick={() => !leaveStatus && handleCellClick(staff.id, day, 'morning')}
                                  title={getCellTitle(morningShift)}
                                >
                                  {leaveStatus === 'holiday' && !morningShift && <span className="leave-marker">H</span>}
                                  {leaveStatus === 'absence' && !morningShift && <span className="leave-marker absence">A</span>}
                                  {morningShift && <span className="shift-marker">{getRoleAbbrev(morningShift.role)}</span>}
                                </td>
                                <td
                                  className={getCellClass(!!afternoonShift, afternoonShift?.role)}
                                  onClick={() => !leaveStatus && handleCellClick(staff.id, day, 'afternoon')}
                                  title={getCellTitle(afternoonShift)}
                                >
                                  {leaveStatus === 'holiday' && !afternoonShift && <span className="leave-marker">H</span>}
                                  {leaveStatus === 'absence' && !afternoonShift && <span className="leave-marker absence">A</span>}
                                  {afternoonShift && <span className="shift-marker">{getRoleAbbrev(afternoonShift.role)}</span>}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rota-legend">
                <span className="legend-item"><span className="legend-box role-yard"></span> Y = Yard Duties</span>
                <span className="legend-item"><span className="legend-box role-maintenance"></span> M = Maintenance</span>
                <span className="legend-item"><span className="legend-box role-office"></span> O = Office</span>
                <span className="legend-item"><span className="legend-box role-events"></span> E = Events</span>
                <span className="legend-item"><span className="legend-box role-teaching"></span> T = Teaching</span>
                <span className="legend-item"><span className="legend-box on-holiday"></span> H = Holiday</span>
                <span className="legend-item"><span className="legend-box on-absence"></span> A = Absent</span>
                {isManager && <span className="legend-hint">Select role above, then click cells to assign</span>}
              </div>
            </div>
          )}

          {/* List View */}
          {shiftsView === 'list' && (
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Staff</th>
                    <th>Shift</th>
                    <th>Role</th>
                    <th>Notes</th>
                    {isManager && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {shifts?.shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td>{formatDate(shift.date)}</td>
                      <td>{shift.staff_name}</td>
                      <td>{enums?.shift_types.find(t => t.value === shift.shift_type)?.label || shift.shift_type}</td>
                      <td>{enums?.shift_roles.find(r => r.value === shift.role)?.label || shift.role}</td>
                      <td>{shift.notes || '-'}</td>
                      {isManager && (
                        <td>
                          <button className="btn-danger btn-sm" onClick={() => handleDeleteShift(shift.id)}>
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {shifts?.shifts.length === 0 && (
                    <tr><td colSpan={isManager ? 6 : 5} className="empty">No shifts scheduled</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Timesheets Tab */}
      {activeTab === 'timesheets' && (
        <div className="timesheets-view">
          <div className="tab-actions">
            <button className="btn-primary" onClick={() => setShowTimesheetModal(true)}>
              Log Hours
            </button>
          </div>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {isManager && <th>Staff</th>}
                  <th>Clock In</th>
                  <th>Clock Out</th>
                  <th>Lunch</th>
                  <th>Work Type</th>
                  <th>Total</th>
                  <th>Status</th>
                  {isManager && <th>Logged By</th>}
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {timesheets?.timesheets.map((ts) => (
                  <tr key={ts.id}>
                    <td>{formatDate(ts.date)}</td>
                    {isManager && <td>{ts.staff_name}</td>}
                    <td>{formatTime(ts.clock_in)}</td>
                    <td>{ts.clock_out ? formatTime(ts.clock_out) : '-'}</td>
                    <td>
                      {ts.lunch_start && ts.lunch_end
                        ? `${formatTime(ts.lunch_start)} - ${formatTime(ts.lunch_end)}`
                        : ts.break_minutes > 0 ? `${ts.break_minutes} min` : '-'}
                    </td>
                    <td>{enums?.work_types.find(w => w.value === ts.work_type)?.label || ts.work_type}</td>
                    <td>{ts.total_hours?.toFixed(2) || '-'} hrs</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(ts.status)}`}>
                        {enums?.timesheet_statuses.find(s => s.value === ts.status)?.label || ts.status}
                      </span>
                      {ts.status === 'rejected' && ts.rejection_reason && (
                        <div className="rejection-reason" title={ts.rejection_reason}>
                          {ts.rejection_reason}
                        </div>
                      )}
                    </td>
                    {isManager && (
                      <td>{ts.logged_by_name || <span className="text-muted">Self</span>}</td>
                    )}
                    <td className="action-buttons">
                      {ts.status === 'draft' && ts.staff_id === user?.id && (
                        <button className="btn-primary btn-sm" onClick={() => handleSubmitTimesheet(ts.id)}>
                          Submit
                        </button>
                      )}
                      {ts.status === 'submitted' && isManager && (
                        <>
                          <button className="btn-success btn-sm" onClick={() => handleApproveTimesheet(ts.id)}>
                            Approve
                          </button>
                          <button className="btn-danger btn-sm" onClick={() => handleRejectTimesheet(ts.id)}>
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {timesheets?.timesheets.length === 0 && (
                  <tr><td colSpan={isManager ? 11 : 9} className="empty">No timesheets</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Holidays Tab */}
      {activeTab === 'holidays' && (
        <div className="holidays-view">
          <div className="tab-actions">
            <button className="btn-primary" onClick={() => setShowHolidayModal(true)}>
              Request Holiday
            </button>
          </div>

          <h3>Pending Requests</h3>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  {isManager && <th>Staff</th>}
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {holidays?.pending.map((h) => (
                  <tr key={h.id}>
                    {isManager && <td>{h.staff_name}</td>}
                    <td>{formatDate(h.start_date)} - {formatDate(h.end_date)}</td>
                    <td>{h.days_requested}</td>
                    <td>{enums?.leave_types.find(t => t.value === h.leave_type)?.label || h.leave_type}</td>
                    <td>{h.reason || '-'}</td>
                    <td className="action-buttons">
                      {isManager ? (
                        <>
                          <button className="btn-success btn-sm" onClick={() => handleApproveHoliday(h.id)}>
                            Approve
                          </button>
                          <button className="btn-danger btn-sm" onClick={() => handleRejectHoliday(h.id)}>
                            Reject
                          </button>
                        </>
                      ) : h.staff_id === user?.id && (
                        <button className="btn-secondary btn-sm" onClick={() => handleCancelHoliday(h.id)}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {holidays?.pending.length === 0 && (
                  <tr><td colSpan={isManager ? 6 : 5} className="empty">No pending requests</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <h3>Approved</h3>
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  {isManager && <th>Staff</th>}
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Type</th>
                  <th>Approved By</th>
                </tr>
              </thead>
              <tbody>
                {holidays?.approved.map((h) => (
                  <tr key={h.id}>
                    {isManager && <td>{h.staff_name}</td>}
                    <td>{formatDate(h.start_date)} - {formatDate(h.end_date)}</td>
                    <td>{h.days_requested}</td>
                    <td>{enums?.leave_types.find(t => t.value === h.leave_type)?.label || h.leave_type}</td>
                    <td>{h.approved_by_name || '-'}</td>
                  </tr>
                ))}
                {holidays?.approved.length === 0 && (
                  <tr><td colSpan={isManager ? 5 : 4} className="empty">No approved holidays</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unplanned Absences Tab */}
      {activeTab === 'sick' && (
        <div className="sick-leave-view">
          {isManager && (
            <div className="tab-actions">
              <button className="btn-primary" onClick={() => setShowSickModal(true)}>
                Record Absence
              </button>
            </div>
          )}
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  {isManager && <th>Staff</th>}
                  <th>Date</th>
                  <th>Reason</th>
                  <th>Reported</th>
                  <th>Expected Return</th>
                  <th>Actual Return</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {sickLeave?.records.map((r) => (
                  <tr key={r.id}>
                    {isManager && <td>{r.staff_name}</td>}
                    <td>{formatDate(r.date)}</td>
                    <td>{r.reason ? r.reason.replace('_', ' ') : 'Sickness'}</td>
                    <td>{r.reported_time ? formatTime(r.reported_time) : '-'}</td>
                    <td>{r.expected_return ? formatDate(r.expected_return) : '-'}</td>
                    <td>{r.actual_return ? formatDate(r.actual_return) : 'Not returned'}</td>
                    <td>{r.notes || '-'}</td>
                  </tr>
                ))}
                {sickLeave?.records.length === 0 && (
                  <tr><td colSpan={isManager ? 8 : 7} className="empty">No absence records</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Shift Modal */}
      {showShiftModal && (
        <div className="modal-overlay" onClick={() => setShowShiftModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Add Shift</h2>
            <form onSubmit={handleCreateShift}>
              <div className="form-group">
                <label>Staff Member *</label>
                <select
                  value={newShift.staff_id}
                  onChange={(e) => setNewShift({ ...newShift, staff_id: parseInt(e.target.value) })}
                  required
                >
                  <option value={0}>Select staff...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  value={newShift.date}
                  onChange={(e) => setNewShift({ ...newShift, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Shift Type *</label>
                  <select
                    value={newShift.shift_type}
                    onChange={(e) => setNewShift({ ...newShift, shift_type: e.target.value as ShiftType })}
                    required
                  >
                    {enums?.shift_types.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    value={newShift.role}
                    onChange={(e) => setNewShift({ ...newShift, role: e.target.value as ShiftRole })}
                  >
                    {enums?.shift_roles.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newShift.notes || ''}
                  onChange={(e) => setNewShift({ ...newShift, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowShiftModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Create Shift</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Timesheet Modal */}
      {showTimesheetModal && (
        <div className="modal-overlay" onClick={() => setShowTimesheetModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{isManager && timesheetStaffId > 0 ? 'Log Hours for Staff' : 'Log Hours'}</h2>
            <form onSubmit={handleCreateTimesheet}>
              {/* Staff selector for managers */}
              {isManager && (
                <div className="form-group">
                  <label>Staff Member</label>
                  <select
                    value={timesheetStaffId}
                    onChange={(e) => setTimesheetStaffId(parseInt(e.target.value))}
                  >
                    <option value={0}>Myself</option>
                    {staffList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {timesheetStaffId > 0 && (
                    <small className="form-hint">Logging hours on behalf of staff member</small>
                  )}
                </div>
              )}
              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={newTimesheet.date}
                    onChange={(e) => setNewTimesheet({ ...newTimesheet, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Work Type *</label>
                  <select
                    value={newTimesheet.work_type}
                    onChange={(e) => setNewTimesheet({ ...newTimesheet, work_type: e.target.value as WorkType })}
                    required
                  >
                    {enums?.work_types.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Clock In *</label>
                  <input
                    type="time"
                    value={newTimesheet.clock_in}
                    onChange={(e) => setNewTimesheet({ ...newTimesheet, clock_in: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Clock Out</label>
                  <input
                    type="time"
                    value={newTimesheet.clock_out || ''}
                    onChange={(e) => setNewTimesheet({ ...newTimesheet, clock_out: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Lunch Start</label>
                  <input
                    type="time"
                    value={newTimesheet.lunch_start || ''}
                    onChange={(e) => setNewTimesheet({ ...newTimesheet, lunch_start: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Lunch End</label>
                  <input
                    type="time"
                    value={newTimesheet.lunch_end || ''}
                    onChange={(e) => setNewTimesheet({ ...newTimesheet, lunch_end: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Additional Break (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={newTimesheet.break_minutes || 0}
                  onChange={(e) => setNewTimesheet({ ...newTimesheet, break_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newTimesheet.notes || ''}
                  onChange={(e) => setNewTimesheet({ ...newTimesheet, notes: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowTimesheetModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Holiday Request Modal */}
      {showHolidayModal && (
        <div className="modal-overlay" onClick={() => setShowHolidayModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Request Holiday</h2>
            <form onSubmit={handleCreateHoliday}>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={newHoliday.start_date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, start_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    value={newHoliday.end_date}
                    onChange={(e) => setNewHoliday({ ...newHoliday, end_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Days Requested *</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={newHoliday.days_requested}
                    onChange={(e) => setNewHoliday({ ...newHoliday, days_requested: parseFloat(e.target.value) })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Leave Type</label>
                  <select
                    value={newHoliday.leave_type}
                    onChange={(e) => setNewHoliday({ ...newHoliday, leave_type: e.target.value as LeaveType })}
                  >
                    {enums?.leave_types.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <textarea
                  value={newHoliday.reason || ''}
                  onChange={(e) => setNewHoliday({ ...newHoliday, reason: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowHolidayModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Unplanned Absence Modal */}
      {showSickModal && (
        <div className="modal-overlay" onClick={() => setShowSickModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Record Unplanned Absence</h2>
            <form onSubmit={handleRecordSickLeave}>
              <div className="form-group">
                <label>Staff Member *</label>
                <select
                  value={newSickLeave.staff_id}
                  onChange={(e) => setNewSickLeave({ ...newSickLeave, staff_id: parseInt(e.target.value) })}
                  required
                >
                  <option value={0}>Select staff...</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date *</label>
                  <input
                    type="date"
                    value={newSickLeave.date}
                    onChange={(e) => setNewSickLeave({ ...newSickLeave, date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Reason *</label>
                  <select
                    value={newSickLeave.reason || 'sickness'}
                    onChange={(e) => setNewSickLeave({ ...newSickLeave, reason: e.target.value as AbsenceReason })}
                    required
                  >
                    <option value="sickness">Sickness</option>
                    <option value="no_show">No Show / No Contact</option>
                    <option value="personal_emergency">Personal Emergency</option>
                    <option value="family_emergency">Family Emergency</option>
                    <option value="hangover">Hangover</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Reported Time</label>
                  <input
                    type="time"
                    value={newSickLeave.reported_time || ''}
                    onChange={(e) => setNewSickLeave({ ...newSickLeave, reported_time: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Expected Return</label>
                  <input
                    type="date"
                    value={newSickLeave.expected_return || ''}
                    onChange={(e) => setNewSickLeave({ ...newSickLeave, expected_return: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={newSickLeave.notes || ''}
                  onChange={(e) => setNewSickLeave({ ...newSickLeave, notes: e.target.value })}
                  rows={2}
                  placeholder="Additional details about the absence..."
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowSickModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">Record Absence</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
