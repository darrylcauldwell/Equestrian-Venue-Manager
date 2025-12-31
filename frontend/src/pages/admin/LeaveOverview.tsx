import { useState, useEffect, useCallback, useMemo } from 'react';
import { staffApi } from '../../services/api';
import { Modal, FormGroup, Textarea } from '../../components/ui';
import type {
  HolidayRequest,
  HolidayRequestsListResponse,
  SickLeaveRecord,
  SickLeaveListResponse,
  AllStaffLeaveSummary,
  StaffLeaveSummary,
  StaffManagementEnums,
} from '../../types';
import './LeaveOverview.css';

// UK Public Holidays
const UK_PUBLIC_HOLIDAYS: { date: string; name: string }[] = [
  // 2025
  { date: '2025-01-01', name: 'New Year\'s Day' },
  { date: '2025-04-18', name: 'Good Friday' },
  { date: '2025-04-21', name: 'Easter Monday' },
  { date: '2025-05-05', name: 'Early May Bank Holiday' },
  { date: '2025-05-26', name: 'Spring Bank Holiday' },
  { date: '2025-08-25', name: 'Summer Bank Holiday' },
  { date: '2025-12-25', name: 'Christmas Day' },
  { date: '2025-12-26', name: 'Boxing Day' },
  // 2026
  { date: '2026-01-01', name: 'New Year\'s Day' },
  { date: '2026-04-03', name: 'Good Friday' },
  { date: '2026-04-06', name: 'Easter Monday' },
  { date: '2026-05-04', name: 'Early May Bank Holiday' },
  { date: '2026-05-25', name: 'Spring Bank Holiday' },
  { date: '2026-08-31', name: 'Summer Bank Holiday' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-28', name: 'Boxing Day (substitute)' },
];

type ActiveTab = 'overview' | 'pending' | 'calendar' | 'absences' | 'balances';

const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const formatDateShort = (dateStr: string): string => {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
};

// Get week dates for calendar view
const getWeekDates = (weekStart: Date): Date[] => {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
};

const getWeekStart = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function AdminLeaveOverview() {
  const today = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [holidays, setHolidays] = useState<HolidayRequestsListResponse | null>(null);
  const [absences, setAbsences] = useState<SickLeaveListResponse | null>(null);
  const [leaveSummary, setLeaveSummary] = useState<AllStaffLeaveSummary | null>(null);
  const [enums, setEnums] = useState<StaffManagementEnums | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Calendar state
  const [calendarWeekStart, setCalendarWeekStart] = useState<Date>(() => getWeekStart(new Date()));

  // Approval modal
  const [approvalModal, setApprovalModal] = useState<{ request: HolidayRequest; action: 'approve' | 'reject' } | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [holidaysRes, absencesRes, summaryRes, enumsRes] = await Promise.all([
        staffApi.listHolidays(),
        staffApi.listSickLeave(),
        staffApi.getLeaveSummary(selectedYear),
        staffApi.getEnums(),
      ]);

      setHolidays(holidaysRes);
      setAbsences(absencesRes);
      setLeaveSummary(summaryRes);
      setEnums(enumsRes);
    } catch (e) {
      setError('Failed to load leave data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getEnumLabel = (enumType: string, value: string): string => {
    if (!enums) return value;
    const enumList = enums[enumType as keyof StaffManagementEnums] as Array<{ value: string; label: string }>;
    const item = enumList?.find(e => e.value === value);
    return item?.label || value;
  };

  // Computed data
  const upcomingHolidays = useMemo(() => {
    if (!holidays) return [];
    return holidays.approved.filter(h => h.start_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  }, [holidays, today]);

  const staffOnLeaveToday = useMemo(() => {
    if (!holidays) return [];
    return holidays.approved.filter(h => h.start_date <= today && h.end_date >= today);
  }, [holidays, today]);

  const recentAbsences = useMemo(() => {
    if (!absences) return [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return absences.records
      .filter(a => new Date(a.date) >= thirtyDaysAgo)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [absences]);

  const staffWithLowBalance = useMemo(() => {
    if (!leaveSummary) return [];
    return leaveSummary.staff_summaries.filter(
      s => s.annual_leave_remaining !== null && s.annual_leave_remaining !== undefined && s.annual_leave_remaining < 5
    );
  }, [leaveSummary]);

  // Calendar data
  const calendarDates = useMemo(() => getWeekDates(calendarWeekStart), [calendarWeekStart]);

  const getStaffForDate = useCallback((dateStr: string) => {
    const onHoliday: HolidayRequest[] = [];
    const absent: SickLeaveRecord[] = [];
    const bankHoliday = UK_PUBLIC_HOLIDAYS.find(h => h.date === dateStr);

    if (holidays) {
      holidays.approved.forEach(h => {
        if (h.start_date <= dateStr && h.end_date >= dateStr) {
          onHoliday.push(h);
        }
      });
    }

    if (absences) {
      absences.records.forEach(a => {
        if (a.date === dateStr) {
          absent.push(a);
        } else if (a.date <= dateStr && a.expected_return && a.expected_return >= dateStr && !a.actual_return) {
          absent.push(a);
        }
      });
    }

    return { onHoliday, absent, bankHoliday };
  }, [holidays, absences]);

  const handleApproval = async () => {
    if (!approvalModal) return;

    setIsSubmitting(true);
    try {
      if (approvalModal.action === 'approve') {
        await staffApi.approveHoliday(approvalModal.request.id, approvalNotes || undefined);
        setSuccess('Holiday request approved');
      } else {
        await staffApi.rejectHoliday(approvalModal.request.id, approvalNotes);
        setSuccess('Holiday request rejected');
      }
      setApprovalModal(null);
      setApprovalNotes('');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError(`Failed to ${approvalModal.action} request`);
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const navigateCalendar = (direction: 'prev' | 'next') => {
    const newStart = new Date(calendarWeekStart);
    newStart.setDate(newStart.getDate() + (direction === 'prev' ? -7 : 7));
    setCalendarWeekStart(newStart);
  };

  if (loading) {
    return (
      <div className="leave-overview-page">
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading leave data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="leave-overview-page">
      <div className="page-header">
        <h1>Leave Overview</h1>
        <p>Manage staff holidays and view absence records</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="ds-alert ds-alert-success">{success}</div>}

      {/* Tab Navigation */}
      <div className="leave-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          Pending ({holidays?.pending.length || 0})
        </button>
        <button
          className={`tab-btn ${activeTab === 'calendar' ? 'active' : ''}`}
          onClick={() => setActiveTab('calendar')}
        >
          Calendar
        </button>
        <button
          className={`tab-btn ${activeTab === 'absences' ? 'active' : ''}`}
          onClick={() => setActiveTab('absences')}
        >
          Absences
        </button>
        <button
          className={`tab-btn ${activeTab === 'balances' ? 'active' : ''}`}
          onClick={() => setActiveTab('balances')}
        >
          Balances
        </button>
      </div>

      {/* Tab Content */}
      <div className="leave-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Quick Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{holidays?.pending.length || 0}</span>
                <span className="stat-label">Pending Requests</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{staffOnLeaveToday.length}</span>
                <span className="stat-label">Off Today</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{upcomingHolidays.length}</span>
                <span className="stat-label">Upcoming Holidays</span>
              </div>
              <div className="stat-card warning">
                <span className="stat-value">{staffWithLowBalance.length}</span>
                <span className="stat-label">Low Balance</span>
              </div>
            </div>

            {/* Staff Off Today */}
            {staffOnLeaveToday.length > 0 && (
              <div className="section">
                <h3>Staff Off Today</h3>
                <div className="staff-list">
                  {staffOnLeaveToday.map(h => (
                    <div key={h.id} className="staff-item">
                      <span className="staff-name">{h.staff_name}</span>
                      <span className="leave-type">{getEnumLabel('leave_types', h.leave_type)}</span>
                      <span className="leave-dates">
                        Until {formatDateShort(h.end_date)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending Requests Preview */}
            {holidays && holidays.pending.length > 0 && (
              <div className="section">
                <div className="section-header">
                  <h3>Pending Requests</h3>
                  <button className="ds-btn ds-btn-sm ds-btn-secondary" onClick={() => setActiveTab('pending')}>
                    View All
                  </button>
                </div>
                <div className="pending-list">
                  {holidays.pending.slice(0, 3).map(request => (
                    <div key={request.id} className="pending-card">
                      <div className="pending-info">
                        <strong>{request.staff_name}</strong>
                        <span className="dates">
                          {formatDateShort(request.start_date)} - {formatDateShort(request.end_date)}
                        </span>
                        <span className="days">{request.days_requested} day{request.days_requested !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="pending-actions">
                        <button
                          className="ds-btn ds-btn-sm ds-btn-success"
                          onClick={() => setApprovalModal({ request, action: 'approve' })}
                        >
                          Approve
                        </button>
                        <button
                          className="ds-btn ds-btn-sm ds-btn-danger"
                          onClick={() => setApprovalModal({ request, action: 'reject' })}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Holidays */}
            {upcomingHolidays.length > 0 && (
              <div className="section">
                <h3>Upcoming Holidays</h3>
                <div className="upcoming-list">
                  {upcomingHolidays.slice(0, 5).map(h => (
                    <div key={h.id} className="upcoming-item">
                      <div className="upcoming-date">
                        <span className="day">{new Date(h.start_date).getDate()}</span>
                        <span className="month">{new Date(h.start_date).toLocaleDateString('en-GB', { month: 'short' })}</span>
                      </div>
                      <div className="upcoming-info">
                        <strong>{h.staff_name}</strong>
                        <span>{formatDateShort(h.start_date)} - {formatDateShort(h.end_date)}</span>
                      </div>
                      <span className="ds-badge ds-badge-info">{h.days_requested} days</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Absences */}
            {recentAbsences.length > 0 && (
              <div className="section">
                <h3>Recent Absences (Last 30 Days)</h3>
                <div className="absence-list">
                  {recentAbsences.slice(0, 5).map(a => (
                    <div key={a.id} className="absence-item">
                      <span className="staff-name">{a.staff_name}</span>
                      <span className="absence-date">{formatDate(a.date)}</span>
                      <span className="absence-reason">{a.reason || 'Not specified'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending Tab */}
        {activeTab === 'pending' && (
          <div className="pending-tab">
            <h2>Pending Holiday Requests</h2>
            {!holidays || holidays.pending.length === 0 ? (
              <div className="empty-state">
                <p>No pending requests</p>
              </div>
            ) : (
              <div className="ds-table-wrapper">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Type</th>
                      <th>Reason</th>
                      <th>Submitted</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {holidays.pending.map(request => (
                      <tr key={request.id}>
                        <td><strong>{request.staff_name}</strong></td>
                        <td>{formatDateShort(request.start_date)} - {formatDateShort(request.end_date)}</td>
                        <td>{request.days_requested}</td>
                        <td>{getEnumLabel('leave_types', request.leave_type)}</td>
                        <td>{request.reason || '—'}</td>
                        <td>{formatDate(request.created_at)}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="ds-btn ds-btn-sm ds-btn-success"
                              onClick={() => setApprovalModal({ request, action: 'approve' })}
                            >
                              Approve
                            </button>
                            <button
                              className="ds-btn ds-btn-sm ds-btn-danger"
                              onClick={() => setApprovalModal({ request, action: 'reject' })}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="calendar-tab">
            <div className="calendar-header">
              <button className="ds-btn ds-btn-secondary" onClick={() => navigateCalendar('prev')}>
                &larr; Prev
              </button>
              <h2>
                Week of {calendarWeekStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </h2>
              <button className="ds-btn ds-btn-secondary" onClick={() => navigateCalendar('next')}>
                Next &rarr;
              </button>
            </div>

            <div className="calendar-grid">
              {calendarDates.map(date => {
                const dateStr = date.toISOString().split('T')[0];
                const { onHoliday, absent, bankHoliday } = getStaffForDate(dateStr);
                const isToday = dateStr === today;
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;

                return (
                  <div
                    key={dateStr}
                    className={`calendar-day ${isToday ? 'today' : ''} ${isWeekend ? 'weekend' : ''} ${bankHoliday ? 'bank-holiday' : ''}`}
                  >
                    <div className="day-header">
                      <span className="day-name">{date.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
                      <span className="day-number">{date.getDate()}</span>
                    </div>
                    <div className="day-content">
                      {bankHoliday && (
                        <div className="bank-holiday-badge">{bankHoliday.name}</div>
                      )}
                      {onHoliday.map(h => (
                        <div key={h.id} className="staff-badge holiday">
                          {h.staff_name}
                        </div>
                      ))}
                      {absent.map(a => (
                        <div key={a.id} className="staff-badge absent">
                          {a.staff_name} (Absent)
                        </div>
                      ))}
                      {onHoliday.length === 0 && absent.length === 0 && !bankHoliday && (
                        <span className="no-leave">Full team</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="calendar-legend">
              <span className="legend-item"><span className="legend-box holiday"></span> On Holiday</span>
              <span className="legend-item"><span className="legend-box absent"></span> Absent</span>
              <span className="legend-item"><span className="legend-box bank"></span> Bank Holiday</span>
            </div>
          </div>
        )}

        {/* Absences Tab */}
        {activeTab === 'absences' && (
          <div className="absences-tab">
            <h2>All Absences</h2>
            {!absences || absences.records.length === 0 ? (
              <div className="empty-state">
                <p>No absence records</p>
              </div>
            ) : (
              <div className="ds-table-wrapper">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Expected Return</th>
                      <th>Actual Return</th>
                      <th>Fit Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absences.records.map(absence => (
                      <tr key={absence.id}>
                        <td><strong>{absence.staff_name}</strong></td>
                        <td>{formatDate(absence.date)}</td>
                        <td>{absence.reason || '—'}</td>
                        <td>{formatDate(absence.expected_return)}</td>
                        <td>{formatDate(absence.actual_return)}</td>
                        <td>
                          {absence.has_fit_note ? (
                            <span className="ds-badge ds-badge-info">Yes</span>
                          ) : (
                            <span className="ds-badge ds-badge-secondary">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Balances Tab */}
        {activeTab === 'balances' && (
          <div className="balances-tab">
            <div className="balances-header">
              <h2>Staff Leave Balances</h2>
              <select
                className="ds-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{ width: 'auto' }}
              >
                {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {leaveSummary && (leaveSummary.leave_year_start || leaveSummary.leave_year_end) && (
              <p className="leave-year-info">
                Leave Year: {formatDate(leaveSummary.leave_year_start)} - {formatDate(leaveSummary.leave_year_end)}
              </p>
            )}

            {!leaveSummary || leaveSummary.staff_summaries.length === 0 ? (
              <div className="empty-state">
                <p>No staff data available</p>
              </div>
            ) : (
              <div className="ds-table-wrapper">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Staff Type</th>
                      <th>Entitlement</th>
                      <th>Days Taken</th>
                      <th>Days Booked</th>
                      <th>Awaiting Approval</th>
                      <th>Days Remaining</th>
                      <th>Unplanned Absences</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveSummary.staff_summaries.map((staff: StaffLeaveSummary) => {
                      const hasProrata = staff.prorata_entitlement !== null &&
                        staff.prorata_entitlement !== undefined &&
                        staff.annual_leave_entitlement !== null &&
                        staff.annual_leave_entitlement !== undefined &&
                        staff.prorata_entitlement !== staff.annual_leave_entitlement;
                      return (
                      <tr key={staff.staff_id} className={staff.annual_leave_remaining !== null && staff.annual_leave_remaining !== undefined && staff.annual_leave_remaining < 5 ? 'low-balance' : ''}>
                        <td><strong>{staff.staff_name}</strong></td>
                        <td>{staff.staff_type || 'Regular'}</td>
                        <td>
                          {hasProrata ? (
                            <span title={`Pro-rata: ${staff.prorata_entitlement} of ${staff.annual_leave_entitlement} days`}>
                              <strong>{staff.prorata_entitlement}</strong>
                              <span style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}> / {staff.annual_leave_entitlement}</span>
                            </span>
                          ) : (
                            staff.annual_leave_entitlement ?? '—'
                          )}
                        </td>
                        <td>{staff.annual_leave_taken}</td>
                        <td>
                          {staff.annual_leave_upcoming > 0 ? (
                            <span className="booked">{staff.annual_leave_upcoming}</span>
                          ) : 0}
                        </td>
                        <td>
                          {staff.annual_leave_pending > 0 ? (
                            <span className="awaiting">{staff.annual_leave_pending}</span>
                          ) : 0}
                        </td>
                        <td>
                          {staff.annual_leave_remaining !== null && staff.annual_leave_remaining !== undefined ? (
                            <span className={staff.annual_leave_remaining < 5 ? 'low' : ''}>
                              {staff.annual_leave_remaining}
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <span className={staff.unplanned_absences_this_year > 3 ? 'high' : ''}>
                            {staff.unplanned_absences_this_year}
                          </span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Approval Modal */}
      <Modal
        isOpen={!!approvalModal}
        onClose={() => {
          setApprovalModal(null);
          setApprovalNotes('');
        }}
        title={approvalModal?.action === 'approve' ? 'Approve Holiday Request' : 'Reject Holiday Request'}
        footer={
          <>
            <button
              className="ds-btn ds-btn-secondary"
              onClick={() => {
                setApprovalModal(null);
                setApprovalNotes('');
              }}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className={`ds-btn ${approvalModal?.action === 'approve' ? 'ds-btn-success' : 'ds-btn-danger'}`}
              onClick={handleApproval}
              disabled={isSubmitting || (approvalModal?.action === 'reject' && !approvalNotes)}
            >
              {isSubmitting ? 'Processing...' : approvalModal?.action === 'approve' ? 'Approve' : 'Reject'}
            </button>
          </>
        }
      >
        {approvalModal && (
          <>
            <div className="approval-details">
              <p><strong>Staff:</strong> {approvalModal.request.staff_name}</p>
              <p><strong>Dates:</strong> {formatDate(approvalModal.request.start_date)} - {formatDate(approvalModal.request.end_date)}</p>
              <p><strong>Days:</strong> {approvalModal.request.days_requested}</p>
              <p><strong>Type:</strong> {getEnumLabel('leave_types', approvalModal.request.leave_type)}</p>
              {approvalModal.request.reason && (
                <p><strong>Reason:</strong> {approvalModal.request.reason}</p>
              )}
            </div>

            <FormGroup label={approvalModal.action === 'reject' ? 'Rejection Reason (required)' : 'Notes (optional)'}>
              <Textarea
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                rows={3}
                placeholder={approvalModal.action === 'reject' ? 'Please provide a reason for rejection...' : 'Add any notes...'}
                required={approvalModal.action === 'reject'}
              />
            </FormGroup>
          </>
        )}
      </Modal>
    </div>
  );
}
