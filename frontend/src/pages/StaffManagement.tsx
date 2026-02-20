import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { staffApi, usersApi } from '../services/api';

// Lazy load StaffProfiles to avoid massive bundle
const StaffProfiles = lazy(() => import('./admin/StaffProfiles'));
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
  UpdateSickLeave,
  SickLeaveListResponse,
  SickLeaveRecord,
  StaffManagementEnums,
  User,
  ShiftType,
  ShiftRole,
  WorkType,
  LeaveType,
  AbsenceReason,
  AllStaffLeaveSummary,
  PayrollSummaryResponse,
  PayrollAdjustmentCreate,
  DayStatus,
  DayStatusType,
} from '../types';
import { useModalForm } from '../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../components/ui';
import './StaffManagement.css';

type TabType = 'shifts' | 'timesheets' | 'holidays' | 'sick' | 'leave' | 'payroll' | 'profiles';
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
  const [searchParams, setSearchParams] = useSearchParams();

  // Read initial tab from URL or default to 'shifts'
  const getInitialTab = (): TabType => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['shifts', 'timesheets', 'holidays', 'sick', 'leave', 'payroll', 'profiles'].includes(tabParam)) {
      return tabParam as TabType;
    }
    return 'shifts';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  // Update URL when tab changes
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // React to URL changes (e.g., navigation from menu links)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['shifts', 'timesheets', 'holidays', 'sick', 'leave', 'payroll', 'profiles'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  const [enums, setEnums] = useState<StaffManagementEnums | null>(null);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Shifts state
  const [shifts, setShifts] = useState<ShiftsListResponse | null>(null);
  const [shiftsView, setShiftsView] = useState<ShiftsViewType>('calendar');
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const weekDays = getWeekDays(weekStart);

  // Timesheets state
  const [timesheets, setTimesheets] = useState<TimesheetsListResponse | null>(null);
  const [timesheetStaffId, setTimesheetStaffId] = useState<number>(0); // 0 = self, otherwise admin logging for staff

  // Holidays state
  const [holidays, setHolidays] = useState<HolidayRequestsListResponse | null>(null);

  // Sick leave state
  const [sickLeave, setSickLeave] = useState<SickLeaveListResponse | null>(null);
  const [absenceStaffFilter, setAbsenceStaffFilter] = useState<number>(0); // 0 = all staff
  const [timesheetStaffFilter, setTimesheetStaffFilter] = useState<number>(0); // 0 = all staff

  // Calendar leave indicators - for showing holidays/absences in shift calendar
  const [calendarHolidays, setCalendarHolidays] = useState<HolidayRequest[]>([]);
  const [calendarAbsences, setCalendarAbsences] = useState<SickLeaveRecord[]>([]);
  const [calendarDayStatuses, setCalendarDayStatuses] = useState<DayStatus[]>([]);

  // Selected assignment type - can be a shift role OR a day status
  // Special values prefixed with 'status_' are for day statuses
  const [selectedAssignment, setSelectedAssignment] = useState<string>('yard_duties');

  // Leave summary state
  const [leaveSummary, setLeaveSummary] = useState<AllStaffLeaveSummary | null>(null);
  const [leaveYear, setLeaveYear] = useState<number>(new Date().getFullYear());

  // Payroll state
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummaryResponse | null>(null);
  const [payrollStartDate, setPayrollStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [payrollEndDate, setPayrollEndDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  });

  // Delete confirmations
  const [deleteShiftId, setDeleteShiftId] = useState<number | null>(null);
  const [cancelHolidayId, setCancelHolidayId] = useState<number | null>(null);
  const [deleteAbsenceId, setDeleteAbsenceId] = useState<number | null>(null);

  // Modal forms
  const shiftModal = useModalForm<CreateShift>({
    staff_id: 0,
    date: '',
    shift_type: 'full_day',
    role: 'yard_duties',
  });

  const timesheetModal = useModalForm<CreateTimesheet>({
    date: new Date().toISOString().split('T')[0],
    clock_in: '09:00',
    work_type: 'yard_duties',
  });

  const holidayModal = useModalForm<CreateHolidayRequest>({
    staff_id: undefined,
    start_date: '',
    end_date: '',
    days_requested: 1,
    leave_type: 'annual',
  });

  const sickModal = useModalForm<CreateSickLeave>({
    staff_id: user?.id || 0,
    date: new Date().toISOString().split('T')[0],
  });

  const editAbsenceModal = useModalForm<UpdateSickLeave>({
    reason: '',
    expected_return: '',
    actual_return: '',
    notes: '',
    has_fit_note: false,
    fit_note_start: '',
    fit_note_end: '',
  });
  const [editAbsenceRecord, setEditAbsenceRecord] = useState<SickLeaveRecord | null>(null);

  const loadInitialData = useCallback(async () => {
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
  }, []);

  const loadTabData = useCallback(async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'shifts': {
          // Load shifts, approved holidays, absences, and day statuses for calendar view
          const [shiftsData, holidaysData, absencesData, dayStatusesData] = await Promise.all([
            staffApi.listShifts(),
            staffApi.listHolidays(),
            staffApi.listSickLeave(),
            staffApi.listDayStatuses(),
          ]);
          setShifts(shiftsData);
          // Store approved holidays for calendar indicators
          setCalendarHolidays(holidaysData.approved || []);
          // Store absences (those without actual_return are still off)
          setCalendarAbsences(absencesData.records || []);
          // Store day statuses (unavailable/day off)
          setCalendarDayStatuses(dayStatusesData.statuses || []);
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
        case 'leave': {
          const leaveData = await staffApi.getLeaveSummary(leaveYear);
          setLeaveSummary(leaveData);
          break;
        }
        case 'payroll': {
          const payrollData = await staffApi.getPayrollSummary(
            payrollStartDate,
            payrollEndDate
          );
          setPayrollSummary(payrollData);
          break;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab, leaveYear, payrollStartDate, payrollEndDate]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  // Shift handlers
  const handleCreateShift = async () => {
    try {
      await staffApi.createShift(shiftModal.formData);
      shiftModal.close();
      loadTabData();
    } catch {
      setError('Failed to create shift');
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteShiftId) return;
    try {
      await staffApi.deleteShift(deleteShiftId);
      setDeleteShiftId(null);
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
        if (a.expected_return && dateStr < a.expected_return) return true;
        // If no return dates, just show the initial absence date
        if (!a.expected_return && !a.actual_return && a.date === dateStr) return true;
      }
      return false;
    });
  };

  // Check if staff member has a day status on a specific date
  const getDayStatusForDate = (staffId: number, date: Date): DayStatus | undefined => {
    const dateStr = formatDateForApi(date);
    return calendarDayStatuses.find(ds =>
      ds.staff_id === staffId &&
      ds.date === dateStr
    );
  };

  // Get leave status for a cell (holiday, absence, day status, or none)
  const getLeaveStatus = (staffId: number, date: Date): 'holiday' | 'absence' | 'unavailable' | 'day_off' | null => {
    if (getHolidayForDate(staffId, date)) return 'holiday';
    if (getAbsenceForDate(staffId, date)) return 'absence';
    const dayStatus = getDayStatusForDate(staffId, date);
    if (dayStatus) {
      return dayStatus.status_type === 'unavailable' ? 'unavailable' : 'day_off';
    }
    return null;
  };

  // Check if selected assignment is a day status
  const isStatusAssignment = selectedAssignment.startsWith('status_');
  const selectedDayStatusType: DayStatusType | null = isStatusAssignment
    ? (selectedAssignment === 'status_unavailable' ? 'unavailable' : 'absent')
    : null;
  // Get selected role (only valid when not a status assignment)
  const selectedRole: ShiftRole = isStatusAssignment ? 'yard_duties' : selectedAssignment as ShiftRole;

  // Handle clicking a cell in the calendar (for shifts)
  const handleCellClick = async (staffId: number, date: Date, period: 'morning' | 'afternoon') => {
    if (!isManager || loading) return;

    // If a day status is selected, handle day status instead of shift
    if (isStatusAssignment) {
      await handleDayStatusClick(staffId, date);
      return;
    }

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

  // Handle clicking a cell for day status (whole day, not AM/PM)
  const handleDayStatusClick = async (staffId: number, date: Date) => {
    if (!isManager || loading || !selectedDayStatusType) return;

    const dateStr = formatDateForApi(date);
    const existingStatus = getDayStatusForDate(staffId, date);

    setError('');
    setLoading(true);

    try {
      if (existingStatus) {
        // If clicking same status type, remove it
        if (existingStatus.status_type === selectedDayStatusType) {
          await staffApi.deleteDayStatus(existingStatus.id);
        } else {
          // Different status type - delete old and create new
          await staffApi.deleteDayStatus(existingStatus.id);
          await staffApi.createDayStatus({
            staff_id: staffId,
            date: dateStr,
            status_type: selectedDayStatusType,
          });
        }
      } else {
        // No existing status - create new one
        await staffApi.createDayStatus({
          staff_id: staffId,
          date: dateStr,
          status_type: selectedDayStatusType,
        });
      }
      await loadTabData();
    } catch (err: unknown) {
      console.error('Failed to update day status:', err);
      let errorMessage = 'Failed to update day status';
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

  // Staff reorder handlers
  const moveStaffUp = async (staffId: number) => {
    const index = staffList.findIndex(s => s.id === staffId);
    if (index <= 0) return; // Already at top

    // Swap positions in local state
    const newList = [...staffList];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setStaffList(newList);

    // Persist the new order
    const orders = newList.map((s, i) => ({ user_id: s.id, order: i }));
    try {
      await usersApi.updateStaffOrder(orders);
    } catch {
      setError('Failed to update staff order');
      // Reload to revert on failure
      loadInitialData();
    }
  };

  const moveStaffDown = async (staffId: number) => {
    const index = staffList.findIndex(s => s.id === staffId);
    if (index < 0 || index >= staffList.length - 1) return; // Already at bottom

    // Swap positions in local state
    const newList = [...staffList];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setStaffList(newList);

    // Persist the new order
    const orders = newList.map((s, i) => ({ user_id: s.id, order: i }));
    try {
      await usersApi.updateStaffOrder(orders);
    } catch {
      setError('Failed to update staff order');
      // Reload to revert on failure
      loadInitialData();
    }
  };

  // Timesheet handlers
  const handleCreateTimesheet = async () => {
    try {
      if (isManager && timesheetStaffId > 0) {
        // Admin logging hours for a staff member
        const adminData: AdminCreateTimesheet = {
          ...timesheetModal.formData,
          staff_id: timesheetStaffId,
        };
        await staffApi.adminCreateTimesheet(adminData);
      } else {
        // Staff logging their own hours
        await staffApi.createTimesheet(timesheetModal.formData);
      }
      timesheetModal.close();
      setTimesheetStaffId(0);
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
  const handleCreateHoliday = async () => {
    try {
      await staffApi.createHoliday(holidayModal.formData);
      holidayModal.close();
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

  const handleCancelHoliday = async () => {
    if (!cancelHolidayId) return;
    try {
      await staffApi.cancelHoliday(cancelHolidayId);
      setCancelHolidayId(null);
      loadTabData();
    } catch {
      setError('Failed to cancel holiday');
    }
  };

  // Sick leave handlers
  const handleRecordSickLeave = async () => {
    try {
      await staffApi.recordSickLeave(sickModal.formData);
      sickModal.close();
      loadTabData();
    } catch {
      setError('Failed to record sick leave');
    }
  };

  const handleEditAbsence = (record: SickLeaveRecord) => {
    setEditAbsenceRecord(record);
    editAbsenceModal.edit(record.id, {
      reason: record.reason || '',
      expected_return: record.expected_return || '',
      actual_return: record.actual_return || '',
      notes: record.notes || '',
      has_fit_note: record.has_fit_note || false,
      fit_note_start: record.fit_note_start || '',
      fit_note_end: record.fit_note_end || '',
    });
  };

  const handleUpdateAbsence = async () => {
    if (!editAbsenceModal.editingId) return;
    try {
      const data = { ...editAbsenceModal.formData };
      // Convert empty date strings to null so Pydantic accepts them as Optional[date]
      (['expected_return', 'actual_return', 'fit_note_start', 'fit_note_end'] as const).forEach(field => {
        if (data[field] === '') data[field] = undefined;
      });
      await staffApi.updateSickLeave(editAbsenceModal.editingId, data);
      editAbsenceModal.close();
      setEditAbsenceRecord(null);
      loadTabData();
    } catch {
      setError('Failed to update absence');
    }
  };

  const handleDeleteAbsence = async () => {
    if (!deleteAbsenceId) return;
    try {
      await staffApi.deleteSickLeave(deleteAbsenceId);
      setDeleteAbsenceId(null);
      loadTabData();
    } catch {
      setError('Failed to delete absence');
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
    return <div className="staff-management"><div className="ds-alert ds-alert-error">Admin access required</div></div>;
  }

  if (loading && !enums) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="staff-management">
      <div className="staff-header">
        <h1>Staff Management</h1>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Tabs */}
      <div className="staff-tabs">
        <button
          className={`ds-tab ${activeTab === 'shifts' ? 'active' : ''}`}
          onClick={() => handleTabChange('shifts')}
        >
          Shifts
        </button>
        <button
          className={`ds-tab ${activeTab === 'timesheets' ? 'active' : ''}`}
          onClick={() => handleTabChange('timesheets')}
        >
          Timesheets
        </button>
        <button
          className={`ds-tab ${activeTab === 'holidays' ? 'active' : ''}`}
          onClick={() => handleTabChange('holidays')}
        >
          Holidays
        </button>
        <button
          className={`ds-tab ${activeTab === 'sick' ? 'active' : ''}`}
          onClick={() => handleTabChange('sick')}
        >
          Unplanned Absences
        </button>
        {isManager && (
          <button
            className={`ds-tab ${activeTab === 'leave' ? 'active' : ''}`}
            onClick={() => handleTabChange('leave')}
          >
            Leave Summary
          </button>
        )}
        {isManager && (
          <button
            className={`ds-tab ${activeTab === 'payroll' ? 'active' : ''}`}
            onClick={() => handleTabChange('payroll')}
          >
            Payroll
          </button>
        )}
        {isManager && (
          <button
            className={`ds-tab ${activeTab === 'profiles' ? 'active' : ''}`}
            onClick={() => handleTabChange('profiles')}
          >
            Staff Profiles
          </button>
        )}
      </div>

      {/* Shifts Tab */}
      {activeTab === 'shifts' && (
        <ShiftsTab
          shifts={shifts}
          staffList={staffList}
          enums={enums}
          shiftsView={shiftsView}
          setShiftsView={setShiftsView}
          weekStart={weekStart}
          weekDays={weekDays}
          selectedAssignment={selectedAssignment}
          setSelectedAssignment={setSelectedAssignment}
          selectedRole={selectedRole}
          isManager={isManager}
          loading={loading}
          onOpenModal={() => shiftModal.open()}
          onDeleteShift={setDeleteShiftId}
          onCellClick={handleCellClick}
          goToPreviousWeek={goToPreviousWeek}
          goToNextWeek={goToNextWeek}
          goToCurrentWeek={goToCurrentWeek}
          getShiftForCell={getShiftForCell}
          getLeaveStatus={getLeaveStatus}
          getHolidayForDate={getHolidayForDate}
          getAbsenceForDate={getAbsenceForDate}
          getDayStatusForDate={getDayStatusForDate}
          getRoleAbbrev={getRoleAbbrev}
          getRoleColorClass={getRoleColorClass}
          formatDate={formatDate}
          moveStaffUp={moveStaffUp}
          moveStaffDown={moveStaffDown}
        />
      )}

      {/* Timesheets Tab */}
      {activeTab === 'timesheets' && (
        <TimesheetsTab
          timesheets={timesheets}
          enums={enums}
          user={user}
          isManager={isManager}
          staffList={staffList}
          timesheetStaffFilter={timesheetStaffFilter}
          setTimesheetStaffFilter={setTimesheetStaffFilter}
          onOpenModal={() => timesheetModal.open()}
          onSubmit={handleSubmitTimesheet}
          onApprove={handleApproveTimesheet}
          onReject={handleRejectTimesheet}
          formatDate={formatDate}
          formatTime={formatTime}
          getStatusClass={getStatusClass}
        />
      )}

      {/* Holidays Tab */}
      {activeTab === 'holidays' && (
        <HolidaysTab
          holidays={holidays}
          enums={enums}
          user={user}
          isManager={isManager}
          onOpenModal={() => holidayModal.open()}
          onApprove={handleApproveHoliday}
          onReject={handleRejectHoliday}
          onCancel={setCancelHolidayId}
          formatDate={formatDate}
        />
      )}

      {/* Unplanned Absences Tab */}
      {activeTab === 'sick' && (
        <SickLeaveTab
          sickLeave={sickLeave}
          staffList={staffList}
          absenceStaffFilter={absenceStaffFilter}
          setAbsenceStaffFilter={setAbsenceStaffFilter}
          isManager={isManager}
          onOpenModal={() => sickModal.open()}
          onEdit={handleEditAbsence}
          onDelete={setDeleteAbsenceId}
          formatDate={formatDate}
          formatTime={formatTime}
        />
      )}

      {/* Leave Summary Tab (Admin only) */}
      {activeTab === 'leave' && isManager && (
        <LeaveSummaryTab
          leaveSummary={leaveSummary}
          leaveYear={leaveYear}
          setLeaveYear={setLeaveYear}
        />
      )}

      {/* Payroll Tab (Admin only) */}
      {activeTab === 'payroll' && isManager && (
        <PayrollTab
          payrollSummary={payrollSummary}
          startDate={payrollStartDate}
          setStartDate={setPayrollStartDate}
          endDate={payrollEndDate}
          setEndDate={setPayrollEndDate}
          loading={loading}
          staffList={staffList}
          loadTabData={loadTabData}
        />
      )}

      {/* Staff Profiles Tab (Admin only) */}
      {activeTab === 'profiles' && isManager && (
        <Suspense fallback={<div className="ds-loading"><div className="ds-spinner"></div><span>Loading staff profiles...</span></div>}>
          <StaffProfiles embedded />
        </Suspense>
      )}

      {/* Create Shift Modal */}
      <Modal
        isOpen={shiftModal.isOpen}
        onClose={shiftModal.close}
        title="Add Shift"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={shiftModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleCreateShift}>Create Shift</button>
          </>
        }
      >
        <FormGroup label="Staff Member" required>
          <Select
            value={shiftModal.formData.staff_id}
            onChange={(e) => shiftModal.updateField('staff_id', parseInt(e.target.value))}
            required
          >
            <option value={0}>Select staff...</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormGroup>
        <FormGroup label="Date" required>
          <Input
            type="date"
            value={shiftModal.formData.date}
            onChange={(e) => shiftModal.updateField('date', e.target.value)}
            required
          />
        </FormGroup>
        <FormRow>
          <FormGroup label="Shift Type" required>
            <Select
              value={shiftModal.formData.shift_type}
              onChange={(e) => shiftModal.updateField('shift_type', e.target.value as ShiftType)}
              required
            >
              {enums?.shift_types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Role">
            <Select
              value={shiftModal.formData.role}
              onChange={(e) => shiftModal.updateField('role', e.target.value as ShiftRole)}
            >
              {enums?.shift_roles.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes">
          <Textarea
            value={shiftModal.formData.notes || ''}
            onChange={(e) => shiftModal.updateField('notes', e.target.value)}
            rows={2}
          />
        </FormGroup>
      </Modal>

      {/* Create Timesheet Modal */}
      <Modal
        isOpen={timesheetModal.isOpen}
        onClose={timesheetModal.close}
        title={isManager && timesheetStaffId > 0 ? 'Log Hours for Staff' : 'Log Hours'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={timesheetModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleCreateTimesheet}>Save</button>
          </>
        }
      >
        {isManager && (
          <FormGroup label="Staff Member">
            <Select
              value={timesheetStaffId}
              onChange={(e) => setTimesheetStaffId(parseInt(e.target.value))}
            >
              <option value={0}>Myself</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            {timesheetStaffId > 0 && (
              <small className="form-hint">Logging hours on behalf of staff member</small>
            )}
          </FormGroup>
        )}
        <FormRow>
          <FormGroup label="Date" required>
            <Input
              type="date"
              value={timesheetModal.formData.date}
              onChange={(e) => timesheetModal.updateField('date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Work Type" required>
            <Select
              value={timesheetModal.formData.work_type}
              onChange={(e) => timesheetModal.updateField('work_type', e.target.value as WorkType)}
              required
            >
              {enums?.work_types.map((w) => (
                <option key={w.value} value={w.value}>{w.label}</option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Clock In" required>
            <Input
              type="time"
              value={timesheetModal.formData.clock_in}
              onChange={(e) => timesheetModal.updateField('clock_in', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Clock Out">
            <Input
              type="time"
              value={timesheetModal.formData.clock_out || ''}
              onChange={(e) => timesheetModal.updateField('clock_out', e.target.value)}
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Lunch Start">
            <Input
              type="time"
              value={timesheetModal.formData.lunch_start || ''}
              onChange={(e) => timesheetModal.updateField('lunch_start', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Lunch End">
            <Input
              type="time"
              value={timesheetModal.formData.lunch_end || ''}
              onChange={(e) => timesheetModal.updateField('lunch_end', e.target.value)}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Additional Break (minutes)">
          <Input
            type="number"
            min={0}
            value={timesheetModal.formData.break_minutes || 0}
            onChange={(e) => timesheetModal.updateField('break_minutes', parseInt(e.target.value) || 0)}
          />
        </FormGroup>
        <FormGroup label="Notes">
          <Textarea
            value={timesheetModal.formData.notes || ''}
            onChange={(e) => timesheetModal.updateField('notes', e.target.value)}
            rows={2}
          />
        </FormGroup>
      </Modal>

      {/* Create Holiday Request Modal */}
      <Modal
        isOpen={holidayModal.isOpen}
        onClose={holidayModal.close}
        title={isManager ? "Add Leave" : "Request Holiday"}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={holidayModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleCreateHoliday}>
              {isManager ? 'Add Leave' : 'Submit Request'}
            </button>
          </>
        }
      >
        {isManager && (
          <FormGroup label="Staff Member" required>
            <Select
              value={holidayModal.formData.staff_id || ''}
              onChange={(e) => holidayModal.updateField('staff_id', parseInt(e.target.value) || undefined)}
              required
            >
              <option value="">Select staff member</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </FormGroup>
        )}
        <FormRow>
          <FormGroup label="Start Date" required>
            <Input
              type="date"
              value={holidayModal.formData.start_date}
              onChange={(e) => {
                const newStartDate = e.target.value;
                holidayModal.updateField('start_date', newStartDate);
                // Auto-set end date to start date if empty or before new start date
                if (!holidayModal.formData.end_date || holidayModal.formData.end_date < newStartDate) {
                  holidayModal.updateField('end_date', newStartDate);
                }
              }}
              required
            />
          </FormGroup>
          <FormGroup label="End Date" required>
            <Input
              type="date"
              value={holidayModal.formData.end_date}
              onChange={(e) => holidayModal.updateField('end_date', e.target.value)}
              min={holidayModal.formData.start_date}
              required
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Days Requested" required>
            <Input
              type="number"
              min={0.5}
              step={0.5}
              value={holidayModal.formData.days_requested}
              onChange={(e) => holidayModal.updateField('days_requested', parseFloat(e.target.value))}
              required
            />
          </FormGroup>
          <FormGroup label="Leave Type">
            <Select
              value={holidayModal.formData.leave_type}
              onChange={(e) => holidayModal.updateField('leave_type', e.target.value as LeaveType)}
            >
              {enums?.leave_types.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Reason">
          <Textarea
            value={holidayModal.formData.reason || ''}
            onChange={(e) => holidayModal.updateField('reason', e.target.value)}
            rows={2}
          />
        </FormGroup>
      </Modal>

      {/* Record Unplanned Absence Modal */}
      <Modal
        isOpen={sickModal.isOpen}
        onClose={sickModal.close}
        title="Record Unplanned Absence"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={sickModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleRecordSickLeave}>Record Absence</button>
          </>
        }
      >
        <FormGroup label="Staff Member" required>
          <Select
            value={sickModal.formData.staff_id}
            onChange={(e) => sickModal.updateField('staff_id', parseInt(e.target.value))}
            required
          >
            <option value={0}>Select staff...</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormGroup>
        <FormRow>
          <FormGroup label="Date" required>
            <Input
              type="date"
              value={sickModal.formData.date}
              onChange={(e) => sickModal.updateField('date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Reason" required>
            <Select
              value={sickModal.formData.reason || 'sickness'}
              onChange={(e) => sickModal.updateField('reason', e.target.value as AbsenceReason)}
              required
            >
              <option value="sickness">Sickness</option>
              <option value="no_show">No Show / No Contact</option>
              <option value="personal_emergency">Personal Emergency</option>
              <option value="family_emergency">Family Emergency</option>
              <option value="hangover">Hangover</option>
              <option value="other">Other</option>
            </Select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Reported Time">
            <Input
              type="time"
              value={sickModal.formData.reported_time || ''}
              onChange={(e) => sickModal.updateField('reported_time', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Expected Return">
            <Input
              type="date"
              value={sickModal.formData.expected_return || ''}
              onChange={(e) => sickModal.updateField('expected_return', e.target.value)}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes">
          <Textarea
            value={sickModal.formData.notes || ''}
            onChange={(e) => sickModal.updateField('notes', e.target.value)}
            rows={2}
            placeholder="Additional details about the absence..."
          />
        </FormGroup>
      </Modal>

      {/* Edit Absence Modal */}
      <Modal
        isOpen={editAbsenceModal.isOpen}
        onClose={() => { editAbsenceModal.close(); setEditAbsenceRecord(null); }}
        title="Edit Absence"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => { editAbsenceModal.close(); setEditAbsenceRecord(null); }}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleUpdateAbsence}>Update</button>
          </>
        }
      >
        {editAbsenceRecord && (
          <div className="ds-alert ds-alert-info" style={{ marginBottom: 'var(--space-4)' }}>
            <strong>{editAbsenceRecord.staff_name}</strong> &mdash; {formatDate(editAbsenceRecord.date)}
          </div>
        )}
        <FormGroup label="Reason">
          <Select
            value={editAbsenceModal.formData.reason || 'sickness'}
            onChange={(e) => editAbsenceModal.updateField('reason', e.target.value)}
          >
            <option value="sickness">Sickness</option>
            <option value="no_show">No Show / No Contact</option>
            <option value="personal_emergency">Personal Emergency</option>
            <option value="family_emergency">Family Emergency</option>
            <option value="hangover">Hangover</option>
            <option value="other">Other</option>
          </Select>
        </FormGroup>
        <FormRow>
          <FormGroup label="Expected Return">
            <Input
              type="date"
              value={editAbsenceModal.formData.expected_return || ''}
              onChange={(e) => editAbsenceModal.updateField('expected_return', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Actual Return">
            <Input
              type="date"
              value={editAbsenceModal.formData.actual_return || ''}
              onChange={(e) => editAbsenceModal.updateField('actual_return', e.target.value)}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes">
          <Textarea
            value={editAbsenceModal.formData.notes || ''}
            onChange={(e) => editAbsenceModal.updateField('notes', e.target.value)}
            rows={2}
          />
        </FormGroup>
        <FormGroup label="">
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <input
              type="checkbox"
              checked={editAbsenceModal.formData.has_fit_note || false}
              onChange={(e) => editAbsenceModal.updateField('has_fit_note', e.target.checked)}
            />
            Has fit note
          </label>
        </FormGroup>
        {editAbsenceModal.formData.has_fit_note && (
          <FormRow>
            <FormGroup label="Fit Note Start">
              <Input
                type="date"
                value={editAbsenceModal.formData.fit_note_start || ''}
                onChange={(e) => editAbsenceModal.updateField('fit_note_start', e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Fit Note End">
              <Input
                type="date"
                value={editAbsenceModal.formData.fit_note_end || ''}
                onChange={(e) => editAbsenceModal.updateField('fit_note_end', e.target.value)}
              />
            </FormGroup>
          </FormRow>
        )}
      </Modal>

      {/* Delete Absence Confirmation */}
      <ConfirmModal
        isOpen={!!deleteAbsenceId}
        onClose={() => setDeleteAbsenceId(null)}
        onConfirm={handleDeleteAbsence}
        title="Delete Absence"
        message="Are you sure you want to delete this absence record?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Delete Shift Confirmation */}
      <ConfirmModal
        isOpen={!!deleteShiftId}
        onClose={() => setDeleteShiftId(null)}
        onConfirm={handleDeleteShift}
        title="Delete Shift"
        message="Are you sure you want to delete this shift?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Cancel Holiday Confirmation */}
      <ConfirmModal
        isOpen={!!cancelHolidayId}
        onClose={() => setCancelHolidayId(null)}
        onConfirm={handleCancelHoliday}
        title="Cancel Holiday Request"
        message="Are you sure you want to cancel this holiday request?"
        confirmLabel="Cancel Request"
        variant="danger"
      />
    </div>
  );
}

// Extracted Tab Components

interface ShiftsTabProps {
  shifts: ShiftsListResponse | null;
  staffList: User[];
  enums: StaffManagementEnums | null;
  shiftsView: ShiftsViewType;
  setShiftsView: (view: ShiftsViewType) => void;
  weekStart: Date;
  weekDays: Date[];
  selectedAssignment: string;
  setSelectedAssignment: (assignment: string) => void;
  selectedRole: ShiftRole;
  isManager: boolean;
  loading: boolean;
  onOpenModal: () => void;
  onDeleteShift: (id: number) => void;
  onCellClick: (staffId: number, date: Date, period: 'morning' | 'afternoon') => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;
  getShiftForCell: (staffId: number, date: Date, period: 'morning' | 'afternoon') => ShiftsListResponse['shifts'][0] | undefined;
  getLeaveStatus: (staffId: number, date: Date) => 'holiday' | 'absence' | 'unavailable' | 'day_off' | null;
  getHolidayForDate: (staffId: number, date: Date) => HolidayRequest | undefined;
  getAbsenceForDate: (staffId: number, date: Date) => SickLeaveRecord | undefined;
  getDayStatusForDate: (staffId: number, date: Date) => DayStatus | undefined;
  getRoleAbbrev: (role: string) => string;
  getRoleColorClass: (role: string) => string;
  formatDate: (dateStr: string) => string;
  moveStaffUp: (staffId: number) => void;
  moveStaffDown: (staffId: number) => void;
}

function ShiftsTab({
  shifts,
  staffList,
  enums,
  shiftsView,
  setShiftsView,
  weekStart,
  weekDays,
  selectedAssignment,
  setSelectedAssignment,
  selectedRole,
  isManager,
  loading,
  onOpenModal,
  onDeleteShift,
  onCellClick,
  goToPreviousWeek,
  goToNextWeek,
  goToCurrentWeek,
  getShiftForCell,
  getLeaveStatus,
  getHolidayForDate,
  getAbsenceForDate,
  getDayStatusForDate,
  getRoleAbbrev,
  getRoleColorClass,
  formatDate,
  moveStaffUp,
  moveStaffDown,
}: ShiftsTabProps) {
  // Check if selected assignment is a day status
  const isStatusAssignment = selectedAssignment.startsWith('status_');
  const statusLabel = selectedAssignment === 'status_unavailable' ? 'Unavailable' : 'Day Off';

  return (
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
          <button className="ds-btn ds-btn-primary" onClick={onOpenModal}>
            Add Shift
          </button>
        )}
      </div>

      {/* Calendar View */}
      {shiftsView === 'calendar' && (
        <div className="rota-calendar">
          <div className="rota-toolbar">
            <div className="rota-nav">
              <button className="ds-btn ds-btn-secondary btn-sm" onClick={goToPreviousWeek}>
                &larr; Prev
              </button>
              <button className="ds-btn ds-btn-secondary btn-sm" onClick={goToCurrentWeek}>
                Today
              </button>
              <span className="week-label">
                Week of {weekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <button className="ds-btn ds-btn-secondary btn-sm" onClick={goToNextWeek}>
                Next &rarr;
              </button>
            </div>
            {isManager && (
              <div className="role-selector">
                <label>Assign:</label>
                <select
                  value={selectedAssignment}
                  onChange={(e) => setSelectedAssignment(e.target.value)}
                >
                  <optgroup label="Shift Roles">
                    {enums?.shift_roles.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Day Status">
                    <option value="status_unavailable">Unavailable</option>
                    <option value="status_day_off">Day Off</option>
                  </optgroup>
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
                  staffList.map((staff, staffIndex) => (
                    <tr key={staff.id}>
                      <td className="staff-name">
                        {isManager && (
                          <span className="staff-reorder-btns">
                            <button
                              className="reorder-btn"
                              onClick={() => moveStaffUp(staff.id)}
                              disabled={staffIndex === 0}
                              title="Move up"
                            >
                              &#9650;
                            </button>
                            <button
                              className="reorder-btn"
                              onClick={() => moveStaffDown(staff.id)}
                              disabled={staffIndex === staffList.length - 1}
                              title="Move down"
                            >
                              &#9660;
                            </button>
                          </span>
                        )}
                        {staff.name}
                      </td>
                      {weekDays.map((day, dayIdx) => {
                        const morningShift = getShiftForCell(staff.id, day, 'morning');
                        const afternoonShift = getShiftForCell(staff.id, day, 'afternoon');
                        const leaveStatus = getLeaveStatus(staff.id, day);
                        const holidayInfo = getHolidayForDate(staff.id, day);
                        const absenceInfo = getAbsenceForDate(staff.id, day);

                        // Get day status info if exists
                        const dayStatusInfo = getDayStatusForDate(staff.id, day);

                        // Build cell classes including leave status
                        const getCellClass = (hasShift: boolean, shiftRole?: string) => {
                          let classes = 'rota-cell';
                          if (leaveStatus === 'holiday') classes += ' on-holiday';
                          else if (leaveStatus === 'absence') classes += ' on-absence';
                          else if (leaveStatus === 'unavailable') classes += ' on-unavailable';
                          else if (leaveStatus === 'day_off') classes += ' on-day-off';
                          if (hasShift && shiftRole && leaveStatus !== 'holiday' && leaveStatus !== 'absence') classes += ` shift-active ${getRoleColorClass(shiftRole)}`;
                          // Allow clicking in status mode even if there's a leave status (to toggle day statuses)
                          if (isManager && (isStatusAssignment || !leaveStatus || leaveStatus === 'unavailable' || leaveStatus === 'day_off')) {
                            classes += ' clickable';
                          }
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
                          if (leaveStatus === 'unavailable') {
                            return `Unavailable${dayStatusInfo?.notes ? `: ${dayStatusInfo.notes}` : ''} - Click to remove`;
                          }
                          if (leaveStatus === 'day_off') {
                            return `Day Off${dayStatusInfo?.notes ? `: ${dayStatusInfo.notes}` : ''} - Click to remove`;
                          }
                          if (isStatusAssignment) {
                            return `Click to set ${statusLabel}`;
                          }
                          if (shift) {
                            return `${enums?.shift_roles.find(r => r.value === shift.role)?.label || shift.role} - Click to remove`;
                          }
                          return `Click to add ${enums?.shift_roles.find(r => r.value === selectedRole)?.label || selectedRole}`;
                        };

                        // Check if cell should be clickable
                        const isCellClickable = (isManager && !loading && (
                          isStatusAssignment ||
                          !leaveStatus ||
                          leaveStatus === 'unavailable' ||
                          leaveStatus === 'day_off'
                        ));

                        return (
                          <React.Fragment key={dayIdx}>
                            <td
                              className={getCellClass(!!morningShift, morningShift?.role)}
                              onClick={() => isCellClickable && onCellClick(staff.id, day, 'morning')}
                              title={getCellTitle(morningShift)}
                            >
                              {leaveStatus === 'holiday' && <span className="leave-marker">H</span>}
                              {leaveStatus === 'absence' && <span className="leave-marker absence">A</span>}
                              {leaveStatus === 'unavailable' && !morningShift && <span className="leave-marker unavailable">U</span>}
                              {leaveStatus === 'day_off' && !morningShift && <span className="leave-marker day-off">O</span>}
                              {morningShift && leaveStatus !== 'holiday' && leaveStatus !== 'absence' && <span className="shift-marker">{getRoleAbbrev(morningShift.role)}</span>}
                            </td>
                            <td
                              className={getCellClass(!!afternoonShift, afternoonShift?.role)}
                              onClick={() => isCellClickable && onCellClick(staff.id, day, 'afternoon')}
                              title={getCellTitle(afternoonShift)}
                            >
                              {leaveStatus === 'holiday' && <span className="leave-marker">H</span>}
                              {leaveStatus === 'absence' && <span className="leave-marker absence">A</span>}
                              {leaveStatus === 'unavailable' && !afternoonShift && <span className="leave-marker unavailable">U</span>}
                              {leaveStatus === 'day_off' && !afternoonShift && <span className="leave-marker day-off">O</span>}
                              {afternoonShift && leaveStatus !== 'holiday' && leaveStatus !== 'absence' && <span className="shift-marker">{getRoleAbbrev(afternoonShift.role)}</span>}
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
            <span className="legend-item"><span className="legend-box on-absence"></span> A = Sick/Absent</span>
            <span className="legend-item"><span className="legend-box on-unavailable"></span> U = Unavailable</span>
            <span className="legend-item"><span className="legend-box on-day-off"></span> O = Day Off</span>
            {isManager && (
              <span className="legend-hint">
                Select option above, then click cells to assign
              </span>
            )}
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
                      <button className="btn-danger btn-sm" onClick={() => onDeleteShift(shift.id)}>
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
  );
}

interface TimesheetsTabProps {
  timesheets: TimesheetsListResponse | null;
  enums: StaffManagementEnums | null;
  user: User | null;
  isManager: boolean;
  staffList: User[];
  timesheetStaffFilter: number;
  setTimesheetStaffFilter: (id: number) => void;
  onOpenModal: () => void;
  onSubmit: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  formatDate: (dateStr: string) => string;
  formatTime: (timeStr: string) => string;
  getStatusClass: (status: string) => string;
}

function TimesheetsTab({
  timesheets,
  enums,
  user,
  isManager,
  staffList,
  timesheetStaffFilter,
  setTimesheetStaffFilter,
  onOpenModal,
  onSubmit,
  onApprove,
  onReject,
  formatDate,
  formatTime,
  getStatusClass,
}: TimesheetsTabProps) {
  // Filter timesheets based on staff selection
  const filteredTimesheets = timesheets?.timesheets.filter(
    ts => timesheetStaffFilter === 0 || ts.staff_id === timesheetStaffFilter
  ) || [];

  return (
    <div className="timesheets-view">
      <div className="tab-actions">
        {isManager && (
          <div className="filter-group">
            <label>Filter by Staff:</label>
            <select
              value={timesheetStaffFilter}
              onChange={(e) => setTimesheetStaffFilter(parseInt(e.target.value))}
              className="staff-filter"
            >
              <option value={0}>All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <button className="ds-btn ds-btn-primary" onClick={onOpenModal}>
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
            {filteredTimesheets.map((ts) => (
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
                    <button className="ds-btn ds-btn-primary btn-sm" onClick={() => onSubmit(ts.id)}>
                      Submit
                    </button>
                  )}
                  {ts.status === 'submitted' && isManager && (
                    <>
                      <button className="btn-success btn-sm" onClick={() => onApprove(ts.id)}>
                        Approve
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => onReject(ts.id)}>
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {filteredTimesheets.length === 0 && (
              <tr><td colSpan={isManager ? 11 : 9} className="empty">No timesheets</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface HolidaysTabProps {
  holidays: HolidayRequestsListResponse | null;
  enums: StaffManagementEnums | null;
  user: User | null;
  isManager: boolean;
  onOpenModal: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onCancel: (id: number) => void;
  formatDate: (dateStr: string) => string;
}

function HolidaysTab({
  holidays,
  enums,
  user,
  isManager,
  onOpenModal,
  onApprove,
  onReject,
  onCancel,
  formatDate,
}: HolidaysTabProps) {
  // Check if two date ranges overlap
  const datesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
    return start1 <= end2 && end1 >= start2;
  };

  // Calculate overlap count for each approved holiday
  const getOverlapCount = (holiday: HolidayRequest): number => {
    if (!holidays?.approved) return 0;
    return holidays.approved.filter(
      h => h.id !== holiday.id && datesOverlap(holiday.start_date, holiday.end_date, h.start_date, h.end_date)
    ).length;
  };

  // Get CSS class based on overlap count
  const getOverlapClass = (overlapCount: number): string => {
    if (overlapCount >= 2) return 'overlap-danger';
    if (overlapCount === 1) return 'overlap-warning';
    return '';
  };

  return (
    <div className="holidays-view">
      <div className="tab-actions">
        <button className="ds-btn ds-btn-primary" onClick={onOpenModal}>
          {isManager ? 'Add Leave' : 'Request Holiday'}
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
                      <button className="btn-success btn-sm" onClick={() => onApprove(h.id)}>
                        Approve
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => onReject(h.id)}>
                        Reject
                      </button>
                    </>
                  ) : h.staff_id === user?.id && (
                    <button className="ds-btn ds-btn-secondary btn-sm" onClick={() => onCancel(h.id)}>
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
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {holidays?.approved.map((h) => {
              const overlapCount = getOverlapCount(h);
              const overlapClass = getOverlapClass(overlapCount);
              return (
                <tr key={h.id} className={overlapClass}>
                  {isManager && <td>{h.staff_name}</td>}
                  <td>
                    {formatDate(h.start_date)} - {formatDate(h.end_date)}
                    {overlapCount > 0 && (
                      <span className={`overlap-indicator ${overlapCount >= 2 ? 'danger' : 'warning'}`}>
                        {overlapCount + 1} off
                      </span>
                    )}
                  </td>
                  <td>{h.days_requested}</td>
                  <td>{enums?.leave_types.find(t => t.value === h.leave_type)?.label || h.leave_type}</td>
                  <td>{h.approved_by_name || '-'}</td>
                  {isManager && (
                    <td className="action-buttons">
                      <button className="btn-danger btn-sm" onClick={() => onCancel(h.id)}>
                        Cancel
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {holidays?.approved.length === 0 && (
              <tr><td colSpan={isManager ? 6 : 4} className="empty">No approved holidays</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface SickLeaveTabProps {
  sickLeave: SickLeaveListResponse | null;
  staffList: User[];
  absenceStaffFilter: number;
  setAbsenceStaffFilter: (id: number) => void;
  isManager: boolean;
  onOpenModal: () => void;
  onEdit: (record: SickLeaveRecord) => void;
  onDelete: (id: number) => void;
  formatDate: (dateStr: string) => string;
  formatTime: (timeStr: string) => string;
}

function SickLeaveTab({
  sickLeave,
  staffList,
  absenceStaffFilter,
  setAbsenceStaffFilter,
  isManager,
  onOpenModal,
  onEdit,
  onDelete,
  formatDate,
  formatTime,
}: SickLeaveTabProps) {
  return (
    <div className="sick-leave-view">
      {/* Summary Stats for Admin */}
      {isManager && sickLeave && (
        <div className="absence-stats">
          <div className="stat-card">
            <div className="stat-value">{sickLeave.records.length}</div>
            <div className="stat-label">Total Absences</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">
              {sickLeave.records.filter(r => !r.actual_return).length}
            </div>
            <div className="stat-label">Currently Off</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {(() => {
                const reasons = sickLeave.records.map(r => r.reason || 'sickness');
                const counts: Record<string, number> = {};
                reasons.forEach(r => { counts[r] = (counts[r] || 0) + 1; });
                const mostCommon = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                return mostCommon ? mostCommon[0].replace('_', ' ') : '-';
              })()}
            </div>
            <div className="stat-label">Most Common</div>
          </div>
        </div>
      )}

      {isManager && (
        <div className="tab-actions">
          <div className="filter-group">
            <label>Filter by Staff:</label>
            <select
              value={absenceStaffFilter}
              onChange={(e) => setAbsenceStaffFilter(parseInt(e.target.value))}
              className="staff-filter"
            >
              <option value={0}>All Staff</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <button className="ds-btn ds-btn-primary" onClick={onOpenModal}>
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
              {isManager && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {sickLeave?.records
              .filter(r => absenceStaffFilter === 0 || r.staff_id === absenceStaffFilter)
              .map((r) => (
              <tr key={r.id}>
                {isManager && <td>{r.staff_name}</td>}
                <td>{formatDate(r.date)}</td>
                <td>{r.reason ? r.reason.replace('_', ' ') : 'Sickness'}</td>
                <td>{r.reported_time ? formatTime(r.reported_time) : '-'}</td>
                <td>{r.expected_return ? formatDate(r.expected_return) : '-'}</td>
                <td>{r.actual_return ? formatDate(r.actual_return) : 'Not returned'}</td>
                <td>{r.notes || '-'}</td>
                {isManager && (
                  <td className="action-buttons">
                    <button className="ds-btn ds-btn-secondary btn-sm" onClick={() => onEdit(r)}>Edit</button>
                    <button className="ds-btn ds-btn-danger btn-sm" onClick={() => onDelete(r.id)}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
            {(sickLeave?.records.filter(r => absenceStaffFilter === 0 || r.staff_id === absenceStaffFilter).length === 0) && (
              <tr><td colSpan={isManager ? 9 : 7} className="empty">No absence records</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface LeaveSummaryTabProps {
  leaveSummary: AllStaffLeaveSummary | null;
  leaveYear: number;
  setLeaveYear: (year: number) => void;
}

function LeaveSummaryTab({
  leaveSummary,
  leaveYear,
  setLeaveYear,
}: LeaveSummaryTabProps) {
  return (
    <div className="leave-summary-view">
      <div className="tab-actions">
        <select
          value={leaveYear}
          onChange={(e) => setLeaveYear(parseInt(e.target.value))}
          className="year-selector"
        >
          {[leaveYear - 1, leaveYear, leaveYear + 1].map(year => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </div>

      <div className="data-table">
        <table>
          <thead>
            <tr>
              <th>Staff</th>
              <th>Type</th>
              <th>Entitlement</th>
              <th>Taken</th>
              <th>Pending</th>
              <th>Remaining</th>
              <th>Absences</th>
            </tr>
          </thead>
          <tbody>
            {leaveSummary?.staff_summaries.map((s) => {
              const isLowBalance = s.annual_leave_remaining !== null &&
                                   s.annual_leave_remaining !== undefined &&
                                   s.annual_leave_remaining < 5;
              const isZeroBalance = s.annual_leave_remaining !== null &&
                                    s.annual_leave_remaining !== undefined &&
                                    s.annual_leave_remaining <= 0;
              return (
                <tr key={s.staff_id}>
                  <td><strong>{s.staff_name}</strong></td>
                  <td>{s.staff_type || '-'}</td>
                  <td>{s.annual_leave_entitlement ?? 'N/A'}</td>
                  <td>{s.annual_leave_taken}</td>
                  <td>{s.annual_leave_pending > 0 ? s.annual_leave_pending : '-'}</td>
                  <td className={isZeroBalance ? 'balance-zero' : isLowBalance ? 'balance-low' : ''}>
                    {s.annual_leave_remaining ?? 'N/A'}
                  </td>
                  <td className={s.unplanned_absences_this_year > 3 ? 'absence-high' : ''}>
                    {s.unplanned_absences_this_year}
                  </td>
                </tr>
              );
            })}
            {(!leaveSummary || leaveSummary.staff_summaries.length === 0) && (
              <tr><td colSpan={7} className="empty">No staff leave data available</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="leave-summary-legend">
        <span className="legend-item">
          <span className="legend-box balance-low"></span> Low balance (&lt; 5 days)
        </span>
        <span className="legend-item">
          <span className="legend-box balance-zero"></span> No remaining balance
        </span>
        <span className="legend-item">
          <span className="legend-box absence-high"></span> High absences (&gt; 3)
        </span>
      </div>
    </div>
  );
}

interface PayrollTabProps {
  payrollSummary: PayrollSummaryResponse | null;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  loading: boolean;
  staffList: User[];
  loadTabData: () => void;
}

function PayrollTab({
  payrollSummary,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  loading,
  staffList,
  loadTabData,
}: PayrollTabProps) {
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState<PayrollAdjustmentCreate>({
    staff_id: 0,
    adjustment_type: 'oneoff',
    amount: 0,
    description: '',
    payment_date: new Date().toISOString().split('T')[0],
    taxable: true,
  });
  const [adjustmentError, setAdjustmentError] = useState('');

  const handleCreateAdjustment = async () => {
    try {
      setAdjustmentError('');
      if (!adjustmentForm.staff_id) {
        setAdjustmentError('Please select a staff member');
        return;
      }
      if (!adjustmentForm.amount || adjustmentForm.amount <= 0) {
        setAdjustmentError('Please enter a valid amount');
        return;
      }
      if (!adjustmentForm.description.trim()) {
        setAdjustmentError('Please enter a description');
        return;
      }
      await staffApi.createPayrollAdjustment(adjustmentForm);
      setShowAdjustmentModal(false);
      setAdjustmentForm({
        staff_id: 0,
        adjustment_type: 'oneoff',
        amount: 0,
        description: '',
        payment_date: new Date().toISOString().split('T')[0],
        taxable: true,
      });
      loadTabData();
    } catch {
      setAdjustmentError('Failed to create adjustment');
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  return (
    <div className="payroll-view">
      <div className="payroll-toolbar">
        <div className="period-selector">
          <label className="date-range-label">From</label>
          <input
            type="date"
            className="ds-input"
            value={startDate}
            onChange={(e) => {
              const newStart = e.target.value;
              setStartDate(newStart);
              if (newStart > endDate) {
                setEndDate(newStart);
              }
            }}
          />
          <label className="date-range-label">To</label>
          <input
            type="date"
            className="ds-input"
            value={endDate}
            min={startDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <button
          className="ds-btn ds-btn-primary"
          onClick={() => setShowAdjustmentModal(true)}
        >
          Add Adjustment
        </button>
      </div>

      {loading && <div className="ds-loading">Loading payroll data...</div>}

      {!loading && payrollSummary && (
        <>
          <div className="payroll-header">
            <h3>{payrollSummary.period_label}</h3>
          </div>

          <div className="payroll-summary-cards">
            <div className="summary-card">
              <div className="summary-value">{payrollSummary.total_approved_hours.toFixed(2)}</div>
              <div className="summary-label">Total Hours</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{formatCurrency(payrollSummary.total_base_pay)}</div>
              <div className="summary-label">Earned Pay</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{formatCurrency(payrollSummary.total_holiday_pay)}</div>
              <div className="summary-label">Holiday Pay</div>
            </div>
            <div className="summary-card">
              <div className="summary-value">{formatCurrency(payrollSummary.total_adjustments)}</div>
              <div className="summary-label">Adjustments</div>
            </div>
            <div className="summary-card highlight">
              <div className="summary-value">{formatCurrency(payrollSummary.total_pay)}</div>
              <div className="summary-label">Total Pay</div>
            </div>
          </div>

          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Type</th>
                  <th>Hourly Rate</th>
                  <th>Hours</th>
                  <th>Earned Pay</th>
                  <th>Hol. Hours</th>
                  <th>Hol. Pay</th>
                  <th>One-off</th>
                  <th>Taxable</th>
                  <th className="tips-header">Tips<span className="tax-free-label">Tax-free</span></th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {payrollSummary.staff_summaries.map((s) => (
                  <tr key={s.staff_id}>
                    <td><strong>{s.staff_name}</strong></td>
                    <td>{s.staff_type || '-'}</td>
                    <td>{formatCurrency(s.hourly_rate || 0)}</td>
                    <td>{s.approved_hours.toFixed(2)}</td>
                    <td>{formatCurrency(s.base_pay)}</td>
                    <td>{s.holiday_hours.toFixed(2)}</td>
                    <td>{formatCurrency(s.holiday_pay)}</td>
                    <td>{formatCurrency(s.adjustments.oneoff_total)}</td>
                    <td>{formatCurrency(s.taxable_pay)}</td>
                    <td className={s.adjustments.tips_total > 0 ? 'tips-cell has-tips' : 'tips-cell'}>
                      {formatCurrency(s.adjustments.tips_total)}
                    </td>
                    <td><strong>{formatCurrency(s.total_pay)}</strong></td>
                  </tr>
                ))}
                {payrollSummary.staff_summaries.length === 0 && (
                  <tr><td colSpan={11} className="empty">No payroll data for this period</td></tr>
                )}
              </tbody>
              {payrollSummary.staff_summaries.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3}><strong>Totals</strong></td>
                    <td><strong>{payrollSummary.total_approved_hours.toFixed(2)}</strong></td>
                    <td><strong>{formatCurrency(payrollSummary.total_base_pay)}</strong></td>
                    <td><strong>{payrollSummary.total_holiday_hours.toFixed(2)}</strong></td>
                    <td><strong>{formatCurrency(payrollSummary.total_holiday_pay)}</strong></td>
                    <td colSpan={3}><strong>{formatCurrency(payrollSummary.total_adjustments)}</strong></td>
                    <td><strong>{formatCurrency(payrollSummary.total_pay)}</strong></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="payroll-notes">
            <p><strong>Note:</strong> Holiday pay is calculated from approved annual leave (full day = 8 hours, half day = 4 hours). Tips are shown separately as they are tax-free. Taxable pay includes base pay, holiday pay, and taxable one-off payments.</p>
          </div>
        </>
      )}

      {/* Add Adjustment Modal */}
      <Modal
        isOpen={showAdjustmentModal}
        onClose={() => setShowAdjustmentModal(false)}
        title="Add Payroll Adjustment"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => setShowAdjustmentModal(false)}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleCreateAdjustment}>Add Adjustment</button>
          </>
        }
      >
        {adjustmentError && <div className="ds-alert ds-alert-error">{adjustmentError}</div>}

        <FormGroup label="Staff Member" required>
          <Select
            value={adjustmentForm.staff_id}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, staff_id: parseInt(e.target.value) })}
            required
          >
            <option value={0}>Select staff...</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormRow>
          <FormGroup label="Type" required>
            <Select
              value={adjustmentForm.adjustment_type}
              onChange={(e) => {
                const type = e.target.value as 'oneoff' | 'tip';
                setAdjustmentForm({
                  ...adjustmentForm,
                  adjustment_type: type,
                  taxable: type !== 'tip', // Tips are tax-free
                });
              }}
              required
            >
              <option value="oneoff">One-off Payment</option>
              <option value="tip">Tip (Tax-free)</option>
            </Select>
          </FormGroup>
          <FormGroup label="Amount (£)" required>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={adjustmentForm.amount || ''}
              onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: parseFloat(e.target.value) || 0 })}
              required
            />
          </FormGroup>
        </FormRow>

        <FormGroup label="Payment Date" required>
          <Input
            type="date"
            value={adjustmentForm.payment_date}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, payment_date: e.target.value })}
            required
          />
        </FormGroup>

        <FormGroup label="Description" required>
          <Input
            type="text"
            value={adjustmentForm.description}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, description: e.target.value })}
            placeholder="e.g., Christmas bonus, Event overtime, Tip from John Smith"
            required
          />
        </FormGroup>

        <FormGroup label="Notes">
          <Textarea
            value={adjustmentForm.notes || ''}
            onChange={(e) => setAdjustmentForm({ ...adjustmentForm, notes: e.target.value })}
            rows={2}
          />
        </FormGroup>

        {adjustmentForm.adjustment_type === 'tip' && (
          <div className="ds-alert ds-alert-info">
            Tips are recorded as tax-free income.
          </div>
        )}
      </Modal>

    </div>
  );
}
