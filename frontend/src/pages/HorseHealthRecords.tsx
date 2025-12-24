import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { healthRecordsApi, horsesApi, rehabApi, servicesApi } from '../services/api';
import { CarePlanForm } from '../components/CarePlanForm';
import { TaskHistoryPanel } from '../components/TaskHistoryPanel';
import type {
  Horse,
  HealthRecordsSummary,
  FarrierRecord,
  DentistRecord,
  VaccinationRecord,
  WormingRecord,
  CreateFarrierRecord,
  CreateDentistRecord,
  CreateVaccinationRecord,
  CreateWormingRecord,
  VaccineType,
  RehabProgram,
  RehabPhase,
  RehabTaskLog,
  CreateRehabProgram,
  DailyRehabTask,
  CreateRehabTaskLog,
  MyServiceRequestsSummary,
  ServiceRequest,
} from '../types';
import './HorseHealthRecords.css';

type RecordTab = 'summary' | 'farrier' | 'dentist' | 'vaccination' | 'worming' | 'careplans';

export function HorseHealthRecords() {
  const { horseId } = useParams<{ horseId: string }>();
  const navigate = useNavigate();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [summary, setSummary] = useState<HealthRecordsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<RecordTab>('summary');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<number | null>(null);
  const [rehabPrograms, setRehabPrograms] = useState<RehabProgram[]>([]);
  const [myRequests, setMyRequests] = useState<MyServiceRequestsSummary | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [programTaskLogs, setProgramTaskLogs] = useState<RehabTaskLog[]>([]);
  const [loadingTaskLogs, setLoadingTaskLogs] = useState(false);

  // Rehab form state
  const [showRehabModal, setShowRehabModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState<RehabProgram | null>(null);
  const [savingRehab, setSavingRehab] = useState(false);

  // Staff assistance request state
  const [showAssistanceForm, setShowAssistanceForm] = useState<number | null>(null); // program ID
  const [assistanceForm, setAssistanceForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    specialInstructions: '',
  });
  const [savingAssistance, setSavingAssistance] = useState(false);
  const [assistanceSuccess, setAssistanceSuccess] = useState<number | null>(null);

  // Task logging state
  const [tasksDue, setTasksDue] = useState<DailyRehabTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showTaskLogModal, setShowTaskLogModal] = useState(false);
  const [loggingTask, setLoggingTask] = useState<DailyRehabTask | null>(null);
  const [taskLogForm, setTaskLogForm] = useState({
    was_completed: true,
    skip_reason: '',
    actual_duration_minutes: 0,
    horse_response: '',
    concerns: '',
    vet_notified: false,
  });
  const [savingTaskLog, setSavingTaskLog] = useState(false);
  const [_taskLogError, _setTaskLogError] = useState('');

  // Form states for each record type
  const [farrierForm, setFarrierForm] = useState<CreateFarrierRecord>({
    visit_date: '',
    farrier_name: '',
    work_done: '',
    cost: undefined,
    next_due: '',
    notes: '',
  });

  const [dentistForm, setDentistForm] = useState<CreateDentistRecord>({
    visit_date: '',
    dentist_name: '',
    treatment: '',
    cost: undefined,
    next_due: '',
    notes: '',
  });

  const [vaccinationForm, setVaccinationForm] = useState<CreateVaccinationRecord>({
    vaccination_date: '',
    vaccine_type: 'flu_tetanus',
    vaccine_name: '',
    batch_number: '',
    administered_by: '',
    next_due: '',
    notes: '',
  });

  const [wormingForm, setWormingForm] = useState<CreateWormingRecord>({
    treatment_date: '',
    product: '',
    worm_count_date: '',
    worm_count_result: undefined,
    next_due: '',
    notes: '',
  });

  const loadData = async () => {
    if (!horseId) return;
    setIsLoading(true);
    try {
      const [horseData, summaryData, rehabData, requestsData] = await Promise.all([
        horsesApi.get(parseInt(horseId)),
        healthRecordsApi.getSummary(parseInt(horseId)),
        rehabApi.getHorsePrograms(parseInt(horseId)),
        servicesApi.getMyRequests().catch(() => null),
      ]);
      setHorse(horseData);
      setSummary(summaryData);
      setRehabPrograms(rehabData);
      setMyRequests(requestsData);
    } catch {
      setError('Failed to load health records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horseId]);

  // Load tasks due when on care plans tab and there are active programs
  useEffect(() => {
    if (activeTab === 'careplans' && rehabPrograms.some(p => p.status === 'active')) {
      loadTasksDue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, rehabPrograms]);

  const loadProgramTaskLogs = async (programId: number) => {
    if (!horseId) return;
    setLoadingTaskLogs(true);
    try {
      const logs = await rehabApi.getTaskLogs(parseInt(horseId), programId);
      setProgramTaskLogs(logs);
    } catch (err) {
      console.error('Failed to load task logs', err);
      setProgramTaskLogs([]);
    } finally {
      setLoadingTaskLogs(false);
    }
  };

  const handleSelectProgram = async (programId: number) => {
    if (selectedProgramId === programId) {
      setSelectedProgramId(null);
      setProgramTaskLogs([]);
    } else {
      setSelectedProgramId(programId);
      await loadProgramTaskLogs(programId);
    }
  };

  // Rehab handlers
  const handleCreateRehab = () => {
    setEditingProgram(null);
    setShowRehabModal(true);
  };

  const handleEditRehab = async (programId: number) => {
    try {
      const program = await rehabApi.get(programId);
      setEditingProgram(program);
      setShowRehabModal(true);
    } catch {
      setError('Failed to load program details');
    }
  };

  const handleSubmitRehab = async (data: CreateRehabProgram) => {
    if (!horseId) return;
    try {
      setSavingRehab(true);
      if (editingProgram) {
        // When editing, only update metadata (phases can't be updated via this endpoint)
        const updateData = {
          name: data.name,
          description: data.description,
          reason: data.reason,
          prescribed_by: data.prescribed_by,
          prescription_date: data.prescription_date,
          start_date: data.start_date,
          expected_end_date: data.expected_end_date,
          notes: data.notes,
        };
        await rehabApi.update(editingProgram.id, updateData);
      } else {
        await rehabApi.create(data);
      }
      setShowRehabModal(false);
      setEditingProgram(null);
      await loadData();
    } catch (err) {
      console.error('Rehab program error:', err);
      setError(editingProgram ? 'Failed to update program' : 'Failed to create program');
    } finally {
      setSavingRehab(false);
    }
  };

  const handleCancelRehab = () => {
    setShowRehabModal(false);
    setEditingProgram(null);
  };

  const handleActivateProgram = async (programId: number) => {
    try {
      await rehabApi.activate(programId);
      await loadData();
    } catch {
      setError('Failed to activate program');
    }
  };

  const handleCompleteProgram = async (programId: number) => {
    if (!confirm('Mark this program as completed?')) return;
    try {
      await rehabApi.complete(programId);
      await loadData();
      if (selectedProgramId === programId) {
        setSelectedProgramId(null);
        setProgramTaskLogs([]);
      }
    } catch {
      setError('Failed to complete program');
    }
  };

  // Accept staff-managed care plan quote - activates the program
  const handleAcceptCarePlanQuote = async (programId: number) => {
    try {
      await rehabApi.activate(programId);
      await loadData();
    } catch {
      setError('Failed to accept quote');
    }
  };

  // Decline staff-managed care plan quote - cancels the program
  const handleDeclineCarePlanQuote = async (programId: number) => {
    if (!confirm('Decline this quote? The care plan will be cancelled.')) return;
    try {
      await rehabApi.update(programId, { status: 'cancelled' });
      await loadData();
    } catch {
      setError('Failed to decline quote');
    }
  };

  const handleCompletePhase = async (programId: number, phaseId: number) => {
    const notes = prompt('Enter any notes for phase completion (optional):');
    try {
      await rehabApi.completePhase(programId, phaseId, notes || undefined);
      await loadData();
      // Reload task logs if viewing this program
      if (selectedProgramId === programId) {
        await loadProgramTaskLogs(programId);
      }
    } catch {
      setError('Failed to complete phase');
    }
  };

  // Staff assistance handlers
  const handleOpenAssistanceForm = (program: RehabProgram) => {
    setShowAssistanceForm(program.id);
    const today = new Date().toISOString().split('T')[0];
    setAssistanceForm({
      startDate: today,
      endDate: today,
      specialInstructions: '',
    });
    setAssistanceSuccess(null);
  };

  const handleCloseAssistanceForm = () => {
    setShowAssistanceForm(null);
    setAssistanceSuccess(null);
  };

  const handleSubmitAssistance = async (program: RehabProgram) => {
    if (!horseId) return;

    try {
      setSavingAssistance(true);
      await servicesApi.createRehabAssistanceRequest({
        horse_id: parseInt(horseId),
        rehab_program_id: program.id,
        start_date: assistanceForm.startDate,
        end_date: assistanceForm.endDate,
        special_instructions: assistanceForm.specialInstructions || undefined,
      });
      setAssistanceSuccess(program.id);
      // Reload data to update button states
      await loadData();
    } catch (err) {
      console.error('Failed to request assistance:', err);
      setError('Failed to request staff assistance');
    } finally {
      setSavingAssistance(false);
    }
  };

  // Get the most recent request for a rehab program to determine button state
  const getRehabRequestState = (programId: number): {
    status: 'none' | 'pending' | 'quoted' | 'approved';
    request?: ServiceRequest;
  } => {
    if (!myRequests) return { status: 'none' };

    // Check quoted requests first (most actionable)
    const quotedRequest = myRequests.quoted_requests.find(
      r => r.rehab_program_id === programId
    );
    if (quotedRequest) return { status: 'quoted', request: quotedRequest };

    // Check pending requests (awaiting quote)
    const pendingRequest = myRequests.pending_requests.find(
      r => r.rehab_program_id === programId
    );
    if (pendingRequest) return { status: 'pending', request: pendingRequest };

    // Check scheduled requests (already approved)
    const scheduledRequest = myRequests.scheduled_requests.find(
      r => r.rehab_program_id === programId
    );
    if (scheduledRequest) return { status: 'approved', request: scheduledRequest };

    return { status: 'none' };
  };

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `£${numPrice.toFixed(2)}`;
  };

  const handleAcceptQuote = async (requestId: number) => {
    try {
      await servicesApi.acceptQuote(requestId);
      await loadData();
    } catch {
      setError('Failed to accept quote');
    }
  };

  const handleRejectQuote = async (requestId: number) => {
    if (!confirm('Decline this quote? This will cancel the request.')) return;
    try {
      await servicesApi.rejectQuote(requestId);
      await loadData();
    } catch {
      setError('Failed to decline quote');
    }
  };

  // Task logging handlers
  const loadTasksDue = async () => {
    if (!horseId) return;
    try {
      setLoadingTasks(true);
      const today = new Date().toISOString().split('T')[0];
      const tasks = await rehabApi.getHorseTasksDue(parseInt(horseId), today);
      setTasksDue(tasks);
    } catch (err) {
      console.error('Failed to load tasks due', err);
      setTasksDue([]);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleOpenTaskLogModal = (task: DailyRehabTask) => {
    setLoggingTask(task);
    setTaskLogForm({
      was_completed: true,
      skip_reason: '',
      actual_duration_minutes: task.duration_minutes || 0,
      horse_response: '',
      concerns: '',
      vet_notified: false,
    });
    setShowTaskLogModal(true);
  };

  const handleCloseTaskLogModal = () => {
    setShowTaskLogModal(false);
    setLoggingTask(null);
  };

  const handleSubmitTaskLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loggingTask || !horseId) return;

    try {
      setSavingTaskLog(true);
      const logData: CreateRehabTaskLog = {
        task_id: loggingTask.task_id,
        program_id: loggingTask.program_id,
        horse_id: loggingTask.horse_id,
        log_date: new Date().toISOString().split('T')[0],
        was_completed: taskLogForm.was_completed,
        skip_reason: !taskLogForm.was_completed ? taskLogForm.skip_reason : undefined,
        actual_duration_minutes: taskLogForm.actual_duration_minutes || undefined,
        horse_response: taskLogForm.horse_response || undefined,
        concerns: taskLogForm.concerns || undefined,
        vet_notified: taskLogForm.vet_notified,
      };
      await rehabApi.logTask(logData);
      handleCloseTaskLogModal();
      await loadTasksDue(); // Refresh tasks
      // Also refresh task logs if viewing the program
      if (selectedProgramId === loggingTask.program_id) {
        await loadProgramTaskLogs(loggingTask.program_id);
      }
    } catch {
      setError('Failed to log task');
    } finally {
      setSavingTaskLog(false);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const getDueBadgeClass = (dueDate: string | undefined) => {
    if (!dueDate) return '';
    const due = new Date(dueDate);
    const now = new Date();
    const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue < 0) return 'overdue';
    if (daysUntilDue <= 14) return 'due-soon';
    return 'ok';
  };

  const resetForms = () => {
    setFarrierForm({ visit_date: '', farrier_name: '', work_done: '', cost: undefined, next_due: '', notes: '' });
    setDentistForm({ visit_date: '', dentist_name: '', treatment: '', cost: undefined, next_due: '', notes: '' });
    setVaccinationForm({ vaccination_date: '', vaccine_type: 'flu_tetanus', vaccine_name: '', batch_number: '', administered_by: '', next_due: '', notes: '' });
    setWormingForm({ treatment_date: '', product: '', worm_count_date: '', worm_count_result: undefined, next_due: '', notes: '' });
    setShowForm(false);
    setEditingRecord(null);
  };

  const handleSubmitFarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;
    try {
      if (editingRecord) {
        await healthRecordsApi.updateFarrier(parseInt(horseId), editingRecord, farrierForm);
      } else {
        await healthRecordsApi.createFarrier(parseInt(horseId), farrierForm);
      }
      resetForms();
      await loadData();
    } catch {
      setError('Failed to save farrier record');
    }
  };

  const handleSubmitDentist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;
    try {
      if (editingRecord) {
        await healthRecordsApi.updateDentist(parseInt(horseId), editingRecord, dentistForm);
      } else {
        await healthRecordsApi.createDentist(parseInt(horseId), dentistForm);
      }
      resetForms();
      await loadData();
    } catch {
      setError('Failed to save dentist record');
    }
  };

  const handleSubmitVaccination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;
    try {
      if (editingRecord) {
        await healthRecordsApi.updateVaccination(parseInt(horseId), editingRecord, vaccinationForm);
      } else {
        await healthRecordsApi.createVaccination(parseInt(horseId), vaccinationForm);
      }
      resetForms();
      await loadData();
    } catch {
      setError('Failed to save vaccination record');
    }
  };

  const handleSubmitWorming = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;
    try {
      if (editingRecord) {
        await healthRecordsApi.updateWorming(parseInt(horseId), editingRecord, wormingForm);
      } else {
        await healthRecordsApi.createWorming(parseInt(horseId), wormingForm);
      }
      resetForms();
      await loadData();
    } catch {
      setError('Failed to save worming record');
    }
  };

  const handleEditFarrier = (record: FarrierRecord) => {
    setFarrierForm({
      visit_date: record.visit_date,
      farrier_name: record.farrier_name || '',
      work_done: record.work_done,
      cost: record.cost,
      next_due: record.next_due || '',
      notes: record.notes || '',
    });
    setEditingRecord(record.id);
    setShowForm(true);
  };

  const handleEditDentist = (record: DentistRecord) => {
    setDentistForm({
      visit_date: record.visit_date,
      dentist_name: record.dentist_name || '',
      treatment: record.treatment,
      cost: record.cost,
      next_due: record.next_due || '',
      notes: record.notes || '',
    });
    setEditingRecord(record.id);
    setShowForm(true);
  };

  const handleEditVaccination = (record: VaccinationRecord) => {
    setVaccinationForm({
      vaccination_date: record.vaccination_date,
      vaccine_type: record.vaccine_type,
      vaccine_name: record.vaccine_name || '',
      batch_number: record.batch_number || '',
      administered_by: record.administered_by || '',
      next_due: record.next_due || '',
      notes: record.notes || '',
    });
    setEditingRecord(record.id);
    setShowForm(true);
  };

  const handleEditWorming = (record: WormingRecord) => {
    setWormingForm({
      treatment_date: record.treatment_date,
      product: record.product,
      worm_count_date: record.worm_count_date || '',
      worm_count_result: record.worm_count_result,
      next_due: record.next_due || '',
      notes: record.notes || '',
    });
    setEditingRecord(record.id);
    setShowForm(true);
  };

  const handleDelete = async (type: RecordTab, recordId: number) => {
    if (!horseId || !confirm('Are you sure you want to delete this record?')) return;
    try {
      switch (type) {
        case 'farrier':
          await healthRecordsApi.deleteFarrier(parseInt(horseId), recordId);
          break;
        case 'dentist':
          await healthRecordsApi.deleteDentist(parseInt(horseId), recordId);
          break;
        case 'vaccination':
          await healthRecordsApi.deleteVaccination(parseInt(horseId), recordId);
          break;
        case 'worming':
          await healthRecordsApi.deleteWorming(parseInt(horseId), recordId);
          break;
      }
      await loadData();
    } catch {
      setError('Failed to delete record');
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  if (!horse || !summary) {
    return <div className="error-message">Horse not found</div>;
  }

  return (
    <div className="health-records-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/book/my-horses')}>
          &larr; Back to My Horses
        </button>
        <h1>{horse.name} - Health Records</h1>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => { setActiveTab('summary'); resetForms(); }}
        >
          Summary
        </button>
        <button
          className={`tab ${activeTab === 'farrier' ? 'active' : ''}`}
          onClick={() => { setActiveTab('farrier'); resetForms(); }}
        >
          Farrier
        </button>
        <button
          className={`tab ${activeTab === 'dentist' ? 'active' : ''}`}
          onClick={() => { setActiveTab('dentist'); resetForms(); }}
        >
          Dentist
        </button>
        <button
          className={`tab ${activeTab === 'vaccination' ? 'active' : ''}`}
          onClick={() => { setActiveTab('vaccination'); resetForms(); }}
        >
          Vaccinations
        </button>
        <button
          className={`tab ${activeTab === 'worming' ? 'active' : ''}`}
          onClick={() => { setActiveTab('worming'); resetForms(); }}
        >
          Worming
        </button>
        <button
          className={`tab ${activeTab === 'careplans' ? 'active' : ''}`}
          onClick={() => { setActiveTab('careplans'); resetForms(); }}
        >
          Care Plans {rehabPrograms.filter(p => p.status === 'active').length > 0 && (
            <span className="tab-badge">{rehabPrograms.filter(p => p.status === 'active').length}</span>
          )}
        </button>
      </div>

      <div className="tab-content">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <div className="summary-grid">
            <div className="summary-card">
              <h3>Farrier</h3>
              <p className="record-count">{summary.farrier_records.length} records</p>
              {summary.next_farrier_due && (
                <p className={`next-due ${getDueBadgeClass(summary.next_farrier_due)}`}>
                  Next due: {formatDate(summary.next_farrier_due)}
                </p>
              )}
            </div>
            <div className="summary-card">
              <h3>Dentist</h3>
              <p className="record-count">{summary.dentist_records.length} records</p>
              {summary.next_dentist_due && (
                <p className={`next-due ${getDueBadgeClass(summary.next_dentist_due)}`}>
                  Next due: {formatDate(summary.next_dentist_due)}
                </p>
              )}
            </div>
            <div className="summary-card">
              <h3>Vaccinations</h3>
              <p className="record-count">{summary.vaccination_records.length} records</p>
              {summary.next_vaccination_due && (
                <p className={`next-due ${getDueBadgeClass(summary.next_vaccination_due)}`}>
                  Next due: {formatDate(summary.next_vaccination_due)}
                </p>
              )}
            </div>
            <div className="summary-card">
              <h3>Worming</h3>
              <p className="record-count">{summary.worming_records.length} records</p>
              {summary.next_worming_due && (
                <p className={`next-due ${getDueBadgeClass(summary.next_worming_due)}`}>
                  Next due: {formatDate(summary.next_worming_due)}
                </p>
              )}
            </div>
            <div className="summary-card">
              <h3>Care Plans</h3>
              <p className="record-count">{rehabPrograms.length} plans</p>
              {rehabPrograms.filter(p => p.status === 'active').length > 0 ? (
                <p className="next-due due-soon">
                  {rehabPrograms.filter(p => p.status === 'active').length} active
                </p>
              ) : (
                <p className="next-due ok">No active plans</p>
              )}
            </div>
          </div>
        )}

        {/* Farrier Tab */}
        {activeTab === 'farrier' && (
          <div className="records-section">
            <div className="section-header">
              <h2>Farrier Records</h2>
              <button className="add-btn" onClick={() => setShowForm(true)}>
                + Add Record
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmitFarrier} className="record-form">
                <h3>{editingRecord ? 'Edit Record' : 'New Farrier Visit'}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Visit Date</label>
                    <input
                      type="date"
                      value={farrierForm.visit_date}
                      onChange={(e) => setFarrierForm({ ...farrierForm, visit_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Farrier Name</label>
                    <input
                      type="text"
                      value={farrierForm.farrier_name}
                      onChange={(e) => setFarrierForm({ ...farrierForm, farrier_name: e.target.value })}
                      placeholder="Name of farrier"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Work Done</label>
                  <textarea
                    value={farrierForm.work_done}
                    onChange={(e) => setFarrierForm({ ...farrierForm, work_done: e.target.value })}
                    placeholder="e.g., Full set, trim, front shoes only"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={farrierForm.cost || ''}
                      onChange={(e) => setFarrierForm({ ...farrierForm, cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Next Due Date</label>
                    <input
                      type="date"
                      value={farrierForm.next_due}
                      onChange={(e) => setFarrierForm({ ...farrierForm, next_due: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={farrierForm.notes}
                    onChange={(e) => setFarrierForm({ ...farrierForm, notes: e.target.value })}
                    placeholder="Any additional notes"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={resetForms} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Save</button>
                </div>
              </form>
            )}

            {summary.farrier_records.length === 0 ? (
              <p className="no-records">No farrier records yet</p>
            ) : (
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Farrier</th>
                    <th>Work Done</th>
                    <th>Cost</th>
                    <th>Next Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.farrier_records.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.visit_date)}</td>
                      <td>{record.farrier_name || '-'}</td>
                      <td>{record.work_done}</td>
                      <td>{record.cost ? `£${record.cost}` : '-'}</td>
                      <td className={getDueBadgeClass(record.next_due)}>{formatDate(record.next_due)}</td>
                      <td className="actions">
                        <button onClick={() => handleEditFarrier(record)}>Edit</button>
                        <button onClick={() => handleDelete('farrier', record.id)} className="delete">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Dentist Tab */}
        {activeTab === 'dentist' && (
          <div className="records-section">
            <div className="section-header">
              <h2>Dentist Records</h2>
              <button className="add-btn" onClick={() => setShowForm(true)}>
                + Add Record
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmitDentist} className="record-form">
                <h3>{editingRecord ? 'Edit Record' : 'New Dentist Visit'}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Visit Date</label>
                    <input
                      type="date"
                      value={dentistForm.visit_date}
                      onChange={(e) => setDentistForm({ ...dentistForm, visit_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Dentist Name</label>
                    <input
                      type="text"
                      value={dentistForm.dentist_name}
                      onChange={(e) => setDentistForm({ ...dentistForm, dentist_name: e.target.value })}
                      placeholder="Name of dentist"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Treatment</label>
                  <textarea
                    value={dentistForm.treatment}
                    onChange={(e) => setDentistForm({ ...dentistForm, treatment: e.target.value })}
                    placeholder="e.g., Routine rasp, wolf teeth removed"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={dentistForm.cost || ''}
                      onChange={(e) => setDentistForm({ ...dentistForm, cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Next Due Date</label>
                    <input
                      type="date"
                      value={dentistForm.next_due}
                      onChange={(e) => setDentistForm({ ...dentistForm, next_due: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={dentistForm.notes}
                    onChange={(e) => setDentistForm({ ...dentistForm, notes: e.target.value })}
                    placeholder="Any additional notes"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={resetForms} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Save</button>
                </div>
              </form>
            )}

            {summary.dentist_records.length === 0 ? (
              <p className="no-records">No dentist records yet</p>
            ) : (
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Dentist</th>
                    <th>Treatment</th>
                    <th>Cost</th>
                    <th>Next Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.dentist_records.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.visit_date)}</td>
                      <td>{record.dentist_name || '-'}</td>
                      <td>{record.treatment}</td>
                      <td>{record.cost ? `£${record.cost}` : '-'}</td>
                      <td className={getDueBadgeClass(record.next_due)}>{formatDate(record.next_due)}</td>
                      <td className="actions">
                        <button onClick={() => handleEditDentist(record)}>Edit</button>
                        <button onClick={() => handleDelete('dentist', record.id)} className="delete">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Vaccination Tab */}
        {activeTab === 'vaccination' && (
          <div className="records-section">
            <div className="section-header">
              <h2>Vaccination Records</h2>
              <button className="add-btn" onClick={() => setShowForm(true)}>
                + Add Record
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmitVaccination} className="record-form">
                <h3>{editingRecord ? 'Edit Record' : 'New Vaccination'}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Vaccination Date</label>
                    <input
                      type="date"
                      value={vaccinationForm.vaccination_date}
                      onChange={(e) => setVaccinationForm({ ...vaccinationForm, vaccination_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Vaccine Type</label>
                    <select
                      value={vaccinationForm.vaccine_type}
                      onChange={(e) => setVaccinationForm({ ...vaccinationForm, vaccine_type: e.target.value as VaccineType })}
                      required
                    >
                      <option value="flu">Flu</option>
                      <option value="tetanus">Tetanus</option>
                      <option value="flu_tetanus">Flu/Tetanus Combo</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Vaccine Name</label>
                    <input
                      type="text"
                      value={vaccinationForm.vaccine_name}
                      onChange={(e) => setVaccinationForm({ ...vaccinationForm, vaccine_name: e.target.value })}
                      placeholder="Brand/product name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Batch Number</label>
                    <input
                      type="text"
                      value={vaccinationForm.batch_number}
                      onChange={(e) => setVaccinationForm({ ...vaccinationForm, batch_number: e.target.value })}
                      placeholder="From certificate"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Administered By</label>
                    <input
                      type="text"
                      value={vaccinationForm.administered_by}
                      onChange={(e) => setVaccinationForm({ ...vaccinationForm, administered_by: e.target.value })}
                      placeholder="Vet name"
                    />
                  </div>
                  <div className="form-group">
                    <label>Next Due Date</label>
                    <input
                      type="date"
                      value={vaccinationForm.next_due}
                      onChange={(e) => setVaccinationForm({ ...vaccinationForm, next_due: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={vaccinationForm.notes}
                    onChange={(e) => setVaccinationForm({ ...vaccinationForm, notes: e.target.value })}
                    placeholder="Any reactions or additional notes"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={resetForms} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Save</button>
                </div>
              </form>
            )}

            {summary.vaccination_records.length === 0 ? (
              <p className="no-records">No vaccination records yet</p>
            ) : (
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Vaccine</th>
                    <th>Administered By</th>
                    <th>Next Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.vaccination_records.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.vaccination_date)}</td>
                      <td className="vaccine-type">{record.vaccine_type.replace('_', '/')}</td>
                      <td>{record.vaccine_name || '-'}</td>
                      <td>{record.administered_by || '-'}</td>
                      <td className={getDueBadgeClass(record.next_due)}>{formatDate(record.next_due)}</td>
                      <td className="actions">
                        <button onClick={() => handleEditVaccination(record)}>Edit</button>
                        <button onClick={() => handleDelete('vaccination', record.id)} className="delete">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Worming Tab */}
        {activeTab === 'worming' && (
          <div className="records-section">
            <div className="section-header">
              <h2>Worming Records</h2>
              <button className="add-btn" onClick={() => setShowForm(true)}>
                + Add Record
              </button>
            </div>

            {showForm && (
              <form onSubmit={handleSubmitWorming} className="record-form">
                <h3>{editingRecord ? 'Edit Record' : 'New Worming Treatment'}</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Treatment Date</label>
                    <input
                      type="date"
                      value={wormingForm.treatment_date}
                      onChange={(e) => setWormingForm({ ...wormingForm, treatment_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Product</label>
                    <input
                      type="text"
                      value={wormingForm.product}
                      onChange={(e) => setWormingForm({ ...wormingForm, product: e.target.value })}
                      placeholder="e.g., Equest, Panacur"
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Worm Count Date</label>
                    <input
                      type="date"
                      value={wormingForm.worm_count_date}
                      onChange={(e) => setWormingForm({ ...wormingForm, worm_count_date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Worm Count Result (EPG)</label>
                    <input
                      type="number"
                      value={wormingForm.worm_count_result || ''}
                      onChange={(e) => setWormingForm({ ...wormingForm, worm_count_result: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="Eggs per gram"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Next Due Date</label>
                  <input
                    type="date"
                    value={wormingForm.next_due}
                    onChange={(e) => setWormingForm({ ...wormingForm, next_due: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={wormingForm.notes}
                    onChange={(e) => setWormingForm({ ...wormingForm, notes: e.target.value })}
                    placeholder="Any additional notes"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={resetForms} className="btn-secondary">Cancel</button>
                  <button type="submit" className="btn-primary">Save</button>
                </div>
              </form>
            )}

            {summary.worming_records.length === 0 ? (
              <p className="no-records">No worming records yet</p>
            ) : (
              <table className="records-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Product</th>
                    <th>Worm Count</th>
                    <th>Next Due</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.worming_records.map((record) => (
                    <tr key={record.id}>
                      <td>{formatDate(record.treatment_date)}</td>
                      <td>{record.product}</td>
                      <td>{record.worm_count_result !== null ? `${record.worm_count_result} EPG` : '-'}</td>
                      <td className={getDueBadgeClass(record.next_due)}>{formatDate(record.next_due)}</td>
                      <td className="actions">
                        <button onClick={() => handleEditWorming(record)}>Edit</button>
                        <button onClick={() => handleDelete('worming', record.id)} className="delete">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Care Plans Tab */}
        {activeTab === 'careplans' && (
          <div className="records-section">
            <div className="section-header">
              <h2>Care Plans</h2>
              <button className="add-btn" onClick={handleCreateRehab}>
                + New Care Plan
              </button>
            </div>

            {/* Today's Tasks Section */}
            {tasksDue.length > 0 && (
              <div className="todays-tasks-section">
                <h3>Today's Tasks</h3>
                <div className="tasks-due-grid">
                  {tasksDue.map((task) => (
                    <div
                      key={`${task.task_id}-${task.program_id}`}
                      className={`task-due-card ${task.is_logged ? 'logged' : ''}`}
                    >
                      <div className="task-due-header">
                        <span className="task-type">{task.task_type.replace('_', ' ')}</span>
                        {task.duration_minutes && (
                          <span className="task-duration">{task.duration_minutes} min</span>
                        )}
                        {task.is_logged && <span className="logged-badge">Done</span>}
                      </div>
                      <p className="task-description">{task.description}</p>
                      {task.instructions && (
                        <p className="task-instructions">{task.instructions}</p>
                      )}
                      <div className="task-due-footer">
                        <span className="task-frequency">{task.frequency.replace('_', ' ')}</span>
                        {!task.is_logged && (
                          <button
                            className="btn-log-task"
                            onClick={() => handleOpenTaskLogModal(task)}
                          >
                            Log Task
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loadingTasks && tasksDue.length === 0 && (
              <div className="loading-tasks">Loading today's tasks...</div>
            )}

            {rehabPrograms.length === 0 ? (
              <div className="no-records">
                <p>No care plans for this horse</p>
                <button className="add-btn" onClick={handleCreateRehab}>
                  Create First Care Plan
                </button>
              </div>
            ) : (
              <div className="care-plans-list">
                {rehabPrograms.map((program) => {
                  // Use API-provided totals, or fall back to counting phases if available
                  const completedPhases = program.completed_phases ?? program.phases?.filter(p => p.is_completed).length ?? 0;
                  const totalPhases = program.total_phases ?? program.phases?.length ?? 0;
                  // If program is completed, show 100%. Otherwise calculate from phases
                  const progressPercent = program.status === 'completed'
                    ? 100
                    : (totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0);
                  const isExpanded = selectedProgramId === program.id;

                  // Find the current phase (first non-completed phase)
                  const currentPhase = program.phases?.find(p => !p.is_completed);

                  // Calculate phase dates based on program start and phase start_day/duration
                  const getPhaseStartDate = (phase: RehabPhase) => {
                    if (!program.start_date) return '';
                    const start = new Date(program.start_date);
                    start.setDate(start.getDate() + phase.start_day - 1);
                    return start.toISOString().split('T')[0];
                  };

                  const getPhaseEndDate = (phase: RehabPhase) => {
                    if (!program.start_date) return '';
                    const start = new Date(program.start_date);
                    start.setDate(start.getDate() + phase.start_day + phase.duration_days - 2);
                    return start.toISOString().split('T')[0];
                  };

                  // Calculate days into program
                  const daysSinceStart = Math.floor((new Date().getTime() - new Date(program.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;

                  return (
                    <div key={program.id} className={`care-plan-card status-${program.status} ${isExpanded ? 'expanded' : ''}`}>
                      {/* Clickable Header */}
                      <div
                        className="program-header clickable"
                        onClick={() => handleSelectProgram(program.id)}
                      >
                        <div className="header-left">
                          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                          <h3>{program.name}</h3>
                        </div>
                        <span className={`status-badge ${program.status}`}>
                          {program.status.charAt(0).toUpperCase() + program.status.slice(1)}
                        </span>
                      </div>

                      {/* Quick Summary (always visible) */}
                      <div className="program-quick-summary">
                        <div className="progress-bar-inline">
                          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                        </div>
                        <span className="progress-text">
                          Day {daysSinceStart} • Phase {program.status === 'completed' ? totalPhases : completedPhases + 1} of {totalPhases}
                        </span>
                      </div>

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div className="program-expanded">
                          {/* Program Overview */}
                          <div className="program-overview">
                            <h4>Program Overview</h4>
                            {program.description && (
                              <p className="program-description">{program.description}</p>
                            )}

                            <div className="program-details-grid">
                              {program.reason && (
                                <div className="detail-item">
                                  <span className="detail-label">Reason:</span>
                                  <span className="detail-value">{program.reason}</span>
                                </div>
                              )}
                              {program.prescribed_by && (
                                <div className="detail-item">
                                  <span className="detail-label">Prescribed by:</span>
                                  <span className="detail-value">{program.prescribed_by}</span>
                                </div>
                              )}
                              <div className="detail-item">
                                <span className="detail-label">Started:</span>
                                <span className="detail-value">{formatDate(program.start_date)}</span>
                              </div>
                              {program.expected_end_date && (
                                <div className="detail-item">
                                  <span className="detail-label">Expected completion:</span>
                                  <span className="detail-value">{formatDate(program.expected_end_date)}</span>
                                </div>
                              )}
                            </div>

                            {program.notes && (
                              <div className="program-notes-box">
                                <strong>Important Notes:</strong>
                                <p>{program.notes}</p>
                              </div>
                            )}

                            {/* Program Actions */}
                            <div className="program-actions-row">
                              {(program.status === 'draft' || program.status === 'active') && (
                                <button
                                  className="btn-action edit"
                                  onClick={(e) => { e.stopPropagation(); handleEditRehab(program.id); }}
                                >
                                  Edit Program
                                </button>
                              )}
                              {program.status === 'draft' && (() => {
                                const requestState = getRehabRequestState(program.id);

                                // Staff-managed plans use direct quote on the care plan
                                if (program.staff_managed) {
                                  return (
                                    <>
                                      {!program.weekly_care_price && (
                                        <span className="quote-pending-badge">
                                          Awaiting Quote
                                        </span>
                                      )}
                                      {program.weekly_care_price && (
                                        <div className="quote-actions" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            className="btn-action accept"
                                            onClick={() => handleAcceptCarePlanQuote(program.id)}
                                          >
                                            Accept £{program.weekly_care_price}/wk
                                          </button>
                                          <button
                                            className="btn-action decline"
                                            onClick={() => handleDeclineCarePlanQuote(program.id)}
                                          >
                                            Decline
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  );
                                }

                                // Non staff-managed plans use service request workflow
                                return (
                                  <>
                                    {requestState.status === 'none' && (
                                      <button
                                        className="btn-action assistance"
                                        onClick={(e) => { e.stopPropagation(); handleOpenAssistanceForm(program); }}
                                      >
                                        Request Assistance
                                      </button>
                                    )}
                                    {requestState.status === 'pending' && (
                                      <button
                                        className="btn-action assistance pending"
                                        disabled
                                      >
                                        Pending Price
                                      </button>
                                    )}
                                    {requestState.status === 'quoted' && requestState.request && (
                                      <div className="quote-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          className="btn-action accept"
                                          onClick={() => handleAcceptQuote(requestState.request!.id)}
                                        >
                                          Accept {formatPrice(requestState.request.quote_amount || 0)}
                                        </button>
                                        <button
                                          className="btn-action decline"
                                          onClick={() => handleRejectQuote(requestState.request!.id)}
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    )}
                                    {requestState.status === 'approved' && (
                                      <button
                                        className="btn-action approved"
                                        disabled
                                      >
                                        Accepted
                                      </button>
                                    )}
                                    <button
                                      className="btn-action activate"
                                      onClick={(e) => { e.stopPropagation(); handleActivateProgram(program.id); }}
                                    >
                                      Activate Care Plan
                                    </button>
                                  </>
                                );
                              })()}
                              {program.status === 'active' && (() => {
                                const requestState = getRehabRequestState(program.id);
                                return (
                                  <>
                                    {/* Only show Request Assistance if NOT staff-managed */}
                                    {!program.staff_managed && requestState.status === 'none' && (
                                      <button
                                        className="btn-action assistance"
                                        onClick={(e) => { e.stopPropagation(); handleOpenAssistanceForm(program); }}
                                      >
                                        Request Assistance
                                      </button>
                                    )}
                                    {/* Staff-managed plans show badge instead of assistance buttons */}
                                    {program.staff_managed && (
                                      <span className="staff-managed-badge">
                                        Staff Managed
                                        {program.weekly_care_price && ` · £${program.weekly_care_price}/wk`}
                                      </span>
                                    )}
                                    {!program.staff_managed && requestState.status === 'pending' && (
                                      <button
                                        className="btn-action assistance pending"
                                        disabled
                                      >
                                        Pending Price
                                      </button>
                                    )}
                                    {!program.staff_managed && requestState.status === 'quoted' && requestState.request && (
                                      <div className="quote-actions" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          className="btn-action accept"
                                          onClick={() => handleAcceptQuote(requestState.request!.id)}
                                        >
                                          Accept {formatPrice(requestState.request.quote_amount || 0)}
                                        </button>
                                        <button
                                          className="btn-action decline"
                                          onClick={() => handleRejectQuote(requestState.request!.id)}
                                        >
                                          Decline
                                        </button>
                                      </div>
                                    )}
                                    {!program.staff_managed && requestState.status === 'approved' && (
                                      <button
                                        className="btn-action approved"
                                        disabled
                                      >
                                        Accepted
                                      </button>
                                    )}
                                    <button
                                      className="btn-action complete"
                                      onClick={(e) => { e.stopPropagation(); handleCompleteProgram(program.id); }}
                                    >
                                      Complete Care Plan
                                    </button>
                                  </>
                                );
                              })()}
                            </div>

                            {/* Staff Assistance Request Form */}
                            {showAssistanceForm === program.id && (
                              <div className="assistance-form-section" onClick={(e) => e.stopPropagation()}>
                                <h4>Request Staff Assistance</h4>
                                {assistanceSuccess === program.id ? (
                                  <div className="assistance-success">
                                    <p>Quote request submitted! Admin will provide a price.</p>
                                    <p className="assistance-hint">You'll be notified when the quote is ready to review.</p>
                                    <button
                                      className="btn-secondary"
                                      onClick={handleCloseAssistanceForm}
                                    >
                                      Close
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    <div className="assistance-form">
                                      <p className="form-intro">
                                        Request a quote for staff to cover care plan tasks during these dates.
                                      </p>

                                      <div className="form-row">
                                        <div className="form-group">
                                          <label>From</label>
                                          <input
                                            type="date"
                                            value={assistanceForm.startDate}
                                            onChange={(e) => {
                                              const newStart = e.target.value;
                                              setAssistanceForm({
                                                ...assistanceForm,
                                                startDate: newStart,
                                                endDate: assistanceForm.endDate < newStart ? newStart : assistanceForm.endDate,
                                              });
                                            }}
                                            min={new Date().toISOString().split('T')[0]}
                                          />
                                        </div>
                                        <div className="form-group">
                                          <label>Until</label>
                                          <input
                                            type="date"
                                            value={assistanceForm.endDate}
                                            onChange={(e) => setAssistanceForm({ ...assistanceForm, endDate: e.target.value })}
                                            min={assistanceForm.startDate}
                                          />
                                        </div>
                                      </div>
                                      <span className="form-hint">
                                        {assistanceForm.startDate === assistanceForm.endDate
                                          ? 'Single day'
                                          : `${Math.ceil((new Date(assistanceForm.endDate).getTime() - new Date(assistanceForm.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} days`}
                                      </span>

                                      <div className="form-group">
                                        <label>Notes (optional)</label>
                                        <textarea
                                          value={assistanceForm.specialInstructions}
                                          onChange={(e) => setAssistanceForm({ ...assistanceForm, specialInstructions: e.target.value })}
                                          placeholder="Any special notes for staff..."
                                          rows={2}
                                        />
                                      </div>
                                    </div>

                                    <div className="assistance-actions">
                                      <button
                                        className="btn-secondary"
                                        onClick={handleCloseAssistanceForm}
                                        disabled={savingAssistance}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        className="btn-primary"
                                        onClick={() => handleSubmitAssistance(program)}
                                        disabled={savingAssistance}
                                      >
                                        {savingAssistance ? 'Requesting...' : 'Submit Request'}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Current Phase Details */}
                          {currentPhase && (
                            <div className="current-phase-section">
                              <h4>Current Phase: {currentPhase.name}</h4>
                              <div className="phase-info">
                                <p className="phase-dates">
                                  {formatDate(getPhaseStartDate(currentPhase))} - {formatDate(getPhaseEndDate(currentPhase))}
                                  <span className="duration-badge">{currentPhase.duration_days} days</span>
                                </p>
                                {currentPhase.description && (
                                  <p className="phase-description">{currentPhase.description}</p>
                                )}
                              </div>

                              {/* Current Phase Tasks */}
                              {currentPhase.tasks && currentPhase.tasks.length > 0 && (
                                <div className="phase-tasks">
                                  <h5>Daily Tasks</h5>
                                  <div className="tasks-grid">
                                    {currentPhase.tasks.map((task, idx) => (
                                      <div key={idx} className="task-card">
                                        <div className="task-header">
                                          <span className="task-type">{task.task_type.replace('_', ' ')}</span>
                                          {task.duration_minutes && (
                                            <span className="task-duration">{task.duration_minutes} mins</span>
                                          )}
                                        </div>
                                        <p className="task-description">{task.description}</p>
                                        {task.instructions && (
                                          <p className="task-instructions">{task.instructions}</p>
                                        )}
                                        {task.equipment_needed && (
                                          <p className="task-equipment">
                                            <strong>Equipment:</strong> {task.equipment_needed}
                                          </p>
                                        )}
                                        {task.frequency && (
                                          <span className="task-frequency">{task.frequency.replace('_', ' ')}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* All Phases Timeline */}
                          <div className="phases-section">
                            <h4>Program Phases</h4>
                            <div className="phases-timeline-detailed">
                              {program.phases?.map((phase, idx) => {
                                const phaseStatus = phase.is_completed ? 'completed' : (currentPhase?.id === phase.id ? 'in_progress' : 'pending');
                                return (
                                  <div key={phase.id} className={`phase-timeline-item ${phaseStatus}`}>
                                    <div className="phase-timeline-marker">
                                      <span className="phase-number">{idx + 1}</span>
                                    </div>
                                    <div className="phase-timeline-content">
                                      <div className="phase-timeline-header">
                                        <span className="phase-name">{phase.name}</span>
                                        <span className={`phase-status-badge ${phaseStatus}`}>
                                          {phaseStatus === 'completed' ? 'Completed' : phaseStatus === 'in_progress' ? 'In Progress' : 'Upcoming'}
                                        </span>
                                      </div>
                                      <p className="phase-timeline-dates">
                                        {formatDate(getPhaseStartDate(phase))} - {formatDate(getPhaseEndDate(phase))}
                                      </p>
                                      {phase.description && (
                                        <p className="phase-timeline-desc">{phase.description}</p>
                                      )}
                                      {phase.completion_notes && (
                                        <p className="phase-completion-notes">
                                          <strong>Completion notes:</strong> {phase.completion_notes}
                                        </p>
                                      )}
                                      {phaseStatus === 'in_progress' && program.status === 'active' && (
                                        <button
                                          className="btn-complete-phase"
                                          onClick={(e) => { e.stopPropagation(); handleCompletePhase(program.id, phase.id); }}
                                        >
                                          Complete Phase
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Task History / Activity Log */}
                          <div className="task-history-section">
                            <TaskHistoryPanel
                              logs={programTaskLogs}
                              loading={loadingTaskLogs}
                              showFilters={false}
                              showMetrics={false}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Task Log Modal */}
      {showTaskLogModal && loggingTask && (
        <div className="modal-overlay" onClick={handleCloseTaskLogModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Log Task</h2>
              <button className="btn-close" onClick={handleCloseTaskLogModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmitTaskLog}>
              <div className="modal-body">
                <div className="task-context">
                  <strong>{loggingTask.task_type.replace('_', ' ')}</strong>: {loggingTask.description}
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="was_completed"
                        checked={taskLogForm.was_completed}
                        onChange={() => setTaskLogForm({ ...taskLogForm, was_completed: true })}
                      />
                      Completed
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="was_completed"
                        checked={!taskLogForm.was_completed}
                        onChange={() => setTaskLogForm({ ...taskLogForm, was_completed: false })}
                      />
                      Skipped
                    </label>
                  </div>
                </div>

                {!taskLogForm.was_completed && (
                  <div className="form-group">
                    <label>Reason for skipping</label>
                    <textarea
                      value={taskLogForm.skip_reason}
                      onChange={(e) => setTaskLogForm({ ...taskLogForm, skip_reason: e.target.value })}
                      placeholder="Why was this task skipped?"
                      rows={2}
                    />
                  </div>
                )}

                {taskLogForm.was_completed && (
                  <>
                    <div className="form-group">
                      <label>Actual duration (minutes)</label>
                      <input
                        type="number"
                        min="0"
                        value={taskLogForm.actual_duration_minutes || ''}
                        onChange={(e) => setTaskLogForm({ ...taskLogForm, actual_duration_minutes: parseInt(e.target.value) || 0 })}
                      />
                    </div>

                    <div className="form-group">
                      <label>Horse's response</label>
                      <textarea
                        value={taskLogForm.horse_response}
                        onChange={(e) => setTaskLogForm({ ...taskLogForm, horse_response: e.target.value })}
                        placeholder="How did the horse respond to the task?"
                        rows={2}
                      />
                    </div>
                  </>
                )}

                <div className="form-group">
                  <label>Concerns (optional)</label>
                  <textarea
                    value={taskLogForm.concerns}
                    onChange={(e) => setTaskLogForm({ ...taskLogForm, concerns: e.target.value })}
                    placeholder="Any concerns to note for the vet?"
                    rows={2}
                  />
                </div>

                {taskLogForm.concerns && (
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={taskLogForm.vet_notified}
                        onChange={(e) => setTaskLogForm({ ...taskLogForm, vet_notified: e.target.checked })}
                      />
                      Vet has been notified
                    </label>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={handleCloseTaskLogModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={savingTaskLog}>
                  {savingTaskLog ? 'Saving...' : 'Save Log'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Care Plan Modal */}
      {showRehabModal && horse && (
        <div className="modal-overlay" onClick={handleCancelRehab}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingProgram ? 'Edit Care Plan' : 'Create Care Plan'}</h2>
              <button className="btn-close" onClick={handleCancelRehab}>&times;</button>
            </div>
            <div className="modal-body">
              <CarePlanForm
                horseId={horse.id}
                horseName={horse.name}
                initialData={editingProgram || undefined}
                onSubmit={handleSubmitRehab}
                onCancel={handleCancelRehab}
                isSubmitting={savingRehab}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
