import { useState, useEffect, useCallback } from 'react';
import { rehabApi, horsesApi } from '../../services/api';
import { useRequestState } from '../../hooks';
import { ConfirmModal, Select, FormGroup } from '../../components/ui';
import { TaskHistoryPanel } from '../../components/TaskHistoryPanel';
import type {
  RehabProgram,
  RehabPhase,
  RehabTask,
  CreateRehabProgram,
  CreateRehabPhase,
  CreateRehabTask,
  Horse,
  RehabStatus,
  TaskFrequency,
  RehabTaskLog
} from '../../types';
import '../../styles/AdminCarePlans.css';

const statusLabels: Record<RehabStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusColors: Record<RehabStatus, string> = {
  draft: 'status-draft',
  active: 'status-active',
  paused: 'status-paused',
  completed: 'status-completed',
  cancelled: 'status-cancelled',
};

const frequencyLabels: Record<TaskFrequency, string> = {
  daily: 'Daily',
  twice_daily: 'Twice Daily',
  every_other_day: 'Every Other Day',
  weekly: 'Weekly',
  as_needed: 'As Needed',
};

interface PhaseFormData extends Omit<CreateRehabPhase, 'tasks'> {
  tasks: CreateRehabTask[];
}

interface ProgramFormData extends Omit<CreateRehabProgram, 'phases'> {
  phases: PhaseFormData[];
}

export default function AdminCarePlans() {
  const [programs, setPrograms] = useState<RehabProgram[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<RehabProgram | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Request state
  const { loading, error, setError, setLoading } = useRequestState(true);

  // Confirmation targets
  const [completeTarget, setCompleteTarget] = useState<number | null>(null);
  const [completePhaseTarget, setCompletePhaseTarget] = useState<{ programId: number; phaseId: number } | null>(null);

  // Task history state
  const [activeTab, setActiveTab] = useState<'overview' | 'history'>('overview');
  const [programTaskLogs, setProgramTaskLogs] = useState<RehabTaskLog[]>([]);
  const [loadingTaskLogs, setLoadingTaskLogs] = useState(false);
  const [logFilters, setLogFilters] = useState<{
    startDate: string;
    endDate: string;
  }>({
    startDate: '',
    endDate: '',
  });

  const [programForm, setProgramForm] = useState<ProgramFormData>({
    horse_id: 0,
    name: '',
    description: '',
    reason: '',
    prescribed_by: '',
    prescription_date: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: '',
    notes: '',
    phases: [createEmptyPhase(1)],
  });

  function createEmptyPhase(phaseNumber: number): PhaseFormData {
    return {
      phase_number: phaseNumber,
      name: `Phase ${phaseNumber}`,
      description: '',
      duration_days: 14,
      start_day: phaseNumber === 1 ? 1 : 0,
      tasks: [createEmptyTask(1)],
    };
  }

  function createEmptyTask(sequence: number): CreateRehabTask {
    return {
      task_type: 'exercise',
      description: '',
      duration_minutes: 15,
      frequency: 'daily',
      instructions: '',
      equipment_needed: '',
      sequence,
    };
  }

  const loadData = useCallback(async () => {
    try {
      const [programsData, horsesData] = await Promise.all([
        rehabApi.list(statusFilter || undefined),
        horsesApi.list()
      ]);
      setPrograms(programsData);
      setHorses(horsesData);
    } catch {
      setError('Failed to load care plans');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateModal = () => {
    setProgramForm({
      horse_id: horses.length > 0 ? horses[0].id : 0,
      name: '',
      description: '',
      reason: '',
      prescribed_by: '',
      prescription_date: '',
      start_date: new Date().toISOString().split('T')[0],
      expected_end_date: '',
      notes: '',
      phases: [createEmptyPhase(1)],
    });
    setShowCreateModal(true);
  };

  const openDetailModal = async (programId: number) => {
    try {
      setLoading(true);
      const program = await rehabApi.get(programId);
      setSelectedProgram(program);
      setActiveTab('overview');
      setProgramTaskLogs([]);
      setLogFilters({ startDate: '', endDate: '' });
      setShowDetailModal(true);
    } catch (err) {
      setError('Failed to load program details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadProgramTaskLogs = async (horseId: number, programId: number, startDate?: string, endDate?: string) => {
    try {
      setLoadingTaskLogs(true);
      const logs = await rehabApi.getTaskLogs(
        horseId,
        programId,
        startDate || logFilters.startDate || undefined,
        endDate || logFilters.endDate || undefined
      );
      setProgramTaskLogs(logs);
    } catch (err) {
      console.error('Failed to load task logs:', err);
    } finally {
      setLoadingTaskLogs(false);
    }
  };

  const handleHistoryFilterChange = (startDate: string, endDate: string) => {
    setLogFilters({ startDate, endDate });
    if (selectedProgram) {
      loadProgramTaskLogs(selectedProgram.horse_id, selectedProgram.id, startDate, endDate);
    }
  };

  const handleTabChange = (tab: 'overview' | 'history') => {
    setActiveTab(tab);
    if (tab === 'history' && selectedProgram && programTaskLogs.length === 0) {
      loadProgramTaskLogs(selectedProgram.horse_id, selectedProgram.id);
    }
  };

  const handleAddPhase = () => {
    const newPhaseNumber = programForm.phases.length + 1;
    const prevPhase = programForm.phases[programForm.phases.length - 1];
    const newStartDay = prevPhase ? prevPhase.start_day + prevPhase.duration_days : 1;

    setProgramForm({
      ...programForm,
      phases: [
        ...programForm.phases,
        {
          ...createEmptyPhase(newPhaseNumber),
          start_day: newStartDay,
        },
      ],
    });
  };

  const handleRemovePhase = (index: number) => {
    if (programForm.phases.length <= 1) return;
    const newPhases = programForm.phases.filter((_, i) => i !== index);
    // Renumber phases
    newPhases.forEach((phase, i) => {
      phase.phase_number = i + 1;
      if (i === 0) {
        phase.start_day = 1;
      } else {
        phase.start_day = newPhases[i - 1].start_day + newPhases[i - 1].duration_days;
      }
    });
    setProgramForm({ ...programForm, phases: newPhases });
  };

  const handleUpdatePhase = (index: number, updates: Partial<PhaseFormData>) => {
    const newPhases = [...programForm.phases];
    newPhases[index] = { ...newPhases[index], ...updates };

    // Recalculate start days if duration changed
    if ('duration_days' in updates) {
      for (let i = index + 1; i < newPhases.length; i++) {
        newPhases[i].start_day = newPhases[i - 1].start_day + newPhases[i - 1].duration_days;
      }
    }

    setProgramForm({ ...programForm, phases: newPhases });
  };

  const handleAddTask = (phaseIndex: number) => {
    const phase = programForm.phases[phaseIndex];
    const newSequence = phase.tasks.length + 1;
    handleUpdatePhase(phaseIndex, {
      tasks: [...phase.tasks, createEmptyTask(newSequence)],
    });
  };

  const handleRemoveTask = (phaseIndex: number, taskIndex: number) => {
    const phase = programForm.phases[phaseIndex];
    if (phase.tasks.length <= 1) return;
    const newTasks = phase.tasks.filter((_, i) => i !== taskIndex);
    newTasks.forEach((task, i) => task.sequence = i + 1);
    handleUpdatePhase(phaseIndex, { tasks: newTasks });
  };

  const handleUpdateTask = (phaseIndex: number, taskIndex: number, updates: Partial<CreateRehabTask>) => {
    const phase = programForm.phases[phaseIndex];
    const newTasks = [...phase.tasks];
    newTasks[taskIndex] = { ...newTasks[taskIndex], ...updates };
    handleUpdatePhase(phaseIndex, { tasks: newTasks });
  };

  const handleCreateProgram = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!programForm.horse_id) {
      setError('Please select a horse');
      return;
    }

    if (!programForm.name.trim()) {
      setError('Please enter a program name');
      return;
    }

    try {
      setSaving(true);
      await rehabApi.create(programForm as CreateRehabProgram);
      await loadData();
      setShowCreateModal(false);
      setError('');
    } catch (err) {
      setError('Failed to create program');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (programId: number) => {
    try {
      await rehabApi.activate(programId);
      await loadData();
      if (selectedProgram?.id === programId) {
        const updated = await rehabApi.get(programId);
        setSelectedProgram(updated);
      }
    } catch {
      setError('Failed to activate program');
    }
  };

  const handleComplete = async () => {
    if (completeTarget === null) return;
    try {
      await rehabApi.complete(completeTarget);
      await loadData();
      if (selectedProgram?.id === completeTarget) {
        const updated = await rehabApi.get(completeTarget);
        setSelectedProgram(updated);
      }
      setCompleteTarget(null);
    } catch {
      setError('Failed to complete program');
    }
  };

  const handleCompletePhase = async () => {
    if (!completePhaseTarget) return;
    try {
      await rehabApi.completePhase(completePhaseTarget.programId, completePhaseTarget.phaseId);
      const updated = await rehabApi.get(completePhaseTarget.programId);
      setSelectedProgram(updated);
      setCompletePhaseTarget(null);
      await loadData();
    } catch {
      setError('Failed to complete phase');
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Calculate expected end date based on phases
  const calculateEndDate = () => {
    if (!programForm.start_date || programForm.phases.length === 0) return '';
    const lastPhase = programForm.phases[programForm.phases.length - 1];
    const totalDays = lastPhase.start_day + lastPhase.duration_days - 1;
    const startDate = new Date(programForm.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays - 1);
    return endDate.toISOString().split('T')[0];
  };

  // Group programs by status
  const draftPrograms = programs.filter(p => p.status === 'draft');
  const activePrograms = programs.filter(p => p.status === 'active');
  const pausedPrograms = programs.filter(p => p.status === 'paused');
  const completedPrograms = programs.filter(p => p.status === 'completed');

  if (loading && programs.length === 0) {
    return (
      <div className="admin-care-plans-page">
        <div className="ds-loading">Loading care plans...</div>
      </div>
    );
  }

  return (
    <div className="admin-care-plans-page">
      <header className="page-header">
        <h1>Care Plans</h1>
        <div className="header-actions">
          <FormGroup label="Status">
            <Select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </FormGroup>
          <button className="btn-add" onClick={openCreateModal}>
            + New Care Plan
          </button>
        </div>
      </header>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Active Care Plans */}
      {activePrograms.length > 0 && (
        <section className="programs-section">
          <h2>Active Care Plans ({activePrograms.length})</h2>
          <div className="programs-grid">
            {activePrograms.map(program => (
              <div key={program.id} className="program-card active" onClick={() => openDetailModal(program.id)}>
                <div className="program-header">
                  <h3>{program.name}</h3>
                  <span className={`status-badge ${statusColors[program.status]}`}>
                    {statusLabels[program.status]}
                  </span>
                </div>
                <p className="program-horse">{program.horse_name}</p>
                <div className="program-progress">
                  <span className="phase-info">
                    Phase {program.current_phase} of {program.total_phases || '?'}
                  </span>
                </div>
                <div className="program-dates">
                  <span>Started: {formatDate(program.start_date)}</span>
                  {program.expected_end_date && (
                    <span>Expected: {formatDate(program.expected_end_date)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Draft Care Plans */}
      {draftPrograms.length > 0 && (
        <section className="programs-section">
          <h2>Draft Care Plans ({draftPrograms.length})</h2>
          <div className="programs-grid">
            {draftPrograms.map(program => (
              <div key={program.id} className="program-card draft" onClick={() => openDetailModal(program.id)}>
                <div className="program-header">
                  <h3>{program.name}</h3>
                  <span className={`status-badge ${statusColors[program.status]}`}>
                    {statusLabels[program.status]}
                  </span>
                </div>
                <p className="program-horse">{program.horse_name}</p>
                <div className="program-dates">
                  <span>Planned start: {formatDate(program.start_date)}</span>
                </div>
                <div className="program-actions" onClick={e => e.stopPropagation()}>
                  <button className="btn-small success" onClick={() => handleActivate(program.id)}>
                    Activate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Paused Care Plans */}
      {pausedPrograms.length > 0 && (
        <section className="programs-section">
          <h2>Paused Care Plans ({pausedPrograms.length})</h2>
          <div className="programs-grid">
            {pausedPrograms.map(program => (
              <div key={program.id} className="program-card paused" onClick={() => openDetailModal(program.id)}>
                <div className="program-header">
                  <h3>{program.name}</h3>
                  <span className={`status-badge ${statusColors[program.status]}`}>
                    {statusLabels[program.status]}
                  </span>
                </div>
                <p className="program-horse">{program.horse_name}</p>
                <div className="program-progress">
                  <span className="phase-info">Phase {program.current_phase}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Completed Care Plans */}
      {completedPrograms.length > 0 && (
        <section className="programs-section completed">
          <h2>Completed Care Plans ({completedPrograms.length})</h2>
          <div className="programs-grid">
            {completedPrograms.map(program => (
              <div key={program.id} className="program-card completed" onClick={() => openDetailModal(program.id)}>
                <div className="program-header">
                  <h3>{program.name}</h3>
                  <span className={`status-badge ${statusColors[program.status]}`}>
                    {statusLabels[program.status]}
                  </span>
                </div>
                <p className="program-horse">{program.horse_name}</p>
                <div className="program-dates">
                  <span>Completed: {formatDate(program.actual_end_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {programs.length === 0 && (
        <div className="ds-empty">
          <p>No care plans found</p>
          <button className="btn-add" onClick={openCreateModal}>
            Create First Care Plan
          </button>
        </div>
      )}

      {/* Create Care Plan Modal */}
      {showCreateModal && (
        <div className="ds-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="ds-modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Create Care Plan</h2>
              <button className="ds-modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleCreateProgram}>
              <div className="ds-modal-body">
                {/* Care Plan Details */}
                <section className="form-section">
                  <h3>Care Plan Details</h3>
                  <div className="form-row">
                    <FormGroup label="Horse" required>
                      <Select
                        value={programForm.horse_id}
                        onChange={e => setProgramForm({ ...programForm, horse_id: Number(e.target.value) })}
                        required
                      >
                        <option value={0}>Select a horse...</option>
                        {horses.map(horse => (
                          <option key={horse.id} value={horse.id}>{horse.name}</option>
                        ))}
                      </Select>
                    </FormGroup>
                    <div className="ds-form-group">
                      <label>Care Plan Name *</label>
                      <input
                        type="text"
                        value={programForm.name}
                        onChange={e => setProgramForm({ ...programForm, name: e.target.value })}
                        placeholder="e.g., Post-colic Recovery, Wound Care, Senior Care"
                        required
                      />
                    </div>
                  </div>

                  <div className="ds-form-group">
                    <label>Reason for Care Plan</label>
                    <input
                      type="text"
                      value={programForm.reason || ''}
                      onChange={e => setProgramForm({ ...programForm, reason: e.target.value })}
                      placeholder="e.g., Suspensory injury, wound treatment, old age"
                    />
                  </div>

                  <div className="form-row">
                    <div className="ds-form-group">
                      <label>Prescribed By</label>
                      <input
                        type="text"
                        value={programForm.prescribed_by || ''}
                        onChange={e => setProgramForm({ ...programForm, prescribed_by: e.target.value })}
                        placeholder="Vet or physio name"
                      />
                    </div>
                    <div className="ds-form-group">
                      <label>Prescription Date</label>
                      <input
                        type="date"
                        value={programForm.prescription_date || ''}
                        onChange={e => setProgramForm({ ...programForm, prescription_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="ds-form-group">
                      <label>Start Date *</label>
                      <input
                        type="date"
                        value={programForm.start_date}
                        onChange={e => setProgramForm({ ...programForm, start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="ds-form-group">
                      <label>Expected End Date</label>
                      <input
                        type="date"
                        value={programForm.expected_end_date || calculateEndDate()}
                        onChange={e => setProgramForm({ ...programForm, expected_end_date: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="ds-form-group">
                    <label>Description</label>
                    <textarea
                      value={programForm.description || ''}
                      onChange={e => setProgramForm({ ...programForm, description: e.target.value })}
                      placeholder="Overall care plan description"
                      rows={2}
                    />
                  </div>
                </section>

                {/* Phases */}
                <section className="form-section">
                  <div className="section-header">
                    <h3>Phases</h3>
                    <button type="button" className="btn-small" onClick={handleAddPhase}>
                      + Add Phase
                    </button>
                  </div>

                  {programForm.phases.map((phase, phaseIndex) => (
                    <div key={phaseIndex} className="phase-card">
                      <div className="phase-header">
                        <h4>Phase {phase.phase_number}</h4>
                        {programForm.phases.length > 1 && (
                          <button
                            type="button"
                            className="btn-remove"
                            onClick={() => handleRemovePhase(phaseIndex)}
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="form-row">
                        <div className="ds-form-group">
                          <label>Name</label>
                          <input
                            type="text"
                            value={phase.name}
                            onChange={e => handleUpdatePhase(phaseIndex, { name: e.target.value })}
                            placeholder="e.g., Box Rest, Walk Only"
                          />
                        </div>
                        <div className="ds-form-group small">
                          <label>Duration (days)</label>
                          <input
                            type="number"
                            min="1"
                            value={phase.duration_days}
                            onChange={e => handleUpdatePhase(phaseIndex, { duration_days: Number(e.target.value) })}
                          />
                        </div>
                        <div className="ds-form-group small">
                          <label>Starts Day</label>
                          <input
                            type="number"
                            min="1"
                            value={phase.start_day}
                            onChange={e => handleUpdatePhase(phaseIndex, { start_day: Number(e.target.value) })}
                            disabled={phaseIndex === 0}
                          />
                        </div>
                      </div>

                      <div className="ds-form-group">
                        <label>Description</label>
                        <textarea
                          value={phase.description || ''}
                          onChange={e => handleUpdatePhase(phaseIndex, { description: e.target.value })}
                          placeholder="Phase goals and restrictions"
                          rows={2}
                        />
                      </div>

                      {/* Tasks */}
                      <div className="tasks-section">
                        <div className="tasks-header">
                          <h5>Tasks</h5>
                          <button
                            type="button"
                            className="btn-small"
                            onClick={() => handleAddTask(phaseIndex)}
                          >
                            + Add Task
                          </button>
                        </div>

                        {phase.tasks.map((task, taskIndex) => (
                          <div key={taskIndex} className="task-row">
                            <FormGroup label="Type">
                              <Select
                                value={task.task_type}
                                onChange={e => handleUpdateTask(phaseIndex, taskIndex, { task_type: e.target.value })}
                              >
                                <option value="exercise">Exercise</option>
                                <option value="walking">Walking</option>
                                <option value="lunging">Lunging</option>
                                <option value="ridden">Ridden Work</option>
                                <option value="therapy">Therapy</option>
                                <option value="medication">Medication</option>
                                <option value="observation">Observation</option>
                                <option value="other">Other</option>
                              </Select>
                            </FormGroup>
                            <div className="ds-form-group flex-grow">
                              <label>Description *</label>
                              <input
                                type="text"
                                value={task.description}
                                onChange={e => handleUpdateTask(phaseIndex, taskIndex, { description: e.target.value })}
                                placeholder="What needs to be done"
                                required
                              />
                            </div>
                            <div className="ds-form-group small">
                              <label>Duration (min)</label>
                              <input
                                type="number"
                                min="1"
                                value={task.duration_minutes || ''}
                                onChange={e => handleUpdateTask(phaseIndex, taskIndex, { duration_minutes: e.target.value ? Number(e.target.value) : undefined })}
                              />
                            </div>
                            <FormGroup label="Frequency">
                              <Select
                                value={task.frequency || 'daily'}
                                onChange={e => handleUpdateTask(phaseIndex, taskIndex, { frequency: e.target.value as TaskFrequency })}
                              >
                                {Object.entries(frequencyLabels).map(([value, label]) => (
                                  <option key={value} value={value}>{label}</option>
                                ))}
                              </Select>
                            </FormGroup>
                            {phase.tasks.length > 1 && (
                              <button
                                type="button"
                                className="btn-remove-task"
                                onClick={() => handleRemoveTask(phaseIndex, taskIndex)}
                              >
                                &times;
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>

                <section className="form-section">
                  <h3>Notes</h3>
                  <div className="ds-form-group">
                    <textarea
                      value={programForm.notes || ''}
                      onChange={e => setProgramForm({ ...programForm, notes: e.target.value })}
                      placeholder="Additional notes or special instructions"
                      rows={3}
                    />
                  </div>
                </section>
              </div>

              <div className="ds-modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? 'Creating...' : 'Create Care Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Care Plan Detail Modal */}
      {showDetailModal && selectedProgram && (
        <div className="ds-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="ds-modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <div className="modal-title-row">
                <h2>{selectedProgram.name}</h2>
                <span className={`status-badge ${statusColors[selectedProgram.status]}`}>
                  {statusLabels[selectedProgram.status]}
                </span>
              </div>
              <button className="ds-modal-close" onClick={() => setShowDetailModal(false)}>&times;</button>
            </div>

            {/* Tab Navigation */}
            <div className="modal-tabs">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => handleTabChange('overview')}
              >
                Care Plan Overview
              </button>
              <button
                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => handleTabChange('history')}
              >
                Task History
              </button>
            </div>

            <div className="ds-modal-body">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <>
                  <div className="detail-info">
                    <div className="info-row">
                      <span className="info-label">Horse:</span>
                      <span className="info-value">{selectedProgram.horse_name}</span>
                    </div>
                    {selectedProgram.reason && (
                      <div className="info-row">
                        <span className="info-label">Reason:</span>
                        <span className="info-value">{selectedProgram.reason}</span>
                      </div>
                    )}
                    {selectedProgram.prescribed_by && (
                      <div className="info-row">
                        <span className="info-label">Prescribed By:</span>
                        <span className="info-value">{selectedProgram.prescribed_by}</span>
                      </div>
                    )}
                    <div className="info-row">
                      <span className="info-label">Start Date:</span>
                      <span className="info-value">{formatDate(selectedProgram.start_date)}</span>
                    </div>
                    {selectedProgram.expected_end_date && (
                      <div className="info-row">
                        <span className="info-label">Expected End:</span>
                        <span className="info-value">{formatDate(selectedProgram.expected_end_date)}</span>
                      </div>
                    )}
                    {selectedProgram.actual_end_date && (
                      <div className="info-row">
                        <span className="info-label">Completed:</span>
                        <span className="info-value">{formatDate(selectedProgram.actual_end_date)}</span>
                      </div>
                    )}
                    {selectedProgram.description && (
                      <div className="info-row">
                        <span className="info-label">Description:</span>
                        <span className="info-value">{selectedProgram.description}</span>
                      </div>
                    )}
                    {selectedProgram.staff_managed && (
                      <div className="info-row">
                        <span className="info-label">Staff Managed:</span>
                        <span className="info-value staff-managed-yes">Yes - All tasks handled by staff</span>
                      </div>
                    )}
                    {selectedProgram.staff_managed && selectedProgram.weekly_care_price && (
                      <div className="info-row">
                        <span className="info-label">Weekly Care Price:</span>
                        <span className="info-value">£{selectedProgram.weekly_care_price}/week</span>
                      </div>
                    )}
                  </div>

                  {/* Quote Setting for Staff-Managed Draft Plans */}
                  {selectedProgram.staff_managed && selectedProgram.status === 'draft' && !selectedProgram.weekly_care_price && (
                    <div className="quote-setting-section">
                      <h4>Set Quote for Staff-Managed Care</h4>
                      <p className="quote-explanation">
                        This livery client has requested staff-managed care. Review the care plan tasks below and set a weekly price quote.
                      </p>
                      <div className="quote-form">
                        <div className="ds-form-group">
                          <label>Weekly Care Price (£)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="e.g., 130.00"
                            id="quote-price-input"
                          />
                        </div>
                        <button
                          className="ds-btn ds-btn-primary"
                          onClick={async () => {
                            const input = document.getElementById('quote-price-input') as HTMLInputElement;
                            const price = parseFloat(input.value);
                            if (isNaN(price) || price <= 0) {
                              alert('Please enter a valid price');
                              return;
                            }
                            try {
                              await rehabApi.update(selectedProgram.id, { weekly_care_price: price });
                              await loadData();
                              // Refresh selected program
                              const updated = await rehabApi.get(selectedProgram.id);
                              setSelectedProgram(updated);
                            } catch {
                              setError('Failed to set quote');
                            }
                          }}
                        >
                          Send Quote to Client
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quote Sent Notice */}
                  {selectedProgram.staff_managed && selectedProgram.status === 'draft' && selectedProgram.weekly_care_price && (
                    <div className="quote-sent-notice">
                      <h4>Quote Sent</h4>
                      <p>
                        A quote of <strong>£{selectedProgram.weekly_care_price}/week</strong> has been sent to the client.
                        Waiting for their response.
                      </p>
                    </div>
                  )}

                  {/* Phases */}
                  <section className="detail-section">
                    <h3>Phases</h3>
                    <div className="phases-list">
                      {selectedProgram.phases?.map((phase: RehabPhase) => (
                        <div
                          key={phase.id}
                          className={`phase-detail ${phase.is_completed ? 'completed' : ''} ${phase.phase_number === selectedProgram.current_phase && selectedProgram.status === 'active' ? 'current' : ''}`}
                        >
                          <div className="phase-detail-header">
                            <div className="phase-title">
                              <span className="phase-number">{phase.phase_number}</span>
                              <h4>{phase.name}</h4>
                              {phase.is_completed && <span className="completed-badge">Completed</span>}
                              {phase.phase_number === selectedProgram.current_phase && selectedProgram.status === 'active' && (
                                <span className="current-badge">Current</span>
                              )}
                            </div>
                            <span className="phase-duration">
                              Days {phase.start_day} - {phase.start_day + phase.duration_days - 1}
                            </span>
                          </div>

                          {phase.description && (
                            <p className="phase-description">{phase.description}</p>
                          )}

                          {phase.tasks && phase.tasks.length > 0 && (
                            <div className="tasks-list">
                              {phase.tasks.map((task: RehabTask) => (
                                <div key={task.id} className="task-detail">
                                  <span className="task-type">{task.task_type}</span>
                                  <span className="task-description">{task.description}</span>
                                  <span className="task-frequency">{frequencyLabels[task.frequency]}</span>
                                  {task.duration_minutes && (
                                    <span className="task-duration">{task.duration_minutes} min</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {phase.phase_number === selectedProgram.current_phase &&
                           selectedProgram.status === 'active' &&
                           !phase.is_completed && (
                            <button
                              className="btn-complete-phase"
                              onClick={() => setCompletePhaseTarget({ programId: selectedProgram.id, phaseId: phase.id })}
                            >
                              Complete Phase
                            </button>
                          )}

                          {phase.is_completed && phase.completed_date && (
                            <div className="phase-completion">
                              Completed: {formatDate(phase.completed_date)}
                              {phase.completion_notes && <p>{phase.completion_notes}</p>}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {selectedProgram.notes && (
                    <section className="detail-section">
                      <h3>Notes</h3>
                      <p>{selectedProgram.notes}</p>
                    </section>
                  )}
                </>
              )}

              {/* Task History Tab */}
              {activeTab === 'history' && (
                <TaskHistoryPanel
                  logs={programTaskLogs}
                  loading={loadingTaskLogs}
                  showFilters={true}
                  showMetrics={true}
                  onFilterChange={handleHistoryFilterChange}
                />
              )}
            </div>

            <div className="ds-modal-footer">
              {selectedProgram.status === 'draft' && (
                <button className="btn-success" onClick={() => handleActivate(selectedProgram.id)}>
                  Activate Care Plan
                </button>
              )}
              {selectedProgram.status === 'active' && (
                <button className="btn-complete" onClick={() => setCompleteTarget(selectedProgram.id)}>
                  Complete Care Plan
                </button>
              )}
              <button className="btn-cancel" onClick={() => setShowDetailModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Program Confirmation */}
      <ConfirmModal
        isOpen={completeTarget !== null}
        onClose={() => setCompleteTarget(null)}
        onConfirm={handleComplete}
        title="Complete Care Plan"
        message="Mark this program as completed?"
        confirmLabel="Complete"
        variant="primary"
      />

      {/* Complete Phase Confirmation */}
      <ConfirmModal
        isOpen={!!completePhaseTarget}
        onClose={() => setCompletePhaseTarget(null)}
        onConfirm={handleCompletePhase}
        title="Complete Phase"
        message="Complete this phase and advance to the next?"
        confirmLabel="Complete Phase"
        variant="primary"
      />
    </div>
  );
}
