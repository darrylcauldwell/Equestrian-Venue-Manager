import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { feedApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { FeedSupplyAlert } from '../types';
import './FeedAlertPopup.css';

const DISMISSAL_KEY = 'feed-alert-dismissed';
const DISMISSAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function FeedAlertPopup() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<FeedSupplyAlert[]>([]);
  const [dismissed, setDismissed] = useState(() => {
    // Check sessionStorage for dismissal (persists across navigation)
    const stored = sessionStorage.getItem(DISMISSAL_KEY);
    if (stored) {
      const { timestamp } = JSON.parse(stored);
      // Only respect dismissal if within expiry period
      if (Date.now() - timestamp < DISMISSAL_EXPIRY_MS) {
        return true;
      }
      sessionStorage.removeItem(DISMISSAL_KEY);
    }
    return false;
  });

  useEffect(() => {
    // Only check for alerts for livery users (not staff or admin)
    if (user && user.role === 'livery' && !dismissed) {
      loadAlerts();
    }
  }, [user, dismissed]);

  const loadAlerts = async () => {
    try {
      const data = await feedApi.getMyHorseAlerts(true);
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load feed alerts:', error);
    }
  };

  const handleDismiss = () => {
    // Persist dismissal to sessionStorage
    sessionStorage.setItem(DISMISSAL_KEY, JSON.stringify({ timestamp: Date.now() }));
    setDismissed(true);
  };

  const handleResolve = async (alert: FeedSupplyAlert) => {
    try {
      await feedApi.resolveAlert(alert.horse_id, alert.id);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  // Don't show if no alerts or dismissed
  if (dismissed || alerts.length === 0) {
    return null;
  }

  return (
    <div className="feed-alert-popup-overlay">
      <div className="feed-alert-popup">
        <div className="popup-header">
          <div className="popup-icon">!</div>
          <h2>Low Feed Alert</h2>
          <button className="close-btn" onClick={handleDismiss} title="Dismiss">
            &times;
          </button>
        </div>

        <p className="popup-intro">
          Yard staff have flagged the following items as running low for your horses.
          Please resupply as soon as possible.
        </p>

        <div className="popup-alerts">
          {alerts.map((alert) => (
            <div key={alert.id} className="popup-alert-item">
              <div className="alert-content">
                <strong className="horse-name">{alert.horse_name}</strong>
                <span className="item-name">{alert.item}</span>
                {alert.notes && <span className="alert-notes">{alert.notes}</span>}
                {alert.created_by_name && (
                  <span className="reporter">Reported by {alert.created_by_name}</span>
                )}
              </div>
              <button
                className="resolve-btn"
                onClick={() => handleResolve(alert)}
                title="Mark as resolved"
              >
                Resolved
              </button>
            </div>
          ))}
        </div>

        <div className="popup-footer">
          <Link to="/book/my-horses" className="view-all-btn" onClick={handleDismiss}>
            View My Horses
          </Link>
          <button className="dismiss-btn" onClick={handleDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
