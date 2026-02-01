// API Service Layer
// Uses shared apiClient from apiFactory for consistent axios configuration
// The apiFactory also provides createResourceApi for new CRUD endpoints

import { apiClient as api, createResourceApi, createExtendedApi, rawApi, API_URL, isAxiosError } from './apiFactory';
import type {
  User,
  SiteSettings,
  SiteSettingsUpdate,
  StableBlock,
  CreateStableBlockData,
  UpdateStableBlockData,
  Stable,
  CreateStableData,
  UpdateStableData,
  Arena,
  Booking,
  Horse,
  AuthTokens,
  CreateBookingData,
  CreateHorseData,
  CreateArenaData,
  HealthRecordsSummary,
  FarrierRecord,
  DentistRecord,
  VaccinationRecord,
  VaccinationAlert,
  WormingRecord,
  HorseWormCountStatus,
  BulkWormCountCreate,
  BulkWormCountResult,
  WormingReportResponse,
  CreateFarrierRecord,
  CreateDentistRecord,
  CreateVaccinationRecord,
  CreateWormingRecord,
  WeightRecord,
  BodyConditionRecord,
  Saddle,
  CreateSaddle,
  UpdateSaddle,
  SaddleFitRecord,
  CreateWeightRecord,
  UpdateWeightRecord,
  CreateBodyConditionRecord,
  UpdateBodyConditionRecord,
  CreateSaddleFitRecord,
  UpdateSaddleFitRecord,
  PhysioRecord,
  CreatePhysioRecord,
  UpdatePhysioRecord,
  FeedSummary,
  FeedRequirement,
  FeedAddition,
  FeedSupplyAlert,
  UpdateFeedRequirement,
  CreateFeedAddition,
  CreateFeedAlert,
  AdditionStatus,
  FeedChangeNotification,
  FeedNotificationHistory,
  FeedChangeType,
  Service,
  ServiceRequest,
  ServiceCategory,
  CreateServiceRequest,
  CreateService,
  UpdateService,
  MyServiceRequestsSummary,
  StaffServiceRequestsSummary,
  Notice,
  NoticeCategory,
  NoticeListResponse,
  CreateNotice,
  Professional,
  ProfessionalCategory,
  ProfessionalCategoryInfo,
  ProfessionalDirectoryResponse,
  CreateProfessional,
  YardTask,
  YardTaskDetail,
  TaskComment,
  CreateYardTask,
  UpdateYardTask,
  TasksListResponse,
  TasksSummary,
  TaskEnums,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  MaintenanceDayAssign,
  Shift,
  CreateShift,
  UpdateShift,
  ShiftsListResponse,
  Timesheet,
  CreateTimesheet,
  AdminCreateTimesheet,
  UpdateTimesheet,
  TimesheetsListResponse,
  TimesheetStatus,
  HolidayRequest,
  CreateHolidayRequest,
  UpdateHolidayRequest,
  HolidayRequestsListResponse,
  SickLeaveRecord,
  CreateSickLeave,
  UpdateSickLeave,
  SickLeaveListResponse,
  ManagerDashboard,
  StaffManagementEnums,
  AllStaffLeaveSummary,
  PayrollAdjustment,
  PayrollAdjustmentCreate,
  PayrollAdjustmentListResponse,
  PayrollSummaryResponse,
  StaffThanks,
  StaffThanksCreate,
  StaffThanksListResponse,
  StaffThanksUnreadCount,
  ClinicRequest,
  ClinicRequestDetail,
  CreateClinicRequest,
  UpdateClinicRequest,
  ClinicParticipant,
  CreateClinicParticipant,
  ClinicSlot,
  ClinicSlotWithParticipants,
  CreateClinicSlot,
  UpdateClinicSlot,
  MyClinicRegistration,
  ClinicsListResponse,
  PublicClinicsResponse,
  SocialShareLinks,
  ConflictInfo,
  ClinicEnums,
  Discipline,
  StripeConfig,
  CheckoutResponse,
  PaymentStatusResponse,
  WeatherResponse,
  LiveryPackage,
  CreateLiveryPackage,
  UpdateLiveryPackage,
  ComplianceItem,
  CreateComplianceItem,
  UpdateComplianceItem,
  ComplianceHistory,
  CompleteComplianceItem,
  ComplianceDashboard,
  ArenaUsageReport,
  TurnoutRequest,
  CreateTurnoutRequest,
  UpdateTurnoutRequest,
  TurnoutReviewRequest,
  DailyTurnoutSummary,
  TurnoutEnums,
  TurnoutStatus,
  EmergencyContact,
  EmergencyContactCreate,
  EmergencyContactUpdate,
  EmergencyContactSummary,
  LedgerEntry,
  CreateLedgerEntry,
  UpdateLedgerEntry,
  VoidTransactionRequest,
  RecordPaymentRequest,
  AccountSummary,
  UserAccountSummary,
  TransactionEnums,
  TransactionType,
  AgedDebtReport,
  IncomeSummaryReport,
  Backup,
  BackupCreate,
  BackupListResponse,
  BackupSchedule,
  BackupScheduleUpdate,
  BackupValidationResult,
  BackupImportResult,
  DatabaseBackup,
  DatabaseBackupListResponse,
  CoachProfile,
  RecurringSchedule,
  AvailabilitySlot,
  LessonRequest,
  CreateLessonRequest,
  CreateLessonBook,
  LessonEnums,
  CoachAvailability,
  CalendarAvailabilityResponse,
  CombinedAvailabilityResponse,
  Field,
  CreateField,
  UpdateField,
  FieldConditionUpdate,
  FieldRestPeriod,
  HorseCompanion,
  CreateHorseCompanion,
  TurnoutGroup,
  CreateTurnoutGroup,
  FieldEnums,
  MedicationDue,
  MedicationAdminLog,
  CreateMedicationLog,
  WoundCareLog,
  CreateWoundCareLog,
  ActiveWoundSummary,
  HealthObservation,
  CreateHealthObservation,
  RehabProgram,
  CreateRehabProgram,
  RehabTaskLog,
  CreateRehabTaskLog,
  RehabDueSummary,
  DailyRehabTask,
  Invoice,
  InvoiceSummary,
  MyInvoiceSummary,
  InvoiceGenerateRequest,
  HealthTaskCompletion,
  HealthTaskGenerationResult,
  MonthOption,
  BillingRunRequest,
  BillingRunResponse,
  HolidayLiveryRequestCreate,
  HolidayLiveryApproval,
  HolidayLiveryRejection,
  HolidayLiveryRequestSummary,
  HolidayLiveryRequestResponse,
  HolidayLiveryPublicResponse,
  HolidayLiveryStats,
  HolidayLiveryStatus,
  RehabAssistanceRequest,
  InsuranceStatement,
  ContractTemplate,
  ContractTemplateSummary,
  ContractVersion,
  ContractVersionSummary,
  ContractVersionDiff,
  ContractSignature,
  ContractSignatureSummary,
  MyContract,
  ContractContent,
  CreateContractTemplate,
  UpdateContractTemplate,
  CreateContractVersion,
  SignatureRequest,
  BulkResignRequest,
  InitiateSigningResponse,
  CompleteSigningRequest,
  CompleteSigningResponse,
  DocuSignSettings,
  UpdateDocuSignSettings,
  DocuSignTestResponse,
  ContractType,
  SignatureStatus,
  SSLSettings,
  SSLSettingsUpdate,
  SSLStatusResponse,
  CertificateInfo,
  HorseFieldAssignment,
  HorseFieldAssignmentCreate,
  HorseFieldAssignmentHistory,
  FieldCurrentOccupancy,
  SheepFlock,
  SheepFlockCreate,
  SheepFlockUpdate,
  SheepFlockWithHistory,
  SheepFlockFieldAssignment,
  SheepFlockFieldAssignmentCreate,
  DayStatus,
  CreateDayStatus,
  DayStatusListResponse,
} from '../types';

// Re-export factory utilities for use in other files
export { createResourceApi, createExtendedApi, rawApi };

export const settingsApi = {
  get: async (): Promise<SiteSettings> => {
    const response = await api.get('/settings/');
    return response.data;
  },

  update: async (data: SiteSettingsUpdate): Promise<SiteSettings> => {
    const response = await api.put('/settings/', data);
    return response.data;
  },

  seedDemoData: async (): Promise<{ message: string; demo_data_enabled: boolean }> => {
    const response = await api.post('/settings/demo-data/seed');
    return response.data;
  },

  cleanDemoData: async (): Promise<{ message: string; demo_data_enabled: boolean; tables_cleaned: number }> => {
    const response = await api.post('/settings/demo-data/clean');
    return response.data;
  },

  getDemoStatus: async (): Promise<{
    demo_data_enabled: boolean;
    can_enable_demo: boolean;
    can_clean_demo: boolean;
    has_real_data: boolean;
    reason: string | null;
    demo_users: Record<string, string[]>;
  }> => {
    const response = await api.get('/settings/demo-data/status');
    return response.data;
  },

  // Scheduler endpoints
  getSchedulerStatus: async (): Promise<{
    scheduler_running: boolean;
    jobs: Array<{
      id: string;
      name: string;
      schedule: string;
      next_run: string | null;
      last_run: string | null;
      last_status: 'success' | 'failed' | null;
      last_summary: string | null;
    }>;
    todays_health_tasks: {
      medication: number;
      wound_care: number;
      health_check: number;
      rehab_exercise: number;
      total: number;
    };
    current_date: string;
  }> => {
    const response = await api.get('/settings/scheduler/status');
    return response.data;
  },

  previewHealthTasks: async (targetDate: string): Promise<{
    target_date: string;
    existing_tasks: {
      medication: number;
      wound_care: number;
      health_check: number;
      rehab_exercise: number;
      total: number;
    };
    already_generated: boolean;
    message: string;
  }> => {
    const response = await api.get(`/settings/scheduler/preview/${targetDate}`);
    return response.data;
  },

  generateHealthTasks: async (targetDate: string): Promise<{
    success: boolean;
    target_date: string;
    tasks_generated: {
      medication: number;
      wound_care: number;
      health_check: number;
      rehab_exercise: number;
      total: number;
    };
    message: string;
  }> => {
    const response = await api.post(`/settings/scheduler/generate/${targetDate}`);
    return response.data;
  },

  runTaskRollover: async (): Promise<{
    success: boolean;
    tasks_moved: number;
    message: string;
  }> => {
    const response = await api.post('/settings/scheduler/rollover');
    return response.data;
  },

  rescheduleJobs: async (): Promise<{
    success: boolean;
    message: string;
    jobs: Array<{
      id: string;
      name: string;
      schedule: string;
      next_run: string | null;
    }>;
  }> => {
    const response = await api.post('/settings/scheduler/reschedule');
    return response.data;
  },

  getMaintenanceDays: async (): Promise<{
    maintenance_days: Array<{
      date: string;
      staff_id: number;
      staff_name: string | null;
      shift_type: string;
      notes: string | null;
    }>;
    next_maintenance_day: string | null;
  }> => {
    const response = await api.get('/settings/scheduler/maintenance-days');
    return response.data;
  },

  getStaffOnRota: async (targetDate: string): Promise<{
    date: string;
    staff_on_rota: Array<{
      id: number;
      name: string;
      role: string | null;
      shift_type: string;
      shift_role: string | null;
    }>;
    count: number;
  }> => {
    const response = await api.get(`/settings/scheduler/staff-on-rota/${targetDate}`);
    return response.data;
  },

  triggerTurnoutCutoff: async (): Promise<{
    message: string;
    turnout_cutoff_date: string;
  }> => {
    const response = await api.post('/settings/turnout-cutoff');
    return response.data;
  },

  // WhatsApp test endpoint
  testWhatsApp: async (): Promise<{
    success: boolean;
    test_mode: boolean;
    message: string;
    message_sid?: string;
  }> => {
    const response = await api.post('/settings/whatsapp/test');
    return response.data;
  },

  // SSL/Domain Configuration
  getSSLStatus: async (): Promise<SSLStatusResponse> => {
    const response = await api.get('/settings/ssl');
    return response.data;
  },

  updateSSLSettings: async (data: SSLSettingsUpdate): Promise<SSLSettings> => {
    const response = await api.put('/settings/ssl', data);
    return response.data;
  },

  checkCertificate: async (domain: string): Promise<CertificateInfo> => {
    const response = await api.get(`/settings/ssl/check-certificate?domain=${encodeURIComponent(domain)}`);
    return response.data;
  },
};

export interface UploadResponse {
  filename: string;
  url: string;
}

export const uploadsApi = {
  uploadLogo: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/uploads/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteLogo: async (): Promise<void> => {
    await api.delete('/uploads/logo');
  },

  uploadArenaImage: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/uploads/arena', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getFileUrl: (filename: string): string => {
    return `${API_URL}/api/uploads/files/${filename}`;
  },
};

export const stableBlocksApi = {
  list: async (activeOnly: boolean = false): Promise<StableBlock[]> => {
    const response = await api.get('/stables/blocks', { params: { active_only: activeOnly } });
    return response.data;
  },

  get: async (id: number): Promise<StableBlock & { stables: Stable[] }> => {
    const response = await api.get(`/stables/blocks/${id}`);
    return response.data;
  },

  create: async (data: CreateStableBlockData): Promise<StableBlock> => {
    const response = await api.post('/stables/blocks', data);
    return response.data;
  },

  update: async (id: number, data: UpdateStableBlockData): Promise<StableBlock> => {
    const response = await api.put(`/stables/blocks/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/stables/blocks/${id}`);
  },
};

export const stablesApi = {
  list: async (activeOnly: boolean = false, blockId?: number): Promise<Stable[]> => {
    const params: Record<string, unknown> = { active_only: activeOnly };
    if (blockId !== undefined) {
      params.block_id = blockId;
    }
    const response = await api.get('/stables/', { params });
    return response.data;
  },

  get: async (id: number): Promise<Stable> => {
    const response = await api.get(`/stables/${id}`);
    return response.data;
  },

  create: async (data: CreateStableData): Promise<Stable> => {
    const response = await api.post('/stables/', data);
    return response.data;
  },

  update: async (id: number, data: UpdateStableData): Promise<Stable> => {
    const response = await api.put(`/stables/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/stables/${id}`);
  },

  assignHorse: async (stableId: number, horseId: number): Promise<void> => {
    await api.put(`/stables/${stableId}/assign/${horseId}`);
  },

  unassignHorse: async (stableId: number, horseId: number): Promise<void> => {
    await api.delete(`/stables/${stableId}/unassign/${horseId}`);
  },
};

export const authApi = {
  register: async (username: string, name: string, password: string, email?: string): Promise<User> => {
    const response = await api.post('/auth/register', { username, name, password, email });
    return response.data;
  },

  login: async (username: string, password: string): Promise<AuthTokens> => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    const response = await api.post('/auth/login', formData);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get('/users/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<User> => {
    const response = await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },
};

export const arenasApi = {
  list: async (): Promise<Arena[]> => {
    const response = await api.get('/arenas/');
    return response.data;
  },

  listAll: async (): Promise<Arena[]> => {
    const response = await api.get('/arenas/all');
    return response.data;
  },

  get: async (id: number): Promise<Arena> => {
    const response = await api.get(`/arenas/${id}`);
    return response.data;
  },

  create: async (data: CreateArenaData): Promise<Arena> => {
    const response = await api.post('/arenas/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Arena>): Promise<Arena> => {
    const response = await api.put(`/arenas/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/arenas/${id}`);
  },
};

export interface GuestBookingData {
  arena_id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
}

export interface BlockSlotData {
  arena_id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  booking_type: 'maintenance' | 'event';
}

export const bookingsApi = {
  list: async (arenaId?: number, startDate?: string, endDate?: string): Promise<Booking[]> => {
    const params: Record<string, string> = {};
    if (arenaId) params.arena_id = arenaId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/bookings/', { params });
    return response.data;
  },

  listPublic: async (arenaId?: number, startDate?: string, endDate?: string): Promise<Booking[]> => {
    const params: Record<string, string> = {};
    if (arenaId) params.arena_id = arenaId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/bookings/public', { params });
    return response.data;
  },

  get: async (id: number): Promise<Booking> => {
    const response = await api.get(`/bookings/${id}`);
    return response.data;
  },

  create: async (data: CreateBookingData): Promise<Booking> => {
    const response = await api.post('/bookings/', data);
    return response.data;
  },

  createGuest: async (data: GuestBookingData): Promise<Booking> => {
    const response = await api.post('/bookings/guest', data);
    return response.data;
  },

  blockSlot: async (data: BlockSlotData): Promise<Booking> => {
    const response = await api.post('/bookings/block', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Booking>): Promise<Booking> => {
    const response = await api.put(`/bookings/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/bookings/${id}`);
  },

  getUsageReport: async (): Promise<ArenaUsageReport> => {
    const response = await api.get('/bookings/reports/usage');
    return response.data;
  },
};

export const horsesApi = {
  list: async (): Promise<Horse[]> => {
    const response = await api.get('/horses/');
    return response.data;
  },

  get: async (id: number): Promise<Horse> => {
    const response = await api.get(`/horses/${id}`);
    return response.data;
  },

  create: async (data: CreateHorseData): Promise<Horse> => {
    const response = await api.post('/horses/', data);
    return response.data;
  },

  update: async (id: number, data: Partial<Horse>): Promise<Horse> => {
    const response = await api.put(`/horses/${id}`, data);
    return response.data;
  },

  delete: async (id: number): Promise<void> => {
    await api.delete(`/horses/${id}`);
  },
};

export interface AdminUserCreate {
  username: string;
  email?: string;
  name: string;
  phone?: string;
  role: string;
  livery_package_id?: number;
  livery_start_date?: string;
  livery_end_date?: string;
}

export interface AdminUserUpdate {
  username?: string;
  email?: string;
  name?: string;
  phone?: string;
  address_street?: string;
  address_town?: string;
  address_county?: string;
  address_postcode?: string;
  role?: string;
  is_active?: boolean;
  is_yard_staff?: boolean;
  livery_package_id?: number | null;
  livery_start_date?: string | null;
  livery_end_date?: string | null;
}

export interface AdminUserCreateResponse {
  user: User;
  temporary_password: string;
}

export const usersApi = {
  list: async (includeInactive: boolean = false): Promise<User[]> => {
    const response = await api.get('/users/', {
      params: { include_inactive: includeInactive },
    });
    return response.data;
  },

  create: async (data: AdminUserCreate): Promise<AdminUserCreateResponse> => {
    const response = await api.post('/users/create', data);
    return response.data;
  },

  updateRole: async (userId: number, role: string): Promise<User> => {
    const response = await api.put(`/users/${userId}/role`, null, {
      params: { role },
    });
    return response.data;
  },

  resetPassword: async (userId: number): Promise<{ temporary_password: string; message: string }> => {
    const response = await api.post(`/users/${userId}/reset-password`);
    return response.data;
  },

  toggleActive: async (userId: number): Promise<User> => {
    const response = await api.put(`/users/${userId}/toggle-active`);
    return response.data;
  },

  update: async (userId: number, data: AdminUserUpdate): Promise<User> => {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },

  updateStaffOrder: async (orders: { user_id: number; order: number }[]): Promise<{ success: boolean; updated: number }> => {
    const response = await api.put('/users/staff-order', { orders });
    return response.data;
  },
};

export const healthRecordsApi = {
  // Summary
  getSummary: async (horseId: number): Promise<HealthRecordsSummary> => {
    const response = await api.get(`/horses/${horseId}/summary`);
    return response.data;
  },

  // Vaccination Alerts
  getUpcomingVaccinations: async (daysAhead: number = 14): Promise<VaccinationAlert[]> => {
    const response = await api.get(`/horses/vaccinations/upcoming`, {
      params: { days_ahead: daysAhead }
    });
    return response.data;
  },

  // Farrier Records
  listFarrier: async (horseId: number): Promise<FarrierRecord[]> => {
    const response = await api.get(`/horses/${horseId}/farrier`);
    return response.data;
  },

  createFarrier: async (horseId: number, data: CreateFarrierRecord): Promise<FarrierRecord> => {
    const response = await api.post(`/horses/${horseId}/farrier`, data);
    return response.data;
  },

  updateFarrier: async (horseId: number, recordId: number, data: Partial<CreateFarrierRecord>): Promise<FarrierRecord> => {
    const response = await api.put(`/horses/${horseId}/farrier/${recordId}`, data);
    return response.data;
  },

  deleteFarrier: async (horseId: number, recordId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/farrier/${recordId}`);
  },

  // Dentist Records
  listDentist: async (horseId: number): Promise<DentistRecord[]> => {
    const response = await api.get(`/horses/${horseId}/dentist`);
    return response.data;
  },

  createDentist: async (horseId: number, data: CreateDentistRecord): Promise<DentistRecord> => {
    const response = await api.post(`/horses/${horseId}/dentist`, data);
    return response.data;
  },

  updateDentist: async (horseId: number, recordId: number, data: Partial<CreateDentistRecord>): Promise<DentistRecord> => {
    const response = await api.put(`/horses/${horseId}/dentist/${recordId}`, data);
    return response.data;
  },

  deleteDentist: async (horseId: number, recordId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/dentist/${recordId}`);
  },

  // Vaccination Records
  listVaccination: async (horseId: number): Promise<VaccinationRecord[]> => {
    const response = await api.get(`/horses/${horseId}/vaccination`);
    return response.data;
  },

  createVaccination: async (horseId: number, data: CreateVaccinationRecord): Promise<VaccinationRecord> => {
    const response = await api.post(`/horses/${horseId}/vaccination`, data);
    return response.data;
  },

  updateVaccination: async (horseId: number, recordId: number, data: Partial<CreateVaccinationRecord>): Promise<VaccinationRecord> => {
    const response = await api.put(`/horses/${horseId}/vaccination/${recordId}`, data);
    return response.data;
  },

  deleteVaccination: async (horseId: number, recordId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/vaccination/${recordId}`);
  },

  // Worming Records
  listWorming: async (horseId: number): Promise<WormingRecord[]> => {
    const response = await api.get(`/horses/${horseId}/worming`);
    return response.data;
  },

  createWorming: async (horseId: number, data: CreateWormingRecord): Promise<WormingRecord> => {
    const response = await api.post(`/horses/${horseId}/worming`, data);
    return response.data;
  },

  updateWorming: async (horseId: number, recordId: number, data: Partial<CreateWormingRecord>): Promise<WormingRecord> => {
    const response = await api.put(`/horses/${horseId}/worming/${recordId}`, data);
    return response.data;
  },

  deleteWorming: async (horseId: number, recordId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/worming/${recordId}`);
  },

  // Weight Records
  listWeight: async (horseId: number): Promise<WeightRecord[]> => {
    const response = await api.get(`/horses/${horseId}/weight`);
    return response.data;
  },

  createWeight: async (horseId: number, data: CreateWeightRecord): Promise<WeightRecord> => {
    const response = await api.post(`/horses/${horseId}/weight`, data);
    return response.data;
  },

  updateWeight: async (horseId: number, recordId: number, data: UpdateWeightRecord): Promise<WeightRecord> => {
    const response = await api.put(`/horses/${horseId}/weight/${recordId}`, data);
    return response.data;
  },

  deleteWeight: async (horseId: number, recordId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/weight/${recordId}`);
  },

  // Body Condition Records
  listBodyCondition: async (horseId: number): Promise<BodyConditionRecord[]> => {
    const response = await api.get(`/horses/${horseId}/body-condition`);
    return response.data;
  },

  createBodyCondition: async (horseId: number, data: CreateBodyConditionRecord): Promise<BodyConditionRecord> => {
    const response = await api.post(`/horses/${horseId}/body-condition`, data);
    return response.data;
  },

  updateBodyCondition: async (horseId: number, recordId: number, data: UpdateBodyConditionRecord): Promise<BodyConditionRecord> => {
    const response = await api.put(`/horses/${horseId}/body-condition/${recordId}`, data);
    return response.data;
  },

  deleteBodyCondition: async (horseId: number, recordId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/body-condition/${recordId}`);
  },

  // Saddles
  listSaddles: async (horseId: number, includeInactive = false): Promise<Saddle[]> => {
    const response = await api.get(`/horses/${horseId}/saddles`, {
      params: { include_inactive: includeInactive }
    });
    return response.data;
  },

  getSaddle: async (horseId: number, saddleId: number): Promise<Saddle> => {
    const response = await api.get(`/horses/${horseId}/saddles/${saddleId}`);
    return response.data;
  },

  createSaddle: async (horseId: number, data: CreateSaddle): Promise<Saddle> => {
    const response = await api.post(`/horses/${horseId}/saddles`, data);
    return response.data;
  },

  updateSaddle: async (horseId: number, saddleId: number, data: UpdateSaddle): Promise<Saddle> => {
    const response = await api.put(`/horses/${horseId}/saddles/${saddleId}`, data);
    return response.data;
  },

  deleteSaddle: async (horseId: number, saddleId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/saddles/${saddleId}`);
  },

  // Saddle Fit Records
  listSaddleFit: async (horseId: number): Promise<SaddleFitRecord[]> => {
    const response = await api.get(`/horses/${horseId}/saddle-fit`);
    return response.data;
  },

  createSaddleFit: async (horseId: number, data: CreateSaddleFitRecord): Promise<SaddleFitRecord> => {
    const response = await api.post(`/horses/${horseId}/saddle-fit`, data);
    return response.data;
  },

  updateSaddleFit: async (horseId: number, recordId: number, data: UpdateSaddleFitRecord): Promise<SaddleFitRecord> => {
    const response = await api.put(`/horses/${horseId}/saddle-fit/${recordId}`, data);
    return response.data;
  },

  deleteSaddleFit: async (horseId: number, recordId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/saddle-fit/${recordId}`);
  },

  // Physio Records
  listPhysio: async (horseId: number): Promise<PhysioRecord[]> => {
    const response = await api.get(`/horses/${horseId}/physio`);
    return response.data;
  },

  createPhysio: async (horseId: number, data: CreatePhysioRecord): Promise<PhysioRecord> => {
    const response = await api.post(`/horses/${horseId}/physio`, data);
    return response.data;
  },

  updatePhysio: async (horseId: number, recordId: number, data: UpdatePhysioRecord): Promise<PhysioRecord> => {
    const response = await api.put(`/horses/${horseId}/physio/${recordId}`, data);
    return response.data;
  },

  deletePhysio: async (horseId: number, recordId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/physio/${recordId}`);
  },

  // Admin Worming Management
  getWormingHorses: async (): Promise<HorseWormCountStatus[]> => {
    const response = await api.get('/horses/worming/horses');
    return response.data;
  },

  bulkCreateWormCounts: async (data: BulkWormCountCreate): Promise<BulkWormCountResult> => {
    const response = await api.post('/horses/worming/bulk', data);
    return response.data;
  },

  getWormingReport: async (years?: number): Promise<WormingReportResponse> => {
    const response = await api.get('/horses/worming/report', { params: { years } });
    return response.data;
  },

  // Emergency Contacts
  listEmergencyContacts: async (horseId: number): Promise<EmergencyContact[]> => {
    const response = await api.get(`/horses/${horseId}/emergency-contacts`);
    return response.data;
  },

  getEmergencyContactsSummary: async (horseId: number): Promise<EmergencyContactSummary> => {
    const response = await api.get(`/horses/${horseId}/emergency-contacts/summary`);
    return response.data;
  },

  createEmergencyContact: async (horseId: number, data: EmergencyContactCreate): Promise<EmergencyContact> => {
    const response = await api.post(`/horses/${horseId}/emergency-contacts`, data);
    return response.data;
  },

  updateEmergencyContact: async (horseId: number, contactId: number, data: EmergencyContactUpdate): Promise<EmergencyContact> => {
    const response = await api.put(`/horses/${horseId}/emergency-contacts/${contactId}`, data);
    return response.data;
  },

  deleteEmergencyContact: async (horseId: number, contactId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/emergency-contacts/${contactId}`);
  },

  setEmergencyContactPrimary: async (horseId: number, contactId: number): Promise<EmergencyContact> => {
    const response = await api.put(`/horses/${horseId}/emergency-contacts/${contactId}/set-primary`);
    return response.data;
  },
};

export const feedApi = {
  // Summary
  getSummary: async (horseId: number): Promise<FeedSummary> => {
    const response = await api.get(`/horses/${horseId}/feed/summary`);
    return response.data;
  },

  // Feed Requirements
  getRequirement: async (horseId: number): Promise<FeedRequirement> => {
    const response = await api.get(`/horses/${horseId}/feed`);
    return response.data;
  },

  updateRequirement: async (horseId: number, data: UpdateFeedRequirement): Promise<FeedRequirement> => {
    const response = await api.put(`/horses/${horseId}/feed`, data);
    return response.data;
  },

  // Feed Additions
  listAdditions: async (horseId: number, activeOnly: boolean = false): Promise<FeedAddition[]> => {
    const response = await api.get(`/horses/${horseId}/feed/additions`, {
      params: { active_only: activeOnly }
    });
    return response.data;
  },

  createAddition: async (horseId: number, data: CreateFeedAddition): Promise<FeedAddition> => {
    const response = await api.post(`/horses/${horseId}/feed/additions`, data);
    return response.data;
  },

  updateAddition: async (horseId: number, additionId: number, data: Partial<CreateFeedAddition> & { status?: AdditionStatus; is_active?: boolean }): Promise<FeedAddition> => {
    const response = await api.put(`/horses/${horseId}/feed/additions/${additionId}`, data);
    return response.data;
  },

  deleteAddition: async (horseId: number, additionId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/feed/additions/${additionId}`);
  },

  // Feed Supply Alerts
  listAlerts: async (horseId: number, unresolvedOnly: boolean = true): Promise<FeedSupplyAlert[]> => {
    const response = await api.get(`/horses/${horseId}/feed/alerts`, {
      params: { unresolved_only: unresolvedOnly }
    });
    return response.data;
  },

  createAlert: async (horseId: number, data: CreateFeedAlert): Promise<FeedSupplyAlert> => {
    const response = await api.post(`/horses/${horseId}/feed/alerts`, data);
    return response.data;
  },

  resolveAlert: async (horseId: number, alertId: number): Promise<FeedSupplyAlert> => {
    const response = await api.put(`/horses/${horseId}/feed/alerts/${alertId}`, { is_resolved: true });
    return response.data;
  },

  deleteAlert: async (horseId: number, alertId: number): Promise<void> => {
    await api.delete(`/horses/${horseId}/feed/alerts/${alertId}`);
  },

  // All alerts (for staff)
  listAllAlerts: async (unresolvedOnly: boolean = true): Promise<FeedSupplyAlert[]> => {
    const response = await api.get('/horses/alerts/all', {
      params: { unresolved_only: unresolvedOnly }
    });
    return response.data;
  },

  // Alerts for current user's horses (for livery owners)
  getMyHorseAlerts: async (unresolvedOnly: boolean = true): Promise<FeedSupplyAlert[]> => {
    const response = await api.get('/horses/alerts/my-horses', {
      params: { unresolved_only: unresolvedOnly }
    });
    return response.data;
  },

  // All feed schedules (for admin)
  getAllSchedules: async (): Promise<FeedSummary[]> => {
    const response = await api.get('/horses/schedule/all');
    return response.data;
  },
};

export const feedNotificationsApi = {
  // Get pending (unacknowledged) notifications for current user
  getPending: async (): Promise<FeedChangeNotification[]> => {
    const response = await api.get('/feed-notifications/pending');
    return response.data;
  },

  // Acknowledge a notification
  acknowledge: async (notificationId: number): Promise<{ message: string; acknowledged_at: string }> => {
    const response = await api.post(`/feed-notifications/${notificationId}/acknowledge`);
    return response.data;
  },

  // Get notification history (admin only)
  getHistory: async (params?: {
    horse_id?: number;
    start_date?: string;
    end_date?: string;
    change_type?: FeedChangeType;
    limit?: number;
    offset?: number;
  }): Promise<FeedNotificationHistory[]> => {
    const response = await api.get('/feed-notifications/history', { params });
    return response.data;
  },
};

export const servicesApi = {
  // Service catalog
  list: async (category?: ServiceCategory, activeOnly: boolean = true): Promise<Service[]> => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    params.active_only = activeOnly.toString();
    const response = await api.get('/services/', { params });
    return response.data;
  },

  listAll: async (): Promise<Service[]> => {
    const response = await api.get('/services/', { params: { active_only: 'false' } });
    return response.data;
  },

  get: async (serviceId: string): Promise<Service> => {
    const response = await api.get(`/services/${serviceId}`);
    return response.data;
  },

  // Admin service management
  create: async (data: CreateService): Promise<Service> => {
    const response = await api.post('/services/', data);
    return response.data;
  },

  update: async (serviceId: string, data: UpdateService): Promise<Service> => {
    const response = await api.put(`/services/${serviceId}`, data);
    return response.data;
  },

  delete: async (serviceId: string): Promise<void> => {
    await api.delete(`/services/${serviceId}`);
  },

  // Service requests - user
  getMyRequests: async (): Promise<MyServiceRequestsSummary> => {
    const response = await api.get('/services/requests/my');
    return response.data;
  },

  // Service requests - assigned to current user (staff)
  getAssignedRequests: async (): Promise<ServiceRequest[]> => {
    const response = await api.get('/services/requests/assigned');
    return response.data;
  },

  createRequest: async (data: CreateServiceRequest): Promise<ServiceRequest> => {
    const response = await api.post('/services/requests', data);
    return response.data;
  },

  getRequest: async (requestId: number): Promise<ServiceRequest> => {
    const response = await api.get(`/services/requests/${requestId}`);
    return response.data;
  },

  cancelRequest: async (requestId: number): Promise<ServiceRequest> => {
    const response = await api.put(`/services/requests/${requestId}/cancel`);
    return response.data;
  },

  deleteRequest: async (requestId: number): Promise<void> => {
    await api.delete(`/services/requests/${requestId}`);
  },

  // Service requests - staff
  getStaffRequests: async (): Promise<StaffServiceRequestsSummary> => {
    const response = await api.get('/services/requests/staff');
    return response.data;
  },

  // Quote workflow
  quoteRequest: async (requestId: number, data: { quote_amount: number; quote_notes?: string }): Promise<ServiceRequest> => {
    const response = await api.put(`/services/requests/${requestId}/quote`, data);
    return response.data;
  },

  acceptQuote: async (requestId: number): Promise<ServiceRequest> => {
    const response = await api.put(`/services/requests/${requestId}/accept-quote`);
    return response.data;
  },

  rejectQuote: async (requestId: number): Promise<ServiceRequest> => {
    const response = await api.put(`/services/requests/${requestId}/reject-quote`);
    return response.data;
  },

  approveRequest: async (requestId: number): Promise<ServiceRequest> => {
    const response = await api.put(`/services/requests/${requestId}/approve`);
    return response.data;
  },

  scheduleRequest: async (requestId: number, data: { assigned_to_id: number; scheduled_datetime: string; notes?: string }): Promise<ServiceRequest> => {
    const response = await api.put(`/services/requests/${requestId}/schedule`, data);
    return response.data;
  },

  completeRequest: async (requestId: number, data: { notes?: string; charge_amount?: number; charge_status?: string }): Promise<ServiceRequest> => {
    const response = await api.put(`/services/requests/${requestId}/complete`, data);
    return response.data;
  },

  // Rehab assistance requests
  createRehabAssistanceRequest: async (data: RehabAssistanceRequest): Promise<ServiceRequest[]> => {
    const response = await api.post('/services/requests/rehab', data);
    return response.data;
  },

  cancelRecurringSeries: async (seriesId: number): Promise<void> => {
    await api.delete(`/services/requests/series/${seriesId}`);
  },

  // Insurance claim methods
  toggleInsuranceClaimable: async (requestId: number, insuranceClaimable: boolean): Promise<ServiceRequest> => {
    const response = await api.put(`/services/requests/${requestId}/insurance`, { insurance_claimable: insuranceClaimable });
    return response.data;
  },

  getMyInsuranceClaims: async (horseId?: number, startDate?: string, endDate?: string): Promise<ServiceRequest[]> => {
    const params: Record<string, string> = {};
    if (horseId) params.horse_id = horseId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/services/requests/insurance/my-claims', { params });
    return response.data;
  },

  getInsuranceStatement: async (horseId?: number, startDate?: string, endDate?: string): Promise<InsuranceStatement> => {
    const params: Record<string, string> = {};
    if (horseId) params.horse_id = horseId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/services/requests/insurance/statement', { params });
    return response.data;
  },

  downloadInsuranceStatementPdf: async (horseId?: number, startDate?: string, endDate?: string): Promise<void> => {
    const params: Record<string, string> = {};
    if (horseId) params.horse_id = horseId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    try {
      const response = await api.get('/services/requests/insurance/statement/pdf', {
        params,
        responseType: 'blob',
      });
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const month = startDate ? startDate.substring(0, 7) : new Date().toISOString().substring(0, 7);
      link.setAttribute('download', `insurance-statement-${month}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      // Handle error responses - extract error message from response
      const axiosError = error as { response?: { data?: Blob | { detail?: string }; status?: number }; message?: string };

      // Check if response data is a Blob (PDF error wrapped in blob)
      if (axiosError.response?.data instanceof Blob) {
        try {
          const text = await axiosError.response.data.text();
          const json = JSON.parse(text);
          throw new Error(json.detail || 'Failed to download insurance statement');
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message && !parseError.message.includes('JSON')) {
            throw parseError;
          }
          throw new Error('Failed to download insurance statement');
        }
      }

      // Check if response data is already parsed JSON (server returned application/json)
      if (axiosError.response?.data && typeof axiosError.response.data === 'object' && 'detail' in axiosError.response.data) {
        throw new Error(axiosError.response.data.detail || 'Failed to download insurance statement');
      }

      // For network errors or other issues
      throw new Error(axiosError.message || 'Failed to download insurance statement. Please check your connection.');
    }
  },
};

export const noticesApi = {
  list: async (category?: NoticeCategory): Promise<NoticeListResponse> => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    const response = await api.get('/notices/', { params });
    return response.data;
  },

  get: async (noticeId: number): Promise<Notice> => {
    const response = await api.get(`/notices/${noticeId}`);
    return response.data;
  },

  create: async (data: CreateNotice): Promise<Notice> => {
    const response = await api.post('/notices/', data);
    return response.data;
  },

  update: async (noticeId: number, data: Partial<CreateNotice> & { is_active?: boolean }): Promise<Notice> => {
    const response = await api.put(`/notices/${noticeId}`, data);
    return response.data;
  },

  delete: async (noticeId: number): Promise<void> => {
    await api.delete(`/notices/${noticeId}`);
  },
};

export const professionalsApi = {
  // List all professionals (with optional filters)
  list: async (category?: ProfessionalCategory, recommendedOnly: boolean = false): Promise<ProfessionalDirectoryResponse> => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (recommendedOnly) params.recommended_only = 'true';
    const response = await api.get('/professionals/', { params });
    return response.data;
  },

  // Get categories with counts
  getCategories: async (): Promise<ProfessionalCategoryInfo[]> => {
    const response = await api.get('/professionals/categories');
    return response.data;
  },

  // Get single professional
  get: async (id: number): Promise<Professional> => {
    const response = await api.get(`/professionals/${id}`);
    return response.data;
  },

  // Staff: Create professional
  create: async (data: CreateProfessional): Promise<Professional> => {
    const response = await api.post('/professionals/', data);
    return response.data;
  },

  // Staff: Update professional
  update: async (id: number, data: Partial<CreateProfessional>): Promise<Professional> => {
    const response = await api.put(`/professionals/${id}`, data);
    return response.data;
  },

  // Staff: Delete (deactivate) professional
  delete: async (id: number): Promise<void> => {
    await api.delete(`/professionals/${id}`);
  },

  // Staff: List all including inactive
  listAll: async (includeInactive: boolean = false): Promise<Professional[]> => {
    const response = await api.get('/professionals/admin/all', {
      params: { include_inactive: includeInactive }
    });
    return response.data;
  },
};

export const tasksApi = {
  // Get enum options for forms
  getEnums: async (): Promise<TaskEnums> => {
    const response = await api.get('/tasks/enums');
    return response.data;
  },

  // Get summary counts
  getSummary: async (): Promise<TasksSummary> => {
    const response = await api.get('/tasks/summary');
    return response.data;
  },

  // List all tasks
  list: async (category?: TaskCategory, priority?: TaskPriority, status?: TaskStatus, assignedToId?: number): Promise<TasksListResponse> => {
    const params: Record<string, string> = {};
    if (category) params.category = category;
    if (priority) params.priority = priority;
    if (status) params.status_filter = status;
    if (assignedToId !== undefined) params.assigned_to_id = assignedToId.toString();
    const response = await api.get('/tasks/', { params });
    return response.data;
  },

  // Get single task with details
  get: async (taskId: number): Promise<YardTaskDetail> => {
    const response = await api.get(`/tasks/${taskId}`);
    return response.data;
  },

  // Create a new task
  create: async (data: CreateYardTask): Promise<YardTask> => {
    const response = await api.post('/tasks/', data);
    return response.data;
  },

  // Update a task
  update: async (taskId: number, data: UpdateYardTask): Promise<YardTask> => {
    const response = await api.put(`/tasks/${taskId}`, data);
    return response.data;
  },

  // Assign a task to a specific person or staff pool
  assign: async (taskId: number, userId?: number, toPool?: boolean): Promise<YardTask> => {
    const params: Record<string, string> = {};
    if (userId) params.user_id = userId.toString();
    if (toPool) params.to_pool = 'true';
    const response = await api.put(`/tasks/${taskId}/assign`, null, { params });
    return response.data;
  },

  // Complete a task
  complete: async (taskId: number, notes?: string): Promise<YardTask> => {
    const params: Record<string, string> = {};
    if (notes) params.notes = notes;
    const response = await api.put(`/tasks/${taskId}/complete`, null, { params });
    return response.data;
  },

  // Cancel a task
  cancel: async (taskId: number): Promise<void> => {
    await api.delete(`/tasks/${taskId}`);
  },

  // Reopen a completed task
  reopen: async (taskId: number): Promise<YardTask> => {
    const response = await api.put(`/tasks/${taskId}/reopen`);
    return response.data;
  },

  // Add a comment
  addComment: async (taskId: number, content: string): Promise<TaskComment> => {
    const response = await api.post(`/tasks/${taskId}/comments`, { content });
    return response.data;
  },

  // Delete a comment
  deleteComment: async (taskId: number, commentId: number): Promise<void> => {
    await api.delete(`/tasks/${taskId}/comments/${commentId}`);
  },

  // Bulk assign tasks for maintenance day
  assignMaintenanceDay: async (data: MaintenanceDayAssign): Promise<YardTask[]> => {
    const response = await api.post('/tasks/bulk/maintenance-day', data);
    return response.data;
  },

  // Generate health tasks for a date (admin only)
  generateHealthTasks: async (date: string): Promise<HealthTaskGenerationResult> => {
    const response = await api.post(`/tasks/generate-health-tasks/${date}`);
    return response.data;
  },

  // Complete a health task with health-specific data
  completeHealthTask: async (taskId: number, completion: HealthTaskCompletion): Promise<YardTask> => {
    const response = await api.put(`/tasks/${taskId}/complete-health`, completion);
    return response.data;
  },

  // Get health tasks for a specific date
  getHealthTasksForDate: async (date: string): Promise<YardTask[]> => {
    const response = await api.get(`/tasks/health-tasks/${date}`);
    return response.data;
  },

  // Unschedule a task (return to backlog)
  unschedule: async (taskId: number): Promise<YardTask> => {
    const response = await api.put(`/tasks/${taskId}/unschedule`);
    return response.data;
  },

  // Reassign a task (pool to specific or vice versa)
  reassign: async (taskId: number, assignedToId?: number, assignmentType?: string): Promise<YardTask> => {
    const params: Record<string, string> = {};
    if (assignedToId !== undefined) params.assigned_to_id = assignedToId.toString();
    if (assignmentType) params.assignment_type = assignmentType;
    const response = await api.put(`/tasks/${taskId}/reassign`, null, { params });
    return response.data;
  },
};

export const staffApi = {
  // Get enum options for forms
  getEnums: async (): Promise<StaffManagementEnums> => {
    const response = await api.get('/staff/enums');
    return response.data;
  },

  // Manager dashboard
  getDashboard: async (): Promise<ManagerDashboard> => {
    const response = await api.get('/staff/dashboard');
    return response.data;
  },

  // Leave summary for staff/admin
  getLeaveSummary: async (year?: number): Promise<AllStaffLeaveSummary> => {
    const params: Record<string, string> = {};
    if (year) params.year = year.toString();
    const response = await api.get('/staff/leave-summary', { params });
    return response.data;
  },

  // ============== Shifts ==============
  listShifts: async (staffId?: number, startDate?: string, endDate?: string): Promise<ShiftsListResponse> => {
    const params: Record<string, string> = {};
    if (staffId) params.staff_id = staffId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/staff/shifts', { params });
    return response.data;
  },

  createShift: async (data: CreateShift): Promise<Shift> => {
    const response = await api.post('/staff/shifts', data);
    return response.data;
  },

  updateShift: async (shiftId: number, data: UpdateShift): Promise<Shift> => {
    const response = await api.put(`/staff/shifts/${shiftId}`, data);
    return response.data;
  },

  deleteShift: async (shiftId: number): Promise<void> => {
    await api.delete(`/staff/shifts/${shiftId}`);
  },

  // ============== Timesheets ==============
  listTimesheets: async (
    staffId?: number,
    status?: TimesheetStatus,
    startDate?: string,
    endDate?: string
  ): Promise<TimesheetsListResponse> => {
    const params: Record<string, string> = {};
    if (staffId) params.staff_id = staffId.toString();
    if (status) params.status_filter = status;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/staff/timesheets', { params });
    return response.data;
  },

  createTimesheet: async (data: CreateTimesheet): Promise<Timesheet> => {
    const response = await api.post('/staff/timesheets', data);
    return response.data;
  },

  adminCreateTimesheet: async (data: AdminCreateTimesheet): Promise<Timesheet> => {
    const response = await api.post('/staff/timesheets/admin', data);
    return response.data;
  },

  updateTimesheet: async (timesheetId: number, data: UpdateTimesheet): Promise<Timesheet> => {
    const response = await api.put(`/staff/timesheets/${timesheetId}`, data);
    return response.data;
  },

  submitTimesheet: async (timesheetId: number): Promise<Timesheet> => {
    const response = await api.put(`/staff/timesheets/${timesheetId}/submit`);
    return response.data;
  },

  approveTimesheet: async (timesheetId: number): Promise<Timesheet> => {
    const response = await api.put(`/staff/timesheets/${timesheetId}/approve`);
    return response.data;
  },

  rejectTimesheet: async (timesheetId: number, reason?: string): Promise<Timesheet> => {
    const params: Record<string, string> = {};
    if (reason) params.reason = reason;
    const response = await api.put(`/staff/timesheets/${timesheetId}/reject`, null, { params });
    return response.data;
  },

  // ============== Holiday Requests ==============
  listHolidays: async (staffId?: number): Promise<HolidayRequestsListResponse> => {
    const params: Record<string, string> = {};
    if (staffId) params.staff_id = staffId.toString();
    const response = await api.get('/staff/holidays', { params });
    return response.data;
  },

  createHoliday: async (data: CreateHolidayRequest): Promise<HolidayRequest> => {
    const response = await api.post('/staff/holidays', data);
    return response.data;
  },

  updateHoliday: async (requestId: number, data: UpdateHolidayRequest): Promise<HolidayRequest> => {
    const response = await api.put(`/staff/holidays/${requestId}`, data);
    return response.data;
  },

  approveHoliday: async (requestId: number, notes?: string): Promise<HolidayRequest> => {
    const params: Record<string, string> = {};
    if (notes) params.notes = notes;
    const response = await api.put(`/staff/holidays/${requestId}/approve`, null, { params });
    return response.data;
  },

  rejectHoliday: async (requestId: number, notes?: string): Promise<HolidayRequest> => {
    const params: Record<string, string> = {};
    if (notes) params.notes = notes;
    const response = await api.put(`/staff/holidays/${requestId}/reject`, null, { params });
    return response.data;
  },

  cancelHoliday: async (requestId: number): Promise<void> => {
    await api.delete(`/staff/holidays/${requestId}`);
  },

  // ============== Sick Leave ==============
  listSickLeave: async (
    staffId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<SickLeaveListResponse> => {
    const params: Record<string, string> = {};
    if (staffId) params.staff_id = staffId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/staff/absences', { params });
    return response.data;
  },

  recordSickLeave: async (data: CreateSickLeave): Promise<SickLeaveRecord> => {
    const response = await api.post('/staff/absences', data);
    return response.data;
  },

  updateSickLeave: async (recordId: number, data: UpdateSickLeave): Promise<SickLeaveRecord> => {
    const response = await api.put(`/staff/absences/${recordId}`, data);
    return response.data;
  },

  // ============== Day Status (Unavailable/Absent) ==============
  listDayStatuses: async (
    staffId?: number,
    startDate?: string,
    endDate?: string
  ): Promise<DayStatusListResponse> => {
    const params: Record<string, string> = {};
    if (staffId) params.staff_id = staffId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get('/staff/day-statuses', { params });
    return response.data;
  },

  createDayStatus: async (data: CreateDayStatus): Promise<DayStatus> => {
    const response = await api.post('/staff/day-statuses', data);
    return response.data;
  },

  deleteDayStatus: async (statusId: number): Promise<void> => {
    await api.delete(`/staff/day-statuses/${statusId}`);
  },

  deleteDayStatusByStaffDate: async (staffId: number, date: string): Promise<void> => {
    await api.delete('/staff/day-statuses/by-staff-date', {
      params: { staff_id: staffId, date }
    });
  },

  // ============== Payroll ==============
  getPayrollSummary: async (
    periodType: 'week' | 'month' = 'month',
    year?: number,
    month?: number,
    week?: number
  ): Promise<PayrollSummaryResponse> => {
    const params: Record<string, string> = { period_type: periodType };
    if (year) params.year = year.toString();
    if (month) params.month = month.toString();
    if (week) params.week = week.toString();
    const response = await api.get('/staff/payroll-summary', { params });
    return response.data;
  },

  createPayrollAdjustment: async (data: PayrollAdjustmentCreate): Promise<PayrollAdjustment> => {
    const response = await api.post('/staff/payroll-adjustments', data);
    return response.data;
  },

  listPayrollAdjustments: async (
    staffId?: number,
    startDate?: string,
    endDate?: string,
    adjustmentType?: string
  ): Promise<PayrollAdjustmentListResponse> => {
    const params: Record<string, string> = {};
    if (staffId) params.staff_id = staffId.toString();
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (adjustmentType) params.adjustment_type = adjustmentType;
    const response = await api.get('/staff/payroll-adjustments', { params });
    return response.data;
  },

  deletePayrollAdjustment: async (adjustmentId: number): Promise<void> => {
    await api.delete(`/staff/payroll-adjustments/${adjustmentId}`);
  },

  // ============== Staff Thanks ==============
  getStaffForThanks: async (): Promise<Array<{ id: number; name: string }>> => {
    const response = await api.get('/staff/thanks/staff-list');
    return response.data;
  },

  sendThanks: async (data: StaffThanksCreate): Promise<StaffThanks> => {
    const response = await api.post('/staff/thanks', data);
    return response.data;
  },

  getMyReceivedThanks: async (): Promise<StaffThanksListResponse> => {
    const response = await api.get('/staff/thanks/my-received');
    return response.data;
  },

  getMySentThanks: async (): Promise<StaffThanksListResponse> => {
    const response = await api.get('/staff/thanks/my-sent');
    return response.data;
  },

  getUnreadThanksCount: async (): Promise<StaffThanksUnreadCount> => {
    const response = await api.get('/staff/thanks/unread-count');
    return response.data;
  },

  markThanksAsRead: async (thanksId: number): Promise<StaffThanks> => {
    const response = await api.post(`/staff/thanks/${thanksId}/mark-read`);
    return response.data;
  },

  markAllThanksAsRead: async (): Promise<void> => {
    await api.post('/staff/thanks/mark-all-read');
  },

  createTipCheckout: async (thanksId: number): Promise<{ checkout_url: string; session_id: string }> => {
    const response = await api.post(`/staff/thanks/${thanksId}/pay-tip`);
    return response.data;
  },

  verifyTipPayment: async (thanksId: number): Promise<{ status: string; thanks_id: number }> => {
    const response = await api.post(`/staff/thanks/${thanksId}/verify-tip`);
    return response.data;
  },
};

export const clinicsApi = {
  // Get enum options for forms
  getEnums: async (): Promise<ClinicEnums> => {
    const response = await api.get('/clinics/enums');
    return response.data;
  },

  // ============== Public routes ==============
  // List public clinics (approved, upcoming)
  listPublic: async (discipline?: Discipline): Promise<PublicClinicsResponse> => {
    const params: Record<string, string> = {};
    if (discipline) params.discipline = discipline;
    const response = await api.get('/clinics/public', { params });
    return response.data;
  },

  // Get public clinic details (no auth required)
  getPublic: async (clinicId: number): Promise<ClinicRequestDetail> => {
    const response = await api.get(`/clinics/public/${clinicId}`);
    return response.data;
  },

  // Submit clinic request (public, no auth required)
  submit: async (data: CreateClinicRequest): Promise<ClinicRequest> => {
    const response = await api.post('/clinics/request', data);
    return response.data;
  },

  // Get social share links
  getShareLinks: async (clinicId: number): Promise<SocialShareLinks> => {
    const response = await api.get(`/clinics/request/${clinicId}/share`);
    return response.data;
  },

  // ============== User routes (authenticated) ==============
  // Register for a clinic
  register: async (clinicId: number, data: CreateClinicParticipant): Promise<ClinicParticipant> => {
    const response = await api.post(`/clinics/${clinicId}/register`, data);
    return response.data;
  },

  // Cancel registration
  cancelRegistration: async (clinicId: number, participantId: number): Promise<void> => {
    await api.delete(`/clinics/${clinicId}/participants/${participantId}`);
  },

  // ============== Manager routes ==============
  // List all clinic requests (manager view) - uses same endpoint, admin gets pending list
  listAll: async (discipline?: Discipline): Promise<ClinicsListResponse> => {
    const params: Record<string, string> = {};
    if (discipline) params.discipline = discipline;
    const response = await api.get('/clinics/', { params });
    return response.data;
  },

  // Get clinic details with participants (manager)
  getDetails: async (clinicId: number): Promise<ClinicRequestDetail> => {
    const response = await api.get(`/clinics/${clinicId}`);
    return response.data;
  },

  // Update clinic request
  update: async (clinicId: number, data: UpdateClinicRequest): Promise<ClinicRequest> => {
    const response = await api.put(`/clinics/${clinicId}`, data);
    return response.data;
  },

  // Check for booking conflicts
  checkConflicts: async (clinicId: number): Promise<ConflictInfo> => {
    const response = await api.get(`/clinics/${clinicId}/conflicts`);
    return response.data;
  },

  // Approve clinic request with venue fees
  approve: async (
    clinicId: number,
    notes?: string,
    venueFees?: {
      venue_fee_private?: number;
      venue_fee_group?: number;
      livery_venue_fee_private?: number;
      livery_venue_fee_group?: number;
    }
  ): Promise<ClinicRequest> => {
    const params: Record<string, string | number> = {};
    if (notes) params.notes = notes;
    if (venueFees?.venue_fee_private !== undefined) params.venue_fee_private = venueFees.venue_fee_private;
    if (venueFees?.venue_fee_group !== undefined) params.venue_fee_group = venueFees.venue_fee_group;
    if (venueFees?.livery_venue_fee_private !== undefined) params.livery_venue_fee_private = venueFees.livery_venue_fee_private;
    if (venueFees?.livery_venue_fee_group !== undefined) params.livery_venue_fee_group = venueFees.livery_venue_fee_group;
    const response = await api.put(`/clinics/${clinicId}/approve`, null, { params });
    return response.data;
  },

  // Reject clinic request
  reject: async (clinicId: number, reason: string): Promise<ClinicRequest> => {
    const response = await api.put(`/clinics/${clinicId}/reject`, null, {
      params: { reason }
    });
    return response.data;
  },

  // Request changes to clinic request
  requestChanges: async (clinicId: number, notes: string): Promise<ClinicRequest> => {
    const response = await api.put(`/clinics/${clinicId}/request-changes`, null, {
      params: { notes }
    });
    return response.data;
  },

  // Cancel approved clinic
  cancel: async (clinicId: number, reason?: string): Promise<void> => {
    const params: Record<string, string> = {};
    if (reason) params.reason = reason;
    await api.delete(`/clinics/${clinicId}`, { params });
  },

  // Mark clinic as completed - handled by updating status
  complete: async (clinicId: number): Promise<ClinicRequest> => {
    const response = await api.put(`/clinics/${clinicId}`, { status: 'completed' });
    return response.data;
  },

  // Update participant confirmation
  updateParticipant: async (
    clinicId: number,
    participantId: number,
    _data: Partial<CreateClinicParticipant> & { is_confirmed?: boolean }
  ): Promise<ClinicParticipant> => {
    const response = await api.put(`/clinics/${clinicId}/participants/${participantId}/confirm`);
    return response.data;
  },

  // ============== User routes ==============
  // Get my clinic registrations with slot details
  getMyRegistrations: async (): Promise<MyClinicRegistration[]> => {
    const response = await api.get('/clinics/my-registrations');
    return response.data;
  },

  // ============== Coach routes ==============
  // Propose a clinic (coach role only)
  propose: async (data: CreateClinicRequest): Promise<ClinicRequest> => {
    const response = await api.post('/clinics/propose', data);
    return response.data;
  },

  // List my proposals (coach role only)
  listMyProposals: async (): Promise<ClinicRequest[]> => {
    const response = await api.get('/clinics/my-proposals');
    return response.data;
  },

  // ============== Slot Management (Admin) ==============
  // List slots for a clinic
  listSlots: async (clinicId: number): Promise<ClinicSlotWithParticipants[]> => {
    const response = await api.get(`/clinics/${clinicId}/slots`);
    return response.data;
  },

  // Create a slot
  createSlot: async (clinicId: number, data: CreateClinicSlot): Promise<ClinicSlot> => {
    const response = await api.post(`/clinics/${clinicId}/slots`, data);
    return response.data;
  },

  // Update a slot
  updateSlot: async (clinicId: number, slotId: number, data: UpdateClinicSlot): Promise<ClinicSlot> => {
    const response = await api.put(`/clinics/${clinicId}/slots/${slotId}`, data);
    return response.data;
  },

  // Delete a slot
  deleteSlot: async (clinicId: number, slotId: number): Promise<void> => {
    await api.delete(`/clinics/${clinicId}/slots/${slotId}`);
  },

  // Assign participant to slot
  assignSlot: async (clinicId: number, participantId: number, slotId: number | null): Promise<ClinicParticipant> => {
    const response = await api.put(`/clinics/${clinicId}/participants/${participantId}/assign-slot`, null, {
      params: { slot_id: slotId }
    });
    return response.data;
  },
};

export const paymentsApi = {
  // Get Stripe configuration
  getConfig: async (): Promise<StripeConfig> => {
    const response = await api.get('/payments/config');
    return response.data;
  },

  // Create checkout session
  createCheckout: async (bookingId: number): Promise<CheckoutResponse> => {
    const response = await api.post('/payments/create-checkout', { booking_id: bookingId });
    return response.data;
  },

  // Get payment status
  getStatus: async (bookingId: number): Promise<PaymentStatusResponse> => {
    const response = await api.get(`/payments/status/${bookingId}`);
    return response.data;
  },

  // Verify payment (manual check with Stripe)
  verify: async (bookingId: number): Promise<PaymentStatusResponse> => {
    const response = await api.post(`/payments/verify/${bookingId}`);
    return response.data;
  },

  // Cancel unpaid booking
  cancelBooking: async (bookingId: number): Promise<void> => {
    await api.delete(`/payments/cancel/${bookingId}`);
  },
};

export const weatherApi = {
  // Get current weather for venue location
  getCurrent: async (): Promise<WeatherResponse> => {
    const response = await api.get('/weather/');
    return response.data;
  },
};

export const liveryPackagesApi = {
  // List packages (public, active only by default)
  list: async (activeOnly: boolean = true): Promise<LiveryPackage[]> => {
    const response = await api.get('/livery-packages/', {
      params: { active_only: activeOnly }
    });
    return response.data;
  },

  // List all packages (including inactive, for admin)
  listAll: async (): Promise<LiveryPackage[]> => {
    const response = await api.get('/livery-packages/', {
      params: { active_only: false }
    });
    return response.data;
  },

  // Get single package
  get: async (id: number): Promise<LiveryPackage> => {
    const response = await api.get(`/livery-packages/${id}`);
    return response.data;
  },

  // Create package (admin only)
  create: async (data: CreateLiveryPackage): Promise<LiveryPackage> => {
    const response = await api.post('/livery-packages/', data);
    return response.data;
  },

  // Update package (admin only)
  update: async (id: number, data: UpdateLiveryPackage): Promise<LiveryPackage> => {
    const response = await api.put(`/livery-packages/${id}`, data);
    return response.data;
  },

  // Delete package (admin only)
  delete: async (id: number): Promise<void> => {
    await api.delete(`/livery-packages/${id}`);
  },
};

export const complianceApi = {
  // Get dashboard summary
  getDashboard: async (): Promise<ComplianceDashboard> => {
    const response = await api.get('/compliance/dashboard');
    return response.data;
  },

  // List all compliance items
  list: async (activeOnly: boolean = true, category?: string): Promise<ComplianceItem[]> => {
    const params: Record<string, unknown> = { active_only: activeOnly };
    if (category) params.category = category;
    const response = await api.get('/compliance/items', { params });
    return response.data;
  },

  // Get single item
  get: async (id: number): Promise<ComplianceItem> => {
    const response = await api.get(`/compliance/items/${id}`);
    return response.data;
  },

  // Create item
  create: async (data: CreateComplianceItem): Promise<ComplianceItem> => {
    const response = await api.post('/compliance/items', data);
    return response.data;
  },

  // Update item
  update: async (id: number, data: UpdateComplianceItem): Promise<ComplianceItem> => {
    const response = await api.put(`/compliance/items/${id}`, data);
    return response.data;
  },

  // Delete item
  delete: async (id: number): Promise<void> => {
    await api.delete(`/compliance/items/${id}`);
  },

  // Mark as complete
  complete: async (id: number, data: CompleteComplianceItem): Promise<ComplianceItem> => {
    const response = await api.post(`/compliance/items/${id}/complete`, data);
    return response.data;
  },

  // Get history
  getHistory: async (id: number): Promise<ComplianceHistory[]> => {
    const response = await api.get(`/compliance/items/${id}/history`);
    return response.data;
  },
};

export const turnoutApi = {
  // Get my turnout requests (livery)
  getMyRequests: async (upcomingOnly: boolean = true): Promise<TurnoutRequest[]> => {
    const response = await api.get('/turnout/my', {
      params: { upcoming_only: upcomingOnly }
    });
    return response.data;
  },

  // Create a turnout request
  create: async (data: CreateTurnoutRequest): Promise<TurnoutRequest> => {
    const response = await api.post('/turnout/', data);
    return response.data;
  },

  // Update a request
  update: async (id: number, data: UpdateTurnoutRequest): Promise<TurnoutRequest> => {
    const response = await api.put(`/turnout/${id}`, data);
    return response.data;
  },

  // Delete a request
  delete: async (id: number): Promise<void> => {
    await api.delete(`/turnout/${id}`);
  },

  // Get pending requests (staff)
  getPending: async (): Promise<TurnoutRequest[]> => {
    const response = await api.get('/turnout/pending');
    return response.data;
  },

  // Review a request (approve/decline)
  review: async (id: number, data: TurnoutReviewRequest): Promise<TurnoutRequest> => {
    const response = await api.post(`/turnout/${id}/review`, data);
    return response.data;
  },

  // Get daily summary (staff)
  getDailySummary: async (date: string): Promise<DailyTurnoutSummary> => {
    const response = await api.get(`/turnout/daily/${date}`);
    return response.data;
  },

  // Get all requests with filters (staff)
  getAll: async (
    fromDate?: string,
    toDate?: string,
    status?: TurnoutStatus
  ): Promise<TurnoutRequest[]> => {
    const params: Record<string, string> = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    if (status) params.status_filter = status;
    const response = await api.get('/turnout/all', { params });
    return response.data;
  },

  // Get enums
  getEnums: async (): Promise<TurnoutEnums> => {
    const response = await api.get('/turnout/enums');
    return response.data;
  },
};

export const accountApi = {
  // Get my account summary (livery)
  getMyAccount: async (): Promise<AccountSummary> => {
    const response = await api.get('/account/my');
    return response.data;
  },

  // Get my transactions (livery)
  getMyTransactions: async (
    fromDate?: string,
    toDate?: string,
    transactionType?: TransactionType,
    limit?: number,
    offset?: number,
    sinceLastInvoice: boolean = true
  ): Promise<LedgerEntry[]> => {
    const params: Record<string, string | number | boolean> = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    if (transactionType) params.transaction_type = transactionType;
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    params.since_last_invoice = sinceLastInvoice;
    const response = await api.get('/account/my/transactions', { params });
    return response.data;
  },

  // List all user accounts (admin)
  listUserAccounts: async (): Promise<UserAccountSummary[]> => {
    const response = await api.get('/account/users');
    return response.data;
  },

  // Get specific user account (admin)
  getUserAccount: async (userId: number): Promise<AccountSummary> => {
    const response = await api.get(`/account/users/${userId}`);
    return response.data;
  },

  // Get user transactions (admin)
  getUserTransactions: async (
    userId: number,
    fromDate?: string,
    toDate?: string,
    transactionType?: TransactionType,
    limit?: number,
    offset?: number
  ): Promise<LedgerEntry[]> => {
    const params: Record<string, string | number> = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    if (transactionType) params.transaction_type = transactionType;
    if (limit) params.limit = limit;
    if (offset) params.offset = offset;
    const response = await api.get(`/account/users/${userId}/transactions`, { params });
    return response.data;
  },

  // Create transaction (admin)
  createTransaction: async (data: CreateLedgerEntry): Promise<LedgerEntry> => {
    const response = await api.post('/account/transactions', data);
    return response.data;
  },

  // Update transaction (admin)
  updateTransaction: async (entryId: number, data: UpdateLedgerEntry): Promise<LedgerEntry> => {
    const response = await api.put(`/account/transactions/${entryId}`, data);
    return response.data;
  },

  // Void transaction (admin) - creates reversal entry
  voidTransaction: async (entryId: number, data: VoidTransactionRequest): Promise<LedgerEntry> => {
    const response = await api.post(`/account/transactions/${entryId}/void`, data);
    return response.data;
  },

  // Delete transaction (admin) - deprecated, use void instead
  deleteTransaction: async (entryId: number): Promise<void> => {
    await api.delete(`/account/transactions/${entryId}`);
  },

  // Record payment with receipt generation (admin)
  recordPayment: async (data: RecordPaymentRequest): Promise<LedgerEntry> => {
    const response = await api.post('/account/payments', data);
    return response.data;
  },

  // Download payment receipt PDF
  downloadReceipt: async (entryId: number): Promise<void> => {
    const response = await api.get(`/account/payments/${entryId}/receipt`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `receipt_${entryId}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Download my statement PDF (livery)
  downloadMyStatement: async (fromDate: string, toDate: string): Promise<void> => {
    try {
      const response = await api.get('/account/my/statement/pdf', {
        params: { from_date: fromDate, to_date: toDate },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `statement_${fromDate}_${toDate}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: Blob | { detail?: string }; status?: number }; message?: string };

      if (axiosError.response?.data instanceof Blob) {
        try {
          const text = await axiosError.response.data.text();
          const json = JSON.parse(text);
          throw new Error(json.detail || 'Failed to download statement');
        } catch (parseError) {
          if (parseError instanceof Error && parseError.message && !parseError.message.includes('JSON')) {
            throw parseError;
          }
          throw new Error('Failed to download statement');
        }
      }

      if (axiosError.response?.data && typeof axiosError.response.data === 'object' && 'detail' in axiosError.response.data) {
        throw new Error(axiosError.response.data.detail || 'Failed to download statement');
      }

      throw new Error(axiosError.message || 'Failed to download statement');
    }
  },

  // Create payment checkout session for account balance
  createPaymentCheckout: async (amount: number): Promise<{ checkout_url: string; session_id: string }> => {
    const response = await api.post('/account/my/payment/checkout', { amount });
    return response.data;
  },

  // Download user statement PDF (admin)
  downloadUserStatement: async (userId: number, fromDate: string, toDate: string): Promise<void> => {
    const response = await api.get(`/account/users/${userId}/statement/pdf`, {
      params: { from_date: fromDate, to_date: toDate },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `statement_user${userId}_${fromDate}_${toDate}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Download user transactions CSV (admin)
  downloadUserTransactionsCsv: async (userId: number, fromDate?: string, toDate?: string): Promise<void> => {
    const params: Record<string, string> = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    const response = await api.get(`/account/users/${userId}/transactions/csv`, {
      params,
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `transactions_user${userId}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Get aged debt report (admin)
  getAgedDebtReport: async (): Promise<AgedDebtReport> => {
    const response = await api.get('/account/reports/aged-debt');
    return response.data;
  },

  // Download aged debt CSV (admin)
  downloadAgedDebtCsv: async (): Promise<void> => {
    const response = await api.get('/account/reports/aged-debt/csv', {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    const today = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `aged_debt_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Get income summary report (admin)
  getIncomeSummaryReport: async (fromDate: string, toDate: string): Promise<IncomeSummaryReport> => {
    const response = await api.get('/account/reports/income-summary', {
      params: { from_date: fromDate, to_date: toDate },
    });
    return response.data;
  },

  // Download income summary CSV (admin)
  downloadIncomeSummaryCsv: async (fromDate: string, toDate: string): Promise<void> => {
    const response = await api.get('/account/reports/income-summary/csv', {
      params: { from_date: fromDate, to_date: toDate },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `income_summary_${fromDate}_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Get enums
  getEnums: async (): Promise<TransactionEnums> => {
    const response = await api.get('/account/enums');
    return response.data;
  },
};

// Billing API (Monthly Livery Billing)
export const billingApi = {
  // Get available billing months
  getMonths: async (): Promise<MonthOption[]> => {
    const response = await api.get('/billing/months');
    return response.data;
  },

  // Preview billing for a month (dry run)
  preview: async (year: number, month: number): Promise<BillingRunResponse> => {
    const request: BillingRunRequest = { year, month, preview_only: true };
    const response = await api.post('/billing/preview', request);
    return response.data;
  },

  // Run billing for a month (creates ledger entries)
  run: async (year: number, month: number): Promise<BillingRunResponse> => {
    const request: BillingRunRequest = { year, month, preview_only: false };
    const response = await api.post('/billing/run', request);
    return response.data;
  },
};

// Backup API
export const backupApi = {
  // Create a new backup
  create: async (data?: BackupCreate): Promise<Backup> => {
    const response = await api.post('/backup/export', data || {});
    return response.data;
  },

  // List all backups
  list: async (): Promise<BackupListResponse> => {
    const response = await api.get('/backup/list');
    return response.data;
  },

  // Download backup file
  download: async (backupId: number): Promise<void> => {
    const response = await api.get(`/backup/download/${backupId}`, {
      responseType: 'blob',
    });
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `backup_${backupId}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Validate backup file
  validate: async (file: File): Promise<BackupValidationResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/backup/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Delete backup
  delete: async (backupId: number): Promise<void> => {
    await api.delete(`/backup/${backupId}`);
  },

  // Get backup schedule
  getSchedule: async (): Promise<BackupSchedule> => {
    const response = await api.get('/backup/schedule');
    return response.data;
  },

  // Update backup schedule
  updateSchedule: async (data: BackupScheduleUpdate): Promise<BackupSchedule> => {
    const response = await api.put('/backup/schedule', data);
    return response.data;
  },

  // Import/restore from backup file
  import: async (file: File, clearFirst: boolean = false): Promise<BackupImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/backup/import?clear_first=${clearFirst}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // =====================================================
  // Database Backup (pg_dump) - For disaster recovery
  // =====================================================

  // Create a database backup using pg_dump
  createDatabaseBackup: async (): Promise<DatabaseBackup> => {
    const response = await api.post('/backup/database/create');
    return response.data;
  },

  // List all database backups
  listDatabaseBackups: async (): Promise<DatabaseBackupListResponse> => {
    const response = await api.get('/backup/database/list');
    return response.data;
  },

  // Download database backup file
  downloadDatabaseBackup: async (filename: string): Promise<void> => {
    const response = await api.get(`/backup/database/download/${filename}`, {
      responseType: 'blob',
    });
    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Delete database backup
  deleteDatabaseBackup: async (filename: string): Promise<void> => {
    await api.delete(`/backup/database/${filename}`);
  },
};

// Lessons (Ad-hoc coaching) API
export interface CoachProfileCreate {
  disciplines?: string[];
  arena_id?: number;
  teaching_description?: string;
  bio?: string;
  availability_mode?: string;
  booking_mode?: string;
  lesson_duration_minutes?: number;
  coach_fee: number;
}

export interface CoachProfileUpdate {
  disciplines?: string[];
  arena_id?: number;
  teaching_description?: string;
  bio?: string;
  availability_mode?: string;
  booking_mode?: string;
  lesson_duration_minutes?: number;
  coach_fee?: number;
}

export interface CoachProfileAdminUpdate {
  venue_fee?: number;
  livery_venue_fee?: number;
  is_active?: boolean;
}

export interface RecurringScheduleCreate {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface AvailabilitySlotCreate {
  slot_date: string;
  start_time: string;
  end_time: string;
}

export interface CoachAcceptLesson {
  confirmed_date: string;
  confirmed_start_time: string;
  confirmed_end_time: string;
  arena_id?: number;
  coach_response?: string;
}

export interface CoachDeclineLesson {
  declined_reason: string;
}

export interface CoachBookLesson {
  user_id?: number;
  horse_id?: number;
  arena_id?: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  discipline?: string;
  notes?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
}

export interface StudentInfo {
  id: number;
  name: string;
  email: string;
  role: string;
}

export const lessonsApi = {
  // Get enum options for forms
  getEnums: async (): Promise<LessonEnums> => {
    const response = await api.get('/lessons/enums');
    return response.data;
  },

  // ============== Public routes ==============
  // List active coaches
  listCoaches: async (discipline?: string): Promise<CoachProfile[]> => {
    const params: Record<string, string> = {};
    if (discipline) params.discipline = discipline;
    const response = await api.get('/lessons/coaches', { params });
    return response.data;
  },

  // Get coach details
  getCoach: async (profileId: number): Promise<CoachProfile> => {
    const response = await api.get(`/lessons/coaches/${profileId}`);
    return response.data;
  },

  // Get coach availability
  getCoachAvailability: async (
    profileId: number,
    startDate?: string,
    endDate?: string
  ): Promise<CoachAvailability> => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get(`/lessons/coaches/${profileId}/availability`, { params });
    return response.data;
  },

  // ============== User routes ==============
  // Book directly (auto-accept coaches)
  book: async (data: CreateLessonBook): Promise<LessonRequest> => {
    const response = await api.post('/lessons/book', data);
    return response.data;
  },

  // Request lesson (request-first coaches)
  request: async (data: CreateLessonRequest): Promise<LessonRequest> => {
    const response = await api.post('/lessons/request', data);
    return response.data;
  },

  // Get my lessons
  getMyLessons: async (status?: string): Promise<LessonRequest[]> => {
    const params: Record<string, string> = {};
    if (status) params.status_filter = status;
    const response = await api.get('/lessons/my-lessons', { params });
    return response.data;
  },

  // Cancel lesson
  cancelLesson: async (lessonId: number): Promise<void> => {
    await api.delete(`/lessons/my-lessons/${lessonId}`);
  },

  // ============== Coach profile routes ==============
  // Get my coach profile
  getMyProfile: async (): Promise<CoachProfile | null> => {
    try {
      const response = await api.get('/lessons/my-profile');
      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Create my coach profile
  createProfile: async (data: CoachProfileCreate): Promise<CoachProfile> => {
    const response = await api.post('/lessons/my-profile', data);
    return response.data;
  },

  // Update my coach profile
  updateProfile: async (data: CoachProfileUpdate): Promise<CoachProfile> => {
    const response = await api.put('/lessons/my-profile', data);
    return response.data;
  },

  // Add recurring schedule
  addRecurringSchedule: async (data: RecurringScheduleCreate): Promise<RecurringSchedule> => {
    const response = await api.post('/lessons/my-profile/recurring', data);
    return response.data;
  },

  // Remove recurring schedule
  removeRecurringSchedule: async (scheduleId: number): Promise<void> => {
    await api.delete(`/lessons/my-profile/recurring/${scheduleId}`);
  },

  // Add availability slot
  addAvailabilitySlot: async (data: AvailabilitySlotCreate): Promise<AvailabilitySlot> => {
    const response = await api.post('/lessons/my-profile/slots', data);
    return response.data;
  },

  // Remove availability slot
  removeAvailabilitySlot: async (slotId: number): Promise<void> => {
    await api.delete(`/lessons/my-profile/slots/${slotId}`);
  },

  // ============== Coach incoming requests ==============
  // Get incoming lesson requests
  getIncoming: async (status?: string): Promise<LessonRequest[]> => {
    const params: Record<string, string> = {};
    if (status) params.status_filter = status;
    const response = await api.get('/lessons/incoming', { params });
    return response.data;
  },

  // Accept lesson request
  acceptLesson: async (lessonId: number, data: CoachAcceptLesson): Promise<LessonRequest> => {
    const response = await api.put(`/lessons/${lessonId}/accept`, data);
    return response.data;
  },

  // Decline lesson request
  declineLesson: async (lessonId: number, data: CoachDeclineLesson): Promise<LessonRequest> => {
    const response = await api.put(`/lessons/${lessonId}/decline`, data);
    return response.data;
  },

  // Cancel lesson as coach (with reason)
  coachCancelLesson: async (lessonId: number, data: { cancellation_reason: string }): Promise<LessonRequest> => {
    const response = await api.put(`/lessons/${lessonId}/cancel`, data);
    return response.data;
  },

  // Get students list for coach booking
  getStudents: async (): Promise<StudentInfo[]> => {
    const response = await api.get('/lessons/students');
    return response.data;
  },

  // Coach book lesson on behalf of student
  coachBookLesson: async (data: CoachBookLesson): Promise<LessonRequest> => {
    const response = await api.post('/lessons/coach-book', data);
    return response.data;
  },

  // ============== Admin routes ==============
  // List all coach profiles
  listProfiles: async (activeOnly: boolean = false): Promise<CoachProfile[]> => {
    const response = await api.get('/lessons/admin/profiles', {
      params: { active_only: activeOnly }
    });
    return response.data;
  },

  // Update coach profile (admin)
  updateProfileAdmin: async (profileId: number, data: CoachProfileAdminUpdate): Promise<CoachProfile> => {
    const response = await api.put(`/lessons/admin/profiles/${profileId}`, data);
    return response.data;
  },

  // Approve coach profile
  approveProfile: async (
    profileId: number,
    venueFee: number,
    liveryVenueFee: number = 0
  ): Promise<CoachProfile> => {
    const response = await api.put(`/lessons/admin/profiles/${profileId}/approve`, null, {
      params: { venue_fee: venueFee, livery_venue_fee: liveryVenueFee }
    });
    return response.data;
  },

  // List all lesson requests (admin)
  listAllRequests: async (status?: string): Promise<LessonRequest[]> => {
    const params: Record<string, string> = {};
    if (status) params.status_filter = status;
    const response = await api.get('/lessons/admin/requests', { params });
    return response.data;
  },

  // Admin accept lesson request
  adminAcceptLesson: async (lessonId: number, data: {
    confirmed_date: string;
    confirmed_start_time: string;
    confirmed_end_time: string;
    arena_id?: number;
    admin_notes?: string;
  }): Promise<LessonRequest> => {
    const response = await api.put(`/lessons/admin/requests/${lessonId}/accept`, data);
    return response.data;
  },

  // Admin decline lesson request
  adminDeclineLesson: async (lessonId: number, data: { declined_reason: string }): Promise<LessonRequest> => {
    const response = await api.put(`/lessons/admin/requests/${lessonId}/decline`, data);
    return response.data;
  },

  // Admin complete lesson
  adminCompleteLesson: async (lessonId: number): Promise<LessonRequest> => {
    const response = await api.put(`/lessons/admin/requests/${lessonId}/complete`);
    return response.data;
  },

  // Admin cancel lesson
  adminCancelLesson: async (lessonId: number, reason: string): Promise<LessonRequest> => {
    const response = await api.put(`/lessons/admin/requests/${lessonId}/cancel`, null, {
      params: { reason }
    });
    return response.data;
  },

  // Get calendar availability (for arena calendar display)
  getCalendarAvailability: async (
    fromDate: string,
    toDate: string
  ): Promise<CalendarAvailabilityResponse> => {
    const response = await api.get('/lessons/calendar-availability', {
      params: { from_date: fromDate, to_date: toDate }
    });
    return response.data;
  },

  // Get combined coach and arena availability for booking
  getCombinedAvailability: async (
    coachId: number,
    fromDate: string,
    toDate: string
  ): Promise<CombinedAvailabilityResponse> => {
    const response = await api.get(`/lessons/coaches/${coachId}/combined-availability`, {
      params: { from_date: fromDate, to_date: toDate }
    });
    return response.data;
  },
};

// ============== Fields & Turnout Groups API ==============

export const fieldsApi = {
  // Get all fields
  list: async (includeInactive: boolean = false): Promise<Field[]> => {
    const response = await api.get('/fields/', {
      params: { include_inactive: includeInactive }
    });
    return response.data;
  },

  // Get single field
  get: async (fieldId: number): Promise<Field> => {
    const response = await api.get(`/fields/${fieldId}`);
    return response.data;
  },

  // Create field (admin)
  create: async (data: CreateField): Promise<Field> => {
    const response = await api.post('/fields/', data);
    return response.data;
  },

  // Update field (admin)
  update: async (fieldId: number, data: UpdateField): Promise<Field> => {
    const response = await api.put(`/fields/${fieldId}`, data);
    return response.data;
  },

  // Update field condition
  updateCondition: async (fieldId: number, data: FieldConditionUpdate): Promise<Field> => {
    const response = await api.put(`/fields/${fieldId}/condition`, data);
    return response.data;
  },

  // Start rest period
  startRest: async (fieldId: number, data: FieldRestPeriod): Promise<Field> => {
    const response = await api.post(`/fields/${fieldId}/rest`, data);
    return response.data;
  },

  // End rest period
  endRest: async (fieldId: number): Promise<Field> => {
    const response = await api.delete(`/fields/${fieldId}/rest`);
    return response.data;
  },

  // Get enum options
  getEnums: async (): Promise<FieldEnums> => {
    const response = await api.get('/fields/enums');
    return response.data;
  },

  // ============== Turnout Groups ==============
  // Get turnout groups for a date
  getGroups: async (date: string): Promise<TurnoutGroup[]> => {
    const response = await api.get(`/fields/turnout/groups/${date}`);
    return response.data;
  },

  // Create turnout group
  createGroup: async (data: CreateTurnoutGroup): Promise<TurnoutGroup> => {
    const response = await api.post('/fields/turnout/groups', data);
    return response.data;
  },

  // Mark horse turned out
  markTurnedOut: async (groupHorseId: number): Promise<void> => {
    await api.put(`/fields/turnout/horses/${groupHorseId}/out`);
  },

  // Mark horse brought in
  markBroughtIn: async (groupHorseId: number): Promise<void> => {
    await api.put(`/fields/turnout/horses/${groupHorseId}/in`);
  },

  // Delete turnout group
  deleteGroup: async (groupId: number): Promise<void> => {
    await api.delete(`/fields/turnout/groups/${groupId}`);
  },

  // ============== Horse Companions ==============
  // Get horse companions
  getCompanions: async (horseId: number): Promise<HorseCompanion[]> => {
    const response = await api.get(`/fields/companions/${horseId}`);
    return response.data;
  },

  // Add companion relationship
  addCompanion: async (horseId: number, data: CreateHorseCompanion): Promise<HorseCompanion> => {
    const response = await api.post(`/fields/companions/${horseId}`, data);
    return response.data;
  },

  // Remove companion relationship
  removeCompanion: async (companionId: number): Promise<void> => {
    await api.delete(`/fields/companions/${companionId}`);
  },
};

// ============== Medication Administration API ==============

export const medicationApi = {
  // Get medications due for a date
  getDue: async (date: string, feedTime?: string): Promise<MedicationDue[]> => {
    const params: Record<string, string> = {};
    if (feedTime) params.feed_time = feedTime;
    const response = await api.get(`/medication/due/${date}`, { params });
    return response.data;
  },

  // Log medication administration
  log: async (data: CreateMedicationLog): Promise<MedicationAdminLog> => {
    const response = await api.post('/medication/log', data);
    return response.data;
  },

  // Get medication history for a horse
  getHistory: async (horseId: number, limit: number = 50): Promise<MedicationAdminLog[]> => {
    const response = await api.get(`/medication/log/${horseId}`, {
      params: { limit }
    });
    return response.data;
  },
};

// ============== Wound Care API ==============

export const woundCareApi = {
  // Get active wounds
  getActiveWounds: async (): Promise<ActiveWoundSummary[]> => {
    const response = await api.get('/wounds/active');
    return response.data;
  },

  // Get wound history for a horse
  getHorseWounds: async (horseId: number, includeResolved: boolean = false): Promise<WoundCareLog[]> => {
    const response = await api.get(`/wounds/${horseId}`, {
      params: { include_resolved: includeResolved }
    });
    return response.data;
  },

  // Log wound treatment
  logTreatment: async (horseId: number, data: CreateWoundCareLog): Promise<WoundCareLog> => {
    const response = await api.post(`/wounds/${horseId}`, data);
    return response.data;
  },

  // Mark wound as resolved
  resolve: async (horseId: number, logId: number): Promise<WoundCareLog> => {
    const response = await api.put(`/wounds/${horseId}/${logId}/resolve`);
    return response.data;
  },
};

// ============== Health Observations API ==============

export const healthObservationsApi = {
  // Get observations for a date
  getForDate: async (date: string): Promise<HealthObservation[]> => {
    const response = await api.get(`/observations/${date}`);
    return response.data;
  },

  // Get horse observation history
  getHorseHistory: async (
    horseId: number,
    startDate?: string,
    endDate?: string,
    limit: number = 50
  ): Promise<HealthObservation[]> => {
    const params: Record<string, string | number> = { limit };
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get(`/observations/horse/${horseId}`, { params });
    return response.data;
  },

  // Log health observation
  log: async (horseId: number, data: CreateHealthObservation): Promise<HealthObservation> => {
    const response = await api.post(`/observations/horse/${horseId}`, data);
    return response.data;
  },

  // Get recent concerns
  getRecentConcerns: async (days: number = 7): Promise<HealthObservation[]> => {
    const response = await api.get('/observations/concerns/recent', {
      params: { days }
    });
    return response.data;
  },
};

// ============== Rehab Programs API ==============

export const rehabApi = {
  // Get all programs with optional status filter
  list: async (statusFilter?: string): Promise<RehabProgram[]> => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status_filter = statusFilter;
    const response = await api.get('/rehab/programs', { params });
    return response.data;
  },

  // Get active rehab programs
  getActive: async (): Promise<RehabProgram[]> => {
    const response = await api.get('/rehab/programs/active');
    return response.data;
  },

  // Get horse's rehab programs
  getHorsePrograms: async (horseId: number): Promise<RehabProgram[]> => {
    const response = await api.get(`/rehab/horse/${horseId}/programs`);
    return response.data;
  },

  // Get single program with phases and tasks
  get: async (programId: number): Promise<RehabProgram> => {
    const response = await api.get(`/rehab/programs/${programId}`);
    return response.data;
  },

  // Create rehab program
  create: async (data: CreateRehabProgram): Promise<RehabProgram> => {
    const response = await api.post('/rehab/programs', data);
    return response.data;
  },

  // Update program
  update: async (programId: number, data: Partial<RehabProgram>): Promise<RehabProgram> => {
    const response = await api.put(`/rehab/programs/${programId}`, data);
    return response.data;
  },

  // Activate program
  activate: async (programId: number): Promise<RehabProgram> => {
    const response = await api.post(`/rehab/programs/${programId}/activate`);
    return response.data;
  },

  // Complete program
  complete: async (programId: number): Promise<RehabProgram> => {
    const response = await api.post(`/rehab/programs/${programId}/complete`);
    return response.data;
  },

  // Complete a phase
  completePhase: async (programId: number, phaseId: number, notes?: string): Promise<{ message: string; next_phase: number | null }> => {
    const response = await api.post(`/rehab/programs/${programId}/phases/${phaseId}/complete`, null, {
      params: notes ? { notes } : {}
    });
    return response.data;
  },

  // Get tasks due for a date
  getTasksDue: async (date: string, feedTime?: string): Promise<RehabDueSummary[]> => {
    const params: Record<string, string> = {};
    if (feedTime) params.feed_time = feedTime;
    const response = await api.get(`/rehab/tasks/due/${date}`, { params });
    return response.data;
  },

  // Log task completion
  logTask: async (data: CreateRehabTaskLog): Promise<RehabTaskLog> => {
    const response = await api.post('/rehab/tasks/log', data);
    return response.data;
  },

  // Get task logs for a horse
  getTaskLogs: async (horseId: number, programId?: number, startDate?: string, endDate?: string): Promise<RehabTaskLog[]> => {
    const params: Record<string, string | number> = {};
    if (programId) params.program_id = programId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    const response = await api.get(`/rehab/tasks/log/${horseId}`, { params });
    return response.data;
  },

  // Get tasks due for a specific horse on a date (available to horse owners)
  getHorseTasksDue: async (horseId: number, date: string): Promise<DailyRehabTask[]> => {
    const response = await api.get(`/rehab/tasks/due/horse/${horseId}/${date}`);
    return response.data;
  },
};

// ============== Invoices API ==============

export const invoicesApi = {
  // ============== Livery User Endpoints ==============
  // Get my invoices
  getMyInvoices: async (): Promise<MyInvoiceSummary[]> => {
    const response = await api.get('/invoices/my');
    return response.data;
  },

  // Get my single invoice
  getMyInvoice: async (invoiceId: number): Promise<Invoice> => {
    const response = await api.get(`/invoices/my/${invoiceId}`);
    return response.data;
  },

  // Download my invoice PDF
  downloadMyPdf: async (invoiceId: number): Promise<Blob> => {
    const response = await api.get(`/invoices/my/${invoiceId}/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // ============== Admin Endpoints ==============
  // Get all invoices
  list: async (statusFilter?: string, userId?: number): Promise<InvoiceSummary[]> => {
    const params: Record<string, string | number> = {};
    if (statusFilter) params.status_filter = statusFilter;
    if (userId) params.user_id = userId;
    const response = await api.get('/invoices/', { params });
    return response.data;
  },

  // Get single invoice
  get: async (invoiceId: number): Promise<Invoice> => {
    const response = await api.get(`/invoices/${invoiceId}`);
    return response.data;
  },

  // Generate invoice
  generate: async (data: InvoiceGenerateRequest): Promise<Invoice> => {
    const response = await api.post('/invoices/generate', data);
    return response.data;
  },

  // Issue invoice
  issue: async (invoiceId: number): Promise<Invoice> => {
    const response = await api.post(`/invoices/${invoiceId}/issue`);
    return response.data;
  },

  // Mark as paid
  markPaid: async (invoiceId: number, paidDate?: string): Promise<Invoice> => {
    const params: Record<string, string> = {};
    if (paidDate) params.paid_date = paidDate;
    const response = await api.post(`/invoices/${invoiceId}/mark-paid`, null, { params });
    return response.data;
  },

  // Cancel invoice
  cancel: async (invoiceId: number): Promise<Invoice> => {
    const response = await api.post(`/invoices/${invoiceId}/cancel`);
    return response.data;
  },

  // Delete draft invoice
  delete: async (invoiceId: number): Promise<void> => {
    await api.delete(`/invoices/${invoiceId}`);
  },

  // Download invoice PDF (admin)
  downloadPdf: async (invoiceId: number): Promise<Blob> => {
    const response = await api.get(`/invoices/${invoiceId}/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  },
};

// ============== Holiday Livery API ==============

export const holidayLiveryApi = {
  // ============== Public Endpoints ==============
  // Submit a holiday livery request (no auth required)
  submitRequest: async (data: HolidayLiveryRequestCreate): Promise<HolidayLiveryPublicResponse> => {
    const response = await api.post('/holiday-livery/request', data);
    return response.data;
  },

  // ============== Admin Endpoints ==============
  // List all holiday livery requests
  list: async (status?: HolidayLiveryStatus): Promise<HolidayLiveryRequestSummary[]> => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const response = await api.get('/holiday-livery/requests', { params });
    return response.data;
  },

  // Get single request details
  get: async (requestId: number): Promise<HolidayLiveryRequestResponse> => {
    const response = await api.get(`/holiday-livery/requests/${requestId}`);
    return response.data;
  },

  // Approve request (creates user account and horse)
  approve: async (requestId: number, data: HolidayLiveryApproval): Promise<HolidayLiveryRequestResponse> => {
    const response = await api.post(`/holiday-livery/requests/${requestId}/approve`, data);
    return response.data;
  },

  // Reject request
  reject: async (requestId: number, data: HolidayLiveryRejection): Promise<HolidayLiveryRequestResponse> => {
    const response = await api.post(`/holiday-livery/requests/${requestId}/reject`, data);
    return response.data;
  },

  // Cancel request
  cancel: async (requestId: number): Promise<HolidayLiveryRequestResponse> => {
    const response = await api.post(`/holiday-livery/requests/${requestId}/cancel`);
    return response.data;
  },

  // Get statistics
  getStats: async (): Promise<HolidayLiveryStats> => {
    const response = await api.get('/holiday-livery/stats');
    return response.data;
  },
};

// ============== Contract Management API ==============

export const contractsApi = {
  // ============== Admin Template Endpoints ==============

  // List all templates
  listTemplates: async (contractType?: ContractType, isActive?: boolean): Promise<ContractTemplateSummary[]> => {
    const params: Record<string, string | boolean> = {};
    if (contractType) params.contract_type = contractType;
    if (isActive !== undefined) params.is_active = isActive;
    const response = await api.get('/contracts/templates', { params });
    return response.data;
  },

  // Create a template
  createTemplate: async (data: CreateContractTemplate): Promise<ContractTemplate> => {
    const response = await api.post('/contracts/templates', data);
    return response.data;
  },

  // Get a template
  getTemplate: async (templateId: number): Promise<ContractTemplate> => {
    const response = await api.get(`/contracts/templates/${templateId}`);
    return response.data;
  },

  // Update a template
  updateTemplate: async (templateId: number, data: UpdateContractTemplate): Promise<ContractTemplate> => {
    const response = await api.put(`/contracts/templates/${templateId}`, data);
    return response.data;
  },

  // Delete a template
  deleteTemplate: async (templateId: number): Promise<void> => {
    await api.delete(`/contracts/templates/${templateId}`);
  },

  // ============== Version Endpoints ==============

  // List versions
  listVersions: async (templateId: number): Promise<ContractVersionSummary[]> => {
    const response = await api.get(`/contracts/templates/${templateId}/versions`);
    return response.data;
  },

  // Create a version
  createVersion: async (templateId: number, data: CreateContractVersion): Promise<ContractVersion> => {
    const response = await api.post(`/contracts/templates/${templateId}/versions`, data);
    return response.data;
  },

  // Get a version
  getVersion: async (templateId: number, versionId: number): Promise<ContractVersion> => {
    const response = await api.get(`/contracts/templates/${templateId}/versions/${versionId}`);
    return response.data;
  },

  // Get version diff
  getVersionDiff: async (templateId: number, versionId: number, compareTo?: number): Promise<ContractVersionDiff> => {
    const params: Record<string, number> = {};
    if (compareTo) params.compare_to = compareTo;
    const response = await api.get(`/contracts/templates/${templateId}/versions/${versionId}/diff`, { params });
    return response.data;
  },

  // ============== Signature Endpoints ==============

  // List all signatures
  listSignatures: async (templateId?: number, statusFilter?: SignatureStatus, userId?: number): Promise<ContractSignatureSummary[]> => {
    const params: Record<string, string | number> = {};
    if (templateId) params.template_id = templateId;
    if (statusFilter) params.status_filter = statusFilter;
    if (userId) params.user_id = userId;
    const response = await api.get('/contracts/signatures', { params });
    return response.data;
  },

  // Request a signature
  requestSignature: async (templateId: number, data: SignatureRequest): Promise<ContractSignature> => {
    const response = await api.post(`/contracts/templates/${templateId}/request-signature`, data);
    return response.data;
  },

  // Trigger bulk re-signing
  triggerResign: async (templateId: number, data: BulkResignRequest): Promise<ContractSignature[]> => {
    const response = await api.post(`/contracts/templates/${templateId}/trigger-resign`, data);
    return response.data;
  },

  // Void a signature
  voidSignature: async (signatureId: number, reason: string): Promise<ContractSignature> => {
    const response = await api.post(`/contracts/signatures/${signatureId}/void`, null, {
      params: { reason }
    });
    return response.data;
  },

  // Download signed PDF (admin)
  downloadSignedPdf: async (signatureId: number): Promise<Blob> => {
    const response = await api.get(`/contracts/signatures/${signatureId}/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // ============== User Endpoints (My Contracts) ==============

  // Get my contracts
  getMyContracts: async (): Promise<MyContract[]> => {
    const response = await api.get('/contracts/my-contracts');
    return response.data;
  },

  // Get contract content for viewing
  getMyContractContent: async (signatureId: number): Promise<ContractContent> => {
    const response = await api.get(`/contracts/my-contracts/${signatureId}/content`);
    return response.data;
  },

  // Initiate signing
  initiateSigning: async (signatureId: number): Promise<InitiateSigningResponse> => {
    const response = await api.post(`/contracts/signatures/${signatureId}/initiate`);
    return response.data;
  },

  // Complete signing (after DocuSign callback)
  completeSigning: async (signatureId: number, data: CompleteSigningRequest): Promise<CompleteSigningResponse> => {
    const response = await api.post(`/contracts/signatures/${signatureId}/complete`, data);
    return response.data;
  },

  // Manual signing (when DocuSign is not configured)
  manualSign: async (signatureId: number): Promise<CompleteSigningResponse> => {
    const response = await api.post(`/contracts/signatures/${signatureId}/manual-sign`);
    return response.data;
  },

  // Download my signed PDF
  downloadMySignedPdf: async (signatureId: number): Promise<Blob> => {
    const response = await api.get(`/contracts/my-contracts/${signatureId}/pdf`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // ============== DocuSign Settings Endpoints ==============

  // Get DocuSign settings
  getDocuSignSettings: async (): Promise<DocuSignSettings> => {
    const response = await api.get('/contracts/docusign/settings');
    return response.data;
  },

  // Update DocuSign settings
  updateDocuSignSettings: async (data: UpdateDocuSignSettings): Promise<DocuSignSettings> => {
    const response = await api.put('/contracts/docusign/settings', data);
    return response.data;
  },

  // Test DocuSign connection
  testDocuSignConnection: async (): Promise<DocuSignTestResponse> => {
    const response = await api.post('/contracts/docusign/test');
    return response.data;
  },
};

// ============== Land Management - Grants API ==============

import type {
  Grant,
  GrantCreate,
  GrantUpdate,
  GrantDetail,
  GrantPaymentSchedule,
  GrantPaymentScheduleCreate,
  GrantFieldLink,
  GrantFeatureLink,
  LandFeature,
  LandFeatureCreate,
  LandFeatureUpdate,
  LandFeatureDetail,
  FeatureMaintenanceLog,
  FeatureMaintenanceLogCreate,
  FloodMonitoringStation,
  FloodMonitoringStationCreate,
  FieldFloodRisk,
  FieldFloodRiskCreate,
  FloodWarningStatus,
  EAStation,
  LandManagementEnums,
  WaterTroughStatus,
  FenceStatus,
  MaintenanceDueItem,
  FieldUsageAnalytics,
  FieldRotationSuggestion,
  YearlyAnalyticsDashboard,
  GrantStatus,
  GrantSchemeType,
  FeatureFlagsResponse,
  FeatureFlagValidationResult,
  EnabledFeaturesResponse,
  FeatureKey,
} from '../types';

export const grantsApi = {
  // List grants
  list: async (params?: { scheme_type?: GrantSchemeType; status?: GrantStatus; active_only?: boolean }): Promise<Grant[]> => {
    const response = await api.get('/grants/', { params });
    return response.data;
  },

  // Get single grant with details
  get: async (grantId: number): Promise<GrantDetail> => {
    const response = await api.get(`/grants/${grantId}`);
    return response.data;
  },

  // Create grant
  create: async (data: GrantCreate): Promise<Grant> => {
    const response = await api.post('/grants/', data);
    return response.data;
  },

  // Update grant
  update: async (grantId: number, data: GrantUpdate): Promise<Grant> => {
    const response = await api.put(`/grants/${grantId}`, data);
    return response.data;
  },

  // Delete grant
  delete: async (grantId: number): Promise<void> => {
    await api.delete(`/grants/${grantId}`);
  },

  // Get upcoming deadlines
  getUpcomingDeadlines: async (daysAhead?: number): Promise<Grant[]> => {
    const response = await api.get('/grants/upcoming-deadlines', {
      params: daysAhead ? { days_ahead: daysAhead } : undefined
    });
    return response.data;
  },

  // Get upcoming inspections
  getUpcomingInspections: async (daysAhead?: number): Promise<Grant[]> => {
    const response = await api.get('/grants/upcoming-inspections', {
      params: daysAhead ? { days_ahead: daysAhead } : undefined
    });
    return response.data;
  },

  // Get payment schedule
  getPaymentSchedule: async (daysAhead?: number): Promise<GrantPaymentSchedule[]> => {
    const response = await api.get('/grants/payment-schedule', {
      params: daysAhead ? { days_ahead: daysAhead } : undefined
    });
    return response.data;
  },

  // Add payment schedule
  addPayment: async (grantId: number, data: GrantPaymentScheduleCreate): Promise<GrantPaymentSchedule> => {
    const response = await api.post(`/grants/${grantId}/payments`, data);
    return response.data;
  },

  // Update payment schedule
  updatePayment: async (grantId: number, paymentId: number, data: Partial<GrantPaymentSchedule>): Promise<GrantPaymentSchedule> => {
    const response = await api.put(`/grants/${grantId}/payments/${paymentId}`, data);
    return response.data;
  },

  // Delete payment schedule
  deletePayment: async (grantId: number, paymentId: number): Promise<void> => {
    await api.delete(`/grants/${grantId}/payments/${paymentId}`);
  },

  // Link field to grant
  linkField: async (grantId: number, fieldId: number, notes?: string): Promise<GrantFieldLink> => {
    const response = await api.post(`/grants/${grantId}/link-field/${fieldId}`, null, {
      params: notes ? { notes } : undefined
    });
    return response.data;
  },

  // Unlink field from grant
  unlinkField: async (grantId: number, fieldId: number): Promise<void> => {
    await api.delete(`/grants/${grantId}/link-field/${fieldId}`);
  },

  // Link feature to grant
  linkFeature: async (grantId: number, featureId: number, notes?: string): Promise<GrantFeatureLink> => {
    const response = await api.post(`/grants/${grantId}/link-feature/${featureId}`, null, {
      params: notes ? { notes } : undefined
    });
    return response.data;
  },

  // Unlink feature from grant
  unlinkFeature: async (grantId: number, featureId: number): Promise<void> => {
    await api.delete(`/grants/${grantId}/link-feature/${featureId}`);
  },
};

// ============== Land Management - Land Features API ==============

export const landFeaturesApi = {
  // List features
  list: async (params?: { feature_type?: string; field_id?: number; condition?: string; active_only?: boolean }): Promise<LandFeature[]> => {
    const response = await api.get('/land-features/', { params });
    return response.data;
  },

  // Get single feature with details
  get: async (featureId: number): Promise<LandFeatureDetail> => {
    const response = await api.get(`/land-features/${featureId}`);
    return response.data;
  },

  // Create feature
  create: async (data: LandFeatureCreate): Promise<LandFeature> => {
    const response = await api.post('/land-features/', data);
    return response.data;
  },

  // Update feature
  update: async (featureId: number, data: LandFeatureUpdate): Promise<LandFeature> => {
    const response = await api.put(`/land-features/${featureId}`, data);
    return response.data;
  },

  // Delete feature
  delete: async (featureId: number): Promise<void> => {
    await api.delete(`/land-features/${featureId}`);
  },

  // Log maintenance
  logMaintenance: async (featureId: number, data: FeatureMaintenanceLogCreate): Promise<FeatureMaintenanceLog> => {
    const response = await api.post(`/land-features/${featureId}/maintenance`, data);
    return response.data;
  },

  // Get maintenance history
  getMaintenanceHistory: async (featureId: number): Promise<FeatureMaintenanceLog[]> => {
    const response = await api.get(`/land-features/${featureId}/maintenance`);
    return response.data;
  },

  // Get features due for maintenance
  getMaintenanceDue: async (daysAhead?: number): Promise<MaintenanceDueItem[]> => {
    const response = await api.get('/land-features/maintenance-due', {
      params: daysAhead ? { days_ahead: daysAhead } : undefined
    });
    return response.data;
  },

  // Get water trough status
  getWaterTroughs: async (): Promise<WaterTroughStatus[]> => {
    const response = await api.get('/land-features/water-troughs');
    return response.data;
  },

  // Record water trough fill
  recordFill: async (featureId: number, notes?: string): Promise<LandFeature> => {
    const response = await api.post(`/land-features/${featureId}/record-fill`, null, {
      params: notes ? { notes } : undefined
    });
    return response.data;
  },

  // Get fence status
  getFenceStatus: async (): Promise<FenceStatus[]> => {
    const response = await api.get('/land-features/fence-status');
    return response.data;
  },

  // Record fence check
  recordFenceCheck: async (featureId: number, data: { working: boolean; voltage?: number; notes?: string }): Promise<LandFeature> => {
    const response = await api.post(`/land-features/${featureId}/fence-check`, data);
    return response.data;
  },

  // Get enums
  getEnums: async (): Promise<LandManagementEnums> => {
    const response = await api.get('/land-features/enums/all');
    return response.data;
  },
};

// ============== Land Management - Flood Warnings API ==============

export const floodWarningsApi = {
  // List configured stations
  listStations: async (activeOnly?: boolean): Promise<FloodMonitoringStation[]> => {
    const response = await api.get('/flood-warnings/stations', {
      params: activeOnly !== undefined ? { active_only: activeOnly } : undefined
    });
    return response.data;
  },

  // Get single station
  getStation: async (stationId: number): Promise<FloodMonitoringStation> => {
    const response = await api.get(`/flood-warnings/stations/${stationId}`);
    return response.data;
  },

  // Add monitoring station
  addStation: async (data: FloodMonitoringStationCreate): Promise<FloodMonitoringStation> => {
    const response = await api.post('/flood-warnings/stations', data);
    return response.data;
  },

  // Update station
  updateStation: async (stationId: number, data: Partial<FloodMonitoringStation>): Promise<FloodMonitoringStation> => {
    const response = await api.put(`/flood-warnings/stations/${stationId}`, data);
    return response.data;
  },

  // Delete station
  deleteStation: async (stationId: number): Promise<void> => {
    await api.delete(`/flood-warnings/stations/${stationId}`);
  },

  // List field flood risks
  listFieldRisks: async (fieldId?: number): Promise<FieldFloodRisk[]> => {
    const response = await api.get('/flood-warnings/field-risks', {
      params: fieldId ? { field_id: fieldId } : undefined
    });
    return response.data;
  },

  // Add field flood risk
  addFieldRisk: async (data: FieldFloodRiskCreate): Promise<FieldFloodRisk> => {
    const response = await api.post('/flood-warnings/field-risks', data);
    return response.data;
  },

  // Update field risk
  updateFieldRisk: async (riskId: number, data: Partial<FieldFloodRisk>): Promise<FieldFloodRisk> => {
    const response = await api.put(`/flood-warnings/field-risks/${riskId}`, data);
    return response.data;
  },

  // Delete field risk
  deleteFieldRisk: async (riskId: number): Promise<void> => {
    await api.delete(`/flood-warnings/field-risks/${riskId}`);
  },

  // Get current warnings
  getCurrentWarnings: async (): Promise<FloodWarningStatus> => {
    const response = await api.get('/flood-warnings/current');
    return response.data;
  },

  // Get field flood risks
  getFieldRisks: async (fieldId: number): Promise<FieldFloodRisk[]> => {
    const response = await api.get(`/flood-warnings/field/${fieldId}`);
    return response.data;
  },

  // Refresh readings from EA API
  refreshReadings: async (): Promise<{ updated: number; errors: number }> => {
    const response = await api.post('/flood-warnings/fetch');
    return response.data;
  },

  // Search EA stations
  searchEAStations: async (params: { search?: string; lat?: number; lon?: number; dist_km?: number }): Promise<{ stations: EAStation[] }> => {
    const response = await api.get('/flood-warnings/search-stations', { params });
    return response.data;
  },

  // Get EA station info
  getEAStationInfo: async (stationId: string): Promise<{ station: EAStation; latest_reading: { value: number; date_time: string } | null }> => {
    const response = await api.get(`/flood-warnings/station-info/${stationId}`);
    return response.data;
  },

  // Get EA station history
  getEAStationHistory: async (stationId: string, hours?: number): Promise<{ readings: Array<{ value: number; date_time: string }> }> => {
    const response = await api.get(`/flood-warnings/station-history/${stationId}`, {
      params: hours ? { hours } : undefined
    });
    return response.data;
  },
};

// ============== Land Management - Field Analytics API ==============

export const fieldAnalyticsApi = {
  // Get yearly analytics dashboard
  getYearly: async (year: number): Promise<YearlyAnalyticsDashboard> => {
    const response = await api.get(`/fields/analytics/yearly/${year}`);
    return response.data;
  },

  // Get field history
  getFieldHistory: async (fieldId: number, months?: number): Promise<FieldUsageAnalytics[]> => {
    const response = await api.get(`/fields/analytics/${fieldId}/history`, {
      params: months ? { months } : undefined
    });
    return response.data;
  },

  // Trigger analytics calculation
  calculate: async (): Promise<{ message: string }> => {
    const response = await api.post('/fields/analytics/calculate');
    return response.data;
  },

  // Get rotation suggestions
  getRotationSuggestions: async (acknowledgedFilter?: boolean): Promise<FieldRotationSuggestion[]> => {
    const response = await api.get('/fields/rotation/suggestions', {
      params: acknowledgedFilter !== undefined ? { acknowledged: acknowledgedFilter } : undefined
    });
    return response.data;
  },

  // Acknowledge suggestion
  acknowledgeSuggestion: async (suggestionId: number, notes?: string): Promise<FieldRotationSuggestion> => {
    const response = await api.post(`/fields/rotation/suggestions/${suggestionId}/acknowledge`, null, {
      params: notes ? { notes } : undefined
    });
    return response.data;
  },
};

// ============== Staff Profiles API ==============

import type {
  StaffProfile,
  StaffProfileCreate,
  StaffProfileUpdate,
  StaffProfileSelfUpdate,
  StaffProfileListResponse,
  StaffProfileSummary,
  StaffMilestonesResponse,
  StaffMemberCreate,
  StaffMemberCreateResponse,
  HourlyRateHistory,
  CreateHourlyRateHistory,
} from '../types';

export const staffProfilesApi = {
  // List all staff profiles (admin only)
  list: async (includeInactive: boolean = false): Promise<StaffProfileListResponse> => {
    const response = await api.get('/staff-profiles', {
      params: { include_inactive: includeInactive }
    });
    return response.data;
  },

  // Get staff profile summaries (admin only)
  getSummaries: async (): Promise<StaffProfileSummary[]> => {
    const response = await api.get('/staff-profiles/summaries');
    return response.data;
  },

  // Get upcoming milestones (admin only)
  getMilestones: async (days: number = 7): Promise<StaffMilestonesResponse> => {
    const response = await api.get('/staff-profiles/milestones', {
      params: { days }
    });
    return response.data;
  },

  // Create staff profile (admin only)
  create: async (data: StaffProfileCreate): Promise<StaffProfile> => {
    const response = await api.post('/staff-profiles', data);
    return response.data;
  },

  // Create staff member with user account + profile (admin only)
  createWithUser: async (data: StaffMemberCreate): Promise<StaffMemberCreateResponse> => {
    const response = await api.post('/staff-profiles/with-user', data);
    return response.data;
  },

  // Get staff profile by user ID (admin or own profile)
  get: async (userId: number): Promise<StaffProfile> => {
    const response = await api.get(`/staff-profiles/${userId}`);
    return response.data;
  },

  // Update staff profile (admin only)
  update: async (userId: number, data: StaffProfileUpdate): Promise<StaffProfile> => {
    const response = await api.put(`/staff-profiles/${userId}`, data);
    return response.data;
  },

  // Delete staff profile (admin only)
  delete: async (userId: number): Promise<void> => {
    await api.delete(`/staff-profiles/${userId}`);
  },

  // Get my profile (staff/admin)
  getMyProfile: async (): Promise<StaffProfile> => {
    const response = await api.get('/staff-profiles/me');
    return response.data;
  },

  // Update my profile (staff/admin - limited fields)
  updateMyProfile: async (data: StaffProfileSelfUpdate): Promise<StaffProfile> => {
    const response = await api.put('/staff-profiles/me', data);
    return response.data;
  },

  // Get my rate history (staff - read-only)
  getMyRateHistory: async (): Promise<HourlyRateHistory[]> => {
    const response = await api.get('/staff-profiles/me/rate-history');
    return response.data;
  },

  // Get hourly rate history for a staff member (admin only)
  getRateHistory: async (userId: number): Promise<HourlyRateHistory[]> => {
    const response = await api.get(`/staff-profiles/${userId}/rate-history`);
    return response.data;
  },

  // Add a new hourly rate for a staff member (admin only)
  addRate: async (userId: number, data: CreateHourlyRateHistory): Promise<HourlyRateHistory> => {
    const response = await api.post(`/staff-profiles/${userId}/rate-history`, data);
    return response.data;
  },
};

// ============== Feature Flags API ==============

export const featureFlagsApi = {
  // Get all feature flags with metadata (admin only)
  getAll: async (): Promise<FeatureFlagsResponse> => {
    const response = await api.get('/feature-flags');
    return response.data;
  },

  // Get list of enabled features (authenticated users)
  getEnabled: async (): Promise<EnabledFeaturesResponse> => {
    const response = await api.get('/feature-flags/enabled');
    return response.data;
  },

  // Check if a specific feature is enabled
  check: async (featureKey: FeatureKey): Promise<{ feature: string; enabled: boolean }> => {
    const response = await api.get(`/feature-flags/check/${featureKey}`);
    return response.data;
  },

  // Update a single feature flag (admin only)
  update: async (featureKey: FeatureKey, enabled: boolean): Promise<FeatureFlagValidationResult> => {
    const response = await api.put(`/feature-flags/${featureKey}`, { enabled });
    return response.data;
  },

  // Bulk update feature flags (admin only)
  bulkUpdate: async (updates: Record<string, boolean>): Promise<FeatureFlagValidationResult> => {
    const response = await api.put('/feature-flags', { updates });
    return response.data;
  },
};

// ============== Risk Assessments API ==============

import type {
  RiskAssessment,
  RiskAssessmentSummary,
  CreateRiskAssessment,
  UpdateRiskAssessment,
  UpdateRiskAssessmentContent,
  RiskAssessmentReview,
  CreateRiskAssessmentReview,
  RiskAssessmentAcknowledgement,
  CreateRiskAssessmentAcknowledgement,
  AcknowledgementSummary,
  AssessmentStaffStatus,
  MyRiskAssessment,
  StaffAcknowledgementStatus,
  ComplianceSummary,
} from '../types';

export const riskAssessmentsApi = {
  // List all risk assessments (admin only)
  list: async (params?: {
    category?: string;
    is_active?: boolean;
    needs_review?: boolean;
  }): Promise<RiskAssessmentSummary[]> => {
    const response = await api.get('/risk-assessments', { params });
    return response.data;
  },

  // Get compliance summary (admin only)
  getComplianceSummary: async (): Promise<ComplianceSummary> => {
    const response = await api.get('/risk-assessments/compliance');
    return response.data;
  },

  // Get staff acknowledgement status (admin only)
  getStaffStatus: async (): Promise<StaffAcknowledgementStatus[]> => {
    const response = await api.get('/risk-assessments/staff-status');
    return response.data;
  },

  // Get a specific risk assessment (admin only)
  get: async (id: number): Promise<RiskAssessment> => {
    const response = await api.get(`/risk-assessments/${id}`);
    return response.data;
  },

  // Create a new risk assessment (admin only)
  create: async (data: CreateRiskAssessment): Promise<RiskAssessment> => {
    const response = await api.post('/risk-assessments', data);
    return response.data;
  },

  // Update risk assessment metadata (admin only)
  update: async (id: number, data: UpdateRiskAssessment): Promise<RiskAssessment> => {
    const response = await api.put(`/risk-assessments/${id}`, data);
    return response.data;
  },

  // Update risk assessment content (admin only, increments version)
  updateContent: async (id: number, data: UpdateRiskAssessmentContent): Promise<RiskAssessment> => {
    const response = await api.put(`/risk-assessments/${id}/content`, data);
    return response.data;
  },

  // Record a review without content changes (admin only)
  recordReview: async (id: number, data: CreateRiskAssessmentReview): Promise<RiskAssessmentReview> => {
    const response = await api.post(`/risk-assessments/${id}/review`, data);
    return response.data;
  },

  // Require all staff to re-acknowledge this assessment (admin only)
  // Use after incidents, near-misses, or when all staff must re-read
  requireReacknowledgement: async (id: number, data: CreateRiskAssessmentReview): Promise<RiskAssessment> => {
    const response = await api.post(`/risk-assessments/${id}/require-reacknowledgement`, data);
    return response.data;
  },

  // Get review history (admin only)
  getReviewHistory: async (id: number): Promise<RiskAssessmentReview[]> => {
    const response = await api.get(`/risk-assessments/${id}/reviews`);
    return response.data;
  },

  // Get acknowledgements for an assessment (admin only)
  getAcknowledgements: async (id: number): Promise<AcknowledgementSummary[]> => {
    const response = await api.get(`/risk-assessments/${id}/acknowledgements`);
    return response.data;
  },

  // Get staff status for a specific assessment (admin only)
  getAssessmentStaffStatus: async (id: number): Promise<AssessmentStaffStatus[]> => {
    const response = await api.get(`/risk-assessments/${id}/staff-status`);
    return response.data;
  },

  // Delete a risk assessment (admin only)
  delete: async (id: number): Promise<void> => {
    await api.delete(`/risk-assessments/${id}`);
  },

  // === Staff endpoints ===

  // Get my risk assessments (all staff)
  getMyAssessments: async (): Promise<MyRiskAssessment[]> => {
    const response = await api.get('/risk-assessments/my/assessments');
    return response.data;
  },

  // Acknowledge a risk assessment (all staff)
  acknowledge: async (data: CreateRiskAssessmentAcknowledgement): Promise<RiskAssessmentAcknowledgement> => {
    const response = await api.post('/risk-assessments/my/acknowledge', data);
    return response.data;
  },

  // Get count of pending acknowledgements (all staff)
  getPendingCount: async (): Promise<{ pending_count: number }> => {
    const response = await api.get('/risk-assessments/my/pending-count');
    return response.data;
  },
};

// Horse Field Assignments API
export const horseFieldAssignmentsApi = {
  // Get current field assignment for a horse
  getCurrentAssignment: async (horseId: number): Promise<HorseFieldAssignment | null> => {
    const response = await api.get(`/fields/horses/${horseId}/field-assignment`);
    return response.data;
  },

  // Assign a horse to a field (auto-ends previous assignment)
  assignToField: async (horseId: number, data: HorseFieldAssignmentCreate): Promise<HorseFieldAssignment> => {
    const response = await api.post(`/fields/horses/${horseId}/field-assignment`, data);
    return response.data;
  },

  // Remove horse from current field (ends assignment)
  removeFromField: async (horseId: number): Promise<void> => {
    await api.delete(`/fields/horses/${horseId}/field-assignment`);
  },

  // Get full assignment history for a horse
  getHistory: async (horseId: number): Promise<HorseFieldAssignmentHistory> => {
    const response = await api.get(`/fields/horses/${horseId}/field-history`);
    return response.data;
  },

  // Set horse box rest status
  setBoxRest: async (horseId: number, boxRest: boolean, notes?: string): Promise<void> => {
    await api.put(`/fields/horses/${horseId}/box-rest`, null, {
      params: { box_rest: boxRest, notes }
    });
  },
};

// Field Occupancy API
export const fieldOccupancyApi = {
  // Get occupancy for a specific field
  getFieldOccupancy: async (fieldId: number): Promise<FieldCurrentOccupancy> => {
    const response = await api.get(`/fields/${fieldId}/occupancy`);
    return response.data;
  },

  // Get occupancy summary for all fields
  getAllOccupancy: async (includeInactive: boolean = false): Promise<FieldCurrentOccupancy[]> => {
    const response = await api.get('/fields/occupancy-summary', {
      params: { include_inactive: includeInactive }
    });
    return response.data;
  },
};

// Sheep Flocks API
export const sheepFlocksApi = {
  // List all flocks
  list: async (includeInactive: boolean = false): Promise<SheepFlock[]> => {
    const response = await api.get('/sheep-flocks/', {
      params: { include_inactive: includeInactive }
    });
    return response.data;
  },

  // Create a new flock
  create: async (data: SheepFlockCreate): Promise<SheepFlock> => {
    const response = await api.post('/sheep-flocks/', data);
    return response.data;
  },

  // Get a flock with history
  get: async (flockId: number): Promise<SheepFlockWithHistory> => {
    const response = await api.get(`/sheep-flocks/${flockId}`);
    return response.data;
  },

  // Update a flock
  update: async (flockId: number, data: SheepFlockUpdate): Promise<SheepFlock> => {
    const response = await api.put(`/sheep-flocks/${flockId}`, data);
    return response.data;
  },

  // Delete (soft-delete) a flock
  delete: async (flockId: number): Promise<void> => {
    await api.delete(`/sheep-flocks/${flockId}`);
  },

  // Assign flock to a field
  assignToField: async (flockId: number, data: SheepFlockFieldAssignmentCreate): Promise<SheepFlockFieldAssignment> => {
    const response = await api.post(`/sheep-flocks/${flockId}/assign-field`, data);
    return response.data;
  },

  // Remove flock from current field
  removeFromField: async (flockId: number): Promise<void> => {
    await api.delete(`/sheep-flocks/${flockId}/field-assignment`);
  },

  // Get current assignment
  getCurrentAssignment: async (flockId: number): Promise<SheepFlockFieldAssignment | null> => {
    const response = await api.get(`/sheep-flocks/${flockId}/current-assignment`);
    return response.data;
  },

  // Get assignment history
  getAssignmentHistory: async (flockId: number): Promise<SheepFlockFieldAssignment[]> => {
    const response = await api.get(`/sheep-flocks/${flockId}/assignment-history`);
    return response.data;
  },
};

export default api;
