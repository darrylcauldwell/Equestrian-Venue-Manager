import { useState, useMemo } from 'react';
import type { RehabTaskLog } from '../types';
import './TaskHistoryPanel.css';

interface TaskHistoryPanelProps {
  logs: RehabTaskLog[];
  loading: boolean;
  showFilters?: boolean;
  showMetrics?: boolean;
  onFilterChange?: (startDate: string, endDate: string) => void;
}

export function TaskHistoryPanel({
  logs,
  loading,
  showFilters = false,
  showMetrics = false,
  onFilterChange,
}: TaskHistoryPanelProps) {
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Calculate completion metrics
  const metrics = useMemo(() => {
    const total = logs.length;
    const completed = logs.filter(log => log.was_completed).length;
    const skipped = total - completed;

    const byRole: Record<string, number> = {
      livery: 0,
      staff: 0,
      admin: 0,
    };

    logs.forEach(log => {
      const role = log.completed_by_role || 'livery';
      byRole[role] = (byRole[role] || 0) + 1;
    });

    return {
      total,
      completed,
      skipped,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      byRole,
    };
  }, [logs]);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const handleApplyFilters = () => {
    onFilterChange?.(filterStartDate, filterEndDate);
  };

  const handleQuickFilter = (filter: 'week' | 'month' | 'all') => {
    const today = new Date();
    let startDate = '';
    let endDate = '';

    if (filter === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    } else if (filter === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      startDate = monthAgo.toISOString().split('T')[0];
      endDate = today.toISOString().split('T')[0];
    }

    setFilterStartDate(startDate);
    setFilterEndDate(endDate);
    onFilterChange?.(startDate, endDate);
  };

  if (loading) {
    return <div className="task-history-panel loading">Loading task history...</div>;
  }

  return (
    <div className="task-history-panel">
      {/* Date Filters - Admin mode only */}
      {showFilters && (
        <div className="history-filters">
          <div className="filter-row">
            <div className="date-filters">
              <label>
                From:
                <input
                  type="date"
                  value={filterStartDate}
                  onChange={e => setFilterStartDate(e.target.value)}
                />
              </label>
              <label>
                To:
                <input
                  type="date"
                  value={filterEndDate}
                  onChange={e => setFilterEndDate(e.target.value)}
                />
              </label>
              <button className="btn-apply" onClick={handleApplyFilters}>
                Apply
              </button>
            </div>
            <div className="quick-filters">
              <button
                className="btn-quick-filter"
                onClick={() => handleQuickFilter('week')}
              >
                This Week
              </button>
              <button
                className="btn-quick-filter"
                onClick={() => handleQuickFilter('month')}
              >
                This Month
              </button>
              <button
                className="btn-quick-filter"
                onClick={() => handleQuickFilter('all')}
              >
                All Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Metrics - Admin mode only */}
      {showMetrics && logs.length > 0 && (
        <div className="metrics-section">
          <h4>Completion Metrics</h4>
          <div className="metrics-grid">
            <div className="metric-card">
              <span className="metric-value">{metrics.total}</span>
              <span className="metric-label">Total Logged</span>
            </div>
            <div className="metric-card success">
              <span className="metric-value">
                {metrics.completed}
                <small> ({metrics.completionRate}%)</small>
              </span>
              <span className="metric-label">Completed</span>
            </div>
            <div className="metric-card warning">
              <span className="metric-value">{metrics.skipped}</span>
              <span className="metric-label">Skipped</span>
            </div>
          </div>

          <div className="attribution-metrics">
            <h5>By Role</h5>
            <div className="attribution-bars">
              {metrics.byRole.livery > 0 && (
                <div className="attribution-item">
                  <span className="role-badge livery">Owner</span>
                  <span className="count">{metrics.byRole.livery}</span>
                </div>
              )}
              {metrics.byRole.staff > 0 && (
                <div className="attribution-item">
                  <span className="role-badge staff">Staff</span>
                  <span className="count">{metrics.byRole.staff}</span>
                </div>
              )}
              {metrics.byRole.admin > 0 && (
                <div className="attribution-item">
                  <span className="role-badge admin">Admin</span>
                  <span className="count">{metrics.byRole.admin}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Logs List */}
      <div className="task-logs-section">
        <h4>Activity Log</h4>
        {logs.length === 0 ? (
          <p className="no-logs">No activity recorded yet.</p>
        ) : (
          <div className="task-logs-list">
            {logs.map(log => {
              const isStaffCompletion = log.completed_by_role === 'staff' || log.completed_by_role === 'admin';
              return (
                <div
                  key={log.id}
                  className={`task-log-entry ${log.was_completed ? '' : 'skipped'} ${log.concerns ? 'has-concerns' : ''} ${isStaffCompletion ? 'staff-completed' : ''}`}
                >
                  <div className="log-header">
                    <span className="log-date">{formatDate(log.log_date)}</span>
                    <div className="log-header-badges">
                      {isStaffCompletion && (
                        <span className={`role-badge ${log.completed_by_role}`}>
                          {log.completed_by_role === 'staff' ? 'Staff' : 'Admin'}
                        </span>
                      )}
                      <span className={`log-status ${log.was_completed ? 'completed' : 'skipped'}`}>
                        {log.was_completed ? 'Completed' : 'Skipped'}
                      </span>
                    </div>
                  </div>

                  <div className="log-task">{log.task_description || 'Task'}</div>

                  <div className="log-details">
                    {log.actual_duration_minutes && (
                      <span className="log-duration">
                        Duration: {log.actual_duration_minutes} min
                      </span>
                    )}
                    {log.completed_by_name && (
                      <span className="log-completed-by">
                        By: {log.completed_by_name}
                        {log.completed_via && log.completed_via !== 'direct' && (
                          <small> (via {log.completed_via.replace('_', ' ')})</small>
                        )}
                      </span>
                    )}
                  </div>

                  {!log.was_completed && log.skip_reason && (
                    <div className="log-skip-reason">
                      <strong>Skip reason:</strong> {log.skip_reason}
                    </div>
                  )}

                  {log.horse_response && (
                    <div className="log-horse-response">
                      <strong>Horse response:</strong> {log.horse_response}
                    </div>
                  )}

                  {log.concerns && (
                    <div className="log-concerns">
                      <strong>Concerns:</strong> {log.concerns}
                      {log.vet_notified && (
                        <span className="vet-notified-badge">Vet Notified</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
