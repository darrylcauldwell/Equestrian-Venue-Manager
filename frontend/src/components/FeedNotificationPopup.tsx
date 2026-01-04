import { useState, useEffect, useCallback } from 'react';
import { feedNotificationsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { FeedChangeNotification } from '../types';
import './FeedNotificationPopup.css';

const CHANGE_TYPE_LABELS: Record<string, string> = {
  requirement_created: 'New Feed Requirements',
  requirement_updated: 'Feed Requirements Updated',
  requirement_deleted: 'Feed Requirements Removed',
  addition_created: 'New Feed Addition',
  addition_updated: 'Feed Addition Updated',
  addition_deleted: 'Feed Addition Removed',
  supply_alert: 'Supply Alert',
};

export function FeedNotificationPopup() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<FeedChangeNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [acknowledging, setAcknowledging] = useState<number | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await feedNotificationsApi.getPending();
      setNotifications(data);
    } catch (error) {
      console.error('Failed to load feed notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only check for notifications for yard staff or admin
    if (user && (user.is_yard_staff || user.role === 'admin')) {
      loadNotifications();
    }
  }, [user, loadNotifications]);

  const handleAcknowledge = async (notificationId: number) => {
    try {
      setAcknowledging(notificationId);
      await feedNotificationsApi.acknowledge(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to acknowledge notification:', error);
    } finally {
      setAcknowledging(null);
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      setLoading(true);
      await Promise.all(
        notifications.map((n) => feedNotificationsApi.acknowledge(n.id))
      );
      setNotifications([]);
    } catch (error) {
      console.error('Failed to acknowledge all notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Don't show if no notifications or not yard staff
  if (!user || (!user.is_yard_staff && user.role !== 'admin') || notifications.length === 0) {
    return null;
  }

  return (
    <div className="feed-notification-popup-overlay">
      <div className="feed-notification-popup">
        <div className="popup-header">
          <div className="popup-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </div>
          <h2>Feed Change Notifications</h2>
        </div>

        <p className="popup-intro">
          The following feed changes require your acknowledgement.
          Please review each change to confirm you've seen it.
        </p>

        <div className="popup-notifications">
          {notifications.map((notification) => (
            <div key={notification.id} className="popup-notification-item">
              <div className="notification-content">
                <div className="notification-header">
                  <span className="change-type">
                    {CHANGE_TYPE_LABELS[notification.change_type] || notification.change_type}
                  </span>
                  <span className="notification-time">
                    {formatDate(notification.created_at)}
                  </span>
                </div>
                <strong className="horse-name">{notification.horse_name}</strong>
                <p className="description">{notification.description}</p>
                <span className="changed-by">Changed by {notification.created_by_name}</span>
              </div>
              <button
                className="acknowledge-btn"
                onClick={() => handleAcknowledge(notification.id)}
                disabled={acknowledging === notification.id}
                title="Acknowledge"
              >
                {acknowledging === notification.id ? 'Saving...' : "I've Read This"}
              </button>
            </div>
          ))}
        </div>

        <div className="popup-footer">
          <span className="notification-count">
            {notifications.length} notification{notifications.length !== 1 ? 's' : ''} pending
          </span>
          <button
            className="acknowledge-all-btn"
            onClick={handleAcknowledgeAll}
            disabled={loading}
          >
            {loading ? 'Acknowledging...' : 'Acknowledge All'}
          </button>
        </div>
      </div>
    </div>
  );
}
