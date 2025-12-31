import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { healthRecordsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { VaccinationAlert } from '../types';
import './VaccinationAlertPopup.css';

const DISMISSAL_KEY = 'vaccination-alert-dismissed';
const DISMISSAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

export function VaccinationAlertPopup() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<VaccinationAlert[]>([]);
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
    // Check for alerts for livery owners only (not admins)
    // Admins can see this info in aggregate via admin reports
    if (user && user.role !== 'admin' && !dismissed) {
      loadAlerts();
    }
  }, [user, dismissed]);

  const loadAlerts = async () => {
    try {
      const data = await healthRecordsApi.getUpcomingVaccinations(14);
      setAlerts(data);
    } catch (error) {
      console.error('Failed to load vaccination alerts:', error);
    }
  };

  const handleDismiss = () => {
    // Persist dismissal to sessionStorage
    sessionStorage.setItem(DISMISSAL_KEY, JSON.stringify({ timestamp: Date.now() }));
    setDismissed(true);
  };

  // Don't show if no alerts or dismissed
  if (dismissed || alerts.length === 0) {
    return null;
  }

  const formatVaccineType = (type: string) => {
    return type.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const getDueDateText = (alert: VaccinationAlert) => {
    if (alert.is_overdue) {
      return `${Math.abs(alert.days_until_due)} days overdue`;
    } else if (alert.days_until_due === 0) {
      return 'Due today';
    } else if (alert.days_until_due === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${alert.days_until_due} days`;
    }
  };

  const overdueAlerts = alerts.filter(a => a.is_overdue);
  const upcomingAlerts = alerts.filter(a => !a.is_overdue);

  return (
    <div className="vaccination-alert-popup-overlay">
      <div className="vaccination-alert-popup">
        <div className={`popup-header ${overdueAlerts.length > 0 ? 'has-overdue' : ''}`}>
          <div className="popup-icon">{overdueAlerts.length > 0 ? '!' : 'i'}</div>
          <h2>Vaccination Reminder</h2>
          <button className="close-btn" onClick={handleDismiss} title="Dismiss">
            &times;
          </button>
        </div>

        <p className="popup-intro">
          {overdueAlerts.length > 0
            ? 'Some vaccinations are overdue. Please arrange these with your vet as soon as possible.'
            : 'The following vaccinations are due soon. Please schedule appointments with your vet.'}
        </p>

        <div className="popup-alerts">
          {overdueAlerts.length > 0 && (
            <div className="alert-section overdue">
              <h3>Overdue</h3>
              {overdueAlerts.map((alert, index) => (
                <div key={`overdue-${index}`} className="popup-alert-item overdue">
                  <div className="alert-content">
                    <strong className="horse-name">{alert.horse_name}</strong>
                    <span className="vaccine-name">
                      {formatVaccineType(alert.vaccine_type)}
                      {alert.vaccine_name && ` (${alert.vaccine_name})`}
                    </span>
                    <span className="due-text overdue">{getDueDateText(alert)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {upcomingAlerts.length > 0 && (
            <div className="alert-section upcoming">
              <h3>Upcoming</h3>
              {upcomingAlerts.map((alert, index) => (
                <div key={`upcoming-${index}`} className="popup-alert-item">
                  <div className="alert-content">
                    <strong className="horse-name">{alert.horse_name}</strong>
                    <span className="vaccine-name">
                      {formatVaccineType(alert.vaccine_type)}
                      {alert.vaccine_name && ` (${alert.vaccine_name})`}
                    </span>
                    <span className="due-text">{getDueDateText(alert)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
