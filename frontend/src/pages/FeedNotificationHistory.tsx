import { useState, useEffect, useCallback } from 'react';
import { feedNotificationsApi, horsesApi } from '../services/api';
import type { FeedNotificationHistory, FeedChangeType, Horse } from '../types';
import './FeedNotificationHistory.css';

const CHANGE_TYPE_LABELS: Record<FeedChangeType, string> = {
  requirement_created: 'New Requirements',
  requirement_updated: 'Requirements Updated',
  requirement_deleted: 'Requirements Removed',
  addition_created: 'New Addition',
  addition_updated: 'Addition Updated',
  addition_deleted: 'Addition Removed',
  supply_alert: 'Supply Alert',
};

const CHANGE_TYPE_COLORS: Record<FeedChangeType, string> = {
  requirement_created: 'badge-success',
  requirement_updated: 'badge-info',
  requirement_deleted: 'badge-danger',
  addition_created: 'badge-success',
  addition_updated: 'badge-info',
  addition_deleted: 'badge-danger',
  supply_alert: 'badge-warning',
};

export default function FeedNotificationHistoryPage() {
  const [notifications, setNotifications] = useState<FeedNotificationHistory[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Filters
  const [horseFilter, setHorseFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  const loadHorses = useCallback(async () => {
    try {
      const data = await horsesApi.list();
      setHorses(data);
    } catch (err) {
      console.error('Failed to load horses:', err);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number | undefined> = {};
      if (horseFilter) params.horse_id = parseInt(horseFilter);
      if (typeFilter) params.change_type = typeFilter;
      if (dateFrom) params.start_date = dateFrom;
      if (dateTo) params.end_date = dateTo;

      const data = await feedNotificationsApi.getHistory(params as {
        horse_id?: number;
        start_date?: string;
        end_date?: string;
        change_type?: FeedChangeType;
      });
      setNotifications(data);
      setError('');
    } catch (err) {
      setError('Failed to load notification history');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [horseFilter, typeFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadHorses();
  }, [loadHorses]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getAcknowledgementStatus = (notification: FeedNotificationHistory) => {
    const { acknowledged_count, total_staff } = notification;
    const percentage = total_staff > 0 ? Math.round((acknowledged_count / total_staff) * 100) : 0;
    return { acknowledged_count, total_staff, percentage };
  };

  return (
    <div className="page-container feed-notification-history-page">
      <div className="page-header">
        <h1>Feed Change History</h1>
        <p className="page-subtitle">
          View all feed changes and staff acknowledgement status
        </p>
      </div>

      <div className="filters-section">
        <div className="ds-form-group">
          <label>Horse</label>
          <select
            className="ds-input"
            value={horseFilter}
            onChange={(e) => setHorseFilter(e.target.value)}
          >
            <option value="">All Horses</option>
            {horses.map((horse) => (
              <option key={horse.id} value={horse.id}>
                {horse.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ds-form-group">
          <label>Change Type</label>
          <select
            className="ds-input"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All Types</option>
            {Object.entries(CHANGE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="ds-form-group">
          <label>From Date</label>
          <input
            type="date"
            className="ds-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="ds-form-group">
          <label>To Date</label>
          <input
            type="date"
            className="ds-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <button
          className="ds-btn ds-btn-secondary clear-filters-btn"
          onClick={() => {
            setHorseFilter('');
            setTypeFilter('');
            setDateFrom('');
            setDateTo('');
          }}
        >
          Clear Filters
        </button>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {loading ? (
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading history...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="empty-state">
          <p>No feed changes found matching your filters.</p>
        </div>
      ) : (
        <div className="notifications-list">
          {notifications.map((notification) => {
            const status = getAcknowledgementStatus(notification);
            const isExpanded = expandedId === notification.id;

            return (
              <div
                key={notification.id}
                className={`notification-card ${isExpanded ? 'expanded' : ''}`}
              >
                <div
                  className="notification-summary"
                  onClick={() => toggleExpand(notification.id)}
                >
                  <div className="notification-main">
                    <span
                      className={`change-type-badge ${CHANGE_TYPE_COLORS[notification.change_type]}`}
                    >
                      {CHANGE_TYPE_LABELS[notification.change_type]}
                    </span>
                    <span className="horse-name">{notification.horse_name}</span>
                    <span className="notification-time">
                      {formatDateTime(notification.created_at)}
                    </span>
                  </div>

                  <p className="notification-description">{notification.description}</p>

                  <div className="notification-footer">
                    <span className="changed-by">
                      Changed by {notification.created_by_name}
                    </span>

                    <div className="acknowledgement-status">
                      <div className="ack-progress">
                        <div
                          className="ack-progress-bar"
                          style={{ width: `${status.percentage}%` }}
                        />
                      </div>
                      <span className="ack-count">
                        {status.acknowledged_count}/{status.total_staff} staff acknowledged
                      </span>
                    </div>

                    <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="acknowledgement-details">
                    <h4>Staff Acknowledgements</h4>
                    {notification.acknowledgements.length === 0 ? (
                      <p className="no-staff">No yard staff configured.</p>
                    ) : (
                      <ul className="ack-list">
                        {notification.acknowledgements.map((ack) => (
                          <li
                            key={ack.user_id}
                            className={ack.acknowledged_at ? 'acknowledged' : 'pending'}
                          >
                            <span className="staff-name">{ack.user_name}</span>
                            {ack.acknowledged_at ? (
                              <span className="ack-time">
                                Acknowledged {formatDateTime(ack.acknowledged_at)}
                              </span>
                            ) : (
                              <span className="pending-badge">Pending</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
