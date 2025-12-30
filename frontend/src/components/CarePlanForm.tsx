import { useState, useEffect } from 'react';
import type {
  CreateRehabProgram,
  CreateRehabPhase,
  CreateRehabTask,
  RehabProgram,
  TaskFrequency,
} from '../types';
import './CarePlanForm.css';

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

interface CarePlanFormProps {
  horseId: number;
  horseName: string;
  initialData?: RehabProgram; // For edit mode
  onSubmit: (data: CreateRehabProgram) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  isAdmin?: boolean; // When true, shows price field for staff-managed plans
}

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
    duration_minutes: undefined,
    frequency: 'daily',
    instructions: '',
    equipment_needed: '',
    is_feed_based: false,
    feed_time: undefined,
    sequence,
  };
}

export function CarePlanForm({
  horseId,
  horseName,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting,
  isAdmin = false,
}: CarePlanFormProps) {
  const [error, setError] = useState('');
  const [programForm, setProgramForm] = useState<ProgramFormData>({
    horse_id: horseId,
    name: '',
    description: '',
    reason: '',
    prescribed_by: '',
    prescription_date: '',
    start_date: new Date().toISOString().split('T')[0],
    expected_end_date: '',
    notes: '',
    staff_managed: false,
    weekly_care_price: undefined,
    phases: [createEmptyPhase(1)],
  });

  // Initialize form from existing program for edit mode
  useEffect(() => {
    if (initialData) {
      setProgramForm({
        horse_id: horseId,
        name: initialData.name,
        description: initialData.description || '',
        reason: initialData.reason || '',
        prescribed_by: initialData.prescribed_by || '',
        prescription_date: initialData.prescription_date || '',
        start_date: initialData.start_date,
        expected_end_date: initialData.expected_end_date || '',
        notes: initialData.notes || '',
        staff_managed: initialData.staff_managed || false,
        weekly_care_price: initialData.weekly_care_price || undefined,
        phases: initialData.phases?.map((phase) => ({
          phase_number: phase.phase_number,
          name: phase.name,
          description: phase.description || '',
          duration_days: phase.duration_days,
          start_day: phase.start_day,
          tasks: phase.tasks?.map((task) => ({
            task_type: task.task_type,
            description: task.description,
            duration_minutes: task.duration_minutes,
            frequency: task.frequency,
            instructions: task.instructions || '',
            equipment_needed: task.equipment_needed || '',
            is_feed_based: task.is_feed_based || false,
            feed_time: task.feed_time || undefined,
            sequence: task.sequence,
          })) || [createEmptyTask(1)],
        })) || [createEmptyPhase(1)],
      });
    }
  }, [initialData, horseId]);

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
    newTasks.forEach((task, i) => (task.sequence = i + 1));
    handleUpdatePhase(phaseIndex, { tasks: newTasks });
  };

  const handleUpdateTask = (
    phaseIndex: number,
    taskIndex: number,
    updates: Partial<CreateRehabTask>
  ) => {
    const phase = programForm.phases[phaseIndex];
    const newTasks = [...phase.tasks];
    newTasks[taskIndex] = { ...newTasks[taskIndex], ...updates };
    handleUpdatePhase(phaseIndex, { tasks: newTasks });
  };

  const calculateEndDate = () => {
    if (!programForm.start_date || programForm.phases.length === 0) return '';
    const lastPhase = programForm.phases[programForm.phases.length - 1];
    const totalDays = lastPhase.start_day + lastPhase.duration_days - 1;
    const startDate = new Date(programForm.start_date);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalDays - 1);
    return endDate.toISOString().split('T')[0];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!programForm.name.trim()) {
      setError('Please enter a program name');
      return;
    }

    // Validate tasks have descriptions
    for (const phase of programForm.phases) {
      for (const task of phase.tasks) {
        if (!task.description.trim()) {
          setError(`Please add a description for all tasks in ${phase.name}`);
          return;
        }
      }
    }

    setError('');

    // Clean up form data - convert empty strings to undefined for optional fields
    const cleanedData: CreateRehabProgram = {
      horse_id: programForm.horse_id,
      name: programForm.name,
      description: programForm.description || undefined,
      reason: programForm.reason || undefined,
      prescribed_by: programForm.prescribed_by || undefined,
      prescription_date: programForm.prescription_date || undefined,
      start_date: programForm.start_date,
      expected_end_date: programForm.expected_end_date || undefined,
      notes: programForm.notes || undefined,
      phases: programForm.phases.map(phase => ({
        phase_number: phase.phase_number,
        name: phase.name,
        description: phase.description || undefined,
        duration_days: phase.duration_days,
        start_day: phase.start_day,
        tasks: phase.tasks.map(task => ({
          task_type: task.task_type,
          description: task.description,
          duration_minutes: task.duration_minutes || undefined,
          frequency: task.frequency,
          instructions: task.instructions || undefined,
          equipment_needed: task.equipment_needed || undefined,
          is_feed_based: task.is_feed_based || false,
          feed_time: task.is_feed_based ? task.feed_time : undefined,
          sequence: task.sequence,
        })),
      })),
    };

    await onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit} className="care-plan-form">
      {error && <div className="form-error">{error}</div>}

      {/* Horse Info */}
      <div className="horse-context">
        <strong>Horse:</strong> {horseName}
      </div>

      {/* Care Plan Details */}
      <section className="form-section">
        <h3>Care Plan Details</h3>
        <div className="ds-form-group">
          <label>Care Plan Name *</label>
          <input
            type="text"
            value={programForm.name}
            onChange={(e) => setProgramForm({ ...programForm, name: e.target.value })}
            placeholder="e.g., Post-colic Recovery, Wound Care, Senior Care"
            required
          />
        </div>

        <div className="ds-form-group">
          <label>Reason for Care Plan</label>
          <input
            type="text"
            value={programForm.reason || ''}
            onChange={(e) => setProgramForm({ ...programForm, reason: e.target.value })}
            placeholder="e.g., Suspensory injury, wound treatment, old age"
          />
        </div>

        <div className="form-row">
          <div className="ds-form-group">
            <label>Prescribed By</label>
            <input
              type="text"
              value={programForm.prescribed_by || ''}
              onChange={(e) => setProgramForm({ ...programForm, prescribed_by: e.target.value })}
              placeholder="Vet or physio name"
            />
          </div>
          <div className="ds-form-group">
            <label>Prescription Date</label>
            <input
              type="date"
              value={programForm.prescription_date || ''}
              onChange={(e) =>
                setProgramForm({ ...programForm, prescription_date: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-row">
          <div className="ds-form-group">
            <label>Start Date *</label>
            <input
              type="date"
              value={programForm.start_date}
              onChange={(e) => setProgramForm({ ...programForm, start_date: e.target.value })}
              required
            />
          </div>
          <div className="ds-form-group">
            <label>Expected End Date</label>
            <input
              type="date"
              value={programForm.expected_end_date || calculateEndDate()}
              onChange={(e) =>
                setProgramForm({ ...programForm, expected_end_date: e.target.value })
              }
            />
          </div>
        </div>

        <div className="ds-form-group">
          <label>Description</label>
          <textarea
            value={programForm.description || ''}
            onChange={(e) => setProgramForm({ ...programForm, description: e.target.value })}
            placeholder="Overall care plan description"
            rows={2}
          />
        </div>

        <div className="ds-form-group checkbox-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={programForm.staff_managed || false}
              onChange={(e) => setProgramForm({
                ...programForm,
                staff_managed: e.target.checked,
                weekly_care_price: e.target.checked ? programForm.weekly_care_price : undefined
              })}
            />
            <span className="checkbox-text">
              <strong>{isAdmin ? 'Staff Managed' : 'Request Staff Management'}</strong>
              <small>
                {isAdmin
                  ? 'All tasks handled by yard staff (e.g., rehab livery package)'
                  : 'Request yard staff to perform all care tasks. You will receive a price quote for approval.'}
              </small>
            </span>
          </label>
        </div>

        {programForm.staff_managed && isAdmin && (
          <div className="ds-form-group price-group">
            <label>Weekly Care Price (£)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={programForm.weekly_care_price || ''}
              onChange={(e) => setProgramForm({
                ...programForm,
                weekly_care_price: e.target.value ? parseFloat(e.target.value) : undefined
              })}
              placeholder="e.g., 130.00"
            />
            <small className="form-hint">Weekly supplement charged for staff care (insurance claimable)</small>
          </div>
        )}

        {programForm.staff_managed && !isAdmin && (
          <div className="quote-notice">
            <p>When you submit this care plan, our team will review the tasks and send you a weekly price quote. You can accept or decline the quote before staff management begins.</p>
          </div>
        )}
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
                  onChange={(e) => handleUpdatePhase(phaseIndex, { name: e.target.value })}
                  placeholder="e.g., Box Rest, Walk Only"
                />
              </div>
              <div className="ds-form-group small">
                <label>Duration (days)</label>
                <input
                  type="number"
                  min="1"
                  value={phase.duration_days}
                  onChange={(e) =>
                    handleUpdatePhase(phaseIndex, { duration_days: Number(e.target.value) })
                  }
                />
              </div>
              <div className="ds-form-group small">
                <label>Starts Day</label>
                <input
                  type="number"
                  min="1"
                  value={phase.start_day}
                  onChange={(e) =>
                    handleUpdatePhase(phaseIndex, { start_day: Number(e.target.value) })
                  }
                  disabled={phaseIndex === 0}
                />
              </div>
            </div>

            <div className="ds-form-group">
              <label>Description</label>
              <textarea
                value={phase.description || ''}
                onChange={(e) => handleUpdatePhase(phaseIndex, { description: e.target.value })}
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
                  <div className="ds-form-group">
                    <label>Type</label>
                    <select
                      value={task.task_type}
                      onChange={(e) =>
                        handleUpdateTask(phaseIndex, taskIndex, { task_type: e.target.value })
                      }
                    >
                      <option value="exercise">Exercise</option>
                      <option value="walking">Walking</option>
                      <option value="lunging">Lunging</option>
                      <option value="ridden">Ridden Work</option>
                      <option value="therapy">Therapy</option>
                      <option value="medication">Medication</option>
                      <option value="observation">Observation</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="ds-form-group flex-grow">
                    <label>Description *</label>
                    <input
                      type="text"
                      value={task.description}
                      onChange={(e) =>
                        handleUpdateTask(phaseIndex, taskIndex, { description: e.target.value })
                      }
                      placeholder="What needs to be done"
                      required
                    />
                  </div>
                  <div className="ds-form-group small">
                    <label>Duration (min)</label>
                    <input
                      type="number"
                      min="1"
                      value={task.duration_minutes ?? ''}
                      onChange={(e) =>
                        handleUpdateTask(phaseIndex, taskIndex, {
                          duration_minutes: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                      placeholder="Optional"
                    />
                  </div>
                  <div className="ds-form-group">
                    <label>Frequency</label>
                    <select
                      value={task.frequency || 'daily'}
                      onChange={(e) =>
                        handleUpdateTask(phaseIndex, taskIndex, {
                          frequency: e.target.value as TaskFrequency,
                        })
                      }
                    >
                      {Object.entries(frequencyLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {phase.tasks.length > 1 && (
                    <button
                      type="button"
                      className="btn-remove-task"
                      onClick={() => handleRemoveTask(phaseIndex, taskIndex)}
                    >
                      &times;
                    </button>
                  )}
                  {/* Feed-based medication options - shown for medication tasks */}
                  {task.task_type === 'medication' && (
                    <div className="task-feed-options">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={task.is_feed_based || false}
                          onChange={(e) =>
                            handleUpdateTask(phaseIndex, taskIndex, {
                              is_feed_based: e.target.checked,
                              feed_time: e.target.checked ? 'both' : undefined,
                            })
                          }
                        />
                        Add to feed schedule (not a yard task)
                      </label>
                      {task.is_feed_based && (
                        <div className="ds-form-group inline">
                          <label>Feed Time:</label>
                          <select
                            value={task.feed_time || 'both'}
                            onChange={(e) =>
                              handleUpdateTask(phaseIndex, taskIndex, { feed_time: e.target.value })
                            }
                          >
                            <option value="morning">Morning Only</option>
                            <option value="evening">Evening Only</option>
                            <option value="both">Morning &amp; Evening</option>
                          </select>
                        </div>
                      )}
                    </div>
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
            onChange={(e) => setProgramForm({ ...programForm, notes: e.target.value })}
            placeholder="Additional notes or special instructions for the vet"
            rows={3}
          />
        </div>
      </section>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn-submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : initialData ? 'Update Care Plan' : 'Create Care Plan'}
        </button>
      </div>
    </form>
  );
}
