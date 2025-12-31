import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { staffApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { StaffThanks } from '../types';
import './ThanksNotificationPopup.css';

// Store dismissed thanks per user to avoid cross-user issues
const getDismissalKey = (userId: number) => `thanks-dismissed-${userId}`;

export function ThanksNotificationPopup() {
  const { user } = useAuth();
  const [unreadThanks, setUnreadThanks] = useState<StaffThanks[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);

  // Load dismissed IDs when user changes
  useEffect(() => {
    if (user) {
      const stored = sessionStorage.getItem(getDismissalKey(user.id));
      if (stored) {
        try {
          const { thanksIds } = JSON.parse(stored);
          setDismissed(thanksIds || []);
        } catch {
          setDismissed([]);
        }
      } else {
        setDismissed([]);
      }
    }
  }, [user]);

  const loadUnreadThanks = useCallback(async () => {
    if (!user) return;
    try {
      const response = await staffApi.getMyReceivedThanks();
      // Only filter by read_at - dismissed filtering happens in render
      const unread = response.thanks.filter((t) => !t.read_at);
      setUnreadThanks(unread);
    } catch (error) {
      console.error('Failed to load thanks:', error);
    }
  }, [user]);

  useEffect(() => {
    // Only check for staff users
    if (user && user.is_yard_staff) {
      loadUnreadThanks();

      // Poll for new thanks every 2 minutes
      const interval = setInterval(loadUnreadThanks, 120000);
      return () => clearInterval(interval);
    }
  }, [user, loadUnreadThanks]);

  // Filter out dismissed thanks for display
  const displayThanks = unreadThanks.filter((t) => !dismissed.includes(t.id));

  const handleDismiss = () => {
    if (!user) return;
    const newDismissed = [...dismissed, ...displayThanks.map((t) => t.id)];
    sessionStorage.setItem(
      getDismissalKey(user.id),
      JSON.stringify({ thanksIds: newDismissed })
    );
    setDismissed(newDismissed);
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

  // Don't show if no unread thanks to display
  if (displayThanks.length === 0) {
    return null;
  }

  const latestThanks = displayThanks[0];
  const hasMore = displayThanks.length > 1;

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
            +{displayThanks.length - 1} more thank you message{displayThanks.length > 2 ? 's' : ''}
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
