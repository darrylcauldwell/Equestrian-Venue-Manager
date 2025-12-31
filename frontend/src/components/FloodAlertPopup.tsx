import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { floodWarningsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { FloodWarningStatus, StationWarningAlert } from '../types';
import './FloodAlertPopup.css';

const DISMISSAL_KEY = 'flood-alert-dismissed';
const DISMISSAL_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours (more frequent checks than vaccination)

export function FloodAlertPopup() {
  const { user, isAdmin } = useAuth();
  const [stationAlerts, setStationAlerts] = useState<StationWarningAlert[]>([]);
  const [hasSevere, setHasSevere] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    const stored = sessionStorage.getItem(DISMISSAL_KEY);
    if (stored) {
      const { timestamp } = JSON.parse(stored);
      if (Date.now() - timestamp < DISMISSAL_EXPIRY_MS) {
        return true;
      }
      sessionStorage.removeItem(DISMISSAL_KEY);
    }
    return false;
  });

  useEffect(() => {
    // Only check for flood alerts for admins
    if (user && isAdmin && !dismissed) {
      loadWarnings();
    }
  }, [user, isAdmin, dismissed]);

  const loadWarnings = async () => {
    try {
      const status: FloodWarningStatus = await floodWarningsApi.getCurrentWarnings();
      if (status.has_warnings && status.station_alerts?.length > 0) {
        setStationAlerts(status.station_alerts);
        setHasSevere(status.has_severe_warnings);
        setLastUpdated(status.last_updated || null);
      }
    } catch (error) {
      console.error('Failed to load flood warnings:', error);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSAL_KEY, JSON.stringify({ timestamp: Date.now() }));
    setDismissed(true);
  };

  // Don't show if no station alerts or dismissed
  if (dismissed || stationAlerts.length === 0) {
    return null;
  }

  const formatLevel = (level?: number) => {
    if (typeof level !== 'number') return 'N/A';
    return `${level.toFixed(2)}m`;
  };

  const formatLastUpdated = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const severeAlerts = stationAlerts.filter(a => a.current_status === 'severe');
  const warningAlerts = stationAlerts.filter(a => a.current_status === 'warning');

  return (
    <div className="flood-alert-popup-overlay">
      <div className="flood-alert-popup">
        <div className={`popup-header ${hasSevere ? 'severe' : 'warning'}`}>
          <div className="popup-icon">
            {hasSevere ? '!' : '⚠'}
          </div>
          <h2>{hasSevere ? 'Severe Flood Warning' : 'Flood Warning'}</h2>
          <button className="close-btn" onClick={handleDismiss} title="Dismiss">
            &times;
          </button>
        </div>

        <p className="popup-intro">
          {hasSevere
            ? 'URGENT: Water levels have reached severe thresholds. Immediate action may be required to ensure horse safety.'
            : 'Water levels have exceeded warning thresholds at monitored stations. Please monitor conditions and consider precautionary measures.'}
        </p>

        <div className="popup-alerts">
          {severeAlerts.length > 0 && (
            <div className="alert-section severe">
              <h3>Severe</h3>
              {severeAlerts.map((alert) => (
                <div key={alert.station_id} className="popup-alert-item severe">
                  <div className="alert-content">
                    <strong className="field-name">{alert.station_name}</strong>
                    {alert.river_name && (
                      <span className="station-info">
                        {alert.river_name}
                      </span>
                    )}
                    <div className="level-info">
                      <span className="current-level severe">
                        Current: {formatLevel(alert.current_level)}
                      </span>
                      {alert.severe_threshold && (
                        <span className="threshold">
                          Severe threshold: {formatLevel(alert.severe_threshold)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {warningAlerts.length > 0 && (
            <div className="alert-section warning">
              <h3>Warning</h3>
              {warningAlerts.map((alert) => (
                <div key={alert.station_id} className="popup-alert-item warning">
                  <div className="alert-content">
                    <strong className="field-name">{alert.station_name}</strong>
                    {alert.river_name && (
                      <span className="station-info">
                        {alert.river_name}
                      </span>
                    )}
                    <div className="level-info">
                      <span className="current-level warning">
                        Current: {formatLevel(alert.current_level)}
                      </span>
                      {alert.warning_threshold && (
                        <span className="threshold">
                          Warning threshold: {formatLevel(alert.warning_threshold)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="popup-meta">
          Last updated: {formatLastUpdated(lastUpdated)}
        </div>

        <div className="popup-footer">
          <Link to="/admin/land-management" className="view-details-btn" onClick={handleDismiss}>
            View Land Management
          </Link>
          <button className="dismiss-btn" onClick={handleDismiss}>
            Dismiss for 4 hours
          </button>
        </div>
      </div>
    </div>
  );
}
