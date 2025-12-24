import { useState, useEffect } from 'react';
import { feedApi } from '../services/api';
import type { FeedSummary, FeedSupplyAlert, CreateFeedAlert } from '../types';
import './FeedDuties.css';

type FeedTime = 'morning' | 'evening';
type ViewMode = 'simple' | 'detailed';

export default function FeedDuties() {
  const [schedules, setSchedules] = useState<FeedSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedTime, setFeedTime] = useState<FeedTime>(() => {
    const hour = new Date().getHours();
    return hour < 14 ? 'morning' : 'evening';
  });
  const [viewMode, setViewMode] = useState<ViewMode>('simple');
  const [expandedHorse, setExpandedHorse] = useState<number | null>(null);

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
    return <div className="loading">Loading feed duties...</div>;
  }

  return (
    <div className="feed-duties">
      <div className="feed-header">
        <h1>Feed Schedule</h1>
        <p className="feed-date">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Low Feed Alerts Summary */}
      {allAlerts.length > 0 && (
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

      {/* View Controls */}
      <div className="feed-controls">
        {/* Feed Time Toggle */}
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

        {/* View Mode Toggle */}
        <div className="view-mode-toggle">
          <button
            className={`mode-btn ${viewMode === 'simple' ? 'active' : ''}`}
            onClick={() => setViewMode('simple')}
          >
            Simple
          </button>
          <button
            className={`mode-btn ${viewMode === 'detailed' ? 'active' : ''}`}
            onClick={() => setViewMode('detailed')}
          >
            Detailed
          </button>
        </div>
      </div>

      {schedules.length === 0 ? (
        <div className="empty-state">
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
                const isExpanded = expandedHorse === schedule.horse_id;

                return (
                  <div
                    key={schedule.horse_id}
                    className={`feed-card ${viewMode === 'detailed' ? 'detailed' : ''}`}
                  >
                    <div className="feed-card-header">
                      <h3
                        className="horse-name"
                        onClick={() => viewMode === 'detailed' && setExpandedHorse(isExpanded ? null : schedule.horse_id)}
                        style={viewMode === 'detailed' ? { cursor: 'pointer' } : undefined}
                      >
                        {schedule.horse_name}
                        {(schedule.unresolved_alerts?.length ?? 0) > 0 && (
                          <span className="alert-badge" title="Has low feed alerts">!</span>
                        )}
                        {viewMode === 'detailed' && (schedule.pending_additions?.length ?? 0) > 0 && (
                          <span className="pending-badge" title="Has pending additions">
                            {schedule.pending_additions?.length} pending
                          </span>
                        )}
                      </h3>
                      <div className="card-actions">
                        {viewMode === 'detailed' && (
                          <span
                            className="expand-icon"
                            onClick={() => setExpandedHorse(isExpanded ? null : schedule.horse_id)}
                          >
                            {isExpanded ? '−' : '+'}
                          </span>
                        )}
                        <button
                          className="low-feed-btn"
                          onClick={() => openAlertModal(schedule.horse_id, schedule.horse_name, 'feed')}
                          title="Report low feed"
                        >
                          Low Feed
                        </button>
                        {(schedule.rehab_medications?.length ?? 0) > 0 && (
                          <button
                            className="low-meds-btn"
                            onClick={() => {
                              const medNames = schedule.rehab_medications
                                ?.map(med => med.description)
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

                    {/* Simple View - Just current feed */}
                    {viewMode === 'simple' && (
                      <div className="feed-content">
                        <pre className="feed-details">
                          {currentFeed || 'No feed specified'}
                        </pre>
                        {/* Rehab Medications for this feed time */}
                        {(schedule.rehab_medications?.filter(
                          med => med.feed_time === feedTime || med.feed_time === 'both'
                        ).length ?? 0) > 0 && (
                          <div className="rehab-meds-simple">
                            <span className="rehab-label">Rehab Meds:</span>
                            {schedule.rehab_medications
                              ?.filter(med => med.feed_time === feedTime || med.feed_time === 'both')
                              .map((med) => (
                                <span key={med.task_id} className="rehab-med-item">
                                  {med.description}
                                  {med.instructions && <span className="med-instructions"> - {med.instructions}</span>}
                                </span>
                              ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Detailed View - Expandable full details */}
                    {viewMode === 'detailed' && isExpanded && (
                      <div className="feed-details-expanded">
                        {feedInfo ? (
                          <div className="feed-section">
                            <div className="feed-info-grid">
                              <div className={`feed-info-item ${feedTime === 'morning' ? 'highlighted' : ''}`}>
                                <span className="feed-label">Morning Feed:</span>
                                <span className="feed-value">{feedInfo.morning_feed || 'Not specified'}</span>
                              </div>
                              <div className={`feed-info-item ${feedTime === 'evening' ? 'highlighted' : ''}`}>
                                <span className="feed-label">Evening Feed:</span>
                                <span className="feed-value">{feedInfo.evening_feed || 'Not specified'}</span>
                              </div>
                              {feedInfo.supplements && (
                                <div className="feed-info-item full-width">
                                  <span className="feed-label">Supplements:</span>
                                  <span className="feed-value">{feedInfo.supplements}</span>
                                </div>
                              )}
                              {feedInfo.special_instructions && (
                                <div className="feed-info-item full-width">
                                  <span className="feed-label">Special Instructions:</span>
                                  <span className="feed-value">{feedInfo.special_instructions}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="no-data">No regular feed requirements set</p>
                        )}

                        {(schedule.active_additions?.length ?? 0) > 0 && (
                          <div className="feed-section">
                            <h4>Active Additions</h4>
                            <ul className="additions-list">
                              {schedule.active_additions?.map((addition) => (
                                <li key={addition.id}>
                                  <strong>{addition.name}</strong>
                                  {addition.dosage && ` - ${addition.dosage}`}
                                  {addition.feed_time && ` (${addition.feed_time})`}
                                  {addition.reason && <p className="addition-notes">{addition.reason}</p>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(schedule.rehab_medications?.length ?? 0) > 0 && (
                          <div className="feed-section rehab-section">
                            <h4>Rehab Medications</h4>
                            <ul className="rehab-meds-list">
                              {schedule.rehab_medications?.map((med) => (
                                <li
                                  key={med.task_id}
                                  className={`rehab-med-entry ${
                                    med.feed_time === feedTime || med.feed_time === 'both'
                                      ? 'current-time'
                                      : ''
                                  }`}
                                >
                                  <strong>{med.description}</strong>
                                  <span className="med-timing">
                                    {med.feed_time === 'both'
                                      ? 'Morning & Evening'
                                      : med.feed_time === 'morning'
                                      ? 'Morning only'
                                      : 'Evening only'}
                                  </span>
                                  {med.instructions && (
                                    <p className="med-instructions">{med.instructions}</p>
                                  )}
                                  <span className="rehab-program-badge">{med.program_name}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {(schedule.unresolved_alerts?.length ?? 0) > 0 && (
                          <div className="feed-section alerts-section">
                            <h4>Supply Alerts</h4>
                            <ul className="supply-alerts-list">
                              {schedule.unresolved_alerts?.map((alert) => (
                                <li key={alert.id} className="supply-alert-item">
                                  <strong>{alert.item}</strong>
                                  {alert.notes && <p>{alert.notes}</p>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Detailed View - Collapsed summary */}
                    {viewMode === 'detailed' && !isExpanded && (
                      <div className="feed-content collapsed">
                        <span className="feed-summary">
                          {currentFeed ? currentFeed.substring(0, 60) + (currentFeed.length > 60 ? '...' : '') : 'No feed specified'}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Low Feed/Medication Alert Modal */}
      {showAlertModal && alertHorse && (
        <div className="modal-overlay" onClick={closeAlertModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{alertType === 'medication' ? 'Report Low Medication' : 'Report Low Feed'}</h2>
            <p className="modal-subtitle">for {alertHorse.name}</p>

            <form onSubmit={handleSubmitAlert}>
              <div className="form-group">
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

              <div className="form-group">
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
                  className="btn-secondary"
                  onClick={closeAlertModal}
                  disabled={submittingAlert}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
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
