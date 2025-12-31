import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { staffApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { StaffThanks } from '../types';
import './ThanksNotificationPopup.css';

const DISMISSAL_KEY = 'thanks-notification-dismissed';

export function ThanksNotificationPopup() {
  const { user } = useAuth();
  const [unreadThanks, setUnreadThanks] = useState<StaffThanks[]>([]);
  const [dismissed, setDismissed] = useState(() => {
    // Check sessionStorage for recent dismissal
    const stored = sessionStorage.getItem(DISMISSAL_KEY);
    if (stored) {
      const { thanksIds } = JSON.parse(stored);
      return thanksIds as number[];
    }
    return [] as number[];
  });

  useEffect(() => {
    // Only check for staff users
    if (user && user.is_yard_staff) {
      loadUnreadThanks();
    }
  }, [user]);

  const loadUnreadThanks = async () => {
    try {
      const response = await staffApi.getMyReceivedThanks();
      const unread = response.thanks.filter(
        (t) => !t.read_at && !dismissed.includes(t.id)
      );
      setUnreadThanks(unread);
    } catch (error) {
      console.error('Failed to load thanks:', error);
    }
  };

  const handleDismiss = () => {
    const newDismissed = [...dismissed, ...unreadThanks.map((t) => t.id)];
    sessionStorage.setItem(
      DISMISSAL_KEY,
      JSON.stringify({ thanksIds: newDismissed })
    );
    setDismissed(newDismissed);
    setUnreadThanks([]);
  };

  const handleViewAll = async () => {
    // Mark all as read when viewing
    try {
      await staffApi.markAllThanksAsRead();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
    handleDismiss();
  };

  // Don't show if no unread thanks
  if (unreadThanks.length === 0) {
    return null;
  }

  const latestThanks = unreadThanks[0];
  const hasMore = unreadThanks.length > 1;

  return (
    <div className="thanks-notification-overlay">
      <div className="thanks-notification-popup">
        <div className="popup-header">
          <div className="popup-icon thank-you">
            <span role="img" aria-label="heart">❤️</span>
          </div>
          <h2>You've Received Thanks!</h2>
          <button className="close-btn" onClick={handleDismiss} title="Dismiss">
            &times;
          </button>
        </div>

        <div className="thanks-preview">
          <div className="sender-info">
            <div className="sender-avatar">
              {latestThanks.sender_name?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="sender-details">
              <strong>{latestThanks.sender_name}</strong>
              <span className="thanks-date">
                {new Date(latestThanks.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                })}
              </span>
            </div>
          </div>
          <p className="thanks-message">
            "{latestThanks.message.length > 100
              ? `${latestThanks.message.substring(0, 100)}...`
              : latestThanks.message}"
          </p>
          {latestThanks.tip_amount && latestThanks.tip_amount > 0 && (
            <div className="tip-included">
              <span className="tip-label">Tip included:</span>
              <span className="tip-amount">£{latestThanks.tip_amount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {hasMore && (
          <p className="more-thanks">
            +{unreadThanks.length - 1} more thank you message{unreadThanks.length > 2 ? 's' : ''}
          </p>
        )}

        <div className="popup-actions">
          <button className="ds-btn ds-btn-secondary" onClick={handleDismiss}>
            Later
          </button>
          <Link
            to="/book/my-thanks"
            className="ds-btn ds-btn-primary"
            onClick={handleViewAll}
          >
            View All Thanks
          </Link>
        </div>
      </div>
    </div>
  );
}
