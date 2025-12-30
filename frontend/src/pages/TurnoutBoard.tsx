import { useState, useEffect, useCallback } from 'react';
import { turnoutApi, fieldsApi, horsesApi, settingsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import type {
  TurnoutRequest,
  DailyTurnoutSummary,
  TurnoutStatus,
  Field,
  TurnoutGroup,
  HorseCompanion,
  Horse,
  CreateTurnoutGroup,
  CreateHorseCompanion,
  CompanionRelationship,
} from '../types';
import './TurnoutBoard.css';

const RELATIONSHIP_LABELS: Record<CompanionRelationship, string> = {
  preferred: 'Best Friend',
  compatible: 'Compatible',
  incompatible: 'Keep Apart',
};

const RELATIONSHIP_ICONS: Record<CompanionRelationship, string> = {
  preferred: '♥',
  compatible: '✓',
  incompatible: '⚠',
};

export default function TurnoutBoard() {
  const { user } = useAuth();
  const { settings, refreshSettings } = useSettings();
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [summary, setSummary] = useState<DailyTurnoutSummary | null>(null);
  const [pendingRequests, setPendingRequests] = useState<TurnoutRequest[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [turnoutGroups, setTurnoutGroups] = useState<TurnoutGroup[]>([]);
  const [allHorses, setAllHorses] = useState<Horse[]>([]);
  const [companions, setCompanions] = useState<Map<number, HorseCompanion[]>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewMessage, setReviewMessage] = useState('');
  const [triggeringCutoff, setTriggeringCutoff] = useState(false);

  // Modal states
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showCompanionModal, setShowCompanionModal] = useState(false);
  const [selectedHorseForCompanion, setSelectedHorseForCompanion] = useState<Horse | null>(null);

  // Create group form
  const [groupFieldId, setGroupFieldId] = useState<number | null>(null);
  const [groupHorseIds, setGroupHorseIds] = useState<number[]>([]);
  const [groupNotes, setGroupNotes] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Add companion form
  const [newCompanionHorseId, setNewCompanionHorseId] = useState<number | null>(null);
  const [newCompanionType, setNewCompanionType] = useState<CompanionRelationship>('compatible');
  const [newCompanionNotes, setNewCompanionNotes] = useState('');
  const [savingCompanion, setSavingCompanion] = useState(false);

  const isStaff = user?.role === 'admin' || user?.is_yard_staff;

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [summaryData, pendingData, fieldsData, groupsData, horsesData] = await Promise.all([
        turnoutApi.getDailySummary(selectedDate),
        turnoutApi.getPending(),
        fieldsApi.list(),
        fieldsApi.getGroups(selectedDate),
        horsesApi.list(),
      ]);
      setSummary(summaryData);
      setPendingRequests(pendingData);
      setFields(fieldsData);
      setTurnoutGroups(groupsData);
      setAllHorses(horsesData);

      // Load companions for all horses in groups
      const horseIdsInGroups = new Set<number>();
      groupsData.forEach(group => {
        group.horses?.forEach(h => horseIdsInGroups.add(h.horse_id));
      });

      const companionMap = new Map<number, HorseCompanion[]>();
      await Promise.all(
        Array.from(horseIdsInGroups).map(async (horseId) => {
          try {
            const comps = await fieldsApi.getCompanions(horseId);
            companionMap.set(horseId, comps);
          } catch {
            // Ignore errors for individual companion lookups
          }
        })
      );
      setCompanions(companionMap);
    } catch {
      setError('Failed to load turnout data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async (requestId: number, status: TurnoutStatus) => {
    try {
      await turnoutApi.review(requestId, {
        status,
        response_message: reviewMessage || undefined,
      });
      setReviewingId(null);
      setReviewMessage('');
      await loadData();
    } catch {
      setError('Failed to process request');
    }
  };

  const handleCreateGroup = async () => {
    if (!groupFieldId || groupHorseIds.length === 0) return;

    try {
      setCreatingGroup(true);
      const data: CreateTurnoutGroup = {
        turnout_date: selectedDate,
        field_id: groupFieldId,
        horse_ids: groupHorseIds,
        notes: groupNotes || undefined,
      };
      await fieldsApi.createGroup(data);
      setShowCreateGroupModal(false);
      setGroupFieldId(null);
      setGroupHorseIds([]);
      setGroupNotes('');
      await loadData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create turnout group';
      setError(errorMessage);
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Remove this turnout group?')) return;
    try {
      await fieldsApi.deleteGroup(groupId);
      await loadData();
    } catch {
      setError('Failed to delete group');
    }
  };

  const handleMarkTurnedOut = async (groupHorseId: number) => {
    try {
      await fieldsApi.markTurnedOut(groupHorseId);
      await loadData();
    } catch {
      setError('Failed to mark as turned out');
    }
  };

  const handleMarkBroughtIn = async (groupHorseId: number) => {
    try {
      await fieldsApi.markBroughtIn(groupHorseId);
      await loadData();
    } catch {
      setError('Failed to mark as brought in');
    }
  };

  const handleAddCompanion = async () => {
    if (!selectedHorseForCompanion || !newCompanionHorseId) return;

    try {
      setSavingCompanion(true);
      const data: CreateHorseCompanion = {
        companion_horse_id: newCompanionHorseId,
        relationship_type: newCompanionType,
        notes: newCompanionNotes || undefined,
      };
      await fieldsApi.addCompanion(selectedHorseForCompanion.id, data);
      setNewCompanionHorseId(null);
      setNewCompanionType('compatible');
      setNewCompanionNotes('');
      await loadData();
      // Reload companions for this horse
      const comps = await fieldsApi.getCompanions(selectedHorseForCompanion.id);
      setCompanions(prev => new Map(prev).set(selectedHorseForCompanion.id, comps));
    } catch {
      setError('Failed to add companion');
    } finally {
      setSavingCompanion(false);
    }
  };

  const handleRemoveCompanion = async (companionId: number) => {
    if (!confirm('Remove this companion relationship?')) return;
    try {
      await fieldsApi.removeCompanion(companionId);
      if (selectedHorseForCompanion) {
        const comps = await fieldsApi.getCompanions(selectedHorseForCompanion.id);
        setCompanions(prev => new Map(prev).set(selectedHorseForCompanion.id, comps));
      }
    } catch {
      setError('Failed to remove companion');
    }
  };

  const openCompanionModal = async (horse: Horse) => {
    setSelectedHorseForCompanion(horse);
    try {
      const comps = await fieldsApi.getCompanions(horse.id);
      setCompanions(prev => new Map(prev).set(horse.id, comps));
    } catch {
      // Ignore
    }
    setShowCompanionModal(true);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr: string | undefined) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const navigateDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];
  const isCutoffActive = settings?.turnout_cutoff_date === todayStr;

  const handleTriggerCutoff = async () => {
    try {
      setTriggeringCutoff(true);
      await settingsApi.triggerTurnoutCutoff();
      await refreshSettings();
    } catch {
      setError('Failed to trigger cutoff');
    } finally {
      setTriggeringCutoff(false);
    }
  };

  // Get horses already assigned to groups
  const assignedHorseIds = new Set<number>();
  turnoutGroups.forEach(group => {
    group.horses?.forEach(h => assignedHorseIds.add(h.horse_id));
  });

  // Get horses staying in today (approved stay-in requests)
  const stayingInHorseIds = new Set<number>();
  summary?.staying_in.forEach(req => stayingInHorseIds.add(req.horse_id));

  // Get available horses for assignment
  const availableHorses = allHorses.filter(
    h => !assignedHorseIds.has(h.id) && !stayingInHorseIds.has(h.id)
  );

  // Get companions for a horse, optionally filtered by type
  const getCompanionsForHorse = (horseId: number, types?: CompanionRelationship[]) => {
    const horseCompanions = companions.get(horseId) || [];
    if (types) {
      return horseCompanions.filter(c => types.includes(c.relationship_type));
    }
    return horseCompanions;
  };

  // Check if selected horses have incompatible relationships
  const getIncompatibilityWarnings = () => {
    const warnings: string[] = [];
    const selectedSet = new Set(groupHorseIds);

    groupHorseIds.forEach(horseId => {
      const incompatible = getCompanionsForHorse(horseId, ['incompatible']);
      incompatible.forEach(c => {
        if (selectedSet.has(c.companion_horse_id)) {
          const horse = allHorses.find(h => h.id === horseId);
          const comp = allHorses.find(h => h.id === c.companion_horse_id);
          if (horse && comp) {
            const warning = `${horse.name} is incompatible with ${comp.name}`;
            if (!warnings.includes(warning)) {
              warnings.push(warning);
            }
          }
        }
      });
    });

    return warnings;
  };

  if (!isStaff) {
    return <div className="ds-alert ds-alert-error">Staff access required</div>;
  }

  if (isLoading) {
    return <div className="ds-loading">Loading turnout board...</div>;
  }

  return (
    <div className="turnout-board">
      <div className="board-header">
        <h1>Daily Turnout Board</h1>
        <p className="board-subtitle">Manage field assignments and track turnout status</p>
      </div>

      {error && (
        <div className="ds-alert ds-alert-error">
          {error}
          <button className="dismiss-btn" onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Date Navigation */}
      <div className="date-nav">
        <button className="nav-btn" onClick={() => navigateDate(-1)}>
          &larr; Previous Day
        </button>
        <div className="date-display">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-picker"
          />
          <span className="formatted-date">{formatDate(selectedDate)}</span>
          {isToday && <span className="today-badge">Today</span>}
        </div>
        <button className="nav-btn" onClick={() => navigateDate(1)}>
          Next Day &rarr;
        </button>
      </div>

      {/* Request Cutoff Button - only show for today */}
      {isToday && (
        <div className="cutoff-section">
          {isCutoffActive ? (
            <div className="cutoff-active">
              <span className="cutoff-badge">Request Cutoff Active</span>
              <span className="cutoff-info">Livery users cannot cancel turnout requests for today</span>
            </div>
          ) : (
            <button
              className="cutoff-btn"
              onClick={handleTriggerCutoff}
              disabled={triggeringCutoff}
            >
              {triggeringCutoff ? 'Activating...' : 'Activate Request Cutoff'}
            </button>
          )}
        </div>
      )}

      {/* Pending Stay In Requests */}
      {pendingRequests.length > 0 && (
        <div className="pending-section">
          <h2>Pending Turnout Requests ({pendingRequests.length})</h2>
          <div className="pending-list">
            {pendingRequests.map((request) => (
              <div key={request.id} className="pending-card">
                <div className="pending-info">
                  <strong>{request.horse_name}</strong>
                  <span className="pending-date">
                    {new Date(request.request_date).toLocaleDateString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <span className={`type-badge ${request.turnout_type}`}>
                    {request.turnout_type === 'in' ? 'Stay In' : 'Turn Out'}
                  </span>
                </div>
                <div className="pending-details">
                  {request.notes && <span className="request-reason"><strong>Reason:</strong> {request.notes}</span>}
                  <span className="requester">Requested by {request.requested_by_name}</span>
                </div>

                {reviewingId === request.id ? (
                  <div className="review-form">
                    <textarea
                      placeholder="Optional message to owner..."
                      value={reviewMessage}
                      onChange={(e) => setReviewMessage(e.target.value)}
                      rows={2}
                    />
                    <div className="review-actions">
                      <button
                        className="approve-btn"
                        onClick={() => handleReview(request.id, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="decline-btn"
                        onClick={() => handleReview(request.id, 'declined')}
                      >
                        Decline
                      </button>
                      <button
                        className="cancel-btn"
                        onClick={() => {
                          setReviewingId(null);
                          setReviewMessage('');
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pending-actions">
                    <button className="review-btn" onClick={() => setReviewingId(request.id)}>
                      Review
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Field Assignment Grid */}
      <div className="field-assignments-section">
        <div className="section-header">
          <h2>Field Assignments</h2>
          <button className="add-group-btn" onClick={() => setShowCreateGroupModal(true)}>
            + Add Group
          </button>
        </div>

        {turnoutGroups.length === 0 && (
          <div className="empty-fields">
            <p>No turnout groups created for {isToday ? 'today' : formatDate(selectedDate)}.</p>
            <p>Click "Add Group" to assign horses to fields.</p>
          </div>
        )}

        <div className="fields-grid">
          {fields.filter(f => f.is_active).map(field => {
            const group = turnoutGroups.find(g => g.field_id === field.id);
            const horseCount = group?.horses?.length || 0;

            return (
              <div
                key={field.id}
                className={`field-card ${field.is_resting ? 'resting' : ''} ${group ? 'has-group' : ''}`}
              >
                <div className="field-header">
                  <h3>{field.name}</h3>
                  <span className={`field-condition ${field.current_condition}`}>
                    {field.current_condition}
                  </span>
                </div>

                {field.is_resting ? (
                  <div className="field-resting">
                    <span className="resting-badge">Resting</span>
                    {field.rest_end_date && (
                      <span className="rest-until">Until {new Date(field.rest_end_date).toLocaleDateString('en-GB')}</span>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="field-capacity">
                      {horseCount}/{field.max_horses || '∞'} horses
                    </div>

                    {group ? (
                      <div className="group-horses">
                        {group.horses?.map(gh => {
                          const horseCompanions = getCompanionsForHorse(gh.horse_id);
                          const preferredInGroup = horseCompanions.filter(
                            c => c.relationship_type === 'preferred' &&
                              group.horses?.some(h => h.horse_id === c.companion_horse_id)
                          );

                          return (
                            <div key={gh.id} className={`group-horse ${gh.turned_out_at ? 'turned-out' : ''} ${gh.brought_in_at ? 'brought-in' : ''}`}>
                              <div className="horse-info">
                                <span
                                  className="horse-name clickable"
                                  onClick={() => {
                                    const horse = allHorses.find(h => h.id === gh.horse_id);
                                    if (horse) openCompanionModal(horse);
                                  }}
                                >
                                  {gh.horse_name}
                                </span>
                                {gh.stable_name && <span className="stable-name">{gh.stable_name}</span>}
                                {preferredInGroup.length > 0 && (
                                  <span className="companion-badge preferred" title={`With: ${preferredInGroup.map(c => c.companion_horse_name).join(', ')}`}>
                                    ♥
                                  </span>
                                )}
                              </div>

                              <div className="horse-status">
                                {gh.brought_in_at ? (
                                  <span className="status-in" title={`Brought in at ${formatTime(gh.brought_in_at)}`}>
                                    ● In
                                  </span>
                                ) : gh.turned_out_at ? (
                                  <>
                                    <span className="status-out" title={`Turned out at ${formatTime(gh.turned_out_at)}`}>
                                      ○ Out
                                    </span>
                                    <button
                                      className="status-btn bring-in"
                                      onClick={() => handleMarkBroughtIn(gh.id)}
                                      title="Bring In"
                                    >
                                      ↓
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    className="status-btn turn-out"
                                    onClick={() => handleMarkTurnedOut(gh.id)}
                                    title="Turn Out"
                                  >
                                    ↑ Out
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        <div className="group-actions">
                          <button
                            className="remove-group-btn"
                            onClick={() => handleDeleteGroup(group.id)}
                            title="Remove group"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="no-group">
                        <span className="no-assignment">No horses assigned</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Daily Summary - Staying In */}
      {summary && summary.staying_in.length > 0 && (
        <div className="daily-summary">
          <div className="staying-in-section">
            <h2>Staying In {isToday ? 'Today' : ''} ({summary.staying_in.length})</h2>
            <ul className="staying-in-list">
              {summary.staying_in.map((request) => (
                <li key={request.id} className="staying-in-item">
                  <strong>{request.horse_name}</strong>
                  {request.stable_name && (
                    <span className="stable">({request.stable_name})</span>
                  )}
                  {request.notes && <span className="reason">- {request.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Create Turnout Group Modal */}
      {showCreateGroupModal && (
        <div className="ds-modal-overlay" onClick={() => setShowCreateGroupModal(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Create Turnout Group</h2>
              <button className="close-btn" onClick={() => setShowCreateGroupModal(false)}>×</button>
            </div>

            <div className="ds-modal-body">
              <div className="ds-form-group">
                <label>Date</label>
                <input type="date" value={selectedDate} disabled className="form-input" />
              </div>

              <div className="ds-form-group">
                <label>Field *</label>
                <select
                  value={groupFieldId || ''}
                  onChange={e => setGroupFieldId(Number(e.target.value) || null)}
                  className="form-select"
                >
                  <option value="">Select field...</option>
                  {fields
                    .filter(f => f.is_active && !f.is_resting)
                    .map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} ({f.current_condition}) - Max {f.max_horses || '∞'} horses
                      </option>
                    ))}
                </select>
              </div>

              <div className="ds-form-group">
                <label>Select Horses * ({groupHorseIds.length} selected)</label>
                <div className="horse-selection">
                  {availableHorses.length === 0 ? (
                    <p className="no-horses">All horses are already assigned or staying in</p>
                  ) : (
                    availableHorses.map(horse => {
                      const horseCompanions = getCompanionsForHorse(horse.id);
                      const preferred = horseCompanions.filter(c => c.relationship_type === 'preferred');
                      const incompatible = horseCompanions.filter(c => c.relationship_type === 'incompatible');

                      return (
                        <label key={horse.id} className="horse-checkbox">
                          <input
                            type="checkbox"
                            checked={groupHorseIds.includes(horse.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setGroupHorseIds([...groupHorseIds, horse.id]);
                              } else {
                                setGroupHorseIds(groupHorseIds.filter(id => id !== horse.id));
                              }
                            }}
                          />
                          <span className="horse-label">
                            <span className="horse-name">{horse.name}</span>
                            {preferred.length > 0 && (
                              <span className="companion-hint preferred">
                                ♥ {preferred.map(c => c.companion_horse_name).join(', ')}
                              </span>
                            )}
                            {incompatible.length > 0 && (
                              <span className="companion-hint incompatible">
                                ⚠ Avoid: {incompatible.map(c => c.companion_horse_name).join(', ')}
                              </span>
                            )}
                            {horse.turnout_alone && (
                              <span className="companion-hint warning">Must go alone</span>
                            )}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {getIncompatibilityWarnings().length > 0 && (
                <div className="compatibility-warning">
                  <strong>⚠ Warning:</strong>
                  <ul>
                    {getIncompatibilityWarnings().map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="ds-form-group">
                <label>Notes (optional)</label>
                <textarea
                  value={groupNotes}
                  onChange={e => setGroupNotes(e.target.value)}
                  placeholder="Any special instructions..."
                  rows={2}
                  className="form-textarea"
                />
              </div>
            </div>

            <div className="ds-modal-footer">
              <button className="cancel-btn" onClick={() => setShowCreateGroupModal(false)}>
                Cancel
              </button>
              <button
                className="submit-btn"
                onClick={handleCreateGroup}
                disabled={!groupFieldId || groupHorseIds.length === 0 || creatingGroup}
              >
                {creatingGroup ? 'Creating...' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Companion Management Modal */}
      {showCompanionModal && selectedHorseForCompanion && (
        <div className="ds-modal-overlay" onClick={() => setShowCompanionModal(false)}>
          <div className="ds-modal companion-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Companions: {selectedHorseForCompanion.name}</h2>
              <button className="close-btn" onClick={() => setShowCompanionModal(false)}>×</button>
            </div>

            <div className="ds-modal-body">
              <div className="current-companions">
                <h3>Current Companions</h3>
                {companions.get(selectedHorseForCompanion.id)?.length === 0 ? (
                  <p className="no-companions">No companion relationships defined</p>
                ) : (
                  <ul className="companions-list">
                    {companions.get(selectedHorseForCompanion.id)?.map(c => (
                      <li key={c.id} className={`companion-item ${c.relationship_type}`}>
                        <span className="companion-icon">{RELATIONSHIP_ICONS[c.relationship_type]}</span>
                        <span className="companion-name">{c.companion_horse_name}</span>
                        <span className="companion-type">{RELATIONSHIP_LABELS[c.relationship_type]}</span>
                        {c.notes && <span className="companion-notes">{c.notes}</span>}
                        <button
                          className="remove-companion-btn"
                          onClick={() => handleRemoveCompanion(c.id)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="add-companion-form">
                <h3>Add Companion</h3>
                <div className="form-row">
                  <div className="ds-form-group">
                    <label>Horse</label>
                    <select
                      value={newCompanionHorseId || ''}
                      onChange={e => setNewCompanionHorseId(Number(e.target.value) || null)}
                      className="form-select"
                    >
                      <option value="">Select horse...</option>
                      {allHorses
                        .filter(h => h.id !== selectedHorseForCompanion.id)
                        .filter(h => !companions.get(selectedHorseForCompanion.id)?.some(c => c.companion_horse_id === h.id))
                        .map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                        ))}
                    </select>
                  </div>

                  <div className="ds-form-group">
                    <label>Relationship</label>
                    <select
                      value={newCompanionType}
                      onChange={e => setNewCompanionType(e.target.value as CompanionRelationship)}
                      className="form-select"
                    >
                      <option value="preferred">Best Friend (should go together)</option>
                      <option value="compatible">Compatible (can go together)</option>
                      <option value="incompatible">Incompatible (keep apart)</option>
                    </select>
                  </div>
                </div>

                <div className="ds-form-group">
                  <label>Notes (optional)</label>
                  <input
                    type="text"
                    value={newCompanionNotes}
                    onChange={e => setNewCompanionNotes(e.target.value)}
                    placeholder="Any notes about this relationship..."
                    className="form-input"
                  />
                </div>

                <button
                  className="add-companion-btn"
                  onClick={handleAddCompanion}
                  disabled={!newCompanionHorseId || savingCompanion}
                >
                  {savingCompanion ? 'Adding...' : 'Add Companion'}
                </button>
              </div>
            </div>

            <div className="ds-modal-footer">
              <button className="close-modal-btn" onClick={() => setShowCompanionModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
