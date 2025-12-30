import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { tasksApi, usersApi, servicesApi, staffApi, settingsApi } from '../services/api';
import { useModalForm, useRequestState } from '../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../components/ui';
import type {
  YardTask,
  YardTaskDetail,
  CreateYardTask,
  TasksListResponse,
  TaskEnums,
  TaskCategory,
  TaskPriority,
  AssignmentType,
  HealthTaskType,
  HealthTaskCompletion,
  MedicationTaskCompletion,
  WoundCareTaskCompletion,
  HealthObservationTaskCompletion,
  RehabExerciseTaskCompletion,
  HealingStatus,
  AppetiteStatus,
  DemeanorStatus,
  User,
  ServiceRequest,
  Shift,
} from '../types';
import './YardTasks.css';

const HEALTH_TASK_TYPE_LABELS: Record<HealthTaskType, string> = {
  medication: 'Medication',
  wound_care: 'Wound Care',
  health_check: 'Health Check',
  rehab_exercise: 'Rehab Exercise',
};

const HEALING_STATUS_LABELS: Record<HealingStatus, string> = {
  improving: 'Improving',
  stable: 'Stable',
  worsening: 'Worsening',
  infected: 'Infected',
  healed: 'Healed',
};

const APPETITE_LABELS: Record<AppetiteStatus, string> = {
  normal: 'Normal',
  reduced: 'Reduced',
  not_eating: 'Not Eating',
  increased: 'Increased',
};

const DEMEANOR_LABELS: Record<DemeanorStatus, string> = {
  bright: 'Bright',
  quiet: 'Quiet',
  lethargic: 'Lethargic',
  agitated: 'Agitated',
};

type TabType = 'open' | 'my' | 'today' | 'pool' | 'backlog' | 'completed' | 'reported' | 'scheduled';

export default function YardTasks() {
  const { isAdmin, user } = useAuth();

  // Only staff and admin can access this page
  const isStaffOrAdmin = isAdmin || user?.is_yard_staff;

  // Non-admin staff default to 'my' tab (their assigned tasks)
  const [activeTab, setActiveTab] = useState<TabType>(isAdmin ? 'today' : 'my');
  const [tasks, setTasks] = useState<TasksListResponse | null>(null);
  const [enums, setEnums] = useState<TaskEnums | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [assignedServices, setAssignedServices] = useState<ServiceRequest[]>([]);

  // Request state
  const { loading, error, setError, setLoading } = useRequestState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | ''>('');
  const [assignedToFilter, setAssignedToFilter] = useState<number | ''>('');

  // Modal hooks
  const createTaskModal = useModalForm<CreateYardTask>({
    title: '',
    category: 'maintenance',
    priority: 'medium',
    assignment_type: 'backlog',
  });

  const completeModal = useModalForm({
    notes: '',
  });

  // Confirm modal for cancel
  const [cancelTarget, setCancelTarget] = useState<YardTask | null>(null);

  // Other modals
  const [selectedTask, setSelectedTask] = useState<YardTaskDetail | null>(null);
  const [showMaintenanceDayModal, setShowMaintenanceDayModal] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);
  const [maintenanceDate, setMaintenanceDate] = useState('');
  const [maintenanceAssignee, setMaintenanceAssignee] = useState<number | ''>('');
  const [staffMembers, setStaffMembers] = useState<User[]>([]);
  const [staffShifts, setStaffShifts] = useState<Shift[]>([]);
  const [maintenanceDays, setMaintenanceDays] = useState<Array<{
    date: string;
    staff_id: number;
    staff_name: string | null;
    shift_type: string;
    notes: string | null;
  }>>([]);
  const [nextMaintenanceDay, setNextMaintenanceDay] = useState<string | null>(null);
  const [staffOnRota, setStaffOnRota] = useState<Array<{
    id: number;
    name: string;
    role: string | null;
    shift_type: string;
    shift_role: string | null;
  }>>([]);
  const [loadingStaffOnRota, setLoadingStaffOnRota] = useState(false);
  const [staffOnRotaToday, setStaffOnRotaToday] = useState<Array<{
    id: number;
    name: string;
    role: string | null;
    shift_type: string;
    shift_role: string | null;
  }>>([]);
  const [showHealthCompleteModal, setShowHealthCompleteModal] = useState(false);
  const [healthTaskToComplete, setHealthTaskToComplete] = useState<YardTask | null>(null);
  const [showEditScheduledModal, setShowEditScheduledModal] = useState(false);
  const [editScheduledDate, setEditScheduledDate] = useState<string | null>(null);

  // Health task completion forms
  const [medicationCompletion, setMedicationCompletion] = useState<MedicationTaskCompletion>({
    was_given: true,
  });
  const [woundCareCompletion, setWoundCareCompletion] = useState<WoundCareTaskCompletion>({
    treatment_given: '',
    healing_assessment: 'stable',
  });
  const [healthObsCompletion, setHealthObsCompletion] = useState<HealthObservationTaskCompletion>({
    appetite: 'normal',
    demeanor: 'bright',
    droppings_normal: true,
  });
  const [rehabCompletion, setRehabCompletion] = useState<RehabExerciseTaskCompletion>({
    was_completed: true,
  });

  // Comments form
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (isStaffOrAdmin) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter, priorityFilter, assignedToFilter, isStaffOrAdmin]);

  // Authorization check - must be after all hooks
  if (!isStaffOrAdmin) {
    return <Navigate to="/book" replace />;
  }

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('YardTasks: Loading data...');
      const [tasksData, enumsData] = await Promise.all([
        tasksApi.list(
          categoryFilter || undefined,
          priorityFilter || undefined,
          undefined, // status filter
          assignedToFilter !== '' ? assignedToFilter : undefined
        ),
        tasksApi.getEnums(),
      ]);
      console.log('YardTasks: Tasks loaded:', tasksData);
      setTasks(tasksData);
      setEnums(enumsData);

      // Load users if admin (for assignment)
      if (isAdmin) {
        console.log('YardTasks: Loading users for admin...');
        const usersData = await usersApi.list();
        console.log('YardTasks: Users loaded:', usersData?.length, 'users');
        setUsers(usersData);
        // Filter to only staff members for maintenance day scheduling
        const staff = usersData.filter((u: User) => u.is_yard_staff || u.role === 'staff');
        console.log('YardTasks: Staff members for maintenance day:', staff?.length);
        setStaffMembers(staff);

        // Load today's rota for filter dropdown
        try {
          const today = new Date().toISOString().split('T')[0];
          const rotaData = await settingsApi.getStaffOnRota(today);
          setStaffOnRotaToday(rotaData.staff_on_rota);
        } catch {
          setStaffOnRotaToday([]);
        }
      }

      // Load assigned services for staff
      if (isAdmin || user?.is_yard_staff) {
        try {
          const servicesData = await servicesApi.getAssignedRequests();
          setAssignedServices(servicesData);
        } catch {
          // Non-critical failure
          setAssignedServices([]);
        }
      }
    } catch (err) {
      setError('Failed to load tasks');
      console.error('YardTasks: Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenanceDays = async () => {
    if (!isAdmin) return;
    try {
      const data = await settingsApi.getMaintenanceDays();
      setMaintenanceDays(data.maintenance_days);
      setNextMaintenanceDay(data.next_maintenance_day);
    } catch {
      // Non-critical - just won't show the quick-add option
      setMaintenanceDays([]);
      setNextMaintenanceDay(null);
    }
  };

  const openScheduleModal = async () => {
    setShowMaintenanceDayModal(true);
    await loadMaintenanceDays();
  };

  const scheduleToNextMaintenanceDay = () => {
    if (!nextMaintenanceDay || maintenanceDays.length === 0) return;

    // Find the maintenance day details
    const nextDay = maintenanceDays[0];
    if (nextDay) {
      setMaintenanceDate(nextDay.date);
      // If there's an assigned staff member, select them
      if (nextDay.staff_id) {
        setMaintenanceAssignee(nextDay.staff_id);
      }
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await tasksApi.create(createTaskModal.formData);
      createTaskModal.close();
      loadData();
    } catch (err) {
      setError('Failed to create task');
      console.error(err);
    }
  };

  const handleViewTask = async (taskId: number) => {
    try {
      const taskDetail = await tasksApi.get(taskId);
      setSelectedTask(taskDetail);

      // Load staff on rota for the task's scheduled date (for assignment dropdown)
      // For pool tasks without scheduled_date, use today
      if (isAdmin) {
        const today = new Date().toISOString().split('T')[0];
        const targetDate = taskDetail.scheduled_date ||
          (taskDetail.assignment_type === 'pool' ? today : null);

        if (targetDate) {
          setLoadingStaffOnRota(true);
          try {
            const rotaData = await settingsApi.getStaffOnRota(targetDate);
            setStaffOnRota(rotaData.staff_on_rota);
          } catch {
            // Non-critical - fall back to showing all staff
            setStaffOnRota([]);
          } finally {
            setLoadingStaffOnRota(false);
          }
        } else {
          setStaffOnRota([]);
        }
      } else {
        setStaffOnRota([]);
      }
    } catch (err) {
      setError('Failed to load task details');
      console.error(err);
    }
  };

  const handleCompleteTask = async () => {
    if (!completeModal.editingId) return;
    try {
      await tasksApi.complete(completeModal.editingId, completeModal.formData.notes || undefined);
      completeModal.close();
      if (selectedTask?.id === completeModal.editingId) {
        setSelectedTask(null);
      }
      await loadData();
    } catch (err) {
      setError('Failed to complete task');
      console.error(err);
    }
  };

  const handleCancelTask = async () => {
    if (!cancelTarget) return;
    try {
      await tasksApi.cancel(cancelTarget.id);
      setCancelTarget(null);
      loadData();
      if (selectedTask?.id === cancelTarget.id) {
        setSelectedTask(null);
      }
    } catch (err) {
      setError('Failed to cancel task');
      console.error(err);
    }
  };

  const handleReopenTask = async (taskId: number) => {
    try {
      await tasksApi.reopen(taskId);
      loadData();
      if (selectedTask?.id === taskId) {
        const updated = await tasksApi.get(taskId);
        setSelectedTask(updated);
      }
    } catch (err) {
      setError('Failed to reopen task');
      console.error(err);
    }
  };

  const handleAssignTask = async (taskId: number, userId: number | undefined, toPool?: boolean) => {
    try {
      await tasksApi.assign(taskId, userId, toPool);
      loadData();
      if (selectedTask?.id === taskId) {
        const updated = await tasksApi.get(taskId);
        setSelectedTask(updated);
        // Reload staff on rota for updated task
        if (isAdmin && updated.scheduled_date) {
          try {
            const rotaData = await settingsApi.getStaffOnRota(updated.scheduled_date);
            setStaffOnRota(rotaData.staff_on_rota);
          } catch {
            setStaffOnRota([]);
          }
        }
      }
    } catch (err) {
      setError('Failed to assign task');
      console.error(err);
    }
  };

  const handleMaintenanceDayAssign = async () => {
    if (!maintenanceDate || !maintenanceAssignee || selectedTaskIds.length === 0) return;
    try {
      await tasksApi.assignMaintenanceDay({
        task_ids: selectedTaskIds,
        assigned_to_id: maintenanceAssignee as number,
        scheduled_date: maintenanceDate,
      });
      setShowMaintenanceDayModal(false);
      setSelectedTaskIds([]);
      setMaintenanceDate('');
      setMaintenanceAssignee('');
      setStaffShifts([]);
      loadData();
    } catch (err) {
      setError('Failed to schedule maintenance day');
      console.error(err);
    }
  };

  // Load shifts when a staff member is selected for maintenance day
  const handleStaffSelect = async (staffId: number | '') => {
    console.log('YardTasks: handleStaffSelect called with staffId:', staffId);
    setMaintenanceAssignee(staffId);
    setMaintenanceDate(''); // Reset date when staff changes

    if (!staffId) {
      setStaffShifts([]);
      return;
    }

    try {
      // Load shifts for the next 3 months
      const today = new Date();
      const threeMonthsLater = new Date();
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

      console.log('YardTasks: Loading shifts for staff', staffId, 'from', today.toISOString().split('T')[0], 'to', threeMonthsLater.toISOString().split('T')[0]);
      const shiftsData = await staffApi.listShifts(
        staffId as number,
        today.toISOString().split('T')[0],
        threeMonthsLater.toISOString().split('T')[0]
      );
      console.log('YardTasks: Shifts loaded:', shiftsData);
      setStaffShifts(shiftsData.shifts);
    } catch (err) {
      console.error('YardTasks: Failed to load staff shifts:', err);
      setStaffShifts([]);
    }
  };

  const toggleTaskSelection = (taskId: number) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newComment.trim()) return;
    try {
      await tasksApi.addComment(selectedTask.id, newComment);
      setNewComment('');
      const updated = await tasksApi.get(selectedTask.id);
      setSelectedTask(updated);
    } catch (err) {
      setError('Failed to add comment');
      console.error(err);
    }
  };

  const handleCompleteHealthTask = async () => {
    if (!healthTaskToComplete) return;
    try {
      const completion: HealthTaskCompletion = {};
      switch (healthTaskToComplete.health_task_type) {
        case 'medication':
          completion.medication = medicationCompletion;
          break;
        case 'wound_care':
          completion.wound_care = woundCareCompletion;
          break;
        case 'health_check':
          completion.health_observation = healthObsCompletion;
          break;
        case 'rehab_exercise':
          completion.rehab_exercise = rehabCompletion;
          break;
      }
      await tasksApi.completeHealthTask(healthTaskToComplete.id, completion);
      setShowHealthCompleteModal(false);
      setHealthTaskToComplete(null);
      resetHealthCompletionForms();
      if (selectedTask?.id === healthTaskToComplete.id) {
        setSelectedTask(null);
      }
      await loadData();
    } catch (err) {
      setError('Failed to complete health task');
      console.error(err);
    }
  };

  const resetHealthCompletionForms = () => {
    setMedicationCompletion({ was_given: true });
    setWoundCareCompletion({ treatment_given: '', healing_assessment: 'stable' });
    setHealthObsCompletion({ appetite: 'normal', demeanor: 'bright', droppings_normal: true });
    setRehabCompletion({ was_completed: true });
  };

  const openHealthCompleteModal = (task: YardTask) => {
    setHealthTaskToComplete(task);
    resetHealthCompletionForms();
    setShowHealthCompleteModal(true);
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!selectedTask) return;
    try {
      await tasksApi.deleteComment(selectedTask.id, commentId);
      const updated = await tasksApi.get(selectedTask.id);
      setSelectedTask(updated);
    } catch (err) {
      setError('Failed to delete comment');
      console.error(err);
    }
  };

  const getCurrentTasks = (): YardTask[] => {
    if (!tasks) return [];
    switch (activeTab) {
      case 'open':
        return tasks.open_tasks;
      case 'my':
        return tasks.my_tasks;
      case 'today':
        // Combine today's assigned tasks and pool tasks
        return [...tasks.today_tasks, ...tasks.pool_tasks];
      case 'pool':
        return tasks.pool_tasks;
      case 'backlog':
        return tasks.backlog_tasks;
      case 'completed':
        return tasks.completed_tasks;
      case 'reported':
        // Tasks reported by current user (from my_tasks which includes assigned to me AND reported by me)
        return tasks.my_tasks;
      case 'scheduled':
        return tasks.scheduled_tasks || [];
      default:
        return [];
    }
  };

  const getPriorityClass = (priority: TaskPriority): string => {
    switch (priority) {
      case 'urgent':
        return 'priority-urgent';
      case 'high':
        return 'priority-high';
      case 'medium':
        return 'priority-medium';
      case 'low':
        return 'priority-low';
      default:
        return '';
    }
  };

  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'open':
        return 'status-open';
      case 'in_progress':
        return 'status-in-progress';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString();
  };

  const formatDateTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString();
  };

  const isOverdue = (task: YardTask): boolean => {
    if (!task.scheduled_date || task.status === 'completed' || task.status === 'cancelled') {
      return false;
    }
    return new Date(task.scheduled_date) < new Date(new Date().toDateString());
  };

  // Service request handlers
  const handleCompleteService = async (requestId: number) => {
    try {
      await servicesApi.completeRequest(requestId, {});
      await loadData();
    } catch {
      setError('Failed to complete service');
    }
  };

  const formatServiceDateTime = (dateStr: string | undefined) => {
    if (!dateStr) return 'Not scheduled';
    return new Date(dateStr).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  // Edit scheduled day handlers
  const openEditScheduledModal = (dateStr: string) => {
    setEditScheduledDate(dateStr);
    setShowEditScheduledModal(true);
  };

  const handleUnscheduleTask = async (taskId: number) => {
    try {
      await tasksApi.unschedule(taskId);
      await loadData();
    } catch {
      setError('Failed to unschedule task');
    }
  };

  const handleReassignTask = async (taskId: number, assignedToId?: number) => {
    try {
      if (assignedToId) {
        await tasksApi.reassign(taskId, assignedToId);
      } else {
        await tasksApi.reassign(taskId, undefined, 'pool');
      }
      await loadData();
    } catch {
      setError('Failed to reassign task');
    }
  };

  const getTasksForDate = (dateStr: string): YardTask[] => {
    return (tasks?.scheduled_tasks || []).filter(t => t.scheduled_date === dateStr);
  };

  if (loading) {
    return <div className="ds-loading">Loading tasks...</div>;
  }

  return (
    <div className="yard-tasks">
      <div className="tasks-header">
        <h1>{isAdmin ? 'Yard Tasks' : 'My Tasks'}</h1>
        {isAdmin && (
          <div className="header-actions">
            <button className="ds-btn ds-btn-primary" onClick={openScheduleModal}>
              Schedule
            </button>
            <button className="ds-btn ds-btn-primary" onClick={() => createTaskModal.open()}>
              Create
            </button>
          </div>
        )}
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}


      {/* Filters - Admin only */}
      {isAdmin && (
        <div className="tasks-filters">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as TaskCategory | '')}
          >
            <option value="">All Categories</option>
            {enums?.categories.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | '')}
          >
            <option value="">All Priorities</option>
            {enums?.priorities.map((pri) => (
              <option key={pri.value} value={pri.value}>
                {pri.label}
              </option>
            ))}
          </select>
          <select
            value={assignedToFilter}
            onChange={(e) => setAssignedToFilter(e.target.value === '' ? '' : parseInt(e.target.value))}
          >
            <option value="">All Assignments</option>
            <option value="-1">Unassigned / Pool</option>
            {staffOnRotaToday.length > 0 ? (
              <>
                <optgroup label="On Rota Today">
                  {staffOnRotaToday.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} ({staff.shift_type})
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Other Staff">
                  {users.filter(u => !staffOnRotaToday.some(s => s.id === u.id)).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </optgroup>
              </>
            ) : (
              users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Tab selector - dropdown for both mobile and desktop */}
      <div className="tasks-tab-selector">
        <select
          value={activeTab}
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'report') {
              createTaskModal.open();
              // Reset to current tab (don't change selection)
              e.target.value = activeTab;
            } else {
              setActiveTab(value as TabType);
            }
          }}
          className="tab-select"
        >
          {isAdmin ? (
            <>
              <option value="today">Today's Tasks ({(tasks?.today_tasks.length || 0) + (tasks?.pool_tasks.length || 0)})</option>
              <option value="open">All Open ({tasks?.open_tasks.length || 0})</option>
              <option value="backlog">To Schedule ({tasks?.backlog_tasks.length || 0})</option>
              <option value="scheduled">Scheduled ({tasks?.scheduled_tasks?.length || 0})</option>
              <option value="completed">Completed Today ({tasks?.completed_tasks.length || 0})</option>
            </>
          ) : user?.is_yard_staff ? (
            <>
              <option value="my">My Daily Tasks ({(tasks?.my_tasks.length || 0) + assignedServices.filter(s => s.assigned_to_id === user?.id).length})</option>
              <option value="pool">Team Daily Tasks ({(tasks?.pool_tasks.length || 0) + assignedServices.filter(s => !s.assigned_to_id || s.assigned_to_id !== user?.id).length})</option>
              <option value="report" className="action-option">+ Report Issue</option>
            </>
          ) : null}
        </select>
      </div>

      {/* Task List - Combined tasks and services for staff view */}
      <div className="tasks-list">

        {/* Upcoming scheduled tasks - grouped by date */}
        {activeTab === 'scheduled' && (
          (tasks?.scheduled_tasks?.length || 0) === 0 ? (
            <div className="ds-empty">No tasks scheduled for future dates</div>
          ) : (
            (() => {
              // Group tasks by scheduled date
              const tasksByDate = (tasks?.scheduled_tasks || []).reduce((acc, task) => {
                const dateKey = task.scheduled_date || 'unscheduled';
                if (!acc[dateKey]) acc[dateKey] = [];
                acc[dateKey].push(task);
                return acc;
              }, {} as Record<string, YardTask[]>);

              const todayStr = new Date().toISOString().split('T')[0];
              return Object.entries(tasksByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([dateStr, dateTasks]) => {
                  const isToday = dateStr === todayStr;
                  return (
                  <div key={dateStr} className={`scheduled-date-group ${isToday ? 'today' : ''}`}>
                    <h3 className="scheduled-date-header">
                      {isToday && <span className="today-badge">Today</span>}
                      {new Date(dateStr).toLocaleDateString('en-GB', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })}
                      <span className="task-count">({dateTasks.length} task{dateTasks.length !== 1 ? 's' : ''})</span>
                      <button
                        className="ds-btn ds-btn-secondary btn-small edit-day-btn"
                        onClick={(e) => { e.stopPropagation(); openEditScheduledModal(dateStr); }}
                      >
                        Edit
                      </button>
                    </h3>
                    {/* Group by assigned staff within each date */}
                    {(() => {
                      const tasksByStaff = dateTasks.reduce((acc, task) => {
                        // Use assignment type to determine grouping
                        const staffKey = task.assignment_type === 'pool'
                          ? 'Pool (Any Staff)'
                          : (task.assigned_to_name || 'Unassigned');
                        if (!acc[staffKey]) acc[staffKey] = [];
                        acc[staffKey].push(task);
                        return acc;
                      }, {} as Record<string, YardTask[]>);

                      // Sort to show Pool section first, then by staff name
                      const sortedEntries = Object.entries(tasksByStaff).sort(([a], [b]) => {
                        if (a === 'Pool (Any Staff)') return -1;
                        if (b === 'Pool (Any Staff)') return 1;
                        return a.localeCompare(b);
                      });

                      return sortedEntries.map(([staffName, staffTasks]) => (
                        <div key={staffName} className={`staff-task-group ${staffName === 'Pool (Any Staff)' ? 'pool-group' : ''}`}>
                          <h4 className="staff-name">{staffName}</h4>
                          <ul className="scheduled-task-list">
                            {staffTasks.map(task => (
                              <li key={task.id} className="scheduled-task-item" onClick={() => handleViewTask(task.id)}>
                                <span className="task-title">{task.title}</span>
                                <span className="task-category">
                                  {enums?.categories.find((c) => c.value === task.category)?.label || task.category}
                                </span>
                                {(isAdmin || user?.role === 'livery') && task.estimated_cost != null && (
                                  <span className="task-cost">£{Number(task.estimated_cost).toFixed(2)}</span>
                                )}
                                {(isAdmin || user?.role === 'livery') && task.service_billable_amount != null && (
                                  <span className="task-billable">Billable: £{Number(task.service_billable_amount).toFixed(2)}</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ));
                    })()}
                  </div>
                );
                })
            })()
          )
        )}

        {/* Today's Tasks - grouped view */}
        {activeTab === 'today' && isAdmin && (
          getCurrentTasks().length === 0 ? (
            <div className="ds-empty">No tasks scheduled for today</div>
          ) : (
            (() => {
              const todaysTasks = getCurrentTasks();
              // Group by staff assignment
              const tasksByStaff = todaysTasks.reduce((acc, task) => {
                const staffKey = task.assignment_type === 'pool'
                  ? 'Staff Pool (Anyone)'
                  : (task.assigned_to_name || 'Unassigned');
                if (!acc[staffKey]) acc[staffKey] = [];
                acc[staffKey].push(task);
                return acc;
              }, {} as Record<string, YardTask[]>);

              // Sort to show assigned staff first (alphabetically), then Pool at the end
              const sortedEntries = Object.entries(tasksByStaff).sort(([a], [b]) => {
                if (a === 'Staff Pool (Anyone)') return 1;
                if (b === 'Staff Pool (Anyone)') return -1;
                if (a === 'Unassigned') return 1;
                if (b === 'Unassigned') return -1;
                return a.localeCompare(b);
              });

              return sortedEntries.map(([staffName, staffTasks]) => (
                <div key={staffName} className={`today-staff-group ${staffName === 'Staff Pool (Anyone)' ? 'pool-group' : ''}`}>
                  <h3 className="staff-group-header">
                    {staffName}
                    <span className="task-count">({staffTasks.length} task{staffTasks.length !== 1 ? 's' : ''})</span>
                  </h3>
                  <div className="staff-tasks-list">
                    {staffTasks.map((task) => (
                      <div
                        key={`task-${task.id}`}
                        className={`task-card ${isOverdue(task) ? 'overdue' : ''} ${task.health_task_type ? 'health-task-card' : ''} ${task.assigned_to_id === user?.id ? 'my-task' : ''}`}
                        onClick={() => handleViewTask(task.id)}
                      >
                        <div className="task-card-header">
                          {task.health_task_type && (
                            <span className={`health-type-badge health-type-${task.health_task_type}`}>
                              {HEALTH_TASK_TYPE_LABELS[task.health_task_type]}
                            </span>
                          )}
                          <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                            {enums?.priorities.find((p) => p.value === task.priority)?.label || task.priority}
                          </span>
                          {task.assigned_to_id === user?.id && (
                            <span className="assignment-badge assigned-to-me">Your Task</span>
                          )}
                        </div>
                        <h3 className="task-title">{task.title}</h3>
                        {task.health_task_type && (
                          <div className="health-task-info">
                            {task.horse_name && <span className="horse-badge">{task.horse_name}</span>}
                            {task.feed_time && <span className="feed-time-badge">{task.feed_time}</span>}
                            {task.medication_dosage && <span className="dosage-info">{task.medication_dosage}</span>}
                          </div>
                        )}
                        <div className="task-meta">
                          <span className="task-category">
                            {enums?.categories.find((c) => c.value === task.category)?.label || task.category}
                          </span>
                          {task.location && <span className="task-location">{task.location}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()
          )
        )}

        {/* Backlog/To Schedule - with staff on rota for quick assignment */}
        {activeTab === 'backlog' && isAdmin && (
          <>
            {/* Staff on Rota Today summary */}
            {staffOnRotaToday.length > 0 && (
              <div className="rota-summary-panel">
                <h3>Staff on Rota Today</h3>
                <div className="rota-staff-chips">
                  {staffOnRotaToday.map((staff) => (
                    <span key={staff.id} className="staff-chip">
                      {staff.name}
                      <span className="shift-type">({staff.shift_type})</span>
                    </span>
                  ))}
                </div>
                <p className="rota-hint">Click a task to assign, or use "Schedule" button to bulk assign</p>
              </div>
            )}
            {staffOnRotaToday.length === 0 && (
              <div className="rota-summary-panel no-staff">
                <h3>No Staff on Rota Today</h3>
                <p>Consider scheduling staff shifts before assigning tasks</p>
              </div>
            )}

            {/* Backlog tasks with quick-assign */}
            {getCurrentTasks().length === 0 ? (
              <div className="ds-empty">No tasks to schedule</div>
            ) : (
              getCurrentTasks().map((task) => (
                <div
                  key={`task-${task.id}`}
                  className={`task-card backlog-task ${task.health_task_type ? 'health-task-card' : ''}`}
                >
                  <div className="task-card-content" onClick={() => handleViewTask(task.id)}>
                    <div className="task-card-header">
                      {task.health_task_type && (
                        <span className={`health-type-badge health-type-${task.health_task_type}`}>
                          {HEALTH_TASK_TYPE_LABELS[task.health_task_type]}
                        </span>
                      )}
                      <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                        {enums?.priorities.find((p) => p.value === task.priority)?.label || task.priority}
                      </span>
                    </div>
                    <h3 className="task-title">{task.title}</h3>
                    {task.health_task_type && (
                      <div className="health-task-info">
                        {task.horse_name && <span className="horse-badge">{task.horse_name}</span>}
                        {task.feed_time && <span className="feed-time-badge">{task.feed_time}</span>}
                      </div>
                    )}
                    <div className="task-meta">
                      <span className="task-category">
                        {enums?.categories.find((c) => c.value === task.category)?.label || task.category}
                      </span>
                      {task.location && <span className="task-location">{task.location}</span>}
                    </div>
                  </div>
                  {/* Quick assign buttons */}
                  <div className="quick-assign-row">
                    <span className="quick-assign-label">Assign for today:</span>
                    <div className="quick-assign-buttons">
                      <button
                        className="quick-assign-btn pool"
                        onClick={(e) => { e.stopPropagation(); handleAssignTask(task.id, undefined, true); }}
                        title="Assign to staff pool"
                      >
                        Pool
                      </button>
                      {staffOnRotaToday.slice(0, 4).map((staff) => (
                        <button
                          key={staff.id}
                          className="quick-assign-btn"
                          onClick={(e) => { e.stopPropagation(); handleAssignTask(task.id, staff.id); }}
                          title={`Assign to ${staff.name}`}
                        >
                          {staff.name.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* Regular tasks - combined with services for staff */}
        {activeTab !== 'scheduled' && activeTab !== 'today' && activeTab !== 'backlog' && (
          (() => {
            // Priority order: urgent=0, high=1, medium=2, low=3, services=2.5 (after medium tasks)
            const priorityOrder: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
            const allTasks = getCurrentTasks();

            // For staff, combine services with tasks
            const isStaffView = !isAdmin && user?.is_yard_staff && (activeTab === 'my' || activeTab === 'pool');
            const filteredServices = isStaffView
              ? assignedServices.filter(s =>
                  activeTab === 'my' ? s.assigned_to_id === user?.id : (!s.assigned_to_id || s.assigned_to_id !== user?.id)
                )
              : [];

            const scheduledServices = filteredServices.filter(s => s.status === 'scheduled');
            const completedServices = filteredServices.filter(s => s.status === 'completed');

            const incompleteTasks = allTasks
              .filter(t => t.status !== 'completed' && t.status !== 'cancelled')
              .sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4));
            const completedTasks = allTasks.filter(t => t.status === 'completed' || t.status === 'cancelled');

            // Split tasks by priority for interleaving with services
            const urgentTasks = incompleteTasks.filter(t => t.priority === 'urgent');
            const highTasks = incompleteTasks.filter(t => t.priority === 'high');
            const mediumTasks = incompleteTasks.filter(t => t.priority === 'medium');
            const lowTasks = incompleteTasks.filter(t => t.priority === 'low' || !priorityOrder[t.priority]);

            const hasItems = allTasks.length > 0 || filteredServices.length > 0;

            if (!hasItems) {
              return <div className="ds-empty">No tasks found</div>;
            }

            // Staff see simplified cards - hide redundant info
            const isStaffRole = !isAdmin && user?.role !== 'livery';

            // Helper to render a service card (matches task card structure)
            const renderServiceCard = (service: ServiceRequest, isCompleted = false) => (
              <div key={`service-${service.id}`} className={`task-card ${isCompleted ? 'completed-task' : ''}`}>
                {/* Hide type/status badges for staff - they know it's a service in their list */}
                {!isStaffRole && (
                  <div className="task-card-header">
                    <span className="service-type-badge">Livery Service</span>
                    <span className={`status-badge status-${service.status}`}>
                      {service.status.replace('_', ' ')}
                    </span>
                  </div>
                )}
                <div className="task-title-row">
                  <h3 className="task-title">{service.service_name}</h3>
                </div>
                <div className="task-meta">
                  <span className="task-category">Horse: {service.horse_name}</span>
                </div>
                {/* Hide assignment for staff - they're viewing their own tasks */}
                {!isStaffRole && (
                  <div className="task-assignment">
                    {service.assigned_to_id === user?.id ? (
                      <span className="assignment-badge assigned-to-me">Assigned to you</span>
                    ) : service.assigned_to_id ? (
                      <span className="assignment-badge assigned-specific">Assigned to staff</span>
                    ) : (
                      <span className="assignment-badge assigned-pool">All Staff</span>
                    )}
                  </div>
                )}
                {/* Hide dates for staff, show for others */}
                {!isStaffRole && (
                  <div className="task-info">
                    {isCompleted ? (
                      <span>Completed: {formatServiceDateTime(service.completed_datetime)}</span>
                    ) : (
                      <>
                        <span>Scheduled: {formatServiceDateTime(service.scheduled_datetime)}</span>
                        <span>Requested by: {service.requested_by_name}</span>
                      </>
                    )}
                  </div>
                )}
                {!isCompleted && service.special_instructions && (
                  <div className="completion-notes">
                    <span className="notes-label">Instructions:</span> {service.special_instructions}
                  </div>
                )}
                {!isCompleted && (
                  <div className="task-quick-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-task-complete" onClick={() => handleCompleteService(service.id)}>
                      Complete & Log
                    </button>
                  </div>
                )}
              </div>
            );

            // Helper to render a task card
            const renderTaskCard = (task: YardTask) => (
              <div
                key={`task-${task.id}`}
                className={`task-card ${isStaffRole ? 'staff-compact' : ''} ${isOverdue(task) ? 'overdue' : ''} ${task.health_task_type ? 'health-task-card' : ''}`}
                onClick={() => handleViewTask(task.id)}
              >
                {/* Staff: priority inline with title. Others: full header */}
                {isStaffRole ? (
                  <div className="task-title-row">
                    <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                      {enums?.priorities.find((p) => p.value === task.priority)?.label || task.priority}
                    </span>
                    <h3 className="task-title">{task.title}</h3>
                  </div>
                ) : (
                  <>
                    <div className="task-card-header">
                      {task.health_task_type && (
                        <span className={`health-type-badge health-type-${task.health_task_type}`}>
                          {HEALTH_TASK_TYPE_LABELS[task.health_task_type]}
                        </span>
                      )}
                      <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                        {enums?.priorities.find((p) => p.value === task.priority)?.label || task.priority}
                      </span>
                      <span className={`status-badge ${getStatusClass(task.status)}`}>
                        {enums?.statuses.find((s) => s.value === task.status)?.label || task.status}
                      </span>
                    </div>
                    <h3 className="task-title">{task.title}</h3>
                  </>
                )}
                {/* Health task specific info */}
                {task.health_task_type && (
                  <div className="health-task-info">
                    {task.horse_name && <span className="horse-badge">{task.horse_name}</span>}
                    {task.feed_time && <span className="feed-time-badge">{task.feed_time}</span>}
                    {task.medication_dosage && <span className="dosage-info">{task.medication_dosage}</span>}
                    {task.wound_location && <span className="wound-info">{task.wound_location}</span>}
                    {task.rehab_program_name && <span className="program-info">{task.rehab_program_name}</span>}
                  </div>
                )}
                {/* For staff: just category. For others: category + location */}
                {!isStaffRole && (
                  <div className="task-meta">
                    <span className="task-category">
                      {enums?.categories.find((c) => c.value === task.category)?.label || task.category}
                    </span>
                    {task.location && <span className="task-location">{task.location}</span>}
                  </div>
                )}
                {/* Hide assignment for staff */}
                {!isStaffRole && (
                  <div className="task-assignment">
                    {task.assignment_type === 'specific' && task.assigned_to_id === user?.id ? (
                      <span className="assignment-badge assigned-to-me">Assigned to you</span>
                    ) : task.assignment_type === 'specific' && task.assigned_to_name ? (
                      <span className="assignment-badge assigned-specific">Assigned: {task.assigned_to_name}</span>
                    ) : task.assignment_type === 'pool' ? (
                      <span className="assignment-badge assigned-pool">All Staff</span>
                    ) : task.assignment_type === 'backlog' ? (
                      <span className="assignment-badge assigned-backlog">Backlog</span>
                    ) : null}
                  </div>
                )}
                {/* Hide all task-info for staff */}
                {!isStaffRole && (
                  <div className="task-info">
                    {task.status === 'completed' ? (
                      <>
                        <span>Completed by: {task.completed_by_name || 'Unknown'}</span>
                        {task.completed_date && (
                          <span>Completed: {formatDate(task.completed_date)}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <span>Reported by: {task.reported_by_name}</span>
                        {task.scheduled_date && (
                          <span className={isOverdue(task) ? 'overdue-date' : ''}>
                            Due: {formatDate(task.scheduled_date)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                )}
                {task.status === 'completed' && task.completion_notes && (
                  <div className="completion-notes">
                    <span className="notes-label">Notes:</span> {task.completion_notes}
                  </div>
                )}
                {task.comment_count !== undefined && task.comment_count > 0 && (
                  <span className="comment-count">{task.comment_count} comments</span>
                )}
                {/* Only show billing info to admin and livery users, not staff */}
                {(isAdmin || user?.role === 'livery') && task.estimated_cost != null && (
                  <span className="cost-indicator">£{Number(task.estimated_cost).toFixed(2)}</span>
                )}
                {(isAdmin || user?.role === 'livery') && task.service_billable_amount != null && (
                  <span className="billable-indicator">Billable: £{Number(task.service_billable_amount).toFixed(2)}</span>
                )}
                {/* Quick complete button for all tasks */}
                {task.status !== 'completed' && task.status !== 'cancelled' && (
                  <div className="task-quick-actions" onClick={(e) => e.stopPropagation()}>
                    {task.health_task_type ? (
                      <button
                        className="btn-health-complete"
                        onClick={() => openHealthCompleteModal(task)}
                      >
                        Complete & Log
                      </button>
                    ) : (
                      <button
                        className="btn-task-complete"
                        onClick={() => completeModal.edit(task.id, { notes: '' })}
                      >
                        Complete & Log
                      </button>
                    )}
                  </div>
                )}
              </div>
            );

            return (
              <>
                {/* Render in priority order: urgent, high, services, medium, low */}
                {urgentTasks.map(renderTaskCard)}
                {highTasks.map(renderTaskCard)}
                {scheduledServices.map(s => renderServiceCard(s, false))}
                {mediumTasks.map(renderTaskCard)}
                {lowTasks.map(renderTaskCard)}

                {/* Completed section with divider - includes both tasks and services */}
                {(completedTasks.length > 0 || completedServices.length > 0) && (
                  <>
                    <div className="completed-section-divider">
                      <span>Completed ({completedTasks.length + completedServices.length})</span>
                    </div>
                    {completedServices.map(s => renderServiceCard(s, true))}
                    {completedTasks.map((task) => (
                      <div
                        key={`task-${task.id}`}
                        className={`task-card completed-task ${task.health_task_type ? 'health-task-card' : ''}`}
                        onClick={() => handleViewTask(task.id)}
                      >
                        <div className="task-card-header">
                          {task.health_task_type && (
                            <span className={`health-type-badge health-type-${task.health_task_type}`}>
                              {HEALTH_TASK_TYPE_LABELS[task.health_task_type]}
                            </span>
                          )}
                          <span className={`priority-badge ${getPriorityClass(task.priority)}`}>
                            {enums?.priorities.find((p) => p.value === task.priority)?.label || task.priority}
                          </span>
                          <span className={`status-badge ${getStatusClass(task.status)}`}>
                            {enums?.statuses.find((s) => s.value === task.status)?.label || task.status}
                          </span>
                        </div>
                        <h3 className="task-title">{task.title}</h3>
                        <div className="task-meta">
                          <span className="task-category">
                            {enums?.categories.find((c) => c.value === task.category)?.label || task.category}
                          </span>
                          {task.location && <span className="task-location">{task.location}</span>}
                        </div>
                        <div className="task-info">
                          <span>Completed by: {task.completed_by_name || 'Unknown'}</span>
                          {task.completed_date && (
                            <span>Completed: {formatDate(task.completed_date)}</span>
                          )}
                        </div>
                        {task.completion_notes && (
                          <div className="completion-notes">
                            <span className="notes-label">Notes:</span> {task.completion_notes}
                          </div>
                        )}
                        {/* Reopen button for completed tasks */}
                        {task.status === 'completed' && (isAdmin || task.assigned_to_id === user?.id) && (
                          <div className="task-quick-actions" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn-task-reopen"
                              onClick={() => handleReopenTask(task.id)}
                            >
                              Reopen
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </>
            );
          })()
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={createTaskModal.isOpen}
        onClose={createTaskModal.close}
        title="Report a Task"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={createTaskModal.close}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleCreateTask}>
              Create Task
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateTask}>
          <FormGroup label="Title" required>
            <Input
              value={createTaskModal.formData.title}
              onChange={(e) => createTaskModal.updateField('title', e.target.value)}
              required
            />
          </FormGroup>

          <FormGroup label="Category" required>
            <Select
              value={createTaskModal.formData.category}
              onChange={(e) => createTaskModal.updateField('category', e.target.value as TaskCategory)}
              required
            >
              {enums?.categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Location">
            <Input
              value={createTaskModal.formData.location || ''}
              onChange={(e) => createTaskModal.updateField('location', e.target.value)}
              placeholder="e.g., Stable 5, Main arena"
            />
          </FormGroup>

          <FormGroup label="Description">
            <Textarea
              value={createTaskModal.formData.description || ''}
              onChange={(e) => createTaskModal.updateField('description', e.target.value)}
              rows={3}
              placeholder="Please describe the issue or task..."
            />
          </FormGroup>

          {/* Admin-only fields for triage */}
          {isAdmin && (
            <>
              <FormGroup label="Priority">
                <Select
                  value={createTaskModal.formData.priority}
                  onChange={(e) => createTaskModal.updateField('priority', e.target.value as TaskPriority)}
                >
                  {enums?.priorities.map((pri) => (
                    <option key={pri.value} value={pri.value}>
                      {pri.label}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup label="Scheduled Date">
                <Input
                  type="date"
                  value={createTaskModal.formData.scheduled_date || ''}
                  onChange={(e) => createTaskModal.updateField('scheduled_date', e.target.value)}
                />
              </FormGroup>

              <FormGroup label="Assignment Type">
                <Select
                  value={createTaskModal.formData.assignment_type || 'backlog'}
                  onChange={(e) => createTaskModal.updateField('assignment_type', e.target.value as AssignmentType)}
                >
                  {enums?.assignment_types.map((at) => (
                    <option key={at.value} value={at.value}>
                      {at.label}
                    </option>
                  ))}
                </Select>
                <small className="form-help">
                  {createTaskModal.formData.assignment_type === 'specific' && 'Assign to a specific person for a specific day'}
                  {createTaskModal.formData.assignment_type === 'pool' && 'Available for any staff working today'}
                  {createTaskModal.formData.assignment_type === 'backlog' && 'Not yet scheduled - can be assigned to a maintenance day later'}
                </small>
              </FormGroup>

              <FormGroup label="Assign To">
                <Select
                  value={createTaskModal.formData.assigned_to_id || ''}
                  onChange={(e) => createTaskModal.updateField('assigned_to_id', e.target.value ? parseInt(e.target.value) : undefined)}
                  disabled={createTaskModal.formData.assignment_type !== 'specific'}
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormGroup label="Estimated Cost (£)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createTaskModal.formData.estimated_cost || ''}
                  onChange={(e) => createTaskModal.updateField('estimated_cost', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="0.00"
                />
                <small className="form-help">Budget required for purchases (leave blank if none)</small>
              </FormGroup>
            </>
          )}
        </form>
      </Modal>

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="ds-modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="ds-modal task-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="task-detail-header">
              <div className="task-badges">
                <span className={`priority-badge ${getPriorityClass(selectedTask.priority)}`}>
                  {enums?.priorities.find((p) => p.value === selectedTask.priority)?.label}
                </span>
                <span className={`status-badge ${getStatusClass(selectedTask.status)}`}>
                  {enums?.statuses.find((s) => s.value === selectedTask.status)?.label}
                </span>
                {isOverdue(selectedTask) && <span className="overdue-badge">Overdue</span>}
              </div>
              <button className="close-btn" onClick={() => setSelectedTask(null)}>
                &times;
              </button>
            </div>

            <h2>{selectedTask.title}</h2>

            {/* Health task info */}
            {selectedTask.health_task_type && (
              <div className="health-task-details">
                <span className={`health-type-badge health-type-${selectedTask.health_task_type}`}>
                  {HEALTH_TASK_TYPE_LABELS[selectedTask.health_task_type]}
                </span>
                {selectedTask.horse_name && (
                  <p className="horse-info">Horse: <strong>{selectedTask.horse_name}</strong></p>
                )}
                {selectedTask.medication_dosage && (
                  <p className="horse-info">Dosage: {selectedTask.medication_dosage}</p>
                )}
                {selectedTask.wound_location && (
                  <p className="horse-info">Location: {selectedTask.wound_location}</p>
                )}
                {selectedTask.rehab_program_name && (
                  <p className="horse-info">Program: {selectedTask.rehab_program_name}</p>
                )}
              </div>
            )}

            <div className="task-detail-info">
              <div className="info-row">
                <span className="info-label">Category:</span>
                <span>{enums?.categories.find((c) => c.value === selectedTask.category)?.label}</span>
              </div>
              {selectedTask.location && (
                <div className="info-row">
                  <span className="info-label">Location:</span>
                  <span>{selectedTask.location}</span>
                </div>
              )}
              <div className="info-row">
                <span className="info-label">Reported by:</span>
                <span>{selectedTask.reported_by_name}{selectedTask.reported_date && ` on ${formatDateTime(selectedTask.reported_date)}`}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Assigned to:</span>
                <span className={`assignment-value ${selectedTask.assignment_type}`}>
                  {selectedTask.assignment_type === 'specific' && selectedTask.assigned_to_name ? (
                    selectedTask.assigned_to_name
                  ) : selectedTask.assignment_type === 'pool' ? (
                    'Staff Pool (Anyone on rota)'
                  ) : selectedTask.assignment_type === 'backlog' ? (
                    'Unscheduled (Backlog)'
                  ) : (
                    'Unassigned'
                  )}
                </span>
              </div>
              {selectedTask.scheduled_date && (
                <div className="info-row">
                  <span className="info-label">Due Date:</span>
                  <span className={isOverdue(selectedTask) ? 'overdue-date' : ''}>
                    {formatDate(selectedTask.scheduled_date)}
                  </span>
                </div>
              )}
              {selectedTask.completed_date && (
                <div className="info-row">
                  <span className="info-label">Completed:</span>
                  <span>{formatDateTime(selectedTask.completed_date)} by {selectedTask.completed_by_name}</span>
                </div>
              )}
              {/* Only show billing info to admin and livery users, not staff */}
              {(isAdmin || user?.role === 'livery') && selectedTask.estimated_cost != null && (
                <div className="info-row">
                  <span className="info-label">Est. Cost:</span>
                  <span className="cost-badge">£{Number(selectedTask.estimated_cost).toFixed(2)}</span>
                </div>
              )}
              {(isAdmin || user?.role === 'livery') && selectedTask.service_billable_amount != null && (
                <div className="info-row">
                  <span className="info-label">Billable:</span>
                  <span className="billable-badge">£{Number(selectedTask.service_billable_amount).toFixed(2)}</span>
                </div>
              )}
            </div>

            {selectedTask.description && (
              <div className="task-description">
                <h4>Description</h4>
                <p>{selectedTask.description}</p>
              </div>
            )}

            {selectedTask.completion_notes && (
              <div className="completion-notes">
                <h4>Completion Notes</h4>
                <p>{selectedTask.completion_notes}</p>
              </div>
            )}

            {/* Staff Assignment */}
            {isAdmin && selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
              <div className="task-assign">
                <label>Assign to:</label>
                <select
                  value={selectedTask.assignment_type === 'pool' ? 'pool' : (selectedTask.assigned_to_id || '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'pool') {
                      handleAssignTask(selectedTask.id, undefined, true);
                    } else if (value) {
                      handleAssignTask(selectedTask.id, parseInt(value));
                    } else {
                      handleAssignTask(selectedTask.id, undefined);
                    }
                  }}
                  disabled={loadingStaffOnRota}
                >
                  <option value="">Unassigned</option>
                  {/* Show Staff Pool option if task has scheduled date OR is already a pool task */}
                  {(selectedTask.scheduled_date || selectedTask.assignment_type === 'pool') && (
                    <option value="pool">Staff Pool (Anyone on rota)</option>
                  )}
                  {loadingStaffOnRota ? (
                    <option disabled>Loading staff on rota...</option>
                  ) : staffOnRota.length > 0 ? (
                    <>
                      <optgroup label="Staff on Rota">
                        {staffOnRota.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.name} ({staff.shift_type})
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Other Staff">
                        {users.filter(u => !staffOnRota.some(s => s.id === u.id)).map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))
                  )}
                </select>
                {selectedTask.scheduled_date && staffOnRota.length === 0 && !loadingStaffOnRota && (
                  <small className="rota-warning">No staff scheduled for this date</small>
                )}
              </div>
            )}

            {/* Actions */}
            {selectedTask.status !== 'completed' && selectedTask.status !== 'cancelled' && (
              <div className="task-actions">
                {selectedTask.health_task_type ? (
                  <button
                    className="btn-success"
                    onClick={() => {
                      setSelectedTask(null);
                      openHealthCompleteModal(selectedTask);
                    }}
                  >
                    Complete & Log Health Record
                  </button>
                ) : (
                  <button
                    className="btn-success"
                    onClick={() => completeModal.edit(selectedTask.id, { notes: '' })}
                  >
                    Complete Task
                  </button>
                )}
                {isAdmin && (
                  <button className="btn-danger" onClick={() => setCancelTarget(selectedTask)}>
                    Cancel Task
                  </button>
                )}
              </div>
            )}

            {/* Reopen action for completed tasks - admin or assigned staff only */}
            {selectedTask.status === 'completed' && (isAdmin || selectedTask.assigned_to_id === user?.id) && (
              <div className="task-actions">
                <button className="ds-btn ds-btn-secondary" onClick={() => handleReopenTask(selectedTask.id)}>
                  Reopen Task
                </button>
              </div>
            )}

            {/* Comments Section */}
            <div className="comments-section">
              <h4>Comments ({selectedTask.comments.length})</h4>
              <div className="comments-list">
                {selectedTask.comments.map((comment) => (
                  <div key={comment.id} className="comment">
                    <div className="comment-header">
                      <span className="comment-author">{comment.user_name}</span>
                      <span className="comment-date">{formatDateTime(comment.created_at)}</span>
                    </div>
                    <p className="comment-content">{comment.content}</p>
                    <button
                      className="delete-comment-btn"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
              <form className="add-comment-form" onSubmit={handleAddComment}>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                />
                <button type="submit" className="ds-btn ds-btn-primary" disabled={!newComment.trim()}>
                  Add Comment
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Complete Task Modal */}
      <Modal
        isOpen={completeModal.isOpen}
        onClose={completeModal.close}
        title="Complete Task"
        size="sm"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={completeModal.close}>
              Cancel
            </button>
            <button className="btn-success" onClick={handleCompleteTask}>
              Complete Task & Log
            </button>
          </>
        }
      >
        {completeModal.editingId && (() => {
          const task = tasks?.open_tasks.find(t => t.id === completeModal.editingId) ||
                       tasks?.my_tasks.find(t => t.id === completeModal.editingId) ||
                       tasks?.today_tasks.find(t => t.id === completeModal.editingId) ||
                       tasks?.pool_tasks.find(t => t.id === completeModal.editingId) ||
                       tasks?.backlog_tasks.find(t => t.id === completeModal.editingId);
          if (!task) return null;
          return (
            <>
              <div className="task-complete-details">
                <span className={`category-badge category-${task.category}`}>
                  {enums?.categories.find((c) => c.value === task.category)?.label || task.category}
                </span>
                <h3>{task.title}</h3>
                {task.location && (
                  <p className="task-location-info">Location: <strong>{task.location}</strong></p>
                )}
                {task.description && (
                  <p className="task-description-info">{task.description}</p>
                )}
              </div>

              <FormGroup label="Completion Notes (optional)">
                <Textarea
                  value={completeModal.formData.notes}
                  onChange={(e) => completeModal.updateField('notes', e.target.value)}
                  placeholder="Add any notes about how the task was completed, issues encountered, follow-up needed..."
                  rows={4}
                />
              </FormGroup>
            </>
          );
        })()}
      </Modal>

      {/* Cancel Task Confirmation */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelTask}
        title="Cancel Task"
        message={`Are you sure you want to cancel "${cancelTarget?.title}"?`}
        confirmLabel="Cancel Task"
        variant="danger"
      />

      {/* Maintenance Day Modal */}
      {showMaintenanceDayModal && (
        <div className="ds-modal-overlay" onClick={() => setShowMaintenanceDayModal(false)}>
          <div className="ds-modal maintenance-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Schedule Selected Tasks</h2>
            <p className="modal-description">
              Select a staff member to see their scheduled work days, then choose tasks from the backlog.
            </p>

            {/* Staff on Rota Today - Quick assign */}
            {staffOnRotaToday.length > 0 && (
              <div className="quick-schedule-section rota-today-section">
                <h4>Staff on Rota Today</h4>
                <div className="rota-quick-buttons">
                  {staffOnRotaToday.map((staff) => (
                    <button
                      key={staff.id}
                      type="button"
                      className={`rota-staff-btn ${maintenanceAssignee === staff.id ? 'selected' : ''}`}
                      onClick={() => {
                        setMaintenanceAssignee(staff.id);
                        setMaintenanceDate(new Date().toISOString().split('T')[0]);
                      }}
                    >
                      {staff.name}
                      <span className="shift-info">{staff.shift_type}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`rota-staff-btn pool-btn ${maintenanceAssignee === -1 ? 'selected' : ''}`}
                    onClick={() => {
                      setMaintenanceAssignee(-1 as unknown as number);
                      setMaintenanceDate(new Date().toISOString().split('T')[0]);
                    }}
                  >
                    Staff Pool
                    <span className="shift-info">Anyone</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick schedule to next maintenance day */}
            {nextMaintenanceDay && maintenanceDays.length > 0 && (
              <div className="quick-schedule-section">
                <h4>Next Maintenance Day</h4>
                <button
                  type="button"
                  className="btn-accent"
                  onClick={scheduleToNextMaintenanceDay}
                >
                  Add to Maintenance Day
                  <span className="maintenance-day-info">
                    {new Date(nextMaintenanceDay).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {maintenanceDays[0]?.staff_name && ` - ${maintenanceDays[0].staff_name}`}
                  </span>
                </button>
              </div>
            )}

            <div className="ds-form-group">
              <label>Or Select Staff Member</label>
              <select
                value={maintenanceAssignee === -1 ? '' : maintenanceAssignee}
                onChange={(e) => handleStaffSelect(e.target.value ? parseInt(e.target.value) : '')}
              >
                <option value="">Select a staff member...</option>
                {staffOnRotaToday.length > 0 && (
                  <optgroup label="On Rota Today">
                    {staffOnRotaToday.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} ({staff.shift_type})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={staffOnRotaToday.length > 0 ? "Other Staff" : "All Staff"}>
                  {staffMembers.filter(s => !staffOnRotaToday.some(r => r.id === s.id)).map((staffMember) => (
                    <option key={staffMember.id} value={staffMember.id}>
                      {staffMember.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            <div className="ds-form-group">
              <label>Scheduled Date *</label>
              {maintenanceAssignee && staffShifts.length === 0 ? (
                <p className="no-shifts-warning">No scheduled shifts found for this staff member. You can still select any date.</p>
              ) : null}
              {maintenanceAssignee && staffShifts.length > 0 ? (
                <>
                  <select
                    value={maintenanceDate}
                    onChange={(e) => setMaintenanceDate(e.target.value)}
                    required
                  >
                    <option value="">Select a work day...</option>
                    {staffShifts.map((shift) => (
                      <option key={shift.id} value={shift.date}>
                        {new Date(shift.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {shift.shift_type && ` (${shift.shift_type.replace('_', ' ')})`}
                      </option>
                    ))}
                  </select>
                  <small className="form-help">Showing scheduled work days for the next 3 months</small>
                </>
              ) : (
                <input
                  type="date"
                  value={maintenanceDate}
                  onChange={(e) => setMaintenanceDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                  disabled={!maintenanceAssignee}
                />
              )}
            </div>

            <div className="ds-form-group">
              <label>Select Tasks from Backlog ({selectedTaskIds.length} selected)</label>
              <div className="task-selection-list">
                {tasks?.backlog_tasks.length === 0 ? (
                  <p className="empty-message">No backlog tasks available</p>
                ) : (
                  tasks?.backlog_tasks.map((task) => (
                    <label key={task.id} className="task-selection-item">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.id)}
                        onChange={() => toggleTaskSelection(task.id)}
                      />
                      <span className="task-selection-content">
                        <span className="task-selection-title">{task.title}</span>
                        <span className="task-selection-meta">
                          {enums?.categories.find((c) => c.value === task.category)?.label}
                          {task.estimated_cost != null && ` • £${Number(task.estimated_cost).toFixed(2)}`}
                        </span>
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="ds-btn ds-btn-secondary"
                onClick={() => {
                  setShowMaintenanceDayModal(false);
                  setSelectedTaskIds([]);
                  setMaintenanceDate('');
                  setMaintenanceAssignee('');
                  setStaffShifts([]);
                }}
              >
                Cancel
              </button>
              <button
                className="ds-btn ds-btn-primary"
                onClick={handleMaintenanceDayAssign}
                disabled={!maintenanceDate || !maintenanceAssignee || selectedTaskIds.length === 0}
              >
                Schedule {selectedTaskIds.length} Task{selectedTaskIds.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Health Task Completion Modal */}
      <Modal
        isOpen={showHealthCompleteModal && !!healthTaskToComplete}
        onClose={() => setShowHealthCompleteModal(false)}
        title="Complete Health Task"
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => setShowHealthCompleteModal(false)}>
              Cancel
            </button>
            <button
              className="btn-success"
              onClick={handleCompleteHealthTask}
              disabled={
                (healthTaskToComplete?.health_task_type === 'wound_care' && !woundCareCompletion.treatment_given)
              }
            >
              Complete Task & Log Health Record
            </button>
          </>
        }
      >
        {healthTaskToComplete && (
          <>
            <div className="health-task-details">
              <span className={`health-type-badge health-type-${healthTaskToComplete.health_task_type}`}>
                {healthTaskToComplete.health_task_type && HEALTH_TASK_TYPE_LABELS[healthTaskToComplete.health_task_type]}
              </span>
              <h3>{healthTaskToComplete.title}</h3>
              {healthTaskToComplete.horse_name && (
                <p className="horse-info">Horse: <strong>{healthTaskToComplete.horse_name}</strong></p>
              )}
            </div>

            {/* Medication Completion Form */}
            {healthTaskToComplete.health_task_type === 'medication' && (
              <div className="health-form">
                <FormGroup label="Was medication given?">
                  <div className="toggle-group">
                    <button
                      type="button"
                      className={`toggle-btn ${medicationCompletion.was_given ? 'active' : ''}`}
                      onClick={() => setMedicationCompletion({ ...medicationCompletion, was_given: true })}
                    >
                      Yes, Given
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${!medicationCompletion.was_given ? 'active' : ''}`}
                      onClick={() => setMedicationCompletion({ ...medicationCompletion, was_given: false })}
                    >
                      Skipped
                    </button>
                  </div>
                </FormGroup>
                {!medicationCompletion.was_given && (
                  <FormGroup label="Reason for skipping">
                    <Input
                      value={medicationCompletion.skip_reason || ''}
                      onChange={(e) => setMedicationCompletion({ ...medicationCompletion, skip_reason: e.target.value })}
                      placeholder="e.g., Horse refused, out of stock..."
                    />
                  </FormGroup>
                )}
                <FormGroup label="Notes (optional)">
                  <Textarea
                    value={medicationCompletion.notes || ''}
                    onChange={(e) => setMedicationCompletion({ ...medicationCompletion, notes: e.target.value })}
                    rows={2}
                    placeholder="Any observations..."
                  />
                </FormGroup>
              </div>
            )}

            {/* Wound Care Completion Form */}
            {healthTaskToComplete.health_task_type === 'wound_care' && (
              <div className="health-form">
                <FormGroup label="Treatment Given" required>
                  <Input
                    value={woundCareCompletion.treatment_given}
                    onChange={(e) => setWoundCareCompletion({ ...woundCareCompletion, treatment_given: e.target.value })}
                    placeholder="e.g., Cleaned with saline, applied cream..."
                    required
                  />
                </FormGroup>
                <FormGroup label="Products Used">
                  <Input
                    value={woundCareCompletion.products_used || ''}
                    onChange={(e) => setWoundCareCompletion({ ...woundCareCompletion, products_used: e.target.value })}
                    placeholder="e.g., Hibiscrub, Flamazine..."
                  />
                </FormGroup>
                <FormGroup label="Healing Assessment" required>
                  <Select
                    value={woundCareCompletion.healing_assessment}
                    onChange={(e) => setWoundCareCompletion({ ...woundCareCompletion, healing_assessment: e.target.value as HealingStatus })}
                    required
                  >
                    {Object.entries(HEALING_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </FormGroup>
                <FormGroup label="Next Treatment Due">
                  <Input
                    type="date"
                    value={woundCareCompletion.next_treatment_due || ''}
                    onChange={(e) => setWoundCareCompletion({ ...woundCareCompletion, next_treatment_due: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </FormGroup>
                <FormGroup>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={woundCareCompletion.is_healed || false}
                      onChange={(e) => setWoundCareCompletion({ ...woundCareCompletion, is_healed: e.target.checked })}
                    />
                    Mark wound as healed
                  </label>
                </FormGroup>
                <FormGroup label="Assessment Notes">
                  <Textarea
                    value={woundCareCompletion.assessment_notes || ''}
                    onChange={(e) => setWoundCareCompletion({ ...woundCareCompletion, assessment_notes: e.target.value })}
                    rows={2}
                    placeholder="Observations about wound condition..."
                  />
                </FormGroup>
              </div>
            )}

            {/* Health Observation Completion Form */}
            {healthTaskToComplete.health_task_type === 'health_check' && (
              <div className="health-form">
                <FormRow>
                  <FormGroup label="Appetite" required>
                    <Select
                      value={healthObsCompletion.appetite}
                      onChange={(e) => setHealthObsCompletion({ ...healthObsCompletion, appetite: e.target.value as AppetiteStatus })}
                      required
                    >
                      {Object.entries(APPETITE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                  </FormGroup>
                  <FormGroup label="Demeanor" required>
                    <Select
                      value={healthObsCompletion.demeanor}
                      onChange={(e) => setHealthObsCompletion({ ...healthObsCompletion, demeanor: e.target.value as DemeanorStatus })}
                      required
                    >
                      {Object.entries(DEMEANOR_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </Select>
                  </FormGroup>
                </FormRow>
                <FormGroup>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={healthObsCompletion.droppings_normal}
                      onChange={(e) => setHealthObsCompletion({ ...healthObsCompletion, droppings_normal: e.target.checked })}
                    />
                    Droppings normal
                  </label>
                </FormGroup>
                <FormGroup label="Temperature (°C)">
                  <Input
                    type="number"
                    step="0.1"
                    value={healthObsCompletion.temperature || ''}
                    onChange={(e) => setHealthObsCompletion({ ...healthObsCompletion, temperature: e.target.value ? parseFloat(e.target.value) : undefined })}
                    placeholder="e.g., 37.5"
                  />
                </FormGroup>
                <FormGroup label="Concerns">
                  <Textarea
                    value={healthObsCompletion.concerns || ''}
                    onChange={(e) => setHealthObsCompletion({ ...healthObsCompletion, concerns: e.target.value })}
                    rows={2}
                    placeholder="Any concerns or abnormalities..."
                  />
                </FormGroup>
                <FormGroup>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={healthObsCompletion.vet_notified || false}
                      onChange={(e) => setHealthObsCompletion({ ...healthObsCompletion, vet_notified: e.target.checked })}
                    />
                    Vet notified
                  </label>
                </FormGroup>
              </div>
            )}

            {/* Rehab Exercise Completion Form */}
            {healthTaskToComplete.health_task_type === 'rehab_exercise' && (
              <div className="health-form">
                <FormGroup label="Was exercise completed?">
                  <div className="toggle-group">
                    <button
                      type="button"
                      className={`toggle-btn ${rehabCompletion.was_completed ? 'active' : ''}`}
                      onClick={() => setRehabCompletion({ ...rehabCompletion, was_completed: true })}
                    >
                      Yes, Completed
                    </button>
                    <button
                      type="button"
                      className={`toggle-btn ${!rehabCompletion.was_completed ? 'active' : ''}`}
                      onClick={() => setRehabCompletion({ ...rehabCompletion, was_completed: false })}
                    >
                      Skipped
                    </button>
                  </div>
                </FormGroup>
                {!rehabCompletion.was_completed && (
                  <FormGroup label="Reason for skipping">
                    <Input
                      value={rehabCompletion.skip_reason || ''}
                      onChange={(e) => setRehabCompletion({ ...rehabCompletion, skip_reason: e.target.value })}
                      placeholder="e.g., Horse lame, weather..."
                    />
                  </FormGroup>
                )}
                {rehabCompletion.was_completed && (
                  <FormGroup label="Actual Duration (minutes)">
                    <Input
                      type="number"
                      value={rehabCompletion.actual_duration_minutes || ''}
                      onChange={(e) => setRehabCompletion({ ...rehabCompletion, actual_duration_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
                      placeholder="e.g., 20"
                    />
                  </FormGroup>
                )}
                <FormGroup label="Horse Response">
                  <Textarea
                    value={rehabCompletion.horse_response || ''}
                    onChange={(e) => setRehabCompletion({ ...rehabCompletion, horse_response: e.target.value })}
                    rows={2}
                    placeholder="How did the horse respond? Any issues?"
                  />
                </FormGroup>
                <FormGroup label="Concerns">
                  <Textarea
                    value={rehabCompletion.concerns || ''}
                    onChange={(e) => setRehabCompletion({ ...rehabCompletion, concerns: e.target.value })}
                    rows={2}
                    placeholder="Any concerns about the exercise or horse..."
                  />
                </FormGroup>
                <FormGroup label="Lameness Score (AAEP 0-5)">
                  <Select
                    value={rehabCompletion.lameness_score ?? ''}
                    onChange={(e) => setRehabCompletion({ ...rehabCompletion, lameness_score: e.target.value ? parseInt(e.target.value) : undefined })}
                  >
                    <option value="">Not assessed</option>
                    <option value="0">0 - Sound</option>
                    <option value="1">1 - Difficult to observe, inconsistent</option>
                    <option value="2">2 - Difficult to observe at walk, consistent at trot</option>
                    <option value="3">3 - Consistently observable at trot</option>
                    <option value="4">4 - Obvious lameness, head nod/hip hike</option>
                    <option value="5">5 - Minimal weight bearing / non-weight bearing</option>
                  </Select>
                </FormGroup>
                <FormGroup label="Physical Observations">
                  <Textarea
                    value={rehabCompletion.physical_observations || ''}
                    onChange={(e) => setRehabCompletion({ ...rehabCompletion, physical_observations: e.target.value })}
                    rows={2}
                    placeholder="Swelling, heat, filling, wound condition, etc."
                  />
                </FormGroup>
                <FormGroup>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rehabCompletion.vet_notified || false}
                      onChange={(e) => setRehabCompletion({ ...rehabCompletion, vet_notified: e.target.checked })}
                    />
                    Vet notified
                  </label>
                </FormGroup>
              </div>
            )}
          </>
        )}
      </Modal>

      {/* Edit Scheduled Day Modal */}
      {showEditScheduledModal && editScheduledDate && (
        <div className="ds-modal-overlay" onClick={() => setShowEditScheduledModal(false)}>
          <div className="ds-modal edit-scheduled-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Scheduled Day</h2>
            <p className="modal-description">
              {new Date(editScheduledDate).toLocaleDateString('en-GB', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </p>

            <div className="ds-form-group">
              <label>Tasks for this day</label>
              <div className="edit-task-list">
                {getTasksForDate(editScheduledDate).length === 0 ? (
                  <p className="empty-message">No tasks scheduled for this day</p>
                ) : (
                  getTasksForDate(editScheduledDate).map((task) => (
                    <div key={task.id} className="edit-task-item">
                      <div className="edit-task-info">
                        <span className="edit-task-title">{task.title}</span>
                        <span className="edit-task-meta">
                          {task.assignment_type === 'pool' ? (
                            <span className="pool-badge">Pool</span>
                          ) : (
                            <span className="assigned-badge">{task.assigned_to_name}</span>
                          )}
                        </span>
                      </div>
                      <div className="edit-task-actions">
                        {task.assignment_type === 'pool' ? (
                          <select
                            className="reassign-select"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleReassignTask(task.id, parseInt(e.target.value));
                              }
                            }}
                          >
                            <option value="">Assign to...</option>
                            {staffMembers.map((staff) => (
                              <option key={staff.id} value={staff.id}>
                                {staff.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            className="btn-small btn-secondary"
                            onClick={() => handleReassignTask(task.id)}
                            title="Move to pool"
                          >
                            To Pool
                          </button>
                        )}
                        <button
                          className="btn-small btn-danger"
                          onClick={() => handleUnscheduleTask(task.id)}
                          title="Remove from schedule"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="ds-form-group">
              <label>Add tasks from To Schedule</label>
              <div className="add-task-list">
                {tasks?.backlog_tasks.length === 0 ? (
                  <p className="empty-message">No tasks in To Schedule</p>
                ) : (
                  tasks?.backlog_tasks.slice(0, 10).map((task) => (
                    <div key={task.id} className="add-task-item">
                      <span className="add-task-title">{task.title}</span>
                      <span className="add-task-meta">
                        {enums?.categories.find((c) => c.value === task.category)?.label}
                      </span>
                      <button
                        className="btn-small btn-primary"
                        onClick={async () => {
                          try {
                            await tasksApi.update(task.id, {
                              scheduled_date: editScheduledDate,
                              assignment_type: 'pool',
                            });
                            await loadData();
                          } catch {
                            setError('Failed to add task');
                          }
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ))
                )}
                {(tasks?.backlog_tasks.length || 0) > 10 && (
                  <p className="more-tasks">+ {(tasks?.backlog_tasks.length || 0) - 10} more tasks in backlog</p>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="ds-btn ds-btn-primary"
                onClick={() => setShowEditScheduledModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
