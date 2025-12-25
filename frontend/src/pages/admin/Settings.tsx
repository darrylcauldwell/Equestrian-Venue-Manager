import { useState, useEffect, useRef } from 'react';
import { settingsApi, uploadsApi } from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import type { SiteSettingsUpdate } from '../../types';
import './Admin.css';

interface SchedulerJob {
  id: string;
  name: string;
  schedule: string;
  next_run: string | null;
  last_run: string | null;
  last_status: 'success' | 'failed' | null;
  last_summary: string | null;
}

interface TaskCounts {
  medication: number;
  wound_care: number;
  health_check: number;
  rehab_exercise: number;
  total: number;
}

export function AdminSettings() {
  const { refreshSettings } = useSettings();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [demoDataEnabled, setDemoDataEnabled] = useState(false);
  const [canEnableDemo, setCanEnableDemo] = useState(false);

  // Scheduler state
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerJobs, setSchedulerJobs] = useState<SchedulerJob[]>([]);
  const [todaysTaskCounts, setTodaysTaskCounts] = useState<TaskCounts | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewData, setPreviewData] = useState<{ existing_tasks: TaskCounts; already_generated: boolean } | null>(null);
  const [isRollingOver, setIsRollingOver] = useState(false);
  const [rolloverResult, setRolloverResult] = useState<{ tasks_moved: number; message: string } | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<SiteSettingsUpdate>({
    venue_name: '',
    venue_tagline: '',
    contact_email: '',
    contact_phone: '',
    address_street: '',
    address_town: '',
    address_county: '',
    address_postcode: '',
    venue_latitude: undefined,
    venue_longitude: undefined,
    gate_code: '',
    key_safe_code: '',
    security_info: '',
    what3words: '',
    theme_primary_color: '#3B82F6',
    theme_accent_color: '#10B981',
    theme_font_family: 'Inter',
    theme_mode: 'light',
    livery_billing_day: 1,
    livery_max_future_hours_per_horse: undefined,
    livery_max_booking_hours: undefined,
    livery_min_advance_hours: 0,
    livery_max_advance_days: 30,
    livery_max_weekly_hours_per_horse: undefined,
    livery_max_daily_hours_per_horse: undefined,
    stripe_enabled: false,
    stripe_secret_key: '',
    stripe_publishable_key: '',
    stripe_webhook_secret: '',
    access_token_expire_minutes: 30,
    refresh_token_expire_days: 7,
    frontend_url: 'http://localhost:3000',
    dev_mode: true,
    // Scheduler times
    scheduler_health_tasks_hour: 0,
    scheduler_health_tasks_minute: 1,
    scheduler_rollover_hour: 0,
    scheduler_rollover_minute: 5,
    scheduler_billing_day: 1,
    scheduler_billing_hour: 6,
    scheduler_billing_minute: 0,
    scheduler_backup_hour: 2,
    scheduler_backup_minute: 0,
    scheduler_cleanup_hour: 2,
    scheduler_cleanup_minute: 30,
  });

  const FONT_OPTIONS = [
    { value: 'Inter', label: 'Inter (Default)' },
    { value: 'Roboto', label: 'Roboto' },
    { value: 'Open Sans', label: 'Open Sans' },
    { value: 'Lato', label: 'Lato' },
    { value: 'Source Sans Pro', label: 'Source Sans Pro' },
    { value: 'Nunito', label: 'Nunito' },
  ];

  useEffect(() => {
    loadSettings();
    loadSchedulerStatus();
  }, []);

  const loadSchedulerStatus = async () => {
    try {
      const status = await settingsApi.getSchedulerStatus();
      setSchedulerRunning(status.scheduler_running);
      setSchedulerJobs(status.jobs);
      setTodaysTaskCounts(status.todays_health_tasks);
    } catch {
      // Silently fail - scheduler status is non-essential
    }
  };

  const handlePreviewTasks = async () => {
    try {
      const result = await settingsApi.previewHealthTasks(selectedDate);
      setPreviewData({
        existing_tasks: result.existing_tasks,
        already_generated: result.already_generated,
      });
    } catch {
      setError('Failed to preview tasks');
    }
  };

  const handleGenerateTasks = async () => {
    setError('');
    setSuccess('');
    setIsGenerating(true);

    try {
      const result = await settingsApi.generateHealthTasks(selectedDate);
      setSuccess(result.message);
      setPreviewData({
        existing_tasks: result.tasks_generated,
        already_generated: true,
      });
      if (selectedDate === new Date().toISOString().split('T')[0]) {
        await loadSchedulerStatus();
      }
    } catch {
      setError('Failed to generate health tasks');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRollover = async () => {
    setError('');
    setSuccess('');
    setIsRollingOver(true);
    setRolloverResult(null);

    try {
      const result = await settingsApi.runTaskRollover();
      setRolloverResult({
        tasks_moved: result.tasks_moved,
        message: result.message,
      });
      setSuccess(result.message);
    } catch {
      setError('Failed to run task rollover');
    } finally {
      setIsRollingOver(false);
    }
  };

  const handleSaveSchedule = async () => {
    setError('');
    setSuccess('');
    setIsSavingSchedule(true);

    try {
      // Save schedule times to settings
      await settingsApi.update({
        scheduler_health_tasks_hour: formData.scheduler_health_tasks_hour,
        scheduler_health_tasks_minute: formData.scheduler_health_tasks_minute,
        scheduler_rollover_hour: formData.scheduler_rollover_hour,
        scheduler_rollover_minute: formData.scheduler_rollover_minute,
        scheduler_billing_day: formData.scheduler_billing_day,
        scheduler_billing_hour: formData.scheduler_billing_hour,
        scheduler_billing_minute: formData.scheduler_billing_minute,
        scheduler_backup_hour: formData.scheduler_backup_hour,
        scheduler_backup_minute: formData.scheduler_backup_minute,
        scheduler_cleanup_hour: formData.scheduler_cleanup_hour,
        scheduler_cleanup_minute: formData.scheduler_cleanup_minute,
      });

      // Reschedule jobs with new times
      const result = await settingsApi.rescheduleJobs();
      setSuccess(result.message);

      // Refresh scheduler status to show updated schedules
      await loadSchedulerStatus();
    } catch {
      setError('Failed to save schedule configuration');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await settingsApi.get();
      setFormData({
        venue_name: data.venue_name || '',
        venue_tagline: data.venue_tagline || '',
        contact_email: data.contact_email || '',
        contact_phone: data.contact_phone || '',
        address_street: data.address_street || '',
        address_town: data.address_town || '',
        address_county: data.address_county || '',
        address_postcode: data.address_postcode || '',
        venue_latitude: data.venue_latitude,
        venue_longitude: data.venue_longitude,
        gate_code: data.gate_code || '',
        key_safe_code: data.key_safe_code || '',
        security_info: data.security_info || '',
        what3words: data.what3words || '',
        theme_primary_color: data.theme_primary_color || '#3B82F6',
        theme_accent_color: data.theme_accent_color || '#10B981',
        theme_font_family: data.theme_font_family || 'Inter',
        theme_mode: data.theme_mode || 'light',
        livery_billing_day: data.livery_billing_day ?? 1,
        livery_max_future_hours_per_horse: data.livery_max_future_hours_per_horse,
        livery_max_booking_hours: data.livery_max_booking_hours,
        livery_min_advance_hours: data.livery_min_advance_hours ?? 0,
        livery_max_advance_days: data.livery_max_advance_days ?? 30,
        livery_max_weekly_hours_per_horse: data.livery_max_weekly_hours_per_horse,
        livery_max_daily_hours_per_horse: data.livery_max_daily_hours_per_horse,
        stripe_enabled: data.stripe_enabled || false,
        stripe_secret_key: data.stripe_secret_key || '',
        stripe_publishable_key: data.stripe_publishable_key || '',
        stripe_webhook_secret: data.stripe_webhook_secret || '',
        access_token_expire_minutes: data.access_token_expire_minutes ?? 30,
        refresh_token_expire_days: data.refresh_token_expire_days ?? 7,
        frontend_url: data.frontend_url || 'http://localhost:3000',
        dev_mode: data.dev_mode ?? true,
        // Scheduler times
        scheduler_health_tasks_hour: data.scheduler_health_tasks_hour ?? 0,
        scheduler_health_tasks_minute: data.scheduler_health_tasks_minute ?? 1,
        scheduler_rollover_hour: data.scheduler_rollover_hour ?? 0,
        scheduler_rollover_minute: data.scheduler_rollover_minute ?? 5,
        scheduler_billing_day: data.scheduler_billing_day ?? 1,
        scheduler_billing_hour: data.scheduler_billing_hour ?? 6,
        scheduler_billing_minute: data.scheduler_billing_minute ?? 0,
        scheduler_backup_hour: data.scheduler_backup_hour ?? 2,
        scheduler_backup_minute: data.scheduler_backup_minute ?? 0,
        scheduler_cleanup_hour: data.scheduler_cleanup_hour ?? 2,
        scheduler_cleanup_minute: data.scheduler_cleanup_minute ?? 30,
      });
      if (data.logo_url) {
        setLogoUrl(uploadsApi.getFileUrl(data.logo_url));
      }
      setDemoDataEnabled(data.demo_data_enabled || false);

      try {
        const demoStatus = await settingsApi.getDemoStatus();
        setCanEnableDemo(demoStatus.can_enable_demo);
      } catch {
        setCanEnableDemo(false);
      }
    } catch {
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDemoData = async () => {
    setError('');
    setSuccess('');
    setIsDemoLoading(true);

    try {
      await settingsApi.seedDemoData();
      setDemoDataEnabled(true);
      setSuccess('Demo data loaded successfully!');
      await refreshSettings();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load demo data';
      setError(message);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleCleanDemoData = async () => {
    setError('');
    setSuccess('');
    setIsDemoLoading(true);

    try {
      await settingsApi.cleanDemoData();
      setDemoDataEnabled(false);
      setCanEnableDemo(false);
      setSuccess('Demo data removed.');
      await refreshSettings();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove demo data';
      setError(message);
    } finally {
      setIsDemoLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsUploading(true);
    try {
      const result = await uploadsApi.uploadLogo(file);
      setLogoUrl(uploadsApi.getFileUrl(result.filename));
      setSuccess('Logo uploaded successfully');
      await refreshSettings();
    } catch {
      setError('Failed to upload logo');
    } finally {
      setIsUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleDeleteLogo = async () => {
    if (!confirm('Are you sure you want to delete the logo?')) return;
    setError('');
    try {
      await uploadsApi.deleteLogo();
      setLogoUrl(null);
      setSuccess('Logo deleted');
      await refreshSettings();
    } catch {
      setError('Failed to delete logo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.contact_email) {
      const emailResult = validateEmail(formData.contact_email);
      if (!emailResult.isValid) {
        setError(emailResult.message || 'Invalid contact email');
        return;
      }
    }

    if (formData.contact_phone) {
      const phoneResult = validatePhone(formData.contact_phone);
      if (!phoneResult.isValid) {
        setError(phoneResult.message || 'Invalid contact phone number');
        return;
      }
    }

    setIsSaving(true);

    try {
      await settingsApi.update(formData);
      setSuccess('Settings saved successfully');
      await refreshSettings();
    } catch {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Loading settings...</div>;
  }

  return (
    <div className="admin-page settings-page">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleSubmit} className="settings-form">

        {/* ========== SECTION 1: VENUE IDENTITY ========== */}
        <div className="form-section">
          <h3>Venue Identity</h3>

          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label htmlFor="venue_name">Venue Name *</label>
              <input
                id="venue_name"
                type="text"
                value={formData.venue_name}
                onChange={(e) => setFormData({ ...formData, venue_name: e.target.value })}
                placeholder="e.g., Abbey Farm Equestrian"
                required
              />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label>Logo</label>
              {logoUrl ? (
                <div className="logo-inline-preview">
                  <img src={logoUrl} alt="Logo" />
                  <button type="button" className="btn-small" onClick={() => logoInputRef.current?.click()} disabled={isUploading}>
                    Change
                  </button>
                  <button type="button" className="btn-small btn-danger" onClick={handleDeleteLogo} disabled={isUploading}>
                    Remove
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-secondary btn-small" onClick={() => logoInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? 'Uploading...' : 'Upload Logo'}
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="venue_tagline">Tagline</label>
            <input
              id="venue_tagline"
              type="text"
              value={formData.venue_tagline || ''}
              onChange={(e) => setFormData({ ...formData, venue_tagline: e.target.value })}
              placeholder="e.g., Premium Livery & Arena Hire"
            />
          </div>
        </div>

        {/* ========== SECTION 2: CONTACT & LOCATION ========== */}
        <div className="form-section">
          <h3>Contact & Location</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="contact_email">Email</label>
              <input
                id="contact_email"
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="contact@yourvenue.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="contact_phone">Phone</label>
              <input
                id="contact_phone"
                type="tel"
                value={formData.contact_phone || ''}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="01onal 734448"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="address_street">Street Address</label>
            <input
              id="address_street"
              type="text"
              value={formData.address_street || ''}
              onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
              placeholder="e.g., Abbey Farm, Country Lane"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="address_town">Town</label>
              <input
                id="address_town"
                type="text"
                value={formData.address_town || ''}
                onChange={(e) => setFormData({ ...formData, address_town: e.target.value })}
                placeholder="e.g., Ashbourne"
              />
            </div>
            <div className="form-group">
              <label htmlFor="address_county">County</label>
              <input
                id="address_county"
                type="text"
                value={formData.address_county || ''}
                onChange={(e) => setFormData({ ...formData, address_county: e.target.value })}
                placeholder="e.g., Derbyshire"
              />
            </div>
            <div className="form-group" style={{ maxWidth: '140px' }}>
              <label htmlFor="address_postcode">Postcode</label>
              <input
                id="address_postcode"
                type="text"
                value={formData.address_postcode || ''}
                onChange={(e) => setFormData({ ...formData, address_postcode: e.target.value.toUpperCase() })}
                placeholder="DE6 1AB"
              />
            </div>
          </div>
        </div>

        {/* Demo Data Section - always shown */}
        <div className="form-section">
          <h3>Demo Mode</h3>
          <div className="feature-toggles">
            <div className="feature-toggle-row">
              <div className="feature-toggle-info">
                <span className="feature-toggle-label">Demo Data</span>
                <span className="feature-toggle-description">
                  {demoDataEnabled
                    ? 'Sample users, horses, and bookings are loaded'
                    : canEnableDemo
                      ? 'Load sample data for testing (users: admin, coach, livery1, staff1 - password: password)'
                      : 'Database already has data. Demo mode only works on fresh installations.'}
                </span>
              </div>
              {(canEnableDemo || demoDataEnabled) ? (
                <>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={demoDataEnabled}
                      disabled={isDemoLoading}
                      onChange={async (e) => {
                        if (e.target.checked) {
                          if (confirm('Load demo data? This adds sample users, horses, and bookings.')) {
                            await handleSeedDemoData();
                          } else {
                            e.target.checked = false;
                          }
                        } else {
                          if (confirm('Remove ALL demo data? Your admin account will be preserved. This cannot be undone.')) {
                            if (confirm('Confirm: Delete demo data permanently?')) {
                              await handleCleanDemoData();
                            } else {
                              e.target.checked = true;
                            }
                          } else {
                            e.target.checked = true;
                          }
                        }
                      }}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  {isDemoLoading && <span className="toggle-loading">{demoDataEnabled ? 'Removing...' : 'Loading...'}</span>}
                </>
              ) : (
                <span className="toggle-status-text">Unavailable</span>
              )}
            </div>
          </div>
        </div>

        {/* ========== SECTION 4: APPEARANCE ========== */}
        <div className="form-section">
          <h3>Appearance</h3>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="theme_primary_color">Primary Color</label>
              <div className="color-input-group">
                <input
                  id="theme_primary_color"
                  type="color"
                  value={formData.theme_primary_color || '#3B82F6'}
                  onChange={(e) => setFormData({ ...formData, theme_primary_color: e.target.value })}
                />
                <input
                  type="text"
                  value={formData.theme_primary_color || '#3B82F6'}
                  onChange={(e) => setFormData({ ...formData, theme_primary_color: e.target.value })}
                  maxLength={7}
                  className="color-text-input"
                />
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="theme_accent_color">Accent Color</label>
              <div className="color-input-group">
                <input
                  id="theme_accent_color"
                  type="color"
                  value={formData.theme_accent_color || '#10B981'}
                  onChange={(e) => setFormData({ ...formData, theme_accent_color: e.target.value })}
                />
                <input
                  type="text"
                  value={formData.theme_accent_color || '#10B981'}
                  onChange={(e) => setFormData({ ...formData, theme_accent_color: e.target.value })}
                  maxLength={7}
                  className="color-text-input"
                />
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="theme_font_family">Font</label>
              <select
                id="theme_font_family"
                value={formData.theme_font_family || 'Inter'}
                onChange={(e) => setFormData({ ...formData, theme_font_family: e.target.value })}
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="theme_mode">Theme</label>
              <select
                id="theme_mode"
                value={formData.theme_mode || 'light'}
                onChange={(e) => setFormData({ ...formData, theme_mode: e.target.value })}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>
          </div>
        </div>

        {/* ========== SECTION 5: BILLING MANAGEMENT ========== */}
        <div className="form-section">
          <h3>Billing Management</h3>

          <div className="form-group" style={{ maxWidth: '200px' }}>
            <label htmlFor="livery_billing_day">Monthly Billing Day</label>
            <select
              id="livery_billing_day"
              value={formData.livery_billing_day ?? 1}
              onChange={(e) => setFormData({ ...formData, livery_billing_day: parseInt(e.target.value) })}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                <option key={day} value={day}>
                  {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                </option>
              ))}
            </select>
            <small>Day when monthly livery charges are applied</small>
          </div>

          <div className="feature-toggles" style={{ marginTop: '1.5rem' }}>
            <div className="feature-toggle-block">
              <div className="feature-toggle-row">
                <div className="feature-toggle-info">
                  <span className="feature-toggle-label">Stripe Payments</span>
                  <span className="feature-toggle-description">Accept online payments for arena bookings</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formData.stripe_enabled || false}
                    onChange={(e) => setFormData({ ...formData, stripe_enabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {formData.stripe_enabled && (
                <div className="feature-config">
                  <div className="form-group">
                    <label htmlFor="stripe_publishable_key">Publishable Key</label>
                    <input
                      id="stripe_publishable_key"
                      type="text"
                      value={formData.stripe_publishable_key || ''}
                      onChange={(e) => setFormData({ ...formData, stripe_publishable_key: e.target.value })}
                      placeholder="pk_test_... or pk_live_..."
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="stripe_secret_key">Secret Key</label>
                    <input
                      id="stripe_secret_key"
                      type="password"
                      value={formData.stripe_secret_key || ''}
                      onChange={(e) => setFormData({ ...formData, stripe_secret_key: e.target.value })}
                      placeholder="sk_test_... or sk_live_..."
                      autoComplete="off"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="stripe_webhook_secret">Webhook Secret</label>
                    <input
                      id="stripe_webhook_secret"
                      type="password"
                      value={formData.stripe_webhook_secret || ''}
                      onChange={(e) => setFormData({ ...formData, stripe_webhook_secret: e.target.value })}
                      placeholder="whsec_..."
                      autoComplete="off"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== SECTION 6: BOOKING MANAGEMENT ========== */}
        <div className="form-section">
          <h3>Booking Management</h3>

          <div className="form-group" style={{ maxWidth: '200px' }}>
            <label htmlFor="livery_max_advance_days">Booking Window (days)</label>
            <input
              id="livery_max_advance_days"
              type="number"
              min="1"
              value={formData.livery_max_advance_days ?? 30}
              onChange={(e) => setFormData({ ...formData, livery_max_advance_days: parseInt(e.target.value) || 30 })}
            />
            <small>How far ahead bookings can be made</small>
          </div>

          <details className="advanced-options">
            <summary>Booking Limits (Optional)</summary>
            <p className="small-text">Set limits only if someone is abusing the system. Leave blank for no limit.</p>

            <div className="form-row">
              <div className="form-group">
                <label>Max Future Hours/Horse</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.livery_max_future_hours_per_horse ?? ''}
                  onChange={(e) => setFormData({ ...formData, livery_max_future_hours_per_horse: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="No limit"
                />
              </div>
              <div className="form-group">
                <label>Max Single Booking (hours)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={formData.livery_max_booking_hours ?? ''}
                  onChange={(e) => setFormData({ ...formData, livery_max_booking_hours: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="No limit"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Max Daily Hours/Horse</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.livery_max_daily_hours_per_horse ?? ''}
                  onChange={(e) => setFormData({ ...formData, livery_max_daily_hours_per_horse: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="No limit"
                />
              </div>
              <div className="form-group">
                <label>Max Weekly Hours/Horse</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={formData.livery_max_weekly_hours_per_horse ?? ''}
                  onChange={(e) => setFormData({ ...formData, livery_max_weekly_hours_per_horse: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="No limit"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Minimum Advance Notice (hours)</label>
              <input
                type="number"
                min="0"
                value={formData.livery_min_advance_hours ?? 0}
                onChange={(e) => setFormData({ ...formData, livery_min_advance_hours: parseInt(e.target.value) || 0 })}
                placeholder="0"
                style={{ maxWidth: '120px' }}
              />
            </div>
          </details>
        </div>

        {/* ========== SAVE BUTTON ========== */}
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* ========== ADVANCED SETTINGS (at bottom) ========== */}
      <details className="form-section advanced-section">
        <summary><h3 style={{ display: 'inline' }}>Advanced Settings</h3></summary>

        <div className="form-subsection">
          <h4>Development</h4>
          <div className="feature-toggle-row">
            <div className="feature-toggle-info">
              <span className="feature-toggle-label">Development Mode</span>
              <span className="feature-toggle-description">Disables browser caching - turn off for production</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={formData.dev_mode ?? true}
                onChange={(e) => setFormData({ ...formData, dev_mode: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="form-subsection">
          <h4>Session Configuration</h4>
          <div className="form-row">
            <div className="form-group">
              <label>Access Token Expiry (minutes)</label>
              <input
                type="number"
                min="5"
                value={formData.access_token_expire_minutes ?? 30}
                onChange={(e) => setFormData({ ...formData, access_token_expire_minutes: parseInt(e.target.value) || 30 })}
                style={{ maxWidth: '100px' }}
              />
            </div>
            <div className="form-group">
              <label>Refresh Token Expiry (days)</label>
              <input
                type="number"
                min="1"
                value={formData.refresh_token_expire_days ?? 7}
                onChange={(e) => setFormData({ ...formData, refresh_token_expire_days: parseInt(e.target.value) || 7 })}
                style={{ maxWidth: '100px' }}
              />
            </div>
          </div>
        </div>

        <div className="form-subsection">
          <h4>URLs & Redirects</h4>
          <div className="form-group">
            <label>Frontend URL</label>
            <input
              type="url"
              value={formData.frontend_url || ''}
              onChange={(e) => setFormData({ ...formData, frontend_url: e.target.value })}
              placeholder="https://your-domain.com"
            />
            <small>Used for payment redirects and email links</small>
          </div>
        </div>

        <div className="form-subsection">
          <h4>Weather Coordinates Override</h4>
          <p className="small-text">Override postcode lookup with specific coordinates</p>
          <div className="form-row">
            <div className="form-group">
              <label>Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={formData.venue_latitude ?? ''}
                onChange={(e) => setFormData({ ...formData, venue_latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="51.509865"
              />
            </div>
            <div className="form-group">
              <label>Longitude</label>
              <input
                type="number"
                step="0.000001"
                value={formData.venue_longitude ?? ''}
                onChange={(e) => setFormData({ ...formData, venue_longitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="-0.118092"
              />
            </div>
          </div>
        </div>

        <div className="form-subsection">
          <h4>Background Tasks</h4>
          <p className="small-text">Automated tasks run daily to generate health tasks, roll over incomplete work, and create backups.</p>

          <div className="scheduler-status-row">
            <span className="scheduler-label">Scheduler Status</span>
            <span className={`status-badge ${schedulerRunning ? 'status-running' : 'status-stopped'}`}>
              {schedulerRunning ? 'Running' : 'Stopped'}
            </span>
          </div>

          {schedulerJobs.length > 0 && (
            <div className="scheduled-jobs-list">
              {schedulerJobs.map(job => {
                const formatDateTime = (isoString: string | null) => {
                  if (!isoString) return null;
                  return new Date(isoString).toLocaleString('en-GB', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                };

                return (
                  <div key={job.id} className="scheduled-job-item">
                    <div className="job-header">
                      <span className="job-name">{job.name}</span>
                      <span className="job-schedule">{job.schedule}</span>
                    </div>
                    <div className="job-times">
                      <div className="job-time-row">
                        <span className="job-time-label">Last run:</span>
                        {job.last_run ? (
                          <>
                            <span className="job-time-value">{formatDateTime(job.last_run)}</span>
                            <span className={`job-status ${job.last_status === 'success' ? 'status-success' : 'status-failed'}`}>
                              {job.last_status === 'success' ? '✓' : '✗'}
                            </span>
                            {job.last_summary && <span className="job-summary">{job.last_summary}</span>}
                          </>
                        ) : (
                          <span className="job-time-value job-time-none">Not yet run</span>
                        )}
                      </div>
                      <div className="job-time-row">
                        <span className="job-time-label">Next run:</span>
                        <span className="job-time-value">
                          {formatDateTime(job.next_run) || 'Not scheduled'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {todaysTaskCounts && todaysTaskCounts.total > 0 && (
            <div className="todays-tasks-summary">
              <span className="summary-label">Today's Generated Tasks:</span>
              <div className="task-counts">
                <span className="task-count"><strong>{todaysTaskCounts.medication}</strong> Medication</span>
                <span className="task-count"><strong>{todaysTaskCounts.wound_care}</strong> Wound Care</span>
                <span className="task-count"><strong>{todaysTaskCounts.health_check}</strong> Health Check</span>
                <span className="task-count"><strong>{todaysTaskCounts.rehab_exercise}</strong> Rehab</span>
                <span className="task-count total"><strong>{todaysTaskCounts.total}</strong> Total</span>
              </div>
            </div>
          )}

          <details className="advanced-options">
            <summary>Manual Operations</summary>
            <div className="manual-ops-grid">
              <div className="manual-op-card">
                <h4>Generate Health Tasks</h4>
                <p>Manually generate tasks for a specific date (normally runs at midnight).</p>
                <div className="op-controls">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setPreviewData(null); }}
                  />
                  <button type="button" className="btn-secondary btn-small" onClick={handlePreviewTasks}>
                    Check
                  </button>
                  <button type="button" className="btn-primary btn-small" onClick={handleGenerateTasks} disabled={isGenerating}>
                    {isGenerating ? 'Generating...' : 'Generate'}
                  </button>
                </div>
                {previewData && (
                  <div className={`op-result ${previewData.already_generated ? 'success' : 'info'}`}>
                    {previewData.already_generated
                      ? `${previewData.existing_tasks.total} tasks exist`
                      : 'No tasks generated yet'}
                  </div>
                )}
              </div>

              <div className="manual-op-card">
                <h4>Task Rollover</h4>
                <p>Move incomplete past tasks to backlog (normally runs at 00:05).</p>
                <div className="op-controls">
                  <button type="button" className="btn-primary btn-small" onClick={handleRollover} disabled={isRollingOver}>
                    {isRollingOver ? 'Running...' : 'Run Rollover'}
                  </button>
                </div>
                {rolloverResult && (
                  <div className="op-result success">{rolloverResult.message}</div>
                )}
              </div>
            </div>
          </details>

          <details className="advanced-options">
            <summary>Schedule Configuration</summary>
            <p className="small-text">Configure when each background task runs. Changes take effect immediately.</p>

            <div className="schedule-config-grid">
              <div className="schedule-config-item">
                <label>Health Task Generation</label>
                <div className="time-input-group">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.scheduler_health_tasks_hour ?? 0}
                    onChange={(e) => setFormData({ ...formData, scheduler_health_tasks_hour: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.scheduler_health_tasks_minute ?? 1}
                    onChange={(e) => setFormData({ ...formData, scheduler_health_tasks_minute: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                </div>
                <small>Generates medication, wound care, health check, and rehab tasks</small>
              </div>

              <div className="schedule-config-item">
                <label>Task Rollover</label>
                <div className="time-input-group">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.scheduler_rollover_hour ?? 0}
                    onChange={(e) => setFormData({ ...formData, scheduler_rollover_hour: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.scheduler_rollover_minute ?? 5}
                    onChange={(e) => setFormData({ ...formData, scheduler_rollover_minute: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                </div>
                <small>Moves incomplete past tasks to backlog</small>
              </div>

              <div className="schedule-config-item">
                <label>Monthly Billing</label>
                <div className="billing-schedule-group">
                  <select
                    value={formData.scheduler_billing_day ?? 1}
                    onChange={(e) => setFormData({ ...formData, scheduler_billing_day: parseInt(e.target.value) })}
                    className="day-select"
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                      <option key={day} value={day}>
                        {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                      </option>
                    ))}
                  </select>
                  <span>at</span>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.scheduler_billing_hour ?? 6}
                    onChange={(e) => setFormData({ ...formData, scheduler_billing_hour: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.scheduler_billing_minute ?? 0}
                    onChange={(e) => setFormData({ ...formData, scheduler_billing_minute: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                </div>
                <small>Generates livery invoices for the previous month</small>
              </div>

              <div className="schedule-config-item">
                <label>Automated Backup</label>
                <div className="time-input-group">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.scheduler_backup_hour ?? 2}
                    onChange={(e) => setFormData({ ...formData, scheduler_backup_hour: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.scheduler_backup_minute ?? 0}
                    onChange={(e) => setFormData({ ...formData, scheduler_backup_minute: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                </div>
                <small>Creates database backups (if enabled)</small>
              </div>

              <div className="schedule-config-item">
                <label>Backup Cleanup</label>
                <div className="time-input-group">
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={formData.scheduler_cleanup_hour ?? 2}
                    onChange={(e) => setFormData({ ...formData, scheduler_cleanup_hour: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                  <span>:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={formData.scheduler_cleanup_minute ?? 30}
                    onChange={(e) => setFormData({ ...formData, scheduler_cleanup_minute: parseInt(e.target.value) || 0 })}
                    className="time-input"
                  />
                </div>
                <small>Removes backups older than retention period</small>
              </div>
            </div>

            <div className="schedule-save-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveSchedule}
                disabled={isSavingSchedule}
              >
                {isSavingSchedule ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </details>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-primary" disabled={isSaving} onClick={handleSubmit}>
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </details>
    </div>
  );
}
