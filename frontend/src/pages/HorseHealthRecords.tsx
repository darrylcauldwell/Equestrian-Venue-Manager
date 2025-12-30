import { useState, useEffect, useCallback } from 'react';
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
  WeightRecord,
  BodyConditionRecord,
  Saddle,
  CreateSaddle,
  SaddleType,
  SaddleFitRecord,
  PhysioRecord,
  CreatePhysioRecord,
  CreateFarrierRecord,
  CreateDentistRecord,
  CreateVaccinationRecord,
  CreateWormingRecord,
  CreateWeightRecord,
  CreateBodyConditionRecord,
  CreateSaddleFitRecord,
  VaccineType,
  SaddleFitStatus,
  RehabProgram,
  RehabPhase,
  RehabTaskLog,
  CreateRehabProgram,
  DailyRehabTask,
  CreateRehabTaskLog,
  MyServiceRequestsSummary,
  ServiceRequest,
} from '../types';
import { useModalForm, useRequestState } from '../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea, Checkbox } from '../components/ui';
import './HorseHealthRecords.css';

type RecordTab = 'summary' | 'farrier' | 'dentist' | 'vaccination' | 'worming' | 'weight' | 'bodycondition' | 'saddles' | 'saddlefit' | 'physio' | 'careplans';

// Physio treatment types
const physioTreatmentTypes = [
  { value: 'massage', label: 'Massage' },
  { value: 'stretching', label: 'Stretching' },
  { value: 'laser', label: 'Laser Therapy' },
  { value: 'ultrasound', label: 'Ultrasound' },
  { value: 'shockwave', label: 'Shockwave Therapy' },
  { value: 'chiropractic', label: 'Chiropractic' },
  { value: 'acupuncture', label: 'Acupuncture' },
  { value: 'hydrotherapy', label: 'Hydrotherapy' },
  { value: 'assessment', label: 'Assessment Only' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'other', label: 'Other' },
];

// Saddle type labels
const saddleTypeLabels: Record<SaddleType, string> = {
  gp: 'General Purpose',
  dressage: 'Dressage',
  jump: 'Jumping',
  endurance: 'Endurance',
  other: 'Other',
};

// Helper functions
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

const kgToLbs = (kg: number) => Math.round(kg * 2.20462 * 10) / 10;
const lbsToKg = (lbs: number) => Math.round(lbs / 2.20462 * 10) / 10;

// Body Condition Score descriptions (Henneke scale)
const bcsDescriptions: Record<number, { label: string; color: string; description: string }> = {
  1: { label: 'Poor', color: 'red', description: 'Extremely emaciated. Bone structure prominent.' },
  2: { label: 'Very Thin', color: 'red', description: 'Emaciated. Slight fat covering over bone.' },
  3: { label: 'Thin', color: 'orange', description: 'Slight fat over ribs. Tailhead prominent.' },
  4: { label: 'Moderately Thin', color: 'orange', description: 'Faint outline of ribs. Tailhead not prominent.' },
  5: { label: 'Moderate', color: 'green', description: 'Ribs not visually seen but easily felt. Ideal condition.' },
  6: { label: 'Moderately Fleshy', color: 'green', description: 'Fat beginning to cover ribs. Soft fat around tailhead.' },
  7: { label: 'Fleshy', color: 'orange', description: 'Fat deposited along neck, withers, behind shoulders.' },
  8: { label: 'Fat', color: 'orange', description: 'Noticeable thickening of neck. Fat along inner buttocks.' },
  9: { label: 'Extremely Fat', color: 'red', description: 'Bulging fat. Obvious fat patches. Cresty neck.' },
};

// Saddle fit status helpers
const fitStatusLabels: Record<SaddleFitStatus, { label: string; color: string }> = {
  good: { label: 'Good Fit', color: 'green' },
  needs_adjustment: { label: 'Needs Adjustment', color: 'orange' },
  needs_replacing: { label: 'Needs Replacing', color: 'red' },
};

export function HorseHealthRecords() {
  const { horseId } = useParams<{ horseId: string }>();
  const navigate = useNavigate();

  // Core data state
  const [horse, setHorse] = useState<Horse | null>(null);
  const [summary, setSummary] = useState<HealthRecordsSummary | null>(null);
  const [activeTab, setActiveTab] = useState<RecordTab>('summary');
  const [rehabPrograms, setRehabPrograms] = useState<RehabProgram[]>([]);
  const [myRequests, setMyRequests] = useState<MyServiceRequestsSummary | null>(null);
  const [saddles, setSaddles] = useState<Saddle[]>([]);

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);

  // Rehab program state
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [programTaskLogs, setProgramTaskLogs] = useState<RehabTaskLog[]>([]);
  const [loadingTaskLogs, setLoadingTaskLogs] = useState(false);
  const [editingProgram, setEditingProgram] = useState<RehabProgram | null>(null);
  const [savingRehab, setSavingRehab] = useState(false);

  // Task logging state
  const [tasksDue, setTasksDue] = useState<DailyRehabTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Delete confirmations
  const [deleteTarget, setDeleteTarget] = useState<{ type: RecordTab; id: number } | null>(null);
  const [completeTarget, setCompleteTarget] = useState<number | null>(null);
  const [declineTarget, setDeclineTarget] = useState<number | null>(null);
  const [rejectQuoteTarget, setRejectQuoteTarget] = useState<number | null>(null);

  // Weight display unit preference
  const [displayUnit, setDisplayUnit] = useState<'kg' | 'lbs'>('kg');

  // Health record modals
  const farrierModal = useModalForm<CreateFarrierRecord>({
    visit_date: '',
    farrier_name: '',
    work_done: '',
    cost: undefined,
    next_due: '',
    notes: '',
  });

  const dentistModal = useModalForm<CreateDentistRecord>({
    visit_date: '',
    dentist_name: '',
    treatment: '',
    cost: undefined,
    next_due: '',
    notes: '',
  });

  const vaccinationModal = useModalForm<CreateVaccinationRecord>({
    vaccination_date: '',
    vaccine_type: 'flu_tetanus',
    vaccine_name: '',
    batch_number: '',
    administered_by: '',
    next_due: '',
    notes: '',
  });

  const wormingModal = useModalForm<CreateWormingRecord>({
    treatment_date: '',
    product: '',
    worm_count_date: '',
    worm_count_result: undefined,
    next_due: '',
    notes: '',
  });

  const weightModal = useModalForm<CreateWeightRecord>({
    record_date: '',
    weight_kg: 0,
    unit_entered: 'kg',
    method: '',
    notes: '',
  });

  const bodyConditionModal = useModalForm<CreateBodyConditionRecord>({
    record_date: '',
    score: 5,
    assessed_by: '',
    notes: '',
  });

  const saddleModal = useModalForm<CreateSaddle>({
    name: '',
    saddle_type: 'gp',
    brand: '',
    model: '',
    serial_number: '',
    purchase_date: '',
    is_active: 1,
    notes: '',
  });

  const saddleFitModal = useModalForm<CreateSaddleFitRecord>({
    saddle_id: undefined,
    check_date: '',
    fitter_name: '',
    saddle_type: '',
    fit_status: 'good',
    adjustments_made: '',
    next_check_due: '',
    cost: undefined,
    notes: '',
  });

  const physioModal = useModalForm<CreatePhysioRecord>({
    session_date: '',
    practitioner_name: '',
    treatment_type: '',
    areas_treated: '',
    findings: '',
    treatment_notes: '',
    recommendations: '',
    next_session_due: '',
    cost: undefined,
  });

  // Rehab modal
  const [showRehabModal, setShowRehabModal] = useState(false);

  // Task log modal
  const taskLogModal = useModalForm<CreateRehabTaskLog & { loggingTask?: DailyRehabTask }>({
    task_id: 0,
    program_id: 0,
    horse_id: 0,
    log_date: '',
    was_completed: true,
    skip_reason: '',
    actual_duration_minutes: 0,
    horse_response: '',
    concerns: '',
    vet_notified: false,
  });

  // Staff assistance state
  const [showAssistanceForm, setShowAssistanceForm] = useState<number | null>(null);
  const [assistanceForm, setAssistanceForm] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    specialInstructions: '',
  });
  const [savingAssistance, setSavingAssistance] = useState(false);
  const [assistanceSuccess, setAssistanceSuccess] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    if (!horseId) return;
    setLoading(true);
    try {
      const [horseData, summaryData, rehabData, requestsData, saddlesData] = await Promise.all([
        horsesApi.get(parseInt(horseId)),
        healthRecordsApi.getSummary(parseInt(horseId)),
        rehabApi.getHorsePrograms(parseInt(horseId)),
        servicesApi.getMyRequests().catch(() => null),
        healthRecordsApi.listSaddles(parseInt(horseId), true).catch(() => []),
      ]);
      setHorse(horseData);
      setSummary(summaryData);
      setRehabPrograms(rehabData);
      setMyRequests(requestsData);
      setSaddles(saddlesData);
    } catch {
      setError('Failed to load health records');
    } finally {
      setLoading(false);
    }
  }, [horseId, setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load tasks due when on care plans tab
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

  const handleSelectProgram = async (programId: number) => {
    if (selectedProgramId === programId) {
      setSelectedProgramId(null);
      setProgramTaskLogs([]);
    } else {
      setSelectedProgramId(programId);
      await loadProgramTaskLogs(programId);
    }
  };

  // Health record handlers
  const handleSubmitFarrier = async () => {
    if (!horseId) return;
    try {
      if (farrierModal.isEditing && farrierModal.editingId) {
        await healthRecordsApi.updateFarrier(parseInt(horseId), farrierModal.editingId, farrierModal.formData);
      } else {
        await healthRecordsApi.createFarrier(parseInt(horseId), farrierModal.formData);
      }
      farrierModal.close();
      await loadData();
    } catch {
      setError('Failed to save farrier record');
    }
  };

  const handleSubmitDentist = async () => {
    if (!horseId) return;
    try {
      if (dentistModal.isEditing && dentistModal.editingId) {
        await healthRecordsApi.updateDentist(parseInt(horseId), dentistModal.editingId, dentistModal.formData);
      } else {
        await healthRecordsApi.createDentist(parseInt(horseId), dentistModal.formData);
      }
      dentistModal.close();
      await loadData();
    } catch {
      setError('Failed to save dentist record');
    }
  };

  const handleSubmitVaccination = async () => {
    if (!horseId) return;
    try {
      if (vaccinationModal.isEditing && vaccinationModal.editingId) {
        await healthRecordsApi.updateVaccination(parseInt(horseId), vaccinationModal.editingId, vaccinationModal.formData);
      } else {
        await healthRecordsApi.createVaccination(parseInt(horseId), vaccinationModal.formData);
      }
      vaccinationModal.close();
      await loadData();
    } catch {
      setError('Failed to save vaccination record');
    }
  };

  const handleSubmitWorming = async () => {
    if (!horseId) return;
    try {
      if (wormingModal.isEditing && wormingModal.editingId) {
        await healthRecordsApi.updateWorming(parseInt(horseId), wormingModal.editingId, wormingModal.formData);
      } else {
        await healthRecordsApi.createWorming(parseInt(horseId), wormingModal.formData);
      }
      wormingModal.close();
      await loadData();
    } catch {
      setError('Failed to save worming record');
    }
  };

  const handleSubmitWeight = async () => {
    if (!horseId) return;
    try {
      const weightInKg = weightModal.formData.unit_entered === 'lbs'
        ? lbsToKg(weightModal.formData.weight_kg)
        : weightModal.formData.weight_kg;
      const dataToSend = { ...weightModal.formData, weight_kg: weightInKg };

      if (weightModal.isEditing && weightModal.editingId) {
        await healthRecordsApi.updateWeight(parseInt(horseId), weightModal.editingId, dataToSend);
      } else {
        await healthRecordsApi.createWeight(parseInt(horseId), dataToSend);
      }
      weightModal.close();
      await loadData();
    } catch {
      setError('Failed to save weight record');
    }
  };

  const handleSubmitBodyCondition = async () => {
    if (!horseId) return;
    try {
      if (bodyConditionModal.isEditing && bodyConditionModal.editingId) {
        await healthRecordsApi.updateBodyCondition(parseInt(horseId), bodyConditionModal.editingId, bodyConditionModal.formData);
      } else {
        await healthRecordsApi.createBodyCondition(parseInt(horseId), bodyConditionModal.formData);
      }
      bodyConditionModal.close();
      await loadData();
    } catch {
      setError('Failed to save body condition record');
    }
  };

  const handleSubmitSaddle = async () => {
    if (!horseId) return;
    try {
      if (saddleModal.isEditing && saddleModal.editingId) {
        await healthRecordsApi.updateSaddle(parseInt(horseId), saddleModal.editingId, saddleModal.formData);
      } else {
        await healthRecordsApi.createSaddle(parseInt(horseId), saddleModal.formData);
      }
      saddleModal.close();
      await loadData();
    } catch {
      setError('Failed to save saddle');
    }
  };

  const handleEditSaddle = (saddle: Saddle) => {
    saddleModal.edit(saddle.id, {
      name: saddle.name,
      saddle_type: saddle.saddle_type,
      brand: saddle.brand || '',
      model: saddle.model || '',
      serial_number: saddle.serial_number || '',
      purchase_date: saddle.purchase_date || '',
      is_active: saddle.is_active,
      notes: saddle.notes || '',
    });
  };

  const handleSubmitSaddleFit = async () => {
    if (!horseId) return;
    try {
      if (saddleFitModal.isEditing && saddleFitModal.editingId) {
        await healthRecordsApi.updateSaddleFit(parseInt(horseId), saddleFitModal.editingId, saddleFitModal.formData);
      } else {
        await healthRecordsApi.createSaddleFit(parseInt(horseId), saddleFitModal.formData);
      }
      saddleFitModal.close();
      await loadData();
    } catch {
      setError('Failed to save saddle fit record');
    }
  };

  const handleSubmitPhysio = async () => {
    if (!horseId) return;
    try {
      if (physioModal.isEditing && physioModal.editingId) {
        await healthRecordsApi.updatePhysio(parseInt(horseId), physioModal.editingId, physioModal.formData);
      } else {
        await healthRecordsApi.createPhysio(parseInt(horseId), physioModal.formData);
      }
      physioModal.close();
      await loadData();
    } catch {
      setError('Failed to save physio record');
    }
  };

  const handleEditPhysio = (record: PhysioRecord) => {
    physioModal.edit(record.id, {
      session_date: record.session_date,
      practitioner_name: record.practitioner_name || '',
      treatment_type: record.treatment_type,
      areas_treated: record.areas_treated || '',
      findings: record.findings || '',
      treatment_notes: record.treatment_notes || '',
      recommendations: record.recommendations || '',
      next_session_due: record.next_session_due || '',
      cost: record.cost,
    });
  };

  const handleDelete = async () => {
    if (!horseId || !deleteTarget) return;
    try {
      switch (deleteTarget.type) {
        case 'farrier':
          await healthRecordsApi.deleteFarrier(parseInt(horseId), deleteTarget.id);
          break;
        case 'dentist':
          await healthRecordsApi.deleteDentist(parseInt(horseId), deleteTarget.id);
          break;
        case 'vaccination':
          await healthRecordsApi.deleteVaccination(parseInt(horseId), deleteTarget.id);
          break;
        case 'worming':
          await healthRecordsApi.deleteWorming(parseInt(horseId), deleteTarget.id);
          break;
        case 'weight':
          await healthRecordsApi.deleteWeight(parseInt(horseId), deleteTarget.id);
          break;
        case 'bodycondition':
          await healthRecordsApi.deleteBodyCondition(parseInt(horseId), deleteTarget.id);
          break;
        case 'saddles':
          await healthRecordsApi.deleteSaddle(parseInt(horseId), deleteTarget.id);
          break;
        case 'saddlefit':
          await healthRecordsApi.deleteSaddleFit(parseInt(horseId), deleteTarget.id);
          break;
        case 'physio':
          await healthRecordsApi.deletePhysio(parseInt(horseId), deleteTarget.id);
          break;
      }
      setDeleteTarget(null);
      await loadData();
    } catch {
      setError('Failed to delete record');
    }
  };

  // Edit handlers
  const handleEditFarrier = (record: FarrierRecord) => {
    farrierModal.edit(record.id, {
      visit_date: record.visit_date,
      farrier_name: record.farrier_name || '',
      work_done: record.work_done,
      cost: record.cost,
      next_due: record.next_due || '',
      notes: record.notes || '',
    });
  };

  const handleEditDentist = (record: DentistRecord) => {
    dentistModal.edit(record.id, {
      visit_date: record.visit_date,
      dentist_name: record.dentist_name || '',
      treatment: record.treatment,
      cost: record.cost,
      next_due: record.next_due || '',
      notes: record.notes || '',
    });
  };

  const handleEditVaccination = (record: VaccinationRecord) => {
    vaccinationModal.edit(record.id, {
      vaccination_date: record.vaccination_date,
      vaccine_type: record.vaccine_type,
      vaccine_name: record.vaccine_name || '',
      batch_number: record.batch_number || '',
      administered_by: record.administered_by || '',
      next_due: record.next_due || '',
      notes: record.notes || '',
    });
  };

  const handleEditWorming = (record: WormingRecord) => {
    wormingModal.edit(record.id, {
      treatment_date: record.treatment_date,
      product: record.product,
      worm_count_date: record.worm_count_date || '',
      worm_count_result: record.worm_count_result,
      next_due: record.next_due || '',
      notes: record.notes || '',
    });
  };

  const handleEditWeight = (record: WeightRecord) => {
    weightModal.edit(record.id, {
      record_date: record.record_date,
      weight_kg: record.weight_kg,
      unit_entered: record.unit_entered as 'kg' | 'lbs',
      method: record.method || '',
      notes: record.notes || '',
    });
  };

  const handleEditBodyCondition = (record: BodyConditionRecord) => {
    bodyConditionModal.edit(record.id, {
      record_date: record.record_date,
      score: record.score,
      assessed_by: record.assessed_by || '',
      notes: record.notes || '',
    });
  };

  const handleEditSaddleFit = (record: SaddleFitRecord) => {
    saddleFitModal.edit(record.id, {
      saddle_id: record.saddle_id,
      check_date: record.check_date,
      fitter_name: record.fitter_name || '',
      saddle_type: record.saddle_type || '',
      fit_status: record.fit_status as SaddleFitStatus,
      adjustments_made: record.adjustments_made || '',
      next_check_due: record.next_check_due || '',
      cost: record.cost,
      notes: record.notes || '',
    });
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

  const handleCompleteProgram = async () => {
    if (!completeTarget) return;
    try {
      await rehabApi.complete(completeTarget);
      await loadData();
      if (selectedProgramId === completeTarget) {
        setSelectedProgramId(null);
        setProgramTaskLogs([]);
      }
    } catch {
      setError('Failed to complete program');
    } finally {
      setCompleteTarget(null);
    }
  };

  const handleAcceptCarePlanQuote = async (programId: number) => {
    try {
      await rehabApi.activate(programId);
      await loadData();
    } catch {
      setError('Failed to accept quote');
    }
  };

  const handleDeclineCarePlanQuote = async () => {
    if (!declineTarget) return;
    try {
      await rehabApi.update(declineTarget, { status: 'cancelled' });
      await loadData();
    } catch {
      setError('Failed to decline quote');
    } finally {
      setDeclineTarget(null);
    }
  };

  const handleCompletePhase = async (programId: number, phaseId: number) => {
    const notes = prompt('Enter any notes for phase completion (optional):');
    try {
      await rehabApi.completePhase(programId, phaseId, notes || undefined);
      await loadData();
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
      await loadData();
    } catch (err) {
      console.error('Failed to request assistance:', err);
      setError('Failed to request staff assistance');
    } finally {
      setSavingAssistance(false);
    }
  };

  // Get request state for rehab program
  const getRehabRequestState = (programId: number): {
    status: 'none' | 'pending' | 'quoted' | 'approved';
    request?: ServiceRequest;
  } => {
    if (!myRequests) return { status: 'none' };
    const quotedRequest = myRequests.quoted_requests.find(r => r.rehab_program_id === programId);
    if (quotedRequest) return { status: 'quoted', request: quotedRequest };
    const pendingRequest = myRequests.pending_requests.find(r => r.rehab_program_id === programId);
    if (pendingRequest) return { status: 'pending', request: pendingRequest };
    const scheduledRequest = myRequests.scheduled_requests.find(r => r.rehab_program_id === programId);
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

  const handleRejectQuote = async () => {
    if (!rejectQuoteTarget) return;
    try {
      await servicesApi.rejectQuote(rejectQuoteTarget);
      await loadData();
    } catch {
      setError('Failed to decline quote');
    } finally {
      setRejectQuoteTarget(null);
    }
  };

  // Task log handlers
  const handleOpenTaskLogModal = (task: DailyRehabTask) => {
    taskLogModal.edit(task.task_id, {
      task_id: task.task_id,
      program_id: task.program_id,
      horse_id: task.horse_id,
      log_date: new Date().toISOString().split('T')[0],
      was_completed: true,
      skip_reason: '',
      actual_duration_minutes: task.duration_minutes || 0,
      horse_response: '',
      concerns: '',
      vet_notified: false,
      loggingTask: task,
    });
  };

  const handleSubmitTaskLog = async () => {
    if (!horseId) return;
    try {
      const logData: CreateRehabTaskLog = {
        task_id: taskLogModal.formData.task_id,
        program_id: taskLogModal.formData.program_id,
        horse_id: taskLogModal.formData.horse_id,
        log_date: new Date().toISOString().split('T')[0],
        was_completed: taskLogModal.formData.was_completed,
        skip_reason: !taskLogModal.formData.was_completed ? taskLogModal.formData.skip_reason : undefined,
        actual_duration_minutes: taskLogModal.formData.actual_duration_minutes || undefined,
        horse_response: taskLogModal.formData.horse_response || undefined,
        concerns: taskLogModal.formData.concerns || undefined,
        vet_notified: taskLogModal.formData.vet_notified,
      };
      await rehabApi.logTask(logData);
      taskLogModal.close();
      await loadTasksDue();
      if (selectedProgramId === taskLogModal.formData.program_id) {
        await loadProgramTaskLogs(taskLogModal.formData.program_id);
      }
    } catch {
      setError('Failed to log task');
    }
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  if (!horse || !summary) {
    return <div className="ds-alert ds-alert-error">Horse not found</div>;
  }

  return (
    <div className="health-records-page">
      <div className="page-header">
        <button className="back-btn" onClick={() => navigate('/book/my-horses')}>
          &larr; Back to My Horses
        </button>
        <h1>{horse.name} - Health Records</h1>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      <div className="ds-tabs">
        {(['summary', 'farrier', 'dentist', 'vaccination', 'worming', 'weight', 'bodycondition', 'saddles', 'saddlefit', 'physio', 'careplans'] as RecordTab[]).map(tab => (
          <button
            key={tab}
            className={`ds-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'summary' ? 'Summary' :
             tab === 'farrier' ? 'Farrier' :
             tab === 'dentist' ? 'Dentist' :
             tab === 'vaccination' ? 'Vaccinations' :
             tab === 'worming' ? 'Worming' :
             tab === 'weight' ? 'Weight' :
             tab === 'bodycondition' ? 'Body Condition' :
             tab === 'saddles' ? 'Saddles' :
             tab === 'saddlefit' ? 'Saddle Fit' :
             tab === 'physio' ? 'Physio' :
             'Care Plans'}
            {tab === 'careplans' && rehabPrograms.filter(p => p.status === 'active').length > 0 && (
              <span className="tab-badge">{rehabPrograms.filter(p => p.status === 'active').length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {/* Summary Tab */}
        {activeTab === 'summary' && (
          <SummaryTab
            summary={summary}
            rehabPrograms={rehabPrograms}
            displayUnit={displayUnit}
            kgToLbs={kgToLbs}
            bcsDescriptions={bcsDescriptions}
            onNavigateToTab={setActiveTab}
          />
        )}

        {/* Farrier Tab */}
        {activeTab === 'farrier' && (
          <FarrierTab
            records={summary.farrier_records}
            onAdd={() => farrierModal.open()}
            onEdit={handleEditFarrier}
            onDelete={(id) => setDeleteTarget({ type: 'farrier', id })}
          />
        )}

        {/* Dentist Tab */}
        {activeTab === 'dentist' && (
          <DentistTab
            records={summary.dentist_records}
            onAdd={() => dentistModal.open()}
            onEdit={handleEditDentist}
            onDelete={(id) => setDeleteTarget({ type: 'dentist', id })}
          />
        )}

        {/* Vaccination Tab */}
        {activeTab === 'vaccination' && (
          <VaccinationTab
            records={summary.vaccination_records}
            onAdd={() => vaccinationModal.open()}
            onEdit={handleEditVaccination}
            onDelete={(id) => setDeleteTarget({ type: 'vaccination', id })}
          />
        )}

        {/* Worming Tab */}
        {activeTab === 'worming' && (
          <WormingTab
            records={summary.worming_records}
            onAdd={() => wormingModal.open()}
            onEdit={handleEditWorming}
            onDelete={(id) => setDeleteTarget({ type: 'worming', id })}
          />
        )}

        {/* Weight Tab */}
        {activeTab === 'weight' && (
          <WeightTab
            records={summary.weight_records || []}
            displayUnit={displayUnit}
            setDisplayUnit={setDisplayUnit}
            onAdd={() => weightModal.open()}
            onEdit={handleEditWeight}
            onDelete={(id) => setDeleteTarget({ type: 'weight', id })}
            kgToLbs={kgToLbs}
          />
        )}

        {/* Body Condition Tab */}
        {activeTab === 'bodycondition' && (
          <BodyConditionTab
            records={summary.body_condition_records || []}
            onAdd={() => bodyConditionModal.open()}
            onEdit={handleEditBodyCondition}
            onDelete={(id) => setDeleteTarget({ type: 'bodycondition', id })}
            bcsDescriptions={bcsDescriptions}
          />
        )}

        {/* Saddles Tab */}
        {activeTab === 'saddles' && (
          <SaddlesTab
            saddles={saddles}
            onAdd={() => saddleModal.open()}
            onEdit={handleEditSaddle}
            onDelete={(id) => setDeleteTarget({ type: 'saddles', id })}
            saddleTypeLabels={saddleTypeLabels}
          />
        )}

        {/* Saddle Fit Tab */}
        {activeTab === 'saddlefit' && (
          <SaddleFitTab
            records={summary.saddle_fit_records || []}
            saddles={saddles}
            onAdd={() => saddleFitModal.open()}
            onEdit={handleEditSaddleFit}
            onDelete={(id) => setDeleteTarget({ type: 'saddlefit', id })}
            fitStatusLabels={fitStatusLabels}
          />
        )}

        {/* Physio Tab */}
        {activeTab === 'physio' && (
          <PhysioTab
            records={summary.physio_records || []}
            onAdd={() => physioModal.open()}
            onEdit={handleEditPhysio}
            onDelete={(id) => setDeleteTarget({ type: 'physio', id })}
          />
        )}

        {/* Care Plans Tab */}
        {activeTab === 'careplans' && (
          <CarePlansTab
            rehabPrograms={rehabPrograms}
            tasksDue={tasksDue}
            loadingTasks={loadingTasks}
            selectedProgramId={selectedProgramId}
            programTaskLogs={programTaskLogs}
            loadingTaskLogs={loadingTaskLogs}
            showAssistanceForm={showAssistanceForm}
            assistanceForm={assistanceForm}
            setAssistanceForm={setAssistanceForm}
            savingAssistance={savingAssistance}
            assistanceSuccess={assistanceSuccess}
            onCreateRehab={handleCreateRehab}
            onEditRehab={handleEditRehab}
            onSelectProgram={handleSelectProgram}
            onActivateProgram={handleActivateProgram}
            onCompleteProgram={(id) => setCompleteTarget(id)}
            onAcceptCarePlanQuote={handleAcceptCarePlanQuote}
            onDeclineCarePlanQuote={(id) => setDeclineTarget(id)}
            onCompletePhase={handleCompletePhase}
            onOpenAssistanceForm={handleOpenAssistanceForm}
            onCloseAssistanceForm={handleCloseAssistanceForm}
            onSubmitAssistance={handleSubmitAssistance}
            onOpenTaskLogModal={handleOpenTaskLogModal}
            getRehabRequestState={getRehabRequestState}
            formatPrice={formatPrice}
            onAcceptQuote={handleAcceptQuote}
            onRejectQuote={(id) => setRejectQuoteTarget(id)}
          />
        )}
      </div>

      {/* Farrier Modal */}
      <Modal
        isOpen={farrierModal.isOpen}
        onClose={farrierModal.close}
        title={farrierModal.isEditing ? 'Edit Farrier Record' : 'New Farrier Visit'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={farrierModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitFarrier}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Visit Date" required>
            <Input
              type="date"
              value={farrierModal.formData.visit_date}
              onChange={(e) => farrierModal.updateField('visit_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Farrier Name">
            <Input
              value={farrierModal.formData.farrier_name}
              onChange={(e) => farrierModal.updateField('farrier_name', e.target.value)}
              placeholder="Name of farrier"
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Work Done" required>
          <Textarea
            value={farrierModal.formData.work_done}
            onChange={(e) => farrierModal.updateField('work_done', e.target.value)}
            placeholder="e.g., Full set, trim, front shoes only"
            required
          />
        </FormGroup>
        <FormRow>
          <FormGroup label="Cost">
            <Input
              type="number"
              step="0.01"
              value={farrierModal.formData.cost || ''}
              onChange={(e) => farrierModal.updateField('cost', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
            />
          </FormGroup>
          <FormGroup label="Next Due Date">
            <Input
              type="date"
              value={farrierModal.formData.next_due}
              onChange={(e) => farrierModal.updateField('next_due', e.target.value)}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes">
          <Textarea
            value={farrierModal.formData.notes}
            onChange={(e) => farrierModal.updateField('notes', e.target.value)}
            placeholder="Any additional notes"
          />
        </FormGroup>
      </Modal>

      {/* Dentist Modal */}
      <Modal
        isOpen={dentistModal.isOpen}
        onClose={dentistModal.close}
        title={dentistModal.isEditing ? 'Edit Dentist Record' : 'New Dentist Visit'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={dentistModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitDentist}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Visit Date" required>
            <Input
              type="date"
              value={dentistModal.formData.visit_date}
              onChange={(e) => dentistModal.updateField('visit_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Dentist Name">
            <Input
              value={dentistModal.formData.dentist_name}
              onChange={(e) => dentistModal.updateField('dentist_name', e.target.value)}
              placeholder="Name of dentist"
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Treatment" required>
          <Textarea
            value={dentistModal.formData.treatment}
            onChange={(e) => dentistModal.updateField('treatment', e.target.value)}
            placeholder="e.g., Routine rasp, wolf teeth removed"
            required
          />
        </FormGroup>
        <FormRow>
          <FormGroup label="Cost">
            <Input
              type="number"
              step="0.01"
              value={dentistModal.formData.cost || ''}
              onChange={(e) => dentistModal.updateField('cost', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
            />
          </FormGroup>
          <FormGroup label="Next Due Date">
            <Input
              type="date"
              value={dentistModal.formData.next_due}
              onChange={(e) => dentistModal.updateField('next_due', e.target.value)}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes">
          <Textarea
            value={dentistModal.formData.notes}
            onChange={(e) => dentistModal.updateField('notes', e.target.value)}
            placeholder="Any additional notes"
          />
        </FormGroup>
      </Modal>

      {/* Vaccination Modal */}
      <Modal
        isOpen={vaccinationModal.isOpen}
        onClose={vaccinationModal.close}
        title={vaccinationModal.isEditing ? 'Edit Vaccination Record' : 'New Vaccination'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={vaccinationModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitVaccination}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Vaccination Date" required>
            <Input
              type="date"
              value={vaccinationModal.formData.vaccination_date}
              onChange={(e) => vaccinationModal.updateField('vaccination_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Vaccine Type" required>
            <Select
              value={vaccinationModal.formData.vaccine_type}
              onChange={(e) => vaccinationModal.updateField('vaccine_type', e.target.value as VaccineType)}
              required
            >
              <option value="flu">Flu</option>
              <option value="tetanus">Tetanus</option>
              <option value="flu_tetanus">Flu/Tetanus Combo</option>
              <option value="other">Other</option>
            </Select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Vaccine Name">
            <Input
              value={vaccinationModal.formData.vaccine_name}
              onChange={(e) => vaccinationModal.updateField('vaccine_name', e.target.value)}
              placeholder="Brand/product name"
            />
          </FormGroup>
          <FormGroup label="Batch Number">
            <Input
              value={vaccinationModal.formData.batch_number}
              onChange={(e) => vaccinationModal.updateField('batch_number', e.target.value)}
              placeholder="From certificate"
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Administered By">
            <Input
              value={vaccinationModal.formData.administered_by}
              onChange={(e) => vaccinationModal.updateField('administered_by', e.target.value)}
              placeholder="Vet name"
            />
          </FormGroup>
          <FormGroup label="Next Due Date">
            <Input
              type="date"
              value={vaccinationModal.formData.next_due}
              onChange={(e) => vaccinationModal.updateField('next_due', e.target.value)}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes">
          <Textarea
            value={vaccinationModal.formData.notes}
            onChange={(e) => vaccinationModal.updateField('notes', e.target.value)}
            placeholder="Any reactions or additional notes"
          />
        </FormGroup>
      </Modal>

      {/* Worming Modal */}
      <Modal
        isOpen={wormingModal.isOpen}
        onClose={wormingModal.close}
        title={wormingModal.isEditing ? 'Edit Worming Record' : 'New Worming Treatment'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={wormingModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitWorming}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Treatment Date" required>
            <Input
              type="date"
              value={wormingModal.formData.treatment_date}
              onChange={(e) => wormingModal.updateField('treatment_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Product" required>
            <Input
              value={wormingModal.formData.product}
              onChange={(e) => wormingModal.updateField('product', e.target.value)}
              placeholder="e.g., Equest, Panacur"
              required
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Worm Count Date">
            <Input
              type="date"
              value={wormingModal.formData.worm_count_date}
              onChange={(e) => wormingModal.updateField('worm_count_date', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Worm Count Result (EPG)">
            <Input
              type="number"
              value={wormingModal.formData.worm_count_result || ''}
              onChange={(e) => wormingModal.updateField('worm_count_result', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Eggs per gram"
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Next Due Date">
          <Input
            type="date"
            value={wormingModal.formData.next_due}
            onChange={(e) => wormingModal.updateField('next_due', e.target.value)}
          />
        </FormGroup>
        <FormGroup label="Notes">
          <Textarea
            value={wormingModal.formData.notes}
            onChange={(e) => wormingModal.updateField('notes', e.target.value)}
            placeholder="Any additional notes"
          />
        </FormGroup>
      </Modal>

      {/* Weight Modal */}
      <Modal
        isOpen={weightModal.isOpen}
        onClose={weightModal.close}
        title={weightModal.isEditing ? 'Edit Weight Record' : 'New Weight Record'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={weightModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitWeight}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Date" required>
            <Input
              type="date"
              value={weightModal.formData.record_date}
              onChange={(e) => weightModal.updateField('record_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Weight" required>
            <div className="weight-input-group">
              <Input
                type="number"
                step="0.1"
                value={weightModal.formData.weight_kg || ''}
                onChange={(e) => weightModal.updateField('weight_kg', parseFloat(e.target.value) || 0)}
                required
              />
              <Select
                value={weightModal.formData.unit_entered}
                onChange={(e) => weightModal.updateField('unit_entered', e.target.value as 'kg' | 'lbs')}
              >
                <option value="kg">kg</option>
                <option value="lbs">lbs</option>
              </Select>
            </div>
          </FormGroup>
        </FormRow>
        <FormGroup label="Method">
          <Select
            value={weightModal.formData.method}
            onChange={(e) => weightModal.updateField('method', e.target.value)}
          >
            <option value="">Select method...</option>
            <option value="weigh tape">Weigh Tape</option>
            <option value="scales">Scales</option>
            <option value="estimated">Estimated</option>
          </Select>
        </FormGroup>
        <FormGroup label="Notes">
          <Textarea
            value={weightModal.formData.notes}
            onChange={(e) => weightModal.updateField('notes', e.target.value)}
            placeholder="Any additional notes"
          />
        </FormGroup>
      </Modal>

      {/* Body Condition Modal */}
      <Modal
        isOpen={bodyConditionModal.isOpen}
        onClose={bodyConditionModal.close}
        title={bodyConditionModal.isEditing ? 'Edit Body Condition Record' : 'New Body Condition Record'}
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={bodyConditionModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitBodyCondition}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Date" required>
            <Input
              type="date"
              value={bodyConditionModal.formData.record_date}
              onChange={(e) => bodyConditionModal.updateField('record_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Assessed By">
            <Input
              value={bodyConditionModal.formData.assessed_by}
              onChange={(e) => bodyConditionModal.updateField('assessed_by', e.target.value)}
              placeholder="Name of assessor"
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Body Condition Score (1-9)">
          <div className="bcs-selector">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
              <button
                key={score}
                type="button"
                className={`bcs-btn bcs-${bcsDescriptions[score].color} ${bodyConditionModal.formData.score === score ? 'selected' : ''}`}
                onClick={() => bodyConditionModal.updateField('score', score)}
              >
                <span className="score">{score}</span>
                <span className="label">{bcsDescriptions[score].label}</span>
              </button>
            ))}
          </div>
          <p className="bcs-description">{bcsDescriptions[bodyConditionModal.formData.score].description}</p>
        </FormGroup>
        <FormGroup label="Notes">
          <Textarea
            value={bodyConditionModal.formData.notes}
            onChange={(e) => bodyConditionModal.updateField('notes', e.target.value)}
            placeholder="Areas of concern, fat deposits, ribs visibility, etc."
          />
        </FormGroup>
      </Modal>

      {/* Saddle Modal */}
      <Modal
        isOpen={saddleModal.isOpen}
        onClose={saddleModal.close}
        title={saddleModal.isEditing ? 'Edit Saddle' : 'Add New Saddle'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={saddleModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitSaddle}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Saddle Name" required>
            <Input
              value={saddleModal.formData.name}
              onChange={(e) => saddleModal.updateField('name', e.target.value)}
              placeholder="e.g. My Dressage Saddle"
              required
            />
          </FormGroup>
          <FormGroup label="Saddle Type" required>
            <Select
              value={saddleModal.formData.saddle_type}
              onChange={(e) => saddleModal.updateField('saddle_type', e.target.value as SaddleType)}
              required
            >
              <option value="gp">General Purpose</option>
              <option value="dressage">Dressage</option>
              <option value="jump">Jumping</option>
              <option value="endurance">Endurance</option>
              <option value="other">Other</option>
            </Select>
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Brand">
            <Input
              value={saddleModal.formData.brand}
              onChange={(e) => saddleModal.updateField('brand', e.target.value)}
              placeholder="e.g. Albion, Stubben"
            />
          </FormGroup>
          <FormGroup label="Model">
            <Input
              value={saddleModal.formData.model}
              onChange={(e) => saddleModal.updateField('model', e.target.value)}
              placeholder="e.g. K2, Genesis"
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Serial Number">
            <Input
              value={saddleModal.formData.serial_number}
              onChange={(e) => saddleModal.updateField('serial_number', e.target.value)}
              placeholder="Optional"
            />
          </FormGroup>
          <FormGroup label="Purchase Date">
            <Input
              type="date"
              value={saddleModal.formData.purchase_date}
              onChange={(e) => saddleModal.updateField('purchase_date', e.target.value)}
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Status">
          <Select
            value={saddleModal.formData.is_active?.toString() || '1'}
            onChange={(e) => saddleModal.updateField('is_active', parseInt(e.target.value))}
          >
            <option value="1">Active</option>
            <option value="0">Retired / Sold</option>
          </Select>
        </FormGroup>
        <FormGroup label="Notes">
          <Textarea
            value={saddleModal.formData.notes}
            onChange={(e) => saddleModal.updateField('notes', e.target.value)}
            placeholder="Additional details about the saddle..."
          />
        </FormGroup>
      </Modal>

      {/* Saddle Fit Modal */}
      <Modal
        isOpen={saddleFitModal.isOpen}
        onClose={saddleFitModal.close}
        title={saddleFitModal.isEditing ? 'Edit Saddle Fit Record' : 'New Saddle Fit Check'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={saddleFitModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitSaddleFit}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Check Date" required>
            <Input
              type="date"
              value={saddleFitModal.formData.check_date}
              onChange={(e) => saddleFitModal.updateField('check_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Fitter Name">
            <Input
              value={saddleFitModal.formData.fitter_name}
              onChange={(e) => saddleFitModal.updateField('fitter_name', e.target.value)}
              placeholder="Saddle fitter name"
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Saddle">
            <Select
              value={saddleFitModal.formData.saddle_id?.toString() || ''}
              onChange={(e) => saddleFitModal.updateField('saddle_id', e.target.value ? parseInt(e.target.value) : undefined)}
            >
              <option value="">Select saddle...</option>
              {saddles.filter(s => s.is_active === 1).map(saddle => (
                <option key={saddle.id} value={saddle.id}>
                  {saddle.name} ({saddleTypeLabels[saddle.saddle_type]})
                </option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Fit Status" required>
            <Select
              value={saddleFitModal.formData.fit_status}
              onChange={(e) => saddleFitModal.updateField('fit_status', e.target.value as SaddleFitStatus)}
              required
            >
              <option value="good">Good Fit</option>
              <option value="needs_adjustment">Needs Adjustment</option>
              <option value="needs_replacing">Needs Replacing</option>
            </Select>
          </FormGroup>
        </FormRow>
        <FormGroup label="Adjustments Made">
          <Textarea
            value={saddleFitModal.formData.adjustments_made}
            onChange={(e) => saddleFitModal.updateField('adjustments_made', e.target.value)}
            placeholder="What was done during this check"
          />
        </FormGroup>
        <FormRow>
          <FormGroup label="Next Check Due">
            <Input
              type="date"
              value={saddleFitModal.formData.next_check_due}
              onChange={(e) => saddleFitModal.updateField('next_check_due', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Cost">
            <Input
              type="number"
              step="0.01"
              value={saddleFitModal.formData.cost || ''}
              onChange={(e) => saddleFitModal.updateField('cost', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="0.00"
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Notes">
          <Textarea
            value={saddleFitModal.formData.notes}
            onChange={(e) => saddleFitModal.updateField('notes', e.target.value)}
            placeholder="Any additional notes"
          />
        </FormGroup>
      </Modal>

      {/* Physio Modal */}
      <Modal
        isOpen={physioModal.isOpen}
        onClose={physioModal.close}
        title={physioModal.isEditing ? 'Edit Physio Record' : 'New Physio Session'}
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={physioModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitPhysio}>Save</button>
          </>
        }
      >
        <FormRow>
          <FormGroup label="Session Date" required>
            <Input
              type="date"
              value={physioModal.formData.session_date}
              onChange={(e) => physioModal.updateField('session_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Practitioner Name">
            <Input
              value={physioModal.formData.practitioner_name}
              onChange={(e) => physioModal.updateField('practitioner_name', e.target.value)}
              placeholder="Physiotherapist name"
            />
          </FormGroup>
        </FormRow>
        <FormRow>
          <FormGroup label="Treatment Type" required>
            <Select
              value={physioModal.formData.treatment_type}
              onChange={(e) => physioModal.updateField('treatment_type', e.target.value)}
              required
            >
              <option value="">Select treatment...</option>
              {physioTreatmentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Areas Treated">
            <Input
              value={physioModal.formData.areas_treated}
              onChange={(e) => physioModal.updateField('areas_treated', e.target.value)}
              placeholder="e.g. Back, hindquarters, neck"
            />
          </FormGroup>
        </FormRow>
        <FormGroup label="Findings">
          <Textarea
            value={physioModal.formData.findings}
            onChange={(e) => physioModal.updateField('findings', e.target.value)}
            placeholder="What was found during assessment..."
          />
        </FormGroup>
        <FormGroup label="Treatment Notes">
          <Textarea
            value={physioModal.formData.treatment_notes}
            onChange={(e) => physioModal.updateField('treatment_notes', e.target.value)}
            placeholder="Details of treatment given..."
          />
        </FormGroup>
        <FormGroup label="Recommendations">
          <Textarea
            value={physioModal.formData.recommendations}
            onChange={(e) => physioModal.updateField('recommendations', e.target.value)}
            placeholder="Follow-up recommendations..."
          />
        </FormGroup>
        <FormRow>
          <FormGroup label="Next Session Due">
            <Input
              type="date"
              value={physioModal.formData.next_session_due}
              onChange={(e) => physioModal.updateField('next_session_due', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Cost (£)">
            <Input
              type="number"
              step="0.01"
              value={physioModal.formData.cost || ''}
              onChange={(e) => physioModal.updateField('cost', e.target.value ? parseFloat(e.target.value) : undefined)}
            />
          </FormGroup>
        </FormRow>
      </Modal>

      {/* Task Log Modal */}
      <Modal
        isOpen={taskLogModal.isOpen}
        onClose={taskLogModal.close}
        title="Log Task"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={taskLogModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitTaskLog}>Save Log</button>
          </>
        }
      >
        {taskLogModal.formData.loggingTask && (
          <div className="task-context">
            <strong>{taskLogModal.formData.loggingTask.task_type.replace('_', ' ')}</strong>: {taskLogModal.formData.loggingTask.description}
          </div>
        )}

        <FormGroup label="Status">
          <div className="radio-group">
            <label className="radio-option">
              <input
                type="radio"
                name="was_completed"
                checked={taskLogModal.formData.was_completed}
                onChange={() => taskLogModal.updateField('was_completed', true)}
              />
              Completed
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="was_completed"
                checked={!taskLogModal.formData.was_completed}
                onChange={() => taskLogModal.updateField('was_completed', false)}
              />
              Skipped
            </label>
          </div>
        </FormGroup>

        {!taskLogModal.formData.was_completed && (
          <FormGroup label="Reason for skipping">
            <Textarea
              value={taskLogModal.formData.skip_reason || ''}
              onChange={(e) => taskLogModal.updateField('skip_reason', e.target.value)}
              placeholder="Why was this task skipped?"
              rows={2}
            />
          </FormGroup>
        )}

        {taskLogModal.formData.was_completed && (
          <>
            <FormGroup label="Actual duration (minutes)">
              <Input
                type="number"
                min={0}
                value={taskLogModal.formData.actual_duration_minutes || ''}
                onChange={(e) => taskLogModal.updateField('actual_duration_minutes', parseInt(e.target.value) || 0)}
              />
            </FormGroup>
            <FormGroup label="Horse's response">
              <Textarea
                value={taskLogModal.formData.horse_response || ''}
                onChange={(e) => taskLogModal.updateField('horse_response', e.target.value)}
                placeholder="How did the horse respond to the task?"
                rows={2}
              />
            </FormGroup>
          </>
        )}

        <FormGroup label="Concerns (optional)">
          <Textarea
            value={taskLogModal.formData.concerns || ''}
            onChange={(e) => taskLogModal.updateField('concerns', e.target.value)}
            placeholder="Any concerns to note for the vet?"
            rows={2}
          />
        </FormGroup>

        {taskLogModal.formData.concerns && (
          <FormGroup>
            <Checkbox
              checked={taskLogModal.formData.vet_notified}
              onChange={(e) => taskLogModal.updateField('vet_notified', e.target.checked)}
              label="Vet has been notified"
            />
          </FormGroup>
        )}
      </Modal>

      {/* Care Plan Modal */}
      <Modal
        isOpen={showRehabModal}
        onClose={handleCancelRehab}
        title={editingProgram ? 'Edit Care Plan' : 'Create Care Plan'}
        size="lg"
      >
        {horse && (
          <CarePlanForm
            horseId={horse.id}
            horseName={horse.name}
            initialData={editingProgram || undefined}
            onSubmit={handleSubmitRehab}
            onCancel={handleCancelRehab}
            isSubmitting={savingRehab}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Record"
        message="Are you sure you want to delete this record?"
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Complete Program Confirmation */}
      <ConfirmModal
        isOpen={!!completeTarget}
        onClose={() => setCompleteTarget(null)}
        onConfirm={handleCompleteProgram}
        title="Complete Care Plan"
        message="Mark this program as completed?"
        confirmLabel="Complete"
      />

      {/* Decline Quote Confirmation */}
      <ConfirmModal
        isOpen={!!declineTarget}
        onClose={() => setDeclineTarget(null)}
        onConfirm={handleDeclineCarePlanQuote}
        title="Decline Quote"
        message="Decline this quote? The care plan will be cancelled."
        confirmLabel="Decline"
        variant="danger"
      />

      {/* Reject Service Quote Confirmation */}
      <ConfirmModal
        isOpen={!!rejectQuoteTarget}
        onClose={() => setRejectQuoteTarget(null)}
        onConfirm={handleRejectQuote}
        title="Decline Quote"
        message="Decline this quote? This will cancel the request."
        confirmLabel="Decline"
        variant="danger"
      />
    </div>
  );
}

// Extracted Tab Components

interface SummaryTabProps {
  summary: HealthRecordsSummary;
  rehabPrograms: RehabProgram[];
  displayUnit: 'kg' | 'lbs';
  kgToLbs: (kg: number) => number;
  bcsDescriptions: Record<number, { label: string; color: string; description: string }>;
  onNavigateToTab: (tab: RecordTab) => void;
}

function SummaryTab({ summary, rehabPrograms, displayUnit, kgToLbs, bcsDescriptions, onNavigateToTab }: SummaryTabProps) {
  return (
    <div className="summary-grid">
      <div className="summary-card clickable" onClick={() => onNavigateToTab('farrier')}>
        <h3>Farrier</h3>
        <p className="record-count">{summary.farrier_records.length} records</p>
        {summary.next_farrier_due && (
          <p className={`next-due ${getDueBadgeClass(summary.next_farrier_due)}`}>
            Next due: {formatDate(summary.next_farrier_due)}
          </p>
        )}
      </div>
      <div className="summary-card clickable" onClick={() => onNavigateToTab('dentist')}>
        <h3>Dentist</h3>
        <p className="record-count">{summary.dentist_records.length} records</p>
        {summary.next_dentist_due && (
          <p className={`next-due ${getDueBadgeClass(summary.next_dentist_due)}`}>
            Next due: {formatDate(summary.next_dentist_due)}
          </p>
        )}
      </div>
      <div className="summary-card clickable" onClick={() => onNavigateToTab('vaccination')}>
        <h3>Vaccinations</h3>
        <p className="record-count">{summary.vaccination_records.length} records</p>
        {summary.next_vaccination_due && (
          <p className={`next-due ${getDueBadgeClass(summary.next_vaccination_due)}`}>
            Next due: {formatDate(summary.next_vaccination_due)}
          </p>
        )}
      </div>
      <div className="summary-card clickable" onClick={() => onNavigateToTab('worming')}>
        <h3>Worming</h3>
        <p className="record-count">{summary.worming_records.length} records</p>
        {summary.next_worming_due && (
          <p className={`next-due ${getDueBadgeClass(summary.next_worming_due)}`}>
            Next due: {formatDate(summary.next_worming_due)}
          </p>
        )}
      </div>
      <div className="summary-card clickable" onClick={() => onNavigateToTab('weight')}>
        <h3>Weight</h3>
        <p className="record-count">{summary.weight_records?.length || 0} records</p>
        {summary.latest_weight && (
          <p className="latest-value">
            Latest: {displayUnit === 'kg'
              ? `${summary.latest_weight.weight_kg} kg`
              : `${kgToLbs(Number(summary.latest_weight.weight_kg))} lbs`}
          </p>
        )}
      </div>
      <div className="summary-card clickable" onClick={() => onNavigateToTab('bodycondition')}>
        <h3>Body Condition</h3>
        <p className="record-count">{summary.body_condition_records?.length || 0} records</p>
        {summary.latest_bcs && (
          <p className={`latest-value bcs-${bcsDescriptions[summary.latest_bcs.score]?.color}`}>
            Latest: {summary.latest_bcs.score}/9 ({bcsDescriptions[summary.latest_bcs.score]?.label})
          </p>
        )}
      </div>
      <div className="summary-card clickable" onClick={() => onNavigateToTab('saddlefit')}>
        <h3>Saddle Fit</h3>
        <p className="record-count">{summary.saddle_fit_records?.length || 0} records</p>
        {summary.next_saddle_check_due && (
          <p className={`next-due ${getDueBadgeClass(summary.next_saddle_check_due)}`}>
            Next check: {formatDate(summary.next_saddle_check_due)}
          </p>
        )}
      </div>
      <div className="summary-card clickable" onClick={() => onNavigateToTab('careplans')}>
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
  );
}

interface FarrierTabProps {
  records: FarrierRecord[];
  onAdd: () => void;
  onEdit: (record: FarrierRecord) => void;
  onDelete: (id: number) => void;
}

function FarrierTab({ records, onAdd, onEdit, onDelete }: FarrierTabProps) {
  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Farrier Records</h2>
        <button className="add-btn" onClick={onAdd}>+ Add Record</button>
      </div>
      {records.length === 0 ? (
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
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.visit_date)}</td>
                <td>{record.farrier_name || '-'}</td>
                <td>{record.work_done}</td>
                <td>{record.cost ? `£${record.cost}` : '-'}</td>
                <td className={getDueBadgeClass(record.next_due)}>{formatDate(record.next_due)}</td>
                <td className="actions">
                  <button onClick={() => onEdit(record)}>Edit</button>
                  <button onClick={() => onDelete(record.id)} className="delete">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface DentistTabProps {
  records: DentistRecord[];
  onAdd: () => void;
  onEdit: (record: DentistRecord) => void;
  onDelete: (id: number) => void;
}

function DentistTab({ records, onAdd, onEdit, onDelete }: DentistTabProps) {
  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Dentist Records</h2>
        <button className="add-btn" onClick={onAdd}>+ Add Record</button>
      </div>
      {records.length === 0 ? (
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
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.visit_date)}</td>
                <td>{record.dentist_name || '-'}</td>
                <td>{record.treatment}</td>
                <td>{record.cost ? `£${record.cost}` : '-'}</td>
                <td className={getDueBadgeClass(record.next_due)}>{formatDate(record.next_due)}</td>
                <td className="actions">
                  <button onClick={() => onEdit(record)}>Edit</button>
                  <button onClick={() => onDelete(record.id)} className="delete">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface VaccinationTabProps {
  records: VaccinationRecord[];
  onAdd: () => void;
  onEdit: (record: VaccinationRecord) => void;
  onDelete: (id: number) => void;
}

function VaccinationTab({ records, onAdd, onEdit, onDelete }: VaccinationTabProps) {
  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Vaccination Records</h2>
        <button className="add-btn" onClick={onAdd}>+ Add Record</button>
      </div>
      {records.length === 0 ? (
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
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.vaccination_date)}</td>
                <td className="vaccine-type">{record.vaccine_type.replace('_', '/')}</td>
                <td>{record.vaccine_name || '-'}</td>
                <td>{record.administered_by || '-'}</td>
                <td className={getDueBadgeClass(record.next_due)}>{formatDate(record.next_due)}</td>
                <td className="actions">
                  <button onClick={() => onEdit(record)}>Edit</button>
                  <button onClick={() => onDelete(record.id)} className="delete">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface WormingTabProps {
  records: WormingRecord[];
  onAdd: () => void;
  onEdit: (record: WormingRecord) => void;
  onDelete: (id: number) => void;
}

function WormingTab({ records, onAdd, onEdit, onDelete }: WormingTabProps) {
  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Worming Records</h2>
        <button className="add-btn" onClick={onAdd}>+ Add Record</button>
      </div>
      {records.length === 0 ? (
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
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.treatment_date)}</td>
                <td>{record.product}</td>
                <td>{record.worm_count_result !== null ? `${record.worm_count_result} EPG` : '-'}</td>
                <td className={getDueBadgeClass(record.next_due)}>{formatDate(record.next_due)}</td>
                <td className="actions">
                  <button onClick={() => onEdit(record)}>Edit</button>
                  <button onClick={() => onDelete(record.id)} className="delete">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface WeightTabProps {
  records: WeightRecord[];
  displayUnit: 'kg' | 'lbs';
  setDisplayUnit: (unit: 'kg' | 'lbs') => void;
  onAdd: () => void;
  onEdit: (record: WeightRecord) => void;
  onDelete: (id: number) => void;
  kgToLbs: (kg: number) => number;
}

function WeightTab({ records, displayUnit, setDisplayUnit, onAdd, onEdit, onDelete, kgToLbs }: WeightTabProps) {
  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Weight Records</h2>
        <div className="header-controls">
          <div className="unit-toggle">
            <button className={displayUnit === 'kg' ? 'active' : ''} onClick={() => setDisplayUnit('kg')}>kg</button>
            <button className={displayUnit === 'lbs' ? 'active' : ''} onClick={() => setDisplayUnit('lbs')}>lbs</button>
          </div>
          <button className="add-btn" onClick={onAdd}>+ Add Record</button>
        </div>
      </div>
      {records.length === 0 ? (
        <p className="no-records">No weight records yet</p>
      ) : (
        <table className="records-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Weight</th>
              <th>Change</th>
              <th>Method</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => {
              const prevRecord = records[idx + 1];
              const change = prevRecord ? Number(record.weight_kg) - Number(prevRecord.weight_kg) : null;
              return (
                <tr key={record.id}>
                  <td>{formatDate(record.record_date)}</td>
                  <td>
                    {displayUnit === 'kg' ? `${record.weight_kg} kg` : `${kgToLbs(Number(record.weight_kg))} lbs`}
                  </td>
                  <td className={change ? (change > 0 ? 'trend-up' : 'trend-down') : ''}>
                    {change !== null ? (
                      <>
                        {change > 0 ? '+' : ''}{displayUnit === 'kg'
                          ? `${change.toFixed(1)} kg`
                          : `${kgToLbs(change).toFixed(1)} lbs`}
                      </>
                    ) : '-'}
                  </td>
                  <td>{record.method || '-'}</td>
                  <td>{record.notes || '-'}</td>
                  <td className="actions">
                    <button onClick={() => onEdit(record)}>Edit</button>
                    <button onClick={() => onDelete(record.id)} className="delete">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface BodyConditionTabProps {
  records: BodyConditionRecord[];
  onAdd: () => void;
  onEdit: (record: BodyConditionRecord) => void;
  onDelete: (id: number) => void;
  bcsDescriptions: Record<number, { label: string; color: string; description: string }>;
}

function BodyConditionTab({ records, onAdd, onEdit, onDelete, bcsDescriptions }: BodyConditionTabProps) {
  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Body Condition Score Records</h2>
        <button className="add-btn" onClick={onAdd}>+ Add Record</button>
      </div>
      <div className="bcs-legend">
        <h4>Henneke Body Condition Score Scale (1-9)</h4>
        <div className="bcs-scale">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(score => (
            <div key={score} className={`bcs-item bcs-${bcsDescriptions[score].color}`}>
              <span className="bcs-score">{score}</span>
              <span className="bcs-label">{bcsDescriptions[score].label}</span>
            </div>
          ))}
        </div>
      </div>
      {records.length === 0 ? (
        <p className="no-records">No body condition records yet</p>
      ) : (
        <table className="records-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Score</th>
              <th>Condition</th>
              <th>Change</th>
              <th>Assessed By</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => {
              const prevRecord = records[idx + 1];
              const change = prevRecord ? record.score - prevRecord.score : null;
              return (
                <tr key={record.id}>
                  <td>{formatDate(record.record_date)}</td>
                  <td>
                    <span className={`bcs-badge bcs-${bcsDescriptions[record.score]?.color}`}>
                      {record.score}/9
                    </span>
                  </td>
                  <td>{bcsDescriptions[record.score]?.label || '-'}</td>
                  <td className={change ? (change > 0 ? 'trend-up' : 'trend-down') : ''}>
                    {change !== null ? (change > 0 ? `+${change}` : change) : '-'}
                  </td>
                  <td>{record.assessed_by || '-'}</td>
                  <td>{record.notes || '-'}</td>
                  <td className="actions">
                    <button onClick={() => onEdit(record)}>Edit</button>
                    <button onClick={() => onDelete(record.id)} className="delete">Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Saddles Tab
interface SaddlesTabProps {
  saddles: Saddle[];
  onAdd: () => void;
  onEdit: (saddle: Saddle) => void;
  onDelete: (id: number) => void;
  saddleTypeLabels: Record<SaddleType, string>;
}

function SaddlesTab({ saddles, onAdd, onEdit, onDelete, saddleTypeLabels }: SaddlesTabProps) {
  const activeSaddles = saddles.filter(s => s.is_active === 1);
  const retiredSaddles = saddles.filter(s => s.is_active === 0);

  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Saddles</h2>
        <button className="add-btn" onClick={onAdd}>+ Add Saddle</button>
      </div>
      {saddles.length === 0 ? (
        <p className="no-records">No saddles registered yet. Add your saddles to track fit checks for each one.</p>
      ) : (
        <>
          {activeSaddles.length > 0 && (
            <>
              <h3 className="subsection-title">Active Saddles ({activeSaddles.length})</h3>
              <div className="saddle-cards">
                {activeSaddles.map((saddle) => (
                  <div key={saddle.id} className="saddle-card">
                    <div className="saddle-card-header">
                      <h4>{saddle.name}</h4>
                      <span className="saddle-type-badge">{saddleTypeLabels[saddle.saddle_type]}</span>
                    </div>
                    <div className="saddle-card-body">
                      {saddle.brand && <p><strong>Brand:</strong> {saddle.brand}</p>}
                      {saddle.model && <p><strong>Model:</strong> {saddle.model}</p>}
                      {saddle.serial_number && <p><strong>Serial:</strong> {saddle.serial_number}</p>}
                      {saddle.purchase_date && <p><strong>Purchased:</strong> {formatDate(saddle.purchase_date)}</p>}
                      {saddle.notes && <p className="saddle-notes">{saddle.notes}</p>}
                    </div>
                    <div className="saddle-card-actions">
                      <button onClick={() => onEdit(saddle)}>Edit</button>
                      <button onClick={() => onDelete(saddle.id)} className="delete">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {retiredSaddles.length > 0 && (
            <>
              <h3 className="subsection-title retired">Retired / Sold ({retiredSaddles.length})</h3>
              <div className="saddle-cards retired">
                {retiredSaddles.map((saddle) => (
                  <div key={saddle.id} className="saddle-card retired">
                    <div className="saddle-card-header">
                      <h4>{saddle.name}</h4>
                      <span className="saddle-type-badge">{saddleTypeLabels[saddle.saddle_type]}</span>
                    </div>
                    <div className="saddle-card-body">
                      {saddle.brand && <p><strong>Brand:</strong> {saddle.brand}</p>}
                      {saddle.model && <p><strong>Model:</strong> {saddle.model}</p>}
                    </div>
                    <div className="saddle-card-actions">
                      <button onClick={() => onEdit(saddle)}>Edit</button>
                      <button onClick={() => onDelete(saddle.id)} className="delete">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface SaddleFitTabProps {
  records: SaddleFitRecord[];
  saddles: Saddle[];
  onAdd: () => void;
  onEdit: (record: SaddleFitRecord) => void;
  onDelete: (id: number) => void;
  fitStatusLabels: Record<SaddleFitStatus, { label: string; color: string }>;
}

function SaddleFitTab({ records, saddles, onAdd, onEdit, onDelete, fitStatusLabels }: SaddleFitTabProps) {
  const getSaddleName = (record: SaddleFitRecord) => {
    if (record.saddle) {
      return record.saddle.name;
    }
    if (record.saddle_id) {
      const saddle = saddles.find(s => s.id === record.saddle_id);
      return saddle?.name || 'Unknown Saddle';
    }
    return record.saddle_type || '-';
  };

  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Saddle Fit Records</h2>
        <button className="add-btn" onClick={onAdd}>+ Add Record</button>
      </div>
      {records.length === 0 ? (
        <p className="no-records">No saddle fit records yet</p>
      ) : (
        <table className="records-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Saddle</th>
              <th>Status</th>
              <th>Fitter</th>
              <th>Adjustments</th>
              <th>Cost</th>
              <th>Next Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.check_date)}</td>
                <td>{getSaddleName(record)}</td>
                <td>
                  <span className={`status-badge-inline status-${fitStatusLabels[record.fit_status as SaddleFitStatus]?.color}`}>
                    {fitStatusLabels[record.fit_status as SaddleFitStatus]?.label || record.fit_status}
                  </span>
                </td>
                <td>{record.fitter_name || '-'}</td>
                <td>{record.adjustments_made || '-'}</td>
                <td>{record.cost ? `£${record.cost}` : '-'}</td>
                <td className={getDueBadgeClass(record.next_check_due)}>{formatDate(record.next_check_due)}</td>
                <td className="actions">
                  <button onClick={() => onEdit(record)}>Edit</button>
                  <button onClick={() => onDelete(record.id)} className="delete">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Physio Tab
interface PhysioTabProps {
  records: PhysioRecord[];
  onAdd: () => void;
  onEdit: (record: PhysioRecord) => void;
  onDelete: (id: number) => void;
}

function PhysioTab({ records, onAdd, onEdit, onDelete }: PhysioTabProps) {
  const getTreatmentLabel = (type: string) => {
    const found = physioTreatmentTypes.find(t => t.value === type);
    return found ? found.label : type;
  };

  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Physiotherapy Records</h2>
        <button className="add-btn" onClick={onAdd}>+ Add Session</button>
      </div>
      {records.length === 0 ? (
        <p className="no-records">No physiotherapy records yet</p>
      ) : (
        <table className="records-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Treatment</th>
              <th>Practitioner</th>
              <th>Areas</th>
              <th>Cost</th>
              <th>Next Due</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{formatDate(record.session_date)}</td>
                <td>{getTreatmentLabel(record.treatment_type)}</td>
                <td>{record.practitioner_name || '-'}</td>
                <td>{record.areas_treated || '-'}</td>
                <td>{record.cost ? `£${record.cost}` : '-'}</td>
                <td className={getDueBadgeClass(record.next_session_due)}>{formatDate(record.next_session_due)}</td>
                <td className="actions">
                  <button onClick={() => onEdit(record)}>Edit</button>
                  <button onClick={() => onDelete(record.id)} className="delete">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Care Plans Tab is complex - keeping it inline due to extensive state interactions
interface CarePlansTabProps {
  rehabPrograms: RehabProgram[];
  tasksDue: DailyRehabTask[];
  loadingTasks: boolean;
  selectedProgramId: number | null;
  programTaskLogs: RehabTaskLog[];
  loadingTaskLogs: boolean;
  showAssistanceForm: number | null;
  assistanceForm: { startDate: string; endDate: string; specialInstructions: string };
  setAssistanceForm: (form: { startDate: string; endDate: string; specialInstructions: string }) => void;
  savingAssistance: boolean;
  assistanceSuccess: number | null;
  onCreateRehab: () => void;
  onEditRehab: (id: number) => void;
  onSelectProgram: (id: number) => void;
  onActivateProgram: (id: number) => void;
  onCompleteProgram: (id: number) => void;
  onAcceptCarePlanQuote: (id: number) => void;
  onDeclineCarePlanQuote: (id: number) => void;
  onCompletePhase: (programId: number, phaseId: number) => void;
  onOpenAssistanceForm: (program: RehabProgram) => void;
  onCloseAssistanceForm: () => void;
  onSubmitAssistance: (program: RehabProgram) => void;
  onOpenTaskLogModal: (task: DailyRehabTask) => void;
  getRehabRequestState: (programId: number) => { status: 'none' | 'pending' | 'quoted' | 'approved'; request?: ServiceRequest };
  formatPrice: (price: number | string) => string;
  onAcceptQuote: (requestId: number) => void;
  onRejectQuote: (requestId: number) => void;
}

function CarePlansTab({
  rehabPrograms,
  tasksDue,
  loadingTasks,
  selectedProgramId,
  programTaskLogs,
  loadingTaskLogs,
  showAssistanceForm,
  assistanceForm,
  setAssistanceForm,
  savingAssistance,
  assistanceSuccess,
  onCreateRehab,
  onEditRehab,
  onSelectProgram,
  onActivateProgram,
  onCompleteProgram,
  onAcceptCarePlanQuote,
  onDeclineCarePlanQuote,
  onCompletePhase,
  onOpenAssistanceForm,
  onCloseAssistanceForm,
  onSubmitAssistance,
  onOpenTaskLogModal,
  getRehabRequestState,
  formatPrice,
  onAcceptQuote,
  onRejectQuote,
}: CarePlansTabProps) {
  const getPhaseStartDate = (program: RehabProgram, phase: RehabPhase) => {
    if (!program.start_date) return '';
    const start = new Date(program.start_date);
    start.setDate(start.getDate() + phase.start_day - 1);
    return start.toISOString().split('T')[0];
  };

  const getPhaseEndDate = (program: RehabProgram, phase: RehabPhase) => {
    if (!program.start_date) return '';
    const start = new Date(program.start_date);
    start.setDate(start.getDate() + phase.start_day + phase.duration_days - 2);
    return start.toISOString().split('T')[0];
  };

  return (
    <div className="records-section">
      <div className="section-header">
        <h2>Care Plans</h2>
        <button className="add-btn" onClick={onCreateRehab}>+ New Care Plan</button>
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
                  {task.duration_minutes && <span className="task-duration">{task.duration_minutes} min</span>}
                  {task.is_logged && <span className="logged-badge">Done</span>}
                </div>
                <p className="task-description">{task.description}</p>
                {task.instructions && <p className="task-instructions">{task.instructions}</p>}
                <div className="task-due-footer">
                  <span className="task-frequency">{task.frequency.replace('_', ' ')}</span>
                  {!task.is_logged && (
                    <button className="btn-log-task" onClick={() => onOpenTaskLogModal(task)}>Log Task</button>
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
          <button className="add-btn" onClick={onCreateRehab}>Create First Care Plan</button>
        </div>
      ) : (
        <div className="care-plans-list">
          {rehabPrograms.map((program) => {
            const completedPhases = program.completed_phases ?? program.phases?.filter(p => p.is_completed).length ?? 0;
            const totalPhases = program.total_phases ?? program.phases?.length ?? 0;
            const progressPercent = program.status === 'completed' ? 100 : (totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0);
            const isExpanded = selectedProgramId === program.id;
            const currentPhase = program.phases?.find(p => !p.is_completed);
            const daysSinceStart = Math.floor((new Date().getTime() - new Date(program.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1;

            return (
              <div key={program.id} className={`care-plan-card status-${program.status} ${isExpanded ? 'expanded' : ''}`}>
                <div className="program-header clickable" onClick={() => onSelectProgram(program.id)}>
                  <div className="header-left">
                    <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
                    <h3>{program.name}</h3>
                  </div>
                  <span className={`status-badge ${program.status}`}>
                    {program.status.charAt(0).toUpperCase() + program.status.slice(1)}
                  </span>
                </div>

                <div className="program-quick-summary">
                  <div className="progress-bar-inline">
                    <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <span className="progress-text">
                    Day {daysSinceStart} • Phase {program.status === 'completed' ? totalPhases : completedPhases + 1} of {totalPhases}
                  </span>
                </div>

                {isExpanded && (
                  <div className="program-expanded">
                    <div className="program-overview">
                      <h4>Program Overview</h4>
                      {program.description && <p className="program-description">{program.description}</p>}
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
                            onClick={(e) => { e.stopPropagation(); onEditRehab(program.id); }}
                          >
                            Edit Program
                          </button>
                        )}
                        {program.status === 'draft' && (() => {
                          const requestState = getRehabRequestState(program.id);
                          if (program.staff_managed) {
                            return (
                              <>
                                {!program.weekly_care_price && <span className="quote-pending-badge">Awaiting Quote</span>}
                                {program.weekly_care_price && (
                                  <div className="quote-actions" onClick={(e) => e.stopPropagation()}>
                                    <button className="btn-action accept" onClick={() => onAcceptCarePlanQuote(program.id)}>
                                      Accept £{program.weekly_care_price}/wk
                                    </button>
                                    <button className="btn-action decline" onClick={() => onDeclineCarePlanQuote(program.id)}>
                                      Decline
                                    </button>
                                  </div>
                                )}
                              </>
                            );
                          }
                          return (
                            <>
                              {requestState.status === 'none' && (
                                <button className="btn-action assistance" onClick={(e) => { e.stopPropagation(); onOpenAssistanceForm(program); }}>
                                  Request Assistance
                                </button>
                              )}
                              {requestState.status === 'pending' && <button className="btn-action assistance pending" disabled>Pending Price</button>}
                              {requestState.status === 'quoted' && requestState.request && (
                                <div className="quote-actions" onClick={(e) => e.stopPropagation()}>
                                  <button className="btn-action accept" onClick={() => onAcceptQuote(requestState.request!.id)}>
                                    Accept {formatPrice(requestState.request.quote_amount || 0)}
                                  </button>
                                  <button className="btn-action decline" onClick={() => onRejectQuote(requestState.request!.id)}>Decline</button>
                                </div>
                              )}
                              {requestState.status === 'approved' && <button className="btn-action approved" disabled>Accepted</button>}
                              <button className="btn-action activate" onClick={(e) => { e.stopPropagation(); onActivateProgram(program.id); }}>
                                Activate Care Plan
                              </button>
                            </>
                          );
                        })()}
                        {program.status === 'active' && (() => {
                          const requestState = getRehabRequestState(program.id);
                          return (
                            <>
                              {!program.staff_managed && requestState.status === 'none' && (
                                <button className="btn-action assistance" onClick={(e) => { e.stopPropagation(); onOpenAssistanceForm(program); }}>
                                  Request Assistance
                                </button>
                              )}
                              {program.staff_managed && (
                                <span className="staff-managed-badge">
                                  Staff Managed{program.weekly_care_price && ` · £${program.weekly_care_price}/wk`}
                                </span>
                              )}
                              {!program.staff_managed && requestState.status === 'pending' && <button className="btn-action assistance pending" disabled>Pending Price</button>}
                              {!program.staff_managed && requestState.status === 'quoted' && requestState.request && (
                                <div className="quote-actions" onClick={(e) => e.stopPropagation()}>
                                  <button className="btn-action accept" onClick={() => onAcceptQuote(requestState.request!.id)}>
                                    Accept {formatPrice(requestState.request.quote_amount || 0)}
                                  </button>
                                  <button className="btn-action decline" onClick={() => onRejectQuote(requestState.request!.id)}>Decline</button>
                                </div>
                              )}
                              {!program.staff_managed && requestState.status === 'approved' && <button className="btn-action approved" disabled>Accepted</button>}
                              <button className="btn-action complete" onClick={(e) => { e.stopPropagation(); onCompleteProgram(program.id); }}>
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
                              <button className="ds-btn ds-btn-secondary" onClick={onCloseAssistanceForm}>Close</button>
                            </div>
                          ) : (
                            <>
                              <div className="assistance-form">
                                <p className="form-intro">Request a quote for staff to cover care plan tasks during these dates.</p>
                                <div className="form-row">
                                  <div className="ds-form-group">
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
                                  <div className="ds-form-group">
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
                                <div className="ds-form-group">
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
                                <button className="ds-btn ds-btn-secondary" onClick={onCloseAssistanceForm} disabled={savingAssistance}>Cancel</button>
                                <button className="ds-btn ds-btn-primary" onClick={() => onSubmitAssistance(program)} disabled={savingAssistance}>
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
                            {formatDate(getPhaseStartDate(program, currentPhase))} - {formatDate(getPhaseEndDate(program, currentPhase))}
                            <span className="duration-badge">{currentPhase.duration_days} days</span>
                          </p>
                          {currentPhase.description && <p className="phase-description">{currentPhase.description}</p>}
                        </div>
                        {currentPhase.tasks && currentPhase.tasks.length > 0 && (
                          <div className="phase-tasks">
                            <h5>Daily Tasks</h5>
                            <div className="tasks-grid">
                              {currentPhase.tasks.map((task, idx) => (
                                <div key={idx} className="task-card">
                                  <div className="task-header">
                                    <span className="task-type">{task.task_type.replace('_', ' ')}</span>
                                    {task.duration_minutes && <span className="task-duration">{task.duration_minutes} mins</span>}
                                  </div>
                                  <p className="task-description">{task.description}</p>
                                  {task.instructions && <p className="task-instructions">{task.instructions}</p>}
                                  {task.equipment_needed && <p className="task-equipment"><strong>Equipment:</strong> {task.equipment_needed}</p>}
                                  {task.frequency && <span className="task-frequency">{task.frequency.replace('_', ' ')}</span>}
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
                              <div className="phase-timeline-marker"><span className="phase-number">{idx + 1}</span></div>
                              <div className="phase-timeline-content">
                                <div className="phase-timeline-header">
                                  <span className="phase-name">{phase.name}</span>
                                  <span className={`phase-status-badge ${phaseStatus}`}>
                                    {phaseStatus === 'completed' ? 'Completed' : phaseStatus === 'in_progress' ? 'In Progress' : 'Upcoming'}
                                  </span>
                                </div>
                                <p className="phase-timeline-dates">{formatDate(getPhaseStartDate(program, phase))} - {formatDate(getPhaseEndDate(program, phase))}</p>
                                {phase.description && <p className="phase-timeline-desc">{phase.description}</p>}
                                {phase.completion_notes && <p className="phase-completion-notes"><strong>Completion notes:</strong> {phase.completion_notes}</p>}
                                {phaseStatus === 'in_progress' && program.status === 'active' && (
                                  <button className="btn-complete-phase" onClick={(e) => { e.stopPropagation(); onCompletePhase(program.id, phase.id); }}>
                                    Complete Phase
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Task History */}
                    <div className="task-history-section">
                      <TaskHistoryPanel logs={programTaskLogs} loading={loadingTaskLogs} showFilters={false} showMetrics={false} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
