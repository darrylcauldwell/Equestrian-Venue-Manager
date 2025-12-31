import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { staffApi } from '../services/api';
import { Modal, FormGroup, FormRow, Input, Textarea } from '../components/ui';
import type {
  HolidayRequestsListResponse,
  SickLeaveListResponse,
  StaffLeaveSummary,
  CreateHolidayRequest,
  StaffManagementEnums,
} from '../types';
import './MyLeave.css';

// UK Public Holidays for 2024-2026
const UK_PUBLIC_HOLIDAYS: { date: string; name: string }[] = [
  // 2024
  { date: '2024-01-01', name: 'New Year\'s Day' },
  { date: '2024-03-29', name: 'Good Friday' },
  { date: '2024-04-01', name: 'Easter Monday' },
  { date: '2024-05-06', name: 'Early May Bank Holiday' },
  { date: '2024-05-27', name: 'Spring Bank Holiday' },
  { date: '2024-08-26', name: 'Summer Bank Holiday' },
  { date: '2024-12-25', name: 'Christmas Day' },
  { date: '2024-12-26', name: 'Boxing Day' },
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

type ActiveTab = 'overview' | 'request' | 'upcoming' | 'history' | 'absences' | 'bank-holidays';

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
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

export default function MyLeave() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Data states
  const [holidays, setHolidays] = useState<HolidayRequestsListResponse | null>(null);
  const [absences, setAbsences] = useState<SickLeaveListResponse | null>(null);
  const [leaveSummary, setLeaveSummary] = useState<StaffLeaveSummary | null>(null);
  const [enums, setEnums] = useState<StaffManagementEnums | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Request form state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState<CreateHolidayRequest>({
    start_date: '',
    end_date: '',
    days_requested: 1,
    leave_type: 'annual',
    reason: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const [holidaysRes, absencesRes, summaryRes, enumsRes] = await Promise.all([
        staffApi.listHolidays(user.id),
        staffApi.listSickLeave(user.id),
        staffApi.getLeaveSummary(selectedYear),
        staffApi.getEnums(),
      ]);

      setHolidays(holidaysRes);
      setAbsences(absencesRes);
      setEnums(enumsRes);

      const mySummary = summaryRes.staff_summaries.find(s => s.staff_id === user.id);
      setLeaveSummary(mySummary || null);
    } catch (e) {
      setError('Failed to load leave data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter holidays
  const myHolidays = useMemo(() => {
    if (!holidays || !user?.id) return { pending: [], approved: [], rejected: [] };
    return {
      pending: holidays.pending.filter(h => h.staff_id === user.id),
      approved: holidays.approved.filter(h => h.staff_id === user.id),
      rejected: holidays.rejected.filter(h => h.staff_id === user.id),
    };
  }, [holidays, user?.id]);

  const upcomingHolidays = useMemo(() => {
    return myHolidays.approved.filter(h => h.start_date >= today);
  }, [myHolidays.approved, today]);

  const pastHolidays = useMemo(() => {
    return myHolidays.approved.filter(h => h.end_date < today);
  }, [myHolidays.approved, today]);

  const myAbsences = useMemo(() => {
    if (!absences || !user?.id) return [];
    return absences.records.filter(a => a.staff_id === user.id);
  }, [absences, user?.id]);

  const upcomingBankHolidays = useMemo(() => {
    return UK_PUBLIC_HOLIDAYS.filter(h => h.date >= today && h.date.startsWith(selectedYear.toString()));
  }, [today, selectedYear]);

  const getEnumLabel = (enumType: string, value: string): string => {
    if (!enums) return value;
    const enumList = enums[enumType as keyof StaffManagementEnums] as Array<{ value: string; label: string }>;
    const item = enumList?.find(e => e.value === value);
    return item?.label || value;
  };

  const calculateDays = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  };

  const handleFormChange = (field: keyof CreateHolidayRequest, value: string | number) => {
    setRequestForm(prev => {
      const updated = { ...prev, [field]: value };
      // When start date changes, auto-set end date to same day (makes calendar open to right month)
      if (field === 'start_date' && value && !prev.end_date) {
        updated.end_date = value as string;
      }
      // If start date is set after end date, adjust end date
      if (field === 'start_date' && value && prev.end_date && value > prev.end_date) {
        updated.end_date = value as string;
      }
      // Auto-calculate days when dates change
      if (field === 'start_date' || field === 'end_date') {
        if (updated.start_date && updated.end_date) {
          updated.days_requested = calculateDays(updated.start_date, updated.end_date);
        }
      }
      return updated;
    });
  };

  const handleSubmitRequest = async () => {
    if (!requestForm.start_date || !requestForm.end_date) {
      setError('Please select start and end dates');
      return;
    }

    if (requestForm.start_date > requestForm.end_date) {
      setError('End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await staffApi.createHoliday(requestForm);
      setSuccess('Holiday request submitted successfully');
      setShowRequestModal(false);
      setRequestForm({
        start_date: '',
        end_date: '',
        days_requested: 1,
        leave_type: 'annual',
        reason: '',
      });
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('Failed to submit holiday request');
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm('Are you sure you want to cancel this holiday request?')) return;

    try {
      await staffApi.cancelHoliday(requestId);
      setSuccess('Holiday request cancelled');
      await loadData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      setError('Failed to cancel request');
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="my-leave-page">
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading leave data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-leave-page">
      <div className="page-header">
        <div className="header-content">
          <h1>My Leave</h1>
          <p>Manage your holidays and view absence records</p>
        </div>
        <button
          className="ds-btn ds-btn-primary"
          onClick={() => setShowRequestModal(true)}
        >
          Request Holiday
        </button>
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
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          Upcoming ({upcomingHolidays.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          History
        </button>
        <button
          className={`tab-btn ${activeTab === 'absences' ? 'active' : ''}`}
          onClick={() => setActiveTab('absences')}
        >
          Absences ({myAbsences.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'bank-holidays' ? 'active' : ''}`}
          onClick={() => setActiveTab('bank-holidays')}
        >
          Bank Holidays
        </button>
      </div>

      {/* Tab Content */}
      <div className="leave-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Leave Balance Card */}
            <div className="leave-balance-card">
              <div className="balance-header">
                <h2>Leave Balance</h2>
                <select
                  className="ds-select"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              {leaveSummary ? (
                <>
                  {leaveSummary.annual_leave_entitlement !== null && leaveSummary.annual_leave_entitlement !== undefined ? (
                    <>
                      <div className="entitlement-row">
                        <span>Annual Entitlement:</span>
                        <strong>{leaveSummary.annual_leave_entitlement} days</strong>
                      </div>

                      <div className="leave-progress">
                        <div className="progress-bar">
                          <div
                            className="progress-taken"
                            style={{ width: `${Math.min(100, (leaveSummary.annual_leave_taken / leaveSummary.annual_leave_entitlement) * 100)}%` }}
                          />
                          <div
                            className="progress-pending"
                            style={{
                              width: `${Math.min(100 - (leaveSummary.annual_leave_taken / leaveSummary.annual_leave_entitlement) * 100, (leaveSummary.annual_leave_pending / leaveSummary.annual_leave_entitlement) * 100)}%`
                            }}
                          />
                        </div>
                      </div>

                      <div className="balance-stats">
                        <div className="stat taken">
                          <span className="stat-value">{leaveSummary.annual_leave_taken}</span>
                          <span className="stat-label">Taken</span>
                        </div>
                        <div className="stat pending">
                          <span className="stat-value">{leaveSummary.annual_leave_pending}</span>
                          <span className="stat-label">Pending</span>
                        </div>
                        <div className={`stat remaining ${(leaveSummary.annual_leave_remaining || 0) < 5 ? 'low' : ''}`}>
                          <span className="stat-value">{leaveSummary.annual_leave_remaining ?? 0}</span>
                          <span className="stat-label">Remaining</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="no-entitlement">
                      <p>Staff Type: <strong>{leaveSummary.staff_type || 'Casual/On-call'}</strong></p>
                      <p className="muted">No fixed annual entitlement</p>
                    </div>
                  )}

                  <div className="absence-stat">
                    <span>Unplanned Absences ({selectedYear}):</span>
                    <span className={`absence-count ${leaveSummary.unplanned_absences_this_year > 3 ? 'high' : ''}`}>
                      {leaveSummary.unplanned_absences_this_year}
                    </span>
                  </div>
                </>
              ) : (
                <p className="muted">No leave data available</p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
              <div className="stat-card">
                <span className="stat-icon pending-icon">⏳</span>
                <div className="stat-info">
                  <span className="stat-value">{myHolidays.pending.length}</span>
                  <span className="stat-label">Pending Requests</span>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon upcoming-icon">📅</span>
                <div className="stat-info">
                  <span className="stat-value">{upcomingHolidays.length}</span>
                  <span className="stat-label">Upcoming Holidays</span>
                </div>
              </div>
              <div className="stat-card">
                <span className="stat-icon bank-icon">🏦</span>
                <div className="stat-info">
                  <span className="stat-value">{upcomingBankHolidays.length}</span>
                  <span className="stat-label">Bank Holidays Left</span>
                </div>
              </div>
            </div>

            {/* Pending Requests */}
            {myHolidays.pending.length > 0 && (
              <div className="section">
                <h3>Pending Requests</h3>
                <div className="request-list">
                  {myHolidays.pending.map(request => (
                    <div key={request.id} className="request-card pending">
                      <div className="request-dates">
                        <span className="date-range">
                          {formatDateShort(request.start_date)} - {formatDateShort(request.end_date)}
                        </span>
                        <span className="days-count">{request.days_requested} day{request.days_requested !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="request-details">
                        <span className="leave-type">{getEnumLabel('leave_types', request.leave_type)}</span>
                        {request.reason && <span className="reason">{request.reason}</span>}
                      </div>
                      <div className="request-actions">
                        <span className="ds-badge ds-badge-warning">Pending</span>
                        <button
                          className="ds-btn ds-btn-sm ds-btn-danger"
                          onClick={() => handleCancelRequest(request.id)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Holiday */}
            {upcomingHolidays.length > 0 && (
              <div className="section">
                <h3>Next Holiday</h3>
                <div className="next-holiday-card">
                  <div className="countdown">
                    <span className="countdown-value">
                      {Math.ceil((new Date(upcomingHolidays[0].start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))}
                    </span>
                    <span className="countdown-label">days to go</span>
                  </div>
                  <div className="holiday-details">
                    <span className="date-range">
                      {formatDate(upcomingHolidays[0].start_date)} - {formatDate(upcomingHolidays[0].end_date)}
                    </span>
                    <span className="days">{upcomingHolidays[0].days_requested} day{upcomingHolidays[0].days_requested !== 1 ? 's' : ''}</span>
                    <span className="type">{getEnumLabel('leave_types', upcomingHolidays[0].leave_type)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Upcoming Holidays Tab */}
        {activeTab === 'upcoming' && (
          <div className="upcoming-tab">
            <h2>Upcoming Holidays</h2>
            {upcomingHolidays.length === 0 ? (
              <div className="empty-state">
                <p>No upcoming holidays booked</p>
                <button className="ds-btn ds-btn-primary" onClick={() => setShowRequestModal(true)}>
                  Request Holiday
                </button>
              </div>
            ) : (
              <div className="holiday-list">
                {upcomingHolidays.map(holiday => (
                  <div key={holiday.id} className="holiday-card approved">
                    <div className="holiday-dates">
                      <span className="start-date">{formatDate(holiday.start_date)}</span>
                      <span className="date-separator">to</span>
                      <span className="end-date">{formatDate(holiday.end_date)}</span>
                    </div>
                    <div className="holiday-info">
                      <span className="days">{holiday.days_requested} day{holiday.days_requested !== 1 ? 's' : ''}</span>
                      <span className="type">{getEnumLabel('leave_types', holiday.leave_type)}</span>
                    </div>
                    {holiday.reason && <p className="reason">{holiday.reason}</p>}
                    <span className="ds-badge ds-badge-success">Approved</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="history-tab">
            <h2>Holiday History</h2>

            {/* Past Approved */}
            <div className="history-section">
              <h3>Taken Holidays</h3>
              {pastHolidays.length === 0 ? (
                <p className="muted">No holiday history</p>
              ) : (
                <div className="ds-table-wrapper">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Dates</th>
                        <th>Days</th>
                        <th>Type</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastHolidays.map(holiday => (
                        <tr key={holiday.id}>
                          <td>{formatDate(holiday.start_date)} - {formatDate(holiday.end_date)}</td>
                          <td>{holiday.days_requested}</td>
                          <td>{getEnumLabel('leave_types', holiday.leave_type)}</td>
                          <td><span className="ds-badge ds-badge-success">Taken</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Rejected Requests */}
            {myHolidays.rejected.length > 0 && (
              <div className="history-section">
                <h3>Rejected Requests</h3>
                <div className="ds-table-wrapper">
                  <table className="ds-table">
                    <thead>
                      <tr>
                        <th>Dates</th>
                        <th>Days</th>
                        <th>Type</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {myHolidays.rejected.map(holiday => (
                        <tr key={holiday.id}>
                          <td>{formatDate(holiday.start_date)} - {formatDate(holiday.end_date)}</td>
                          <td>{holiday.days_requested}</td>
                          <td>{getEnumLabel('leave_types', holiday.leave_type)}</td>
                          <td>{holiday.approval_notes || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Absences Tab */}
        {activeTab === 'absences' && (
          <div className="absences-tab">
            <h2>Unplanned Absences</h2>
            <p className="tab-description">
              Record of sick days and other unplanned absences. These are logged by management.
            </p>

            {myAbsences.length === 0 ? (
              <div className="empty-state">
                <p>No absence records</p>
              </div>
            ) : (
              <div className="ds-table-wrapper">
                <table className="ds-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Expected Return</th>
                      <th>Actual Return</th>
                      <th>Fit Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAbsences.map(absence => (
                      <tr key={absence.id}>
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

        {/* Bank Holidays Tab */}
        {activeTab === 'bank-holidays' && (
          <div className="bank-holidays-tab">
            <div className="bank-holidays-header">
              <h2>UK Bank Holidays</h2>
              <select
                className="ds-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                style={{ width: 'auto' }}
              >
                {[2024, 2025, 2026].map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            <div className="bank-holiday-list">
              {UK_PUBLIC_HOLIDAYS
                .filter(h => h.date.startsWith(selectedYear.toString()))
                .map(holiday => {
                  const isPast = holiday.date < today;
                  return (
                    <div key={holiday.date} className={`bank-holiday-card ${isPast ? 'past' : ''}`}>
                      <div className="holiday-date">
                        <span className="day">{new Date(holiday.date).getDate()}</span>
                        <span className="month">
                          {new Date(holiday.date).toLocaleDateString('en-GB', { month: 'short' })}
                        </span>
                      </div>
                      <div className="holiday-name">
                        <span className="name">{holiday.name}</span>
                        <span className="weekday">
                          {new Date(holiday.date).toLocaleDateString('en-GB', { weekday: 'long' })}
                        </span>
                      </div>
                      {isPast && <span className="ds-badge ds-badge-secondary">Passed</span>}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Request Holiday Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request Holiday"
        footer={
          <>
            <button
              className="ds-btn ds-btn-secondary"
              onClick={() => setShowRequestModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleSubmitRequest}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Start Date" required>
            <Input
              type="date"
              value={requestForm.start_date}
              onChange={(e) => handleFormChange('start_date', e.target.value)}
              min={today}
              required
            />
          </FormGroup>
          <FormGroup label="End Date" required>
            <Input
              type="date"
              value={requestForm.end_date}
              onChange={(e) => handleFormChange('end_date', e.target.value)}
              min={requestForm.start_date || today}
              required
            />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Days Requested">
            <Input
              type="number"
              value={requestForm.days_requested}
              onChange={(e) => handleFormChange('days_requested', parseFloat(e.target.value))}
              min={0.5}
              step={0.5}
            />
            <small className="form-help">Adjust for half days if needed</small>
          </FormGroup>
          <FormGroup label="Leave Type">
            <select
              className="ds-select"
              value={requestForm.leave_type}
              onChange={(e) => handleFormChange('leave_type', e.target.value)}
            >
              <option value="annual">Annual Leave</option>
              <option value="unpaid">Unpaid Leave</option>
              <option value="compassionate">Compassionate Leave</option>
              <option value="other">Other</option>
            </select>
          </FormGroup>
        </FormRow>

        <FormGroup label="Reason (optional)">
          <Textarea
            value={requestForm.reason || ''}
            onChange={(e) => handleFormChange('reason', e.target.value)}
            rows={2}
            placeholder="Add any notes for your manager..."
          />
        </FormGroup>

        {leaveSummary?.annual_leave_remaining !== undefined && leaveSummary.annual_leave_remaining !== null && (
          <div className="remaining-balance-note">
            <strong>Remaining balance:</strong> {leaveSummary.annual_leave_remaining} days
            {requestForm.days_requested > leaveSummary.annual_leave_remaining && (
              <span className="warning"> (Request exceeds balance)</span>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
