export type UserRole = 'public' | 'livery' | 'staff' | 'coach' | 'admin';

export interface User {
  id: number;
  username: string;
  email?: string;
  name: string;
  phone?: string;
  address_street?: string;
  address_town?: string;
  address_county?: string;
  address_postcode?: string;
  role: UserRole;
  is_yard_staff: boolean;
  must_change_password: boolean;
  is_active: boolean;
  created_at: string;
}

export interface UserUpdate {
  email?: string;
  name?: string;
  phone?: string;
  address_street?: string;
  address_town?: string;
  address_county?: string;
  address_postcode?: string;
}

export interface SiteSettings {
  id: number;
  venue_name: string;
  venue_tagline?: string;
  contact_email?: string;
  contact_phone?: string;
  // Structured address fields
  address_street?: string;
  address_town?: string;
  address_county?: string;
  address_postcode?: string;
  logo_url?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  gate_code?: string;
  key_safe_code?: string;
  security_info?: string;
  what3words?: string;
  theme_primary_color?: string;
  theme_accent_color?: string;
  theme_font_family?: string;
  theme_mode?: string;
  // Livery Billing Settings
  livery_billing_day?: number;  // Day of month for billing (1-28)
  // Livery Booking Rules (all optional - null means no limit)
  livery_max_future_hours_per_horse?: number;
  livery_max_booking_hours?: number;
  livery_min_advance_hours?: number;
  livery_max_advance_days?: number;
  livery_max_weekly_hours_per_horse?: number;
  livery_max_daily_hours_per_horse?: number;
  // Rugging guide matrix
  rugging_guide?: RuggingGuide;
  // SMS Notification Settings
  sms_enabled?: boolean;
  sms_provider?: string;
  sms_account_sid?: string;
  sms_auth_token?: string;
  sms_from_number?: string;
  sms_test_mode?: boolean;
  // Stripe Payment Settings
  stripe_enabled?: boolean;
  stripe_secret_key?: string;
  stripe_publishable_key?: string;
  stripe_webhook_secret?: string;
  // Application Configuration
  arena_booking_price_per_hour?: number;
  access_token_expire_minutes?: number;
  refresh_token_expire_days?: number;
  frontend_url?: string;
  // Demo Data Settings
  demo_data_enabled?: boolean;
  // Development Mode
  dev_mode?: boolean;
  // Turnout cutoff
  turnout_cutoff_date?: string;  // ISO date string
  // Scheduler Configuration
  scheduler_health_tasks_hour?: number;
  scheduler_health_tasks_minute?: number;
  scheduler_rollover_hour?: number;
  scheduler_rollover_minute?: number;
  scheduler_billing_day?: number;
  scheduler_billing_hour?: number;
  scheduler_billing_minute?: number;
  scheduler_backup_hour?: number;
  scheduler_backup_minute?: number;
  scheduler_cleanup_hour?: number;
  scheduler_cleanup_minute?: number;
  updated_at?: string;
}

export interface RuggingGuideEntry {
  unclipped: string;
  partial: string;
  fully_clipped: string;
}

export type TempRange = '15+' | '10-15' | '5-10' | '0-5' | '-5-0' | 'below-5';

export interface RuggingGuide {
  '15+': RuggingGuideEntry;
  '10-15': RuggingGuideEntry;
  '5-10': RuggingGuideEntry;
  '0-5': RuggingGuideEntry;
  '-5-0': RuggingGuideEntry;
  'below-5': RuggingGuideEntry;
}

export interface SiteSettingsUpdate {
  venue_name?: string;
  venue_tagline?: string;
  contact_email?: string;
  contact_phone?: string;
  // Structured address fields
  address_street?: string;
  address_town?: string;
  address_county?: string;
  address_postcode?: string;
  logo_url?: string;
  venue_latitude?: number;
  venue_longitude?: number;
  gate_code?: string;
  key_safe_code?: string;
  security_info?: string;
  what3words?: string;
  theme_primary_color?: string;
  theme_accent_color?: string;
  theme_font_family?: string;
  theme_mode?: string;
  // Livery Billing Settings
  livery_billing_day?: number;
  // Livery Booking Rules (all optional - null means no limit)
  livery_max_future_hours_per_horse?: number;
  livery_max_booking_hours?: number;
  livery_min_advance_hours?: number;
  livery_max_advance_days?: number;
  livery_max_weekly_hours_per_horse?: number;
  livery_max_daily_hours_per_horse?: number;
  // Rugging guide matrix
  rugging_guide?: RuggingGuide;
  // SMS Notification Settings
  sms_enabled?: boolean;
  sms_provider?: string;
  sms_account_sid?: string;
  sms_auth_token?: string;
  sms_from_number?: string;
  sms_test_mode?: boolean;
  // Stripe Payment Settings
  stripe_enabled?: boolean;
  stripe_secret_key?: string;
  stripe_publishable_key?: string;
  stripe_webhook_secret?: string;
  // Application Configuration
  arena_booking_price_per_hour?: number;
  access_token_expire_minutes?: number;
  refresh_token_expire_days?: number;
  frontend_url?: string;
  // Development Mode
  dev_mode?: boolean;
  // Scheduler Configuration
  scheduler_health_tasks_hour?: number;
  scheduler_health_tasks_minute?: number;
  scheduler_rollover_hour?: number;
  scheduler_rollover_minute?: number;
  scheduler_billing_day?: number;
  scheduler_billing_hour?: number;
  scheduler_billing_minute?: number;
  scheduler_backup_hour?: number;
  scheduler_backup_minute?: number;
  scheduler_cleanup_hour?: number;
  scheduler_cleanup_minute?: number;
}

// Weather types
export interface ForecastPeriod {
  temp_min: number;
  temp_max: number;
}

export interface WeatherForecast {
  overnight: ForecastPeriod;
  daytime: ForecastPeriod;
  weather_code: number;
  weather_description: string;
  timestamp: string;
}

export interface WeatherResponse {
  forecast: WeatherForecast;
  location_name?: string;
  cached: boolean;
}

export interface Arena {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  size?: string;
  surface_type?: string;
  price_per_hour?: number;
  has_lights: boolean;
  jumps_type?: string;
  free_for_livery: boolean;
  image_url?: string;
}

export type BookingType = 'public' | 'livery' | 'event' | 'maintenance' | 'training_clinic';
export type BookingStatus = 'confirmed' | 'pending' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'not_required';

export interface Booking {
  id: number;
  arena_id: number;
  user_id: number;
  horse_id?: number;
  booked_by_id?: number;
  title: string;
  description?: string;
  notes?: string;
  start_time: string;
  end_time: string;
  booking_type: BookingType;
  booking_status: BookingStatus;
  open_to_share: boolean;
  payment_status: PaymentStatus;
  created_at: string;
  user_name?: string;
  booked_by_name?: string;
  arena_name?: string;
  horse_name?: string;
  // Account creation info (for guest bookings)
  account_created?: boolean;
  temporary_password?: string;
  username?: string;
}

export interface BookingPublic {
  id: number;
  arena_id: number;
  start_time: string;
  end_time: string;
  booking_type: BookingType;
  booking_status: BookingStatus;
  open_to_share: boolean;
  title?: string;
}

export interface Horse {
  id: number;
  owner_id: number;
  name: string;
  passport_name?: string;
  colour?: string;
  birth_year?: number;
  feed_notes?: string;
  stable_id?: number;
  stable_name?: string;
  // Livery package assignment
  livery_package_id?: number;
  livery_start_date?: string;
  livery_end_date?: string;
  livery_package_name?: string;
  // Personality traits - Farrier
  farrier_friendly: boolean;
  farrier_notes?: string;
  // Personality traits - Dentist
  dentist_friendly: boolean;
  needs_sedation_dentist: boolean;
  dentist_notes?: string;
  // Personality traits - Clipping
  clipping_friendly: boolean;
  needs_sedation_clipping: boolean;
  clipping_notes?: string;
  // Personality traits - General handling
  kicks: boolean;
  bites: boolean;
  handling_notes?: string;
  // Personality traits - Loading & Catching
  loads_well: boolean;
  loading_notes?: string;
  difficult_to_catch: boolean;
  catching_notes?: string;
  // Personality traits - Vet
  vet_friendly: boolean;
  needle_shy: boolean;
  vet_notes?: string;
  // Personality traits - Tying & Sedation risks
  can_be_tied: boolean;
  tying_notes?: string;
  has_sedation_risk: boolean;
  sedation_notes?: string;
  // Personality traits - Headshyness
  headshy: boolean;
  headshy_notes?: string;
  // Turnout preferences
  turnout_alone?: boolean;
  turnout_notes?: string;
}

// ============== Emergency Contact Types ==============

export type ContactType = 'vet' | 'vet_backup' | 'farrier' | 'farrier_backup' | 'owner_backup' | 'insurance' | 'other';

export interface EmergencyContact {
  id: number;
  horse_id: number;
  contact_type: ContactType;
  name: string;
  phone: string;
  phone_alt?: string;
  email?: string;
  practice_name?: string;
  address?: string;
  available_24h: boolean;
  availability_notes?: string;
  is_primary: boolean;
  notes?: string;
  created_by_id: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface EmergencyContactCreate {
  contact_type: ContactType;
  name: string;
  phone: string;
  phone_alt?: string;
  email?: string;
  practice_name?: string;
  address?: string;
  available_24h?: boolean;
  availability_notes?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface EmergencyContactUpdate {
  contact_type?: ContactType;
  name?: string;
  phone?: string;
  phone_alt?: string;
  email?: string;
  practice_name?: string;
  address?: string;
  available_24h?: boolean;
  availability_notes?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface EmergencyContactSummary {
  horse_id: number;
  horse_name: string;
  primary_vet?: EmergencyContact;
  backup_vet?: EmergencyContact;
  primary_farrier?: EmergencyContact;
  backup_owner?: EmergencyContact;
  all_contacts: EmergencyContact[];
}

// ============== Stable Block Types ==============

export interface StableBlock {
  id: number;
  name: string;
  sequence: number;
  is_active: boolean;
}

export interface CreateStableBlockData {
  name: string;
  sequence?: number;
}

export interface UpdateStableBlockData {
  name?: string;
  sequence?: number;
  is_active?: boolean;
}

// ============== Stable Types ==============

export interface Stable {
  id: number;
  name: string;
  block_id?: number;
  number?: number;
  sequence: number;
  is_active: boolean;
  horse_count?: number;
  block?: StableBlock;
}

export interface CreateStableData {
  name: string;
  block_id?: number;
  number?: number;
  sequence?: number;
}

export interface UpdateStableData {
  name?: string;
  block_id?: number;
  number?: number;
  sequence?: number;
  is_active?: boolean;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  must_change_password: boolean;
  user_role: UserRole;
}

export interface CreateBookingData {
  arena_id: number;
  horse_id?: number;  // Required for livery bookings
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  booking_type?: BookingType;
  open_to_share?: boolean;
}

export interface CreateHorseData {
  name: string;
  owner_id?: number;  // Admin can specify owner
  passport_name?: string;
  colour?: string;
  birth_year?: number;
  feed_notes?: string;
  // Personality traits - Farrier
  farrier_friendly?: boolean;
  farrier_notes?: string;
  // Personality traits - Dentist
  dentist_friendly?: boolean;
  needs_sedation_dentist?: boolean;
  dentist_notes?: string;
  // Personality traits - Clipping
  clipping_friendly?: boolean;
  needs_sedation_clipping?: boolean;
  clipping_notes?: string;
  // Personality traits - General handling
  kicks?: boolean;
  bites?: boolean;
  handling_notes?: string;
  // Personality traits - Loading & Catching
  loads_well?: boolean;
  loading_notes?: string;
  difficult_to_catch?: boolean;
  catching_notes?: string;
  // Personality traits - Vet
  vet_friendly?: boolean;
  needle_shy?: boolean;
  vet_notes?: string;
  // Personality traits - Tying & Sedation risks
  can_be_tied?: boolean;
  tying_notes?: string;
  has_sedation_risk?: boolean;
  sedation_notes?: string;
  // Personality traits - Headshyness
  headshy?: boolean;
  headshy_notes?: string;
}

export interface CreateArenaData {
  name: string;
  description?: string;
  size?: string;
  surface_type?: string;
  price_per_hour?: number;
  has_lights?: boolean;
  jumps_type?: string;
  free_for_livery?: boolean;
  image_url?: string;
}

// Health Records
export type VaccineType = 'flu' | 'tetanus' | 'flu_tetanus' | 'other';

export interface FarrierRecord {
  id: number;
  horse_id: number;
  visit_date: string;
  farrier_name?: string;
  work_done: string;
  cost?: number;
  next_due?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DentistRecord {
  id: number;
  horse_id: number;
  visit_date: string;
  dentist_name?: string;
  treatment: string;
  cost?: number;
  next_due?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface VaccinationRecord {
  id: number;
  horse_id: number;
  vaccination_date: string;
  vaccine_type: VaccineType;
  vaccine_name?: string;
  batch_number?: string;
  administered_by?: string;
  next_due?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface WormingRecord {
  id: number;
  horse_id: number;
  treatment_date: string;
  product: string;
  worm_count_date?: string;
  worm_count_result?: number;
  next_due?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface HealthRecordsSummary {
  horse_id: number;
  horse_name: string;
  farrier_records: FarrierRecord[];
  dentist_records: DentistRecord[];
  vaccination_records: VaccinationRecord[];
  worming_records: WormingRecord[];
  next_farrier_due?: string;
  next_dentist_due?: string;
  next_vaccination_due?: string;
  next_worming_due?: string;
}

export interface CreateFarrierRecord {
  visit_date: string;
  farrier_name?: string;
  work_done: string;
  cost?: number;
  next_due?: string;
  notes?: string;
}

export interface CreateDentistRecord {
  visit_date: string;
  dentist_name?: string;
  treatment: string;
  cost?: number;
  next_due?: string;
  notes?: string;
}

export interface CreateVaccinationRecord {
  vaccination_date: string;
  vaccine_type: VaccineType;
  vaccine_name?: string;
  batch_number?: string;
  administered_by?: string;
  next_due?: string;
  notes?: string;
}

export interface CreateWormingRecord {
  treatment_date: string;
  product: string;
  worm_count_date?: string;
  worm_count_result?: number;
  next_due?: string;
  notes?: string;
}

// Feed Management
export type FeedTime = 'morning' | 'evening' | 'both';
export type SupplyStatus = 'adequate' | 'low' | 'critical';
export type AdditionStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface FeedRequirement {
  id: number;
  horse_id: number;
  morning_feed?: string;
  evening_feed?: string;
  supplements?: string;
  special_instructions?: string;
  supply_status: SupplyStatus;
  supply_notes?: string;
  updated_at: string;
  updated_by_id?: number;
}

export interface FeedAddition {
  id: number;
  horse_id: number;
  name: string;
  dosage: string;
  feed_time: FeedTime;
  start_date: string;
  end_date?: string;
  reason?: string;
  status: AdditionStatus;
  is_active: boolean;
  requested_by_id: number;
  approved_by_id?: number;
  created_at: string;
  updated_at: string;
  requested_by_name?: string;
}

export interface FeedSupplyAlert {
  id: number;
  horse_id: number;
  item: string;
  notes?: string;
  is_resolved: boolean;
  created_by_id: number;
  resolved_by_id?: number;
  created_at: string;
  resolved_at?: string;
  created_by_name?: string;
  horse_name?: string;
}

export interface RehabFeedMedication {
  task_id: number;
  program_id: number;
  program_name: string;
  task_type: string;
  description: string;
  feed_time?: string;  // morning, evening, both
  instructions?: string;
  frequency: string;
}

export interface FeedSummary {
  horse_id: number;
  horse_name: string;
  stable_id?: number;
  stable_name?: string;
  stable_sequence?: number;
  feed_requirement?: FeedRequirement;
  active_additions: FeedAddition[];
  pending_additions: FeedAddition[];
  unresolved_alerts: FeedSupplyAlert[];
  rehab_medications: RehabFeedMedication[];
}

export interface CreateFeedRequirement {
  morning_feed?: string;
  evening_feed?: string;
  supplements?: string;
  special_instructions?: string;
}

export interface UpdateFeedRequirement extends CreateFeedRequirement {
  supply_status?: SupplyStatus;
  supply_notes?: string;
}

export interface CreateFeedAddition {
  name: string;
  dosage: string;
  feed_time?: FeedTime;
  start_date: string;
  end_date?: string;
  reason?: string;
}

export interface CreateFeedAlert {
  item: string;
  notes?: string;
}

// Service Management
export type ServiceCategory = 'exercise' | 'schooling' | 'grooming' | 'third_party' | 'rehab';
export type RequestStatus = 'pending' | 'quoted' | 'approved' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type ChargeStatus = 'pending' | 'charged' | 'waived';
export type PreferredTime = 'morning' | 'afternoon' | 'evening' | 'any';
export type RecurringPattern = 'none' | 'daily' | 'weekdays' | 'custom';

export interface Service {
  id: string;
  category: ServiceCategory;
  name: string;
  description?: string;
  duration_minutes?: number;
  price_gbp: number;
  requires_approval: boolean;
  approval_reason?: string;
  advance_notice_hours: number;
  is_active: boolean;
  is_insurance_claimable: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceRequest {
  id: number;
  service_id: string;
  horse_id: number;
  requested_by_id: number;
  requested_date: string;
  preferred_time: PreferredTime;
  status: RequestStatus;
  assigned_to_id?: number;
  scheduled_datetime?: string;
  completed_datetime?: string;
  completed_by_id?: number;
  notes?: string;
  special_instructions?: string;
  // Quote fields
  quote_amount?: number;
  quote_notes?: string;
  quoted_at?: string;
  quoted_by_id?: number;
  quoted_by_name?: string;
  // Charge fields
  charge_amount?: number;
  charge_status: ChargeStatus;
  // Insurance tracking
  insurance_claimable: boolean;
  created_at: string;
  updated_at: string;
  // Extended fields populated by API
  service_name?: string;
  service_category?: string;
  service_price?: number;
  horse_name?: string;
  requested_by_name?: string;
  assigned_to_name?: string;
  // Rehab-specific fields
  rehab_program_id?: number;
  rehab_task_id?: number;
  rehab_program_name?: string;
  rehab_task_description?: string;
  // Recurring fields
  recurring_pattern: RecurringPattern;
  recurring_days?: string;
  recurring_end_date?: string;
  recurring_series_id?: number;
}

export interface CreateServiceRequest {
  service_id: string;
  horse_id: number;
  requested_date: string;
  preferred_time?: PreferredTime;
  special_instructions?: string;
}

export interface RehabAssistanceRequest {
  horse_id: number;
  rehab_program_id: number;
  start_date: string;  // First day of assistance
  end_date: string;    // Last day of assistance (same as start for single day)
  special_instructions?: string;
}

export interface MyServiceRequestsSummary {
  pending_requests: ServiceRequest[];  // Awaiting admin quote
  quoted_requests: ServiceRequest[];   // Have quote, awaiting approval
  scheduled_requests: ServiceRequest[];
  completed_requests: ServiceRequest[];
}

export interface StaffServiceRequestsSummary {
  pending_approval: ServiceRequest[];
  pending_scheduling: ServiceRequest[];
  scheduled_today: ServiceRequest[];
  completed: ServiceRequest[];
}

export interface CreateService {
  id: string;
  category: ServiceCategory;
  name: string;
  description?: string;
  duration_minutes?: number;
  price_gbp: number;
  requires_approval?: boolean;
  approval_reason?: string;
  advance_notice_hours?: number;
  is_active?: boolean;
  is_insurance_claimable?: boolean;
  notes?: string;
}

export interface UpdateService {
  name?: string;
  description?: string;
  duration_minutes?: number;
  price_gbp?: number;
  requires_approval?: boolean;
  approval_reason?: string;
  advance_notice_hours?: number;
  is_active?: boolean;
  is_insurance_claimable?: boolean;
  notes?: string;
}

// Noticeboard
export type NoticeCategory = 'general' | 'event' | 'maintenance' | 'health' | 'urgent' | 'social';
export type NoticePriority = 'low' | 'normal' | 'high';

export interface Notice {
  id: number;
  title: string;
  content: string;
  category: NoticeCategory;
  priority: NoticePriority;
  is_pinned: boolean;
  is_active: boolean;
  expires_at?: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  created_by_name?: string;
}

export interface NoticeListResponse {
  pinned: Notice[];
  notices: Notice[];
  total: number;
}

export interface CreateNotice {
  title: string;
  content: string;
  category?: NoticeCategory;
  priority?: NoticePriority;
  is_pinned?: boolean;
  expires_at?: string;
}

// Enum option interface used by various features
export interface EnumOption {
  value: string;
  label: string;
}

// Professional Directory
export type ProfessionalCategory = 'farrier' | 'vet' | 'dentist' | 'physio' | 'chiropractor' | 'saddler' | 'nutritionist' | 'instructor' | 'transporter' | 'feed_store' | 'other';

export interface Professional {
  id: number;
  category: ProfessionalCategory;
  business_name: string;
  contact_name?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  address?: string;
  coverage_area?: string;
  services?: string;
  specialties?: string;
  qualifications?: string;
  typical_rates?: string;
  booking_notes?: string;
  yard_recommended: boolean;
  yard_notes?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProfessionalCategoryInfo {
  value: string;
  label: string;
  count: number;
}

export interface ProfessionalDirectoryResponse {
  categories: ProfessionalCategoryInfo[];
  professionals: Professional[];
  total: number;
}

export interface CreateProfessional {
  category: ProfessionalCategory;
  business_name: string;
  contact_name?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  website?: string;
  address?: string;
  coverage_area?: string;
  services?: string;
  specialties?: string;
  qualifications?: string;
  typical_rates?: string;
  booking_notes?: string;
  yard_recommended?: boolean;
  yard_notes?: string;
}

// Task Management
export type TaskCategory = 'maintenance' | 'repairs' | 'cleaning' | 'feeding' | 'turnout' | 'health' | 'admin' | 'safety' | 'livery_service' | 'other';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'custom';
export type AssignmentType = 'specific' | 'pool' | 'backlog';
export type HealthTaskType = 'medication' | 'wound_care' | 'health_check' | 'rehab_exercise';

export interface YardTask {
  id: number;
  title: string;
  description?: string;
  category: TaskCategory;
  priority: TaskPriority;
  location?: string;
  reported_by_id: number;
  reported_date: string;
  assignment_type: AssignmentType;
  assigned_to_id?: number;
  scheduled_date?: string;
  status: TaskStatus;
  completed_date?: string;
  completed_by_id?: number;
  completion_notes?: string;
  estimated_cost?: number;
  is_maintenance_day_task: boolean;
  is_recurring: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_days?: string;
  parent_task_id?: number;
  service_request_id?: number;
  service_billable_amount?: number;
  created_at: string;
  updated_at: string;
  reported_by_name?: string;
  assigned_to_name?: string;
  completed_by_name?: string;
  comment_count?: number;
  // Health task fields
  health_task_type?: HealthTaskType;
  horse_id?: number;
  horse_name?: string;
  feed_addition_id?: number;
  wound_care_log_id?: number;
  rehab_task_id?: number;
  rehab_program_id?: number;
  feed_time?: string;
  health_record_id?: number;
  health_record_type?: string;
  // Additional health info for display
  medication_name?: string;
  medication_dosage?: string;
  wound_name?: string;
  wound_location?: string;
  rehab_program_name?: string;
  rehab_task_description?: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  user_id: number;
  content: string;
  created_at: string;
  user_name?: string;
}

export interface YardTaskDetail extends YardTask {
  comments: TaskComment[];
}

export interface CreateYardTask {
  title: string;
  description?: string;
  category: TaskCategory;
  priority?: TaskPriority;
  location?: string;
  assignment_type?: AssignmentType;
  assigned_to_id?: number;
  scheduled_date?: string;
  estimated_cost?: number;
  is_maintenance_day_task?: boolean;
  is_recurring?: boolean;
  recurrence_type?: RecurrenceType;
  recurrence_days?: string;
}

export interface UpdateYardTask {
  title?: string;
  description?: string;
  category?: TaskCategory;
  priority?: TaskPriority;
  location?: string;
  assignment_type?: AssignmentType;
  assigned_to_id?: number;
  scheduled_date?: string;
  estimated_cost?: number;
  is_maintenance_day_task?: boolean;
  status?: TaskStatus;
  completion_notes?: string;
}

export interface MaintenanceDayAssign {
  task_ids: number[];
  assigned_to_id: number;
  scheduled_date: string;
}

export interface TasksListResponse {
  open_tasks: YardTask[];
  my_tasks: YardTask[];
  today_tasks: YardTask[];
  pool_tasks: YardTask[];
  backlog_tasks: YardTask[];
  completed_tasks: YardTask[];
  scheduled_tasks: YardTask[];
}

export interface TasksSummary {
  total_open: number;
  urgent_count: number;
  high_priority_count: number;
  overdue_count: number;
  my_assigned_count: number;
  today_count: number;
}

export interface TaskEnums {
  categories: EnumOption[];
  priorities: EnumOption[];
  statuses: EnumOption[];
  recurrence_types: EnumOption[];
  assignment_types: EnumOption[];
}

// Staff Management
export type ShiftType = 'morning' | 'afternoon' | 'full_day';
export type ShiftRole = 'yard_duties' | 'office' | 'events' | 'teaching' | 'maintenance' | 'other';
export type WorkType = 'yard_duties' | 'yard_maintenance' | 'office' | 'events' | 'other';
export type TimesheetStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type LeaveType = 'annual' | 'unpaid' | 'toil' | 'extended';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Shift {
  id: number;
  staff_id: number;
  date: string;
  shift_type: ShiftType;
  role: ShiftRole;
  notes?: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  staff_name?: string;
  created_by_name?: string;
}

export interface CreateShift {
  staff_id: number;
  date: string;
  shift_type?: ShiftType;
  role?: ShiftRole;
  notes?: string;
}

export interface UpdateShift {
  date?: string;
  shift_type?: ShiftType;
  role?: ShiftRole;
  notes?: string;
}

export interface ShiftsListResponse {
  shifts: Shift[];
  total: number;
}

export interface Timesheet {
  id: number;
  staff_id: number;
  date: string;
  clock_in: string;
  clock_out?: string;
  lunch_start?: string;
  lunch_end?: string;
  break_minutes: number;
  work_type: WorkType;
  notes?: string;
  logged_by_id?: number;
  status: TimesheetStatus;
  submitted_at?: string;
  approved_by_id?: number;
  approved_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  staff_name?: string;
  logged_by_name?: string;
  approved_by_name?: string;
  total_hours?: number;
}

export interface CreateTimesheet {
  date: string;
  clock_in: string;
  clock_out?: string;
  lunch_start?: string;
  lunch_end?: string;
  break_minutes?: number;
  work_type?: WorkType;
  notes?: string;
}

export interface AdminCreateTimesheet extends CreateTimesheet {
  staff_id: number;
}

export interface UpdateTimesheet {
  clock_in?: string;
  clock_out?: string;
  lunch_start?: string;
  lunch_end?: string;
  break_minutes?: number;
  work_type?: WorkType;
  notes?: string;
}

export interface TimesheetsListResponse {
  timesheets: Timesheet[];
  total: number;
}

export interface HolidayRequest {
  id: number;
  staff_id: number;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  days_requested: number;
  reason?: string;
  status: LeaveStatus;
  approved_by_id?: number;
  approval_date?: string;
  approval_notes?: string;
  created_at: string;
  updated_at: string;
  staff_name?: string;
  approved_by_name?: string;
}

export interface CreateHolidayRequest {
  start_date: string;
  end_date: string;
  leave_type?: LeaveType;
  days_requested: number;
  reason?: string;
}

export interface UpdateHolidayRequest {
  start_date?: string;
  end_date?: string;
  leave_type?: LeaveType;
  days_requested?: number;
  reason?: string;
}

export interface HolidayRequestsListResponse {
  pending: HolidayRequest[];
  approved: HolidayRequest[];
  rejected: HolidayRequest[];
}

export type AbsenceReason = 'sickness' | 'no_show' | 'personal_emergency' | 'family_emergency' | 'hangover' | 'other';

export interface SickLeaveRecord {
  id: number;
  staff_id: number;
  date: string;
  reported_time?: string;
  reported_to_id?: number;
  reason?: AbsenceReason;
  expected_return?: string;
  actual_return?: string;
  notes?: string;
  has_fit_note: boolean;
  fit_note_start?: string;
  fit_note_end?: string;
  created_at: string;
  updated_at: string;
  staff_name?: string;
  reported_to_name?: string;
}

export interface CreateSickLeave {
  staff_id: number;
  date: string;
  reported_time?: string;
  reason?: AbsenceReason;
  expected_return?: string;
  notes?: string;
}

export interface UpdateSickLeave {
  expected_return?: string;
  actual_return?: string;
  notes?: string;
  has_fit_note?: boolean;
  fit_note_start?: string;
  fit_note_end?: string;
}

export interface SickLeaveListResponse {
  records: SickLeaveRecord[];
  total: number;
}

export interface ManagerDashboard {
  pending_timesheets: number;
  pending_holiday_requests: number;
  staff_on_leave_today: number;
  staff_absent_today: number;
  shifts_today: number;
}

export interface StaffManagementEnums {
  shift_types: EnumOption[];
  shift_roles: EnumOption[];
  work_types: EnumOption[];
  timesheet_statuses: EnumOption[];
  leave_types: EnumOption[];
  leave_statuses: EnumOption[];
}

// Training Clinics
export type Discipline = 'dressage' | 'show_jumping' | 'cross_country' | 'eventing' | 'flatwork' | 'polework' | 'hacking' | 'groundwork' | 'lunging' | 'natural_horsemanship' | 'other';
// ClinicDuration removed - start/end times are sufficient
export type LessonFormat = 'private' | 'semi_private' | 'group' | 'mixed';
export type ClinicStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'cancelled' | 'completed';

export interface ClinicRequest {
  id: number;
  coach_name: string;
  coach_email: string;
  coach_phone?: string;
  coach_bio?: string;
  discipline: Discipline;
  title?: string;
  description?: string;
  proposed_date: string;
  proposed_end_date?: string;
  proposed_start_time?: string;
  proposed_end_time?: string;
  arena_required?: string;
  lesson_format: LessonFormat;
  lesson_duration_minutes?: number;
  max_participants?: number;
  max_group_size?: number;  // Max riders per group slot
  // Fee structure - Coach sets their rate, Admin adds venue fee
  coach_fee_private?: number;  // Coach rate for private lesson
  coach_fee_group?: number;  // Coach rate per person for group
  venue_fee_private?: number;  // Venue fee for private (admin sets)
  venue_fee_group?: number;  // Venue fee per person for group (admin sets)
  livery_venue_fee_private?: number;  // Reduced venue fee for livery users
  livery_venue_fee_group?: number;  // Reduced venue fee for livery users
  special_requirements?: string;
  status: ClinicStatus;
  proposed_by_id?: number;
  reviewed_by_id?: number;
  reviewed_at?: string;
  review_notes?: string;
  rejection_reason?: string;
  booking_id?: number;
  notice_id?: number;
  created_at: string;
  updated_at: string;
  proposed_by_name?: string;
  reviewed_by_name?: string;
  participant_count?: number;
}

export interface CreateClinicRequest {
  coach_name: string;
  coach_email: string;
  coach_phone?: string;
  coach_bio?: string;
  discipline: Discipline;
  title?: string;
  description?: string;
  proposed_date: string;
  proposed_end_date?: string;
  proposed_start_time?: string;
  proposed_end_time?: string;
  arena_required?: string;
  lesson_format?: LessonFormat;
  lesson_duration_minutes?: number;
  max_participants?: number;
  max_group_size?: number;
  // Coach sets their rate
  coach_fee_private?: number;
  coach_fee_group?: number;
  special_requirements?: string;
}

export interface UpdateClinicRequest {
  coach_name?: string;
  coach_email?: string;
  coach_phone?: string;
  coach_bio?: string;
  discipline?: Discipline;
  title?: string;
  description?: string;
  proposed_date?: string;
  proposed_end_date?: string;
  proposed_start_time?: string;
  proposed_end_time?: string;
  arena_required?: string;
  lesson_format?: LessonFormat;
  lesson_duration_minutes?: number;
  max_participants?: number;
  max_group_size?: number;
  // Fee structure
  coach_fee_private?: number;
  coach_fee_group?: number;
  venue_fee_private?: number;
  venue_fee_group?: number;
  livery_venue_fee_private?: number;
  livery_venue_fee_group?: number;
  special_requirements?: string;
}

export interface ClinicParticipant {
  id: number;
  clinic_id: number;
  user_id?: number;
  slot_id?: number;
  horse_id?: number;
  participant_name?: string;
  participant_email?: string;
  participant_phone?: string;
  lesson_time?: string;
  preferred_lesson_type?: 'private' | 'group';
  notes?: string;
  is_confirmed: boolean;
  slot_notified_at?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  horse_name?: string;
  // Slot info when assigned
  slot_start_time?: string;
  slot_end_time?: string;
  slot_group_name?: string;
  slot_arena_name?: string;
}

export interface CreateClinicParticipant {
  horse_id?: number;
  participant_name?: string;
  participant_email?: string;
  participant_phone?: string;
  lesson_time?: string;
  preferred_lesson_type?: 'private' | 'group';
  notes?: string;
}

export interface UpdateClinicParticipant {
  slot_id?: number | null;
  is_confirmed?: boolean;
  notes?: string;
}

// Clinic Slot Types
export interface ClinicSlot {
  id: number;
  clinic_id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  group_name?: string;
  description?: string;
  arena_id?: number;
  is_group_slot: boolean;  // True for group lessons (multiple riders)
  max_participants?: number;
  sequence: number;
  created_at: string;
  updated_at: string;
  arena_name?: string;
  participant_count: number;
}

export interface ClinicSlotWithParticipants extends ClinicSlot {
  participants: ClinicParticipant[];
}

export interface CreateClinicSlot {
  slot_date: string;
  start_time: string;
  end_time: string;
  group_name?: string;
  description?: string;
  arena_id?: number;
  is_group_slot?: boolean;
  max_participants?: number;
  sequence?: number;
}

export interface UpdateClinicSlot {
  slot_date?: string;
  start_time?: string;
  end_time?: string;
  group_name?: string;
  description?: string;
  arena_id?: number | null;
  is_group_slot?: boolean;
  max_participants?: number | null;
  sequence?: number;
}

// User's clinic registration with slot info
export interface MyClinicRegistration {
  id: number;
  clinic_id: number;
  clinic_title: string;
  clinic_date: string;
  discipline?: string;
  coach_name: string;
  status?: string;
  is_confirmed: boolean;
  notes?: string;
  horse_name?: string;
  slot_id?: number;
  slot_date?: string;
  slot_start_time?: string;
  slot_end_time?: string;
  slot_group_name?: string;
  slot_arena_name?: string;
}

export interface ClinicRequestDetail extends ClinicRequest {
  participants: ClinicParticipant[];
  slots: ClinicSlotWithParticipants[];
}

export interface ClinicsListResponse {
  pending: ClinicRequest[];
  approved: ClinicRequest[];
  past: ClinicRequest[];
}

export interface PublicClinicsResponse {
  upcoming: ClinicRequest[];
  past: ClinicRequest[];
}

export interface SocialShareLinks {
  facebook: string;
  twitter: string;
  whatsapp: string;
  copy_text: string;
}

export interface ConflictInfo {
  has_conflicts: boolean;
  conflicting_bookings: Record<string, unknown>[];
}

export interface ClinicEnums {
  disciplines: EnumOption[];
  lesson_formats: EnumOption[];
  statuses: EnumOption[];
}

// Payment Types
export interface StripeConfig {
  publishable_key: string;
  is_configured: boolean;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
}

export interface PaymentStatusResponse {
  booking_id: number;
  payment_status: string;
  payment_ref?: string;
}

// Livery Packages
export interface LiveryPackage {
  id: number;
  name: string;
  price_display: string;
  monthly_price?: number;  // Actual monthly billing amount
  weekly_price?: number;   // For weekly billing type (holiday livery)
  billing_type?: 'monthly' | 'weekly';  // Billing frequency
  description?: string;
  features?: string[];
  additional_note?: string;
  is_featured: boolean;
  display_order: number;
  is_active: boolean;
  is_insurance_claimable: boolean;  // For rehab livery packages
  created_at: string;
  updated_at: string;
}

export interface CreateLiveryPackage {
  name: string;
  price_display: string;
  monthly_price?: number;
  description?: string;
  features?: string[];
  additional_note?: string;
  is_featured?: boolean;
  display_order?: number;
  is_active?: boolean;
  is_insurance_claimable?: boolean;
}

export interface UpdateLiveryPackage {
  name?: string;
  price_display?: string;
  monthly_price?: number;
  description?: string;
  features?: string[];
  additional_note?: string;
  is_featured?: boolean;
  display_order?: number;
  is_active?: boolean;
  is_insurance_claimable?: boolean;
}

// ============== Compliance Calendar Types ==============

export type ComplianceCategory = 'insurance' | 'fire_safety' | 'electrical' | 'equipment' | 'first_aid' | 'health_safety' | 'other';

export interface ComplianceItem {
  id: number;
  name: string;
  category: ComplianceCategory;
  description?: string;
  reference_number?: string;
  provider?: string;
  renewal_frequency_months: number;
  last_completed_date?: string;
  next_due_date?: string;
  reminder_days_before: number;
  responsible_user_id?: number;
  responsible_user_name?: string;
  certificate_url?: string;
  notes?: string;
  is_active: boolean;
  is_overdue: boolean;
  days_until_due?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateComplianceItem {
  name: string;
  category: ComplianceCategory;
  description?: string;
  reference_number?: string;
  provider?: string;
  renewal_frequency_months?: number;
  next_due_date?: string;
  reminder_days_before?: number;
  responsible_user_id?: number;
  notes?: string;
}

export interface UpdateComplianceItem {
  name?: string;
  category?: ComplianceCategory;
  description?: string;
  reference_number?: string;
  provider?: string;
  renewal_frequency_months?: number;
  next_due_date?: string;
  reminder_days_before?: number;
  responsible_user_id?: number;
  certificate_url?: string;
  notes?: string;
  is_active?: boolean;
}

export interface ComplianceHistory {
  id: number;
  compliance_item_id: number;
  completed_date: string;
  completed_by_id?: number;
  completed_by_name?: string;
  certificate_url?: string;
  notes?: string;
  cost?: number;
  created_at?: string;
}

export interface CompleteComplianceItem {
  completed_date: string;
  certificate_url?: string;
  notes?: string;
  cost?: number;
}

export interface ComplianceDashboard {
  total_items: number;
  overdue_count: number;
  due_soon_count: number;
  up_to_date_count: number;
  overdue_items: ComplianceItem[];
  due_soon_items: ComplianceItem[];
}

// Arena Usage Report Types
export interface BookingTypeUsage {
  booking_type: string;
  label: string;
  total_hours: number;
  booking_count: number;
}

export interface ArenaUsageSummary {
  arena_id: number;
  arena_name: string;
  total_hours: number;
  usage_by_type: BookingTypeUsage[];
}

export interface PeriodUsageReport {
  period_label: string;
  start_date: string;
  end_date: string;
  total_hours: number;
  arena_summaries: ArenaUsageSummary[];
}

export interface ArenaUsageReport {
  previous_month: PeriodUsageReport;
  previous_quarter: PeriodUsageReport;
  previous_year: PeriodUsageReport;
}

// Turnout Requests
export type TurnoutStatus = 'pending' | 'approved' | 'declined';
export type TurnoutType = 'out' | 'in';

export interface TurnoutRequest {
  id: number;
  horse_id: number;
  requested_by_id: number;
  request_date: string;
  turnout_type: TurnoutType;
  field_preference?: string;
  notes?: string;
  status: TurnoutStatus;
  reviewed_by_id?: number;
  reviewed_at?: string;
  response_message?: string;
  created_at: string;
  updated_at: string;
  horse_name?: string;
  requested_by_name?: string;
  reviewed_by_name?: string;
  stable_name?: string;
}

export interface CreateTurnoutRequest {
  horse_id: number;
  request_date: string;
  turnout_type?: TurnoutType;
  field_preference?: string;
  notes?: string;
}

export interface UpdateTurnoutRequest {
  turnout_type?: TurnoutType;
  field_preference?: string;
  notes?: string;
}

export interface TurnoutReviewRequest {
  status: TurnoutStatus;
  response_message?: string;
}

export interface DailyTurnoutSummary {
  date: string;
  turning_out: TurnoutRequest[];
  staying_in: TurnoutRequest[];
  pending: TurnoutRequest[];
  no_request_horses: {
    id: number;
    name: string;
    stable_name?: string;
    owner_name?: string;
  }[];
}

export interface TurnoutEnums {
  statuses: EnumOption[];
  types: EnumOption[];
}

// Account & Billing
export type TransactionType = 'package_charge' | 'service_charge' | 'payment' | 'credit' | 'adjustment';

export interface LedgerEntry {
  id: number;
  user_id: number;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  notes?: string;
  service_request_id?: number;
  livery_package_id?: number;
  period_start?: string;
  period_end?: string;
  transaction_date: string;
  created_by_id: number;
  created_at: string;
  user_name?: string;
  created_by_name?: string;
  service_description?: string;
  package_name?: string;
}

export interface CreateLedgerEntry {
  user_id: number;
  transaction_type: TransactionType;
  amount: number;
  description: string;
  notes?: string;
  service_request_id?: number;
  livery_package_id?: number;
  period_start?: string;
  period_end?: string;
  transaction_date?: string;
}

export interface AccountBalance {
  user_id: number;
  user_name: string;
  balance: number;
  total_charges: number;
  total_payments: number;
}

export interface AccountSummary {
  balance: AccountBalance;
  recent_transactions: LedgerEntry[];
  pending_service_charges: number;
  last_invoice_date: string | null;
  current_period_start: string | null;
}

export interface UserAccountSummary {
  user_id: number;
  user_name: string;
  balance: number;
  transaction_count: number;
}

export interface TransactionEnums {
  types: EnumOption[];
}

// Backup types
export interface Backup {
  id: number;
  filename: string;
  backup_date: string;
  file_size?: number;
  entity_counts?: Record<string, number>;
  storage_location: string;
  s3_url?: string;
  notes?: string;
  created_by_id?: number;
  created_by_name?: string;
}

export interface BackupCreate {
  notes?: string;
}

export interface BackupListResponse {
  backups: Backup[];
  total: number;
}

export interface BackupSchedule {
  id: number;
  is_enabled: boolean;
  frequency: string;
  retention_days: number;
  s3_enabled: boolean;
  last_run?: string;
  next_run?: string;
  created_at: string;
  updated_at: string;
}

export interface BackupScheduleUpdate {
  is_enabled: boolean;
  frequency: string;
  retention_days: number;
  s3_enabled: boolean;
}

export interface BackupValidationResult {
  is_valid: boolean;
  entity_counts?: Record<string, number>;
  errors: string[];
  warnings: string[];
}

export interface BackupImportResult {
  message: string;
  entity_counts: Record<string, number>;
  warnings: string[];
  logs: string[];
}

// ============== Ad-Hoc Lessons ==============

export type AvailabilityMode = 'recurring' | 'specific' | 'always';
export type BookingMode = 'auto_accept' | 'request_first';
export type LessonRequestStatus = 'pending' | 'accepted' | 'declined' | 'confirmed' | 'cancelled' | 'completed';

export interface RecurringSchedule {
  id: number;
  day_of_week: number;  // 0-6 (Monday-Sunday)
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export interface AvailabilitySlot {
  id: number;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  created_at: string;
}

export interface CoachProfile {
  id: number;
  user_id: number;
  disciplines?: string[];
  arena_id?: number;
  teaching_description?: string;
  bio?: string;
  availability_mode: AvailabilityMode;
  booking_mode: BookingMode;
  lesson_duration_minutes: number;
  coach_fee: number;
  venue_fee?: number;
  livery_venue_fee?: number;
  is_active: boolean;
  approved_by_id?: number;
  approved_at?: string;
  created_at: string;
  updated_at: string;
  coach_name?: string;
  coach_email?: string;
  total_price?: number;
  livery_total_price?: number;
  arena_name?: string;
  recurring_schedules?: RecurringSchedule[];
  availability_slots?: AvailabilitySlot[];
}

export interface CreateCoachProfile {
  disciplines?: string[];
  arena_id?: number;
  teaching_description?: string;
  bio?: string;
  availability_mode?: AvailabilityMode;
  booking_mode?: BookingMode;
  lesson_duration_minutes?: number;
  coach_fee: number;
}

export interface UpdateCoachProfile {
  disciplines?: string[];
  arena_id?: number;
  teaching_description?: string;
  bio?: string;
  availability_mode?: AvailabilityMode;
  booking_mode?: BookingMode;
  lesson_duration_minutes?: number;
  coach_fee?: number;
}

export interface LessonRequest {
  id: number;
  coach_profile_id: number;
  user_id: number;
  horse_id?: number;
  requested_date: string;
  requested_time?: string;
  alternative_dates?: string;
  discipline?: string;
  notes?: string;
  coach_fee: number;
  venue_fee: number;
  total_price: number;
  confirmed_date?: string;
  confirmed_start_time?: string;
  confirmed_end_time?: string;
  arena_id?: number;
  status: LessonRequestStatus;
  coach_response?: string;
  declined_reason?: string;
  payment_status: PaymentStatus;
  payment_ref?: string;
  created_at: string;
  updated_at: string;
  responded_at?: string;
  coach_name?: string;
  user_name?: string;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  horse_name?: string;
  arena_name?: string;
}

export interface CreateLessonRequest {
  coach_profile_id: number;
  horse_id?: number;
  requested_date: string;
  requested_time?: string;
  alternative_dates?: string;
  discipline?: Discipline;
  notes?: string;
  // Guest booking fields
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
}

export interface CreateLessonBook {
  coach_profile_id: number;
  slot_id?: number;
  arena_id?: number;
  horse_id?: number;
  requested_date: string;
  requested_time: string;
  discipline?: Discipline;
  notes?: string;
  // Guest booking fields
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
}

export interface LessonEnums {
  disciplines: EnumOption[];
  availability_modes: EnumOption[];
  booking_modes: EnumOption[];
  statuses: EnumOption[];
}

export interface CoachAvailability {
  coach_profile_id: number;
  availability_mode: AvailabilityMode;
  booking_mode: BookingMode;
  lesson_duration_minutes: number;
  recurring_schedules: RecurringSchedule[];
  available_slots: AvailabilitySlot[];
  generated_slots: AvailabilitySlot[];
}

// Coach availability for calendar display (non-blocking visual indicator)
export interface CoachCalendarSlot {
  coach_profile_id: number;
  coach_name: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  is_recurring: boolean;
}

export interface CalendarAvailabilityResponse {
  slots: CoachCalendarSlot[];
}

// Combined availability for lesson booking
export interface ArenaBookingInfo {
  arena_id: number;
  arena_name: string;
  start_time: string;
  end_time: string;
  booking_type: string;
}

export interface TimeSlotAvailability {
  slot_date: string;
  start_time: string;
  end_time: string;
  is_coach_available: boolean;
  arena_bookings: ArenaBookingInfo[];
}

export interface CombinedAvailabilityResponse {
  coach_profile_id: number;
  coach_name: string;
  lesson_duration_minutes: number;
  availability_mode: string;
  arenas: { id: number; name: string }[];
  time_slots: TimeSlotAvailability[];
}

// ============== Field Management Types ==============

export type FieldCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'resting';
export type CompanionRelationship = 'preferred' | 'compatible' | 'incompatible';

export interface Field {
  id: number;
  name: string;
  description?: string;
  max_horses?: number;
  size_acres?: number;
  current_condition: FieldCondition;
  condition_notes?: string;
  last_condition_update?: string;
  is_resting: boolean;
  rest_start_date?: string;
  rest_end_date?: string;
  has_shelter: boolean;
  has_water: boolean;
  is_electric_fenced: boolean;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateField {
  name: string;
  description?: string;
  max_horses?: number;
  size_acres?: number;
  current_condition?: FieldCondition;
  has_shelter?: boolean;
  has_water?: boolean;
  is_electric_fenced?: boolean;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateField {
  name?: string;
  description?: string;
  max_horses?: number;
  size_acres?: number;
  has_shelter?: boolean;
  has_water?: boolean;
  is_electric_fenced?: boolean;
  is_active?: boolean;
  display_order?: number;
}

export interface FieldConditionUpdate {
  current_condition: FieldCondition;
  condition_notes?: string;
}

export interface FieldRestPeriod {
  rest_start_date: string;
  rest_end_date?: string;
}

export interface HorseCompanion {
  id: number;
  horse_id: number;
  companion_horse_id: number;
  relationship_type: CompanionRelationship;
  notes?: string;
  created_by_id: number;
  created_at: string;
  horse_name?: string;
  companion_horse_name?: string;
  created_by_name?: string;
}

export interface CreateHorseCompanion {
  companion_horse_id: number;
  relationship_type: CompanionRelationship;
  notes?: string;
}

export interface TurnoutGroup {
  id: number;
  turnout_date: string;
  field_id: number;
  notes?: string;
  assigned_by_id: number;
  created_at: string;
  field_name?: string;
  assigned_by_name?: string;
  horses: TurnoutGroupHorse[];
}

export interface TurnoutGroupHorse {
  id: number;
  group_id: number;
  horse_id: number;
  turned_out_at?: string;
  brought_in_at?: string;
  turned_out_by_id?: number;
  brought_in_by_id?: number;
  horse_name?: string;
  stable_name?: string;
  turned_out_by_name?: string;
  brought_in_by_name?: string;
}

export interface CreateTurnoutGroup {
  turnout_date: string;
  field_id: number;
  horse_ids: number[];
  notes?: string;
}

export interface FieldEnums {
  conditions: EnumOption[];
  relationships: EnumOption[];
}

// ============== Medication Logging Types ==============

export type HealingStatus = 'improving' | 'stable' | 'worsening' | 'infected' | 'healed';
export type AppetiteStatus = 'normal' | 'reduced' | 'not_eating' | 'increased';
export type DemeanorStatus = 'bright' | 'quiet' | 'lethargic' | 'agitated';
export type RehabStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
export type TaskFrequency = 'daily' | 'twice_daily' | 'every_other_day' | 'weekly' | 'as_needed';

export interface MedicationDue {
  id: number;
  horse_id: number;
  horse_name: string;
  stable_name?: string;
  feed_addition_id: number;
  item_name: string;
  quantity?: string;
  instructions?: string;
  feed_time: FeedTime;
  was_given?: boolean | null;
  skip_reason?: string;
  given_by_name?: string;
}

export interface MedicationAdminLog {
  id: number;
  feed_addition_id: number;
  horse_id: number;
  admin_date: string;
  feed_time: FeedTime;
  was_given: boolean;
  skip_reason?: string;
  given_by_id: number;
  given_at?: string;
  notes?: string;
  horse_name?: string;
  medication_name?: string;
  given_by_name?: string;
}

export interface CreateMedicationLog {
  feed_addition_id: number;
  admin_date: string;
  feed_time: FeedTime;
  was_given: boolean;
  skip_reason?: string;
  notes?: string;
}

export interface WoundCareLog {
  id: number;
  horse_id: number;
  wound_name: string;
  wound_location?: string;
  wound_description?: string;
  treatment_date: string;
  treatment_time?: string;
  treatment_given: string;
  products_used?: string;
  healing_assessment?: HealingStatus;
  assessment_notes?: string;
  next_treatment_due?: string;
  treated_by_id: number;
  created_at: string;
  is_resolved: boolean;
  resolved_date?: string;
  horse_name?: string;
  treated_by_name?: string;
}

export interface CreateWoundCareLog {
  wound_name: string;
  wound_location?: string;
  wound_description?: string;
  treatment_given: string;
  products_used?: string;
  healing_assessment: HealingStatus;
  assessment_notes?: string;
  next_treatment_due?: string;
}

export interface ActiveWoundSummary {
  id: number;
  horse_id: number;
  horse_name: string;
  wound_name: string;
  wound_location?: string;
  wound_description?: string;
  last_assessment?: HealingStatus;
  next_treatment_due?: string;
  last_treatment_date?: string;
  treatment_count?: number;
}

export interface HealthObservation {
  id: number;
  horse_id: number;
  observation_date: string;
  observation_time?: string;
  temperature?: number;
  appetite?: AppetiteStatus;
  demeanor?: DemeanorStatus;
  droppings_normal?: boolean;
  concerns?: string;
  action_taken?: string;
  vet_notified: boolean;
  observed_by_id: number;
  created_at: string;
  horse_name?: string;
  observed_by_name?: string;
}

export interface CreateHealthObservation {
  appetite: AppetiteStatus;
  demeanor: DemeanorStatus;
  droppings_normal: boolean;
  temperature?: number;
  concerns?: string;
  action_taken?: string;
  vet_notified?: boolean;
}

// ============== Rehab Program Types ==============

export interface RehabProgram {
  id: number;
  horse_id: number;
  name: string;
  description?: string;
  reason?: string;
  prescribed_by?: string;
  prescription_date?: string;
  start_date: string;
  expected_end_date?: string;
  actual_end_date?: string;
  status: RehabStatus;
  current_phase: number;
  total_phases?: number;
  completed_phases?: number;
  notes?: string;
  staff_managed: boolean;  // When true, all tasks handled by staff
  weekly_care_price?: number;  // Weekly supplement charge for staff-managed care
  created_by_id: number;
  created_at: string;
  updated_at: string;
  horse_name?: string;
  created_by_name?: string;
  phases?: RehabPhase[];
}

export interface RehabPhase {
  id: number;
  program_id: number;
  phase_number: number;
  name: string;
  description?: string;
  duration_days: number;
  start_day: number;
  is_completed: boolean;
  completed_date?: string;
  completion_notes?: string;
  created_at: string;
  tasks?: RehabTask[];
}

export interface RehabTask {
  id: number;
  phase_id: number;
  task_type: string;
  description: string;
  duration_minutes?: number;
  frequency: TaskFrequency;
  instructions?: string;
  equipment_needed?: string;
  is_feed_based: boolean;
  feed_time?: string;  // morning, evening, both
  sequence: number;
  created_at: string;
}

export interface CreateRehabProgram {
  horse_id: number;
  name: string;
  description?: string;
  reason?: string;
  prescribed_by?: string;
  prescription_date?: string;
  start_date: string;
  expected_end_date?: string;
  notes?: string;
  staff_managed?: boolean;  // When true, all tasks handled by staff
  weekly_care_price?: number;  // Weekly supplement charge for staff-managed care
  phases: CreateRehabPhase[];
}

export interface CreateRehabPhase {
  phase_number: number;
  name: string;
  description?: string;
  duration_days: number;
  start_day: number;
  tasks: CreateRehabTask[];
}

export interface CreateRehabTask {
  task_type: string;
  description: string;
  duration_minutes?: number;
  frequency?: TaskFrequency;
  instructions?: string;
  equipment_needed?: string;
  is_feed_based?: boolean;
  feed_time?: string;  // morning, evening, both
  sequence?: number;
}

export interface RehabTaskLog {
  id: number;
  task_id: number;
  program_id: number;
  horse_id: number;
  log_date: string;
  feed_time?: FeedTime;
  was_completed: boolean;
  skip_reason?: string;
  actual_duration_minutes?: number;
  horse_response?: string;
  concerns?: string;
  vet_notified: boolean;
  lameness_score?: number;  // AAEP scale: 0=sound, 5=non-weight bearing
  physical_observations?: string;  // Swelling, heat, filling, etc.
  completed_by_id: number;
  completed_at?: string;
  task_description?: string;
  completed_by_name?: string;
  // Attribution fields for livery feedback
  completed_by_role?: 'livery' | 'staff' | 'admin';
  completed_via?: 'direct' | 'yard_tasks' | 'service_request';
}

export interface CreateRehabTaskLog {
  task_id: number;
  program_id: number;
  horse_id: number;
  log_date: string;
  feed_time?: FeedTime;
  was_completed: boolean;
  skip_reason?: string;
  actual_duration_minutes?: number;
  horse_response?: string;
  concerns?: string;
  vet_notified?: boolean;
  lameness_score?: number;
  physical_observations?: string;
}

export interface RehabDueSummary {
  program_id: number;
  program_name: string;
  horse_id: number;
  horse_name: string;
  current_phase: number;
  phase_name: string;
  tasks_due: RehabTask[];
}

export interface DailyRehabTask {
  task_id: number;
  program_id: number;
  horse_id: number;
  horse_name: string;
  program_name: string;
  phase_name: string;
  task_type: string;
  description: string;
  duration_minutes?: number;
  frequency: TaskFrequency;
  instructions?: string;
  equipment_needed?: string;
  is_logged: boolean;
  log_id?: number;
}

// ============== Invoice Types ==============

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled' | 'overdue';

export interface Invoice {
  id: number;
  user_id: number;
  invoice_number: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  payments_received: number;
  balance_due: number;
  status: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
  paid_date?: string;
  pdf_filename?: string;
  notes?: string;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  created_by_name?: string;
  line_items: InvoiceLineItem[];
}

export interface InvoiceLineItem {
  id: number;
  invoice_id: number;
  ledger_entry_id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  category?: string;
  item_date_start?: string;
  item_date_end?: string;
}

export interface InvoiceSummary {
  id: number;
  invoice_number: string;
  user_id: number;
  user_name: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  balance_due: number;
  status: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
}

export interface MyInvoiceSummary {
  id: number;
  invoice_number: string;
  period_start: string;
  period_end: string;
  subtotal: number;
  balance_due: number;
  status: InvoiceStatus;
  issue_date?: string;
  due_date?: string;
  has_pdf: boolean;
}

export interface InvoiceGenerateRequest {
  user_id: number;
  period_start: string;
  period_end: string;
  due_date?: string;
  auto_populate?: boolean;
  notes?: string;
  line_items?: CreateInvoiceLineItem[];
}

export interface CreateInvoiceLineItem {
  description: string;
  quantity?: number;
  unit_price: number;
  amount: number;
  category?: string;
  item_date_start?: string;
  item_date_end?: string;
}

export interface InvoiceEnums {
  statuses: EnumOption[];
}

// ============== Health Task Completion Types ==============

export interface MedicationTaskCompletion {
  was_given: boolean;
  skip_reason?: string;
  notes?: string;
}

export interface WoundCareTaskCompletion {
  treatment_given: string;
  products_used?: string;
  healing_assessment: HealingStatus;
  assessment_notes?: string;
  next_treatment_due?: string;
  is_healed?: boolean;
}

export interface HealthObservationTaskCompletion {
  observation_time?: string;
  temperature?: number;
  appetite: AppetiteStatus;
  demeanor: DemeanorStatus;
  droppings_normal: boolean;
  concerns?: string;
  action_taken?: string;
  vet_notified?: boolean;
}

export interface RehabExerciseTaskCompletion {
  was_completed: boolean;
  skip_reason?: string;
  actual_duration_minutes?: number;
  horse_response?: string;
  concerns?: string;
  vet_notified?: boolean;
  lameness_score?: number;
  physical_observations?: string;
}

export interface HealthTaskCompletion {
  medication?: MedicationTaskCompletion;
  wound_care?: WoundCareTaskCompletion;
  health_observation?: HealthObservationTaskCompletion;
  rehab_exercise?: RehabExerciseTaskCompletion;
}

export interface HealthTaskGenerationResult {
  date: string;
  medication: number;
  wound_care: number;
  health_check: number;
  rehab_exercise: number;
  total: number;
}

// Monthly Billing Types
export interface MonthOption {
  year: number;
  month: number;
  display: string;
  is_current: boolean;
  is_future: boolean;
}

export interface HorseChargeResponse {
  horse_id: number;
  horse_name: string;
  package_id: number;
  package_name: string;
  monthly_price: number;
  days_in_month: number;
  billable_days: number;
  charge_amount: number;
  period_start: string;
  period_end: string;
  is_partial: boolean;
  notes: string;
}

export interface OwnerBillingSummaryResponse {
  owner_id: number;
  owner_name: string;
  owner_email: string;
  horses: HorseChargeResponse[];
  total_amount: number;
  period_start: string;
  period_end: string;
}

export interface BillingRunResponse {
  billing_month: string;
  billing_month_display: string;
  owner_summaries: OwnerBillingSummaryResponse[];
  total_amount: number;
  total_horses: number;
  total_owners: number;
  ledger_entries_created: number;
  is_preview: boolean;
}

export interface BillingRunRequest {
  year: number;
  month: number;
  preview_only?: boolean;
}

// Holiday Livery Types
export type HolidayLiveryStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface HolidayLiveryRequestCreate {
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  horse_name: string;
  horse_breed?: string;
  horse_age?: number;
  horse_colour?: string;
  horse_gender?: string;
  special_requirements?: string;
  requested_arrival: string;
  requested_departure: string;
  message?: string;
}

export interface HolidayLiveryApproval {
  confirmed_arrival: string;
  confirmed_departure: string;
  assigned_stable_id: number;
  admin_notes?: string;
}

export interface HolidayLiveryRejection {
  rejection_reason: string;
  admin_notes?: string;
}

export interface HolidayLiveryRequestSummary {
  id: number;
  guest_name: string;
  guest_email: string;
  horse_name: string;
  requested_arrival: string;
  requested_departure: string;
  requested_nights: number;
  status: HolidayLiveryStatus;
  created_at: string;
}

export interface HolidayLiveryRequestResponse {
  id: number;
  guest_name: string;
  guest_email: string;
  guest_phone?: string;
  horse_name: string;
  horse_breed?: string;
  horse_age?: number;
  horse_colour?: string;
  horse_gender?: string;
  special_requirements?: string;
  requested_arrival: string;
  requested_departure: string;
  requested_nights: number;
  message?: string;
  status: HolidayLiveryStatus;
  admin_notes?: string;
  rejection_reason?: string;
  confirmed_arrival?: string;
  confirmed_departure?: string;
  confirmed_nights: number;
  assigned_stable_id?: number;
  assigned_stable_name?: string;
  created_user_id?: number;
  created_user_name?: string;
  created_horse_id?: number;
  created_horse_name?: string;
  processed_by_id?: number;
  processed_by_name?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface HolidayLiveryPublicResponse {
  id: number;
  message: string;
  status: string;
  requested_arrival: string;
  requested_departure: string;
}

export interface HolidayLiveryStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

// Insurance claim types
export interface InsuranceClaimItem {
  service_date: string;
  service_name: string;
  horse_name: string;
  description: string;
  amount: number;
  service_request_id: number;
}

export interface InsuranceStatement {
  statement_date: string;
  period_start: string;
  period_end: string;
  horse_id?: number;
  horse_name?: string;
  owner_name: string;
  owner_email: string;
  items: InsuranceClaimItem[];
  total_amount: number;
  item_count: number;
}
