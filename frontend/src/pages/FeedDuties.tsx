import { useState, useEffect } from 'react';
import { feedApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { FeedSummary, FeedSupplyAlert, CreateFeedAlert } from '../types';
import './FeedDuties.css';

type FeedTime = 'morning' | 'evening';

export default function FeedDuties() {
  const { user, isAdmin } = useAuth();
  const [schedules, setSchedules] = useState<FeedSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Determine if user is yard staff (staff role or is_yard_staff flag, but not admin)
  const isYardStaff = (user?.role === 'staff' || user?.is_yard_staff) && !isAdmin;
  const [feedTime, setFeedTime] = useState<FeedTime>(() => {
    const hour = new Date().getHours();
    return hour < 14 ? 'morning' : 'evening';
  });

  // Low feed/medication alert state
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertHorse, setAlertHorse] = useState<{ id: number; name: string } | null>(null);
  const [alertForm, setAlertForm] = useState<CreateFeedAlert>({ item: '', notes: '' });
  const [alertType, setAlertType] = useState<'feed' | 'medication'>('feed');
  const [submittingAlert, setSubmittingAlert] = useState(false);
  const [allAlerts, setAllAlerts] = useState<FeedSupplyAlert[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schedulesData, alertsData] = await Promise.all([
        feedApi.getAllSchedules(),
        feedApi.listAllAlerts(true),
      ]);
      setSchedules(schedulesData);
      setAllAlerts(alertsData);
    } catch {
      setError('Failed to load feed schedules');
    } finally {
      setIsLoading(false);
    }
  };

  const openAlertModal = (horseId: number, horseName: string, type: 'feed' | 'medication' = 'feed', prefillItem?: string) => {
    setAlertHorse({ id: horseId, name: horseName });
    setAlertForm({ item: prefillItem || '', notes: '' });
    setAlertType(type);
    setShowAlertModal(true);
  };

  const closeAlertModal = () => {
    setShowAlertModal(false);
    setAlertHorse(null);
    setAlertForm({ item: '', notes: '' });
    setAlertType('feed');
  };

  const handleSubmitAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertHorse || !alertForm.item.trim()) return;

    setSubmittingAlert(true);
    try {
      const newAlert = await feedApi.createAlert(alertHorse.id, {
        item: alertForm.item.trim(),
        notes: alertForm.notes?.trim() || undefined,
      });
      // Add to local state
      setAllAlerts(prev => [newAlert, ...prev]);
      // Also update the schedule's unresolved_alerts
      setSchedules(prev => prev.map(s =>
        s.horse_id === alertHorse.id
          ? { ...s, unresolved_alerts: [...s.unresolved_alerts, newAlert] }
          : s
      ));
      closeAlertModal();
    } catch {
      setError('Failed to create low feed alert');
    } finally {
      setSubmittingAlert(false);
    }
  };

  const handleResolveAlert = async (alert: FeedSupplyAlert) => {
    try {
      await feedApi.resolveAlert(alert.horse_id, alert.id);
      // Remove from allAlerts
      setAllAlerts(prev => prev.filter(a => a.id !== alert.id));
      // Remove from schedule's unresolved_alerts
      setSchedules(prev => prev.map(s =>
        s.horse_id === alert.horse_id
          ? { ...s, unresolved_alerts: s.unresolved_alerts.filter(a => a.id !== alert.id) }
          : s
      ));
    } catch {
      setError('Failed to resolve alert');
    }
  };

  // Group schedules by stable for display
  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const stableName = schedule.stable_name || 'Unassigned';
    if (!acc[stableName]) {
      acc[stableName] = [];
    }
    acc[stableName].push(schedule);
    return acc;
  }, {} as Record<string, FeedSummary[]>);

  // Sort stable groups: assigned stables first (by sequence), unassigned last
  const sortedStableNames = Object.keys(groupedSchedules).sort((a, b) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    const aSeq = groupedSchedules[a][0]?.stable_sequence ?? 999;
    const bSeq = groupedSchedules[b][0]?.stable_sequence ?? 999;
    return aSeq - bSeq;
  });

  if (isLoading) {
    return <div className="ds-loading">Loading feed duties...</div>;
  }

  return (
    <div className="feed-duties">
      <div className="feed-header">
        <h1>Feed Schedule</h1>
        <p className="feed-date">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Low Feed Alerts Summary - prominent display for livery owners, hidden for staff */}
      {!isYardStaff && allAlerts.length > 0 && (
        <div className="alerts-summary">
          <h2>Low Feed Alerts ({allAlerts.length})</h2>
          <div className="alerts-list">
            {allAlerts.map((alert) => (
              <div key={alert.id} className="alert-card">
                <div className="alert-content">
                  <strong>{alert.horse_name}</strong>
                  <span className="alert-item">{alert.item}</span>
                  {alert.notes && <span className="alert-notes">{alert.notes}</span>}
                </div>
                <button
                  className="resolve-btn"
                  onClick={() => handleResolveAlert(alert)}
                  title="Mark as resolved"
                >
                  Resolved
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feed Time Toggle */}
      <div className="feed-controls">
        <div className="feed-time-toggle">
          <button
            className={`time-btn ${feedTime === 'morning' ? 'active' : ''}`}
            onClick={() => setFeedTime('morning')}
          >
            Morning
          </button>
          <button
            className={`time-btn ${feedTime === 'evening' ? 'active' : ''}`}
            onClick={() => setFeedTime('evening')}
          >
            Evening
          </button>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="ds-empty">
          <p>No horses registered yet</p>
        </div>
      ) : (
        <div className="feed-list">
          {sortedStableNames.map((stableName) => (
            <div key={stableName} className="stable-group">
              <h2 className="stable-header">{stableName}</h2>
              {groupedSchedules[stableName].map((schedule) => {
                const feedInfo = schedule.feed_requirement;
                const currentFeed = feedTime === 'morning' ? feedInfo?.morning_feed : feedInfo?.evening_feed;

                // Filter additions and medications for current feed time
                const currentAdditions = schedule.active_additions?.filter(
                  add => !add.feed_time || add.feed_time === feedTime || add.feed_time === 'both'
                ) || [];
                const currentMedications = schedule.rehab_medications?.filter(
                  med => med.feed_time === feedTime || med.feed_time === 'both'
                ) || [];

                return (
                  <div key={schedule.horse_id} className="feed-card">
                    <div className="feed-card-header">
                      <div className="horse-name-section">
                        <h3 className="horse-name">
                          {schedule.horse_name}
                          {!isYardStaff && (schedule.unresolved_alerts?.length ?? 0) > 0 && (
                            <span className="alert-badge" title="Has low feed alerts">!</span>
                          )}
                        </h3>
                        {/* Subtle notification for staff showing when owner was notified */}
                        {isYardStaff && (schedule.unresolved_alerts?.length ?? 0) > 0 && (
                          <div className="staff-alert-note">
                            {schedule.unresolved_alerts?.map((alert) => (
                              <span key={alert.id} className="staff-alert-item">
                                Owner notified of low {alert.item} on {new Date(alert.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="card-actions">
                        <button
                          className="low-feed-btn"
                          onClick={() => openAlertModal(schedule.horse_id, schedule.horse_name, 'feed')}
                          title="Report low feed"
                        >
                          Low Feed
                        </button>
                        {currentMedications.length > 0 && (
                          <button
                            className="low-meds-btn"
                            onClick={() => {
                              const medNames = currentMedications
                                .map(med => med.description)
                                .join(', ');
                              openAlertModal(schedule.horse_id, schedule.horse_name, 'medication', medNames);
                            }}
                            title="Report low medication"
                          >
                            Low Meds
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Comprehensive feed details for current meal */}
                    <div className="feed-content">
                      {/* Main feed */}
                      <div className="feed-item">
                        <span className="feed-item-label">Feed:</span>
                        <pre className="feed-item-value">{currentFeed || 'No feed specified'}</pre>
                      </div>

                      {/* Supplements */}
                      {feedInfo?.supplements && (
                        <div className="feed-item">
                          <span className="feed-item-label">Supplements:</span>
                          <span className="feed-item-value">{feedInfo.supplements}</span>
                        </div>
                      )}

                      {/* Special instructions */}
                      {feedInfo?.special_instructions && (
                        <div className="feed-item special-instructions">
                          <span className="feed-item-label">Special Instructions:</span>
                          <span className="feed-item-value">{feedInfo.special_instructions}</span>
                        </div>
                      )}

                      {/* Active additions for this feed time */}
                      {currentAdditions.length > 0 && (
                        <div className="feed-item additions">
                          <span className="feed-item-label">Additions:</span>
                          <div className="feed-item-list">
                            {currentAdditions.map((addition) => (
                              <div key={addition.id} className="addition-entry">
                                <strong>{addition.name}</strong>
                                {addition.dosage && <span className="dosage"> - {addition.dosage}</span>}
                                {addition.reason && <span className="reason"> ({addition.reason})</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Rehab medications for this feed time */}
                      {currentMedications.length > 0 && (
                        <div className="feed-item medications">
                          <span className="feed-item-label">Medications:</span>
                          <div className="feed-item-list">
                            {currentMedications.map((med) => (
                              <div key={med.task_id} className="medication-entry">
                                <strong>{med.description}</strong>
                                {med.instructions && <span className="instructions"> - {med.instructions}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Low Feed/Medication Alert Modal */}
      {showAlertModal && alertHorse && (
        <div className="ds-modal-overlay" onClick={closeAlertModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{alertType === 'medication' ? 'Report Low Medication' : 'Report Low Feed'}</h2>
            <p className="modal-subtitle">for {alertHorse.name}</p>

            <form onSubmit={handleSubmitAlert}>
              <div className="ds-form-group">
                <label htmlFor="alert-item">
                  {alertType === 'medication' ? 'Which medication is running low? *' : "What's running low? *"}
                </label>
                <input
                  id="alert-item"
                  type="text"
                  value={alertForm.item}
                  onChange={(e) => setAlertForm({ ...alertForm, item: e.target.value })}
                  placeholder={alertType === 'medication'
                    ? 'e.g., Bute, Danilon, Supplements'
                    : 'e.g., Hay, Hard feed, Chaff, Supplements'}
                  required
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="alert-notes">Additional notes</label>
                <textarea
                  id="alert-notes"
                  value={alertForm.notes || ''}
                  onChange={(e) => setAlertForm({ ...alertForm, notes: e.target.value })}
                  placeholder={alertType === 'medication'
                    ? 'e.g., Approximately how many doses left...'
                    : 'Any additional details for the owner...'}
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  onClick={closeAlertModal}
                  disabled={submittingAlert}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ds-btn ds-btn-primary"
                  disabled={submittingAlert || !alertForm.item.trim()}
                >
                  {submittingAlert ? 'Sending...' : 'Notify Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
