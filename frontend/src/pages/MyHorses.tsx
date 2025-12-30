import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { horsesApi, feedApi } from '../services/api';
import type { Horse, FeedSupplyAlert } from '../types';
import './MyHorses.css';

interface HorseAlerts {
  [horseId: number]: FeedSupplyAlert[];
}

export function MyHorses() {
  const navigate = useNavigate();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseAlerts, setHorseAlerts] = useState<HorseAlerts>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHorses = async () => {
    try {
      const data = await horsesApi.list();
      setHorses(data || []);

      // Load alerts for each horse
      if (data && data.length > 0) {
        const alertsMap: HorseAlerts = {};
        await Promise.all(
          data.map(async (horse) => {
            try {
              const alerts = await feedApi.listAlerts(horse.id, true);
              if (alerts.length > 0) {
                alertsMap[horse.id] = alerts;
              }
            } catch {
              // Silently ignore alert loading errors
            }
          })
        );
        setHorseAlerts(alertsMap);
      }
    } catch (err) {
      console.error('Failed to load horses:', err);
      setError('Failed to load horses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get all alerts across all horses
  const getAllAlerts = (): (FeedSupplyAlert & { horseName: string })[] => {
    const alerts: (FeedSupplyAlert & { horseName: string })[] = [];
    horses.forEach((horse) => {
      const horseAlertList = horseAlerts[horse.id] || [];
      horseAlertList.forEach((alert) => {
        alerts.push({ ...alert, horseName: horse.name });
      });
    });
    return alerts;
  };

  const handleResolveAlert = async (horseId: number, alertId: number) => {
    try {
      await feedApi.resolveAlert(horseId, alertId);
      // Update local state
      setHorseAlerts((prev) => ({
        ...prev,
        [horseId]: (prev[horseId] || []).filter((a) => a.id !== alertId),
      }));
    } catch {
      setError('Failed to resolve alert');
    }
  };

  useEffect(() => {
    loadHorses();
  }, []);

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="my-horses-page">
      <div className="page-header">
        <h1>My Horses</h1>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Low Feed Alerts Banner */}
      {getAllAlerts().length > 0 && (
        <div className="feed-alerts-banner">
          <h2>Low Feed Alerts</h2>
          <p className="alerts-intro">Yard staff have flagged the following items as running low:</p>
          <div className="alerts-list">
            {getAllAlerts().map((alert) => (
              <div key={alert.id} className="alert-item">
                <div className="alert-details">
                  <strong>{alert.horseName}</strong>
                  <span className="alert-item-name">{alert.item}</span>
                  {alert.notes && <span className="alert-notes">{alert.notes}</span>}
                  {alert.created_by_name && (
                    <span className="alert-reporter">Reported by {alert.created_by_name}</span>
                  )}
                </div>
                <button
                  className="resolve-btn"
                  onClick={() => handleResolveAlert(alert.horse_id, alert.id)}
                >
                  Mark Resolved
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {horses.length === 0 ? (
        <p className="no-horses">No horses registered yet. Please contact the yard to add your horses.</p>
      ) : (
        <div className="horses-grid">
          {horses.map((horse) => (
            <div key={horse.id} className={`horse-card ${(horseAlerts[horse.id]?.length ?? 0) > 0 ? 'has-alerts' : ''}`}>
              <div className="horse-icon">🐴</div>
              <h3>
                {horse.name}
                {(horseAlerts[horse.id]?.length ?? 0) > 0 && (
                  <span className="alert-badge" title="Low feed alert">!</span>
                )}
              </h3>
              {horse.colour && <p className="horse-colour">{horse.colour}</p>}
              {horse.birth_year && (
                <p className="horse-age">
                  Born {horse.birth_year} ({new Date().getFullYear() - horse.birth_year} years old)
                </p>
              )}
              {horse.stable_name && (
                <p className="horse-stable">Stable: {horse.stable_name}</p>
              )}
              {horse.livery_package_name && (
                <p className="horse-package">{horse.livery_package_name}</p>
              )}
              {horse.feed_notes && (
                <p className="horse-feed-notes">{horse.feed_notes}</p>
              )}
              <div className="horse-actions">
                <button className="health-btn" onClick={() => navigate(`/book/my-horses/${horse.id}/health`)}>
                  Health Records
                </button>
                <button className="feed-btn" onClick={() => navigate(`/book/my-horses/${horse.id}/feed`)}>
                  Feed Management
                </button>
                <button className="emergency-btn" onClick={() => navigate(`/book/my-horses/${horse.id}/emergency-contacts`)}>
                  Emergency Contacts
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
