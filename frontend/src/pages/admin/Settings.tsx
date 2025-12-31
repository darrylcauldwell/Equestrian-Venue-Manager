import { useState, useEffect, useRef, useCallback } from 'react';
import { settingsApi, uploadsApi, contractsApi } from '../../services/api';
import { useSettings } from '../../contexts/SettingsContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { useRequestState, useLoadingStates } from '../../hooks';
import type { SiteSettingsUpdate, RuggingGuide, DocuSignSettings, UpdateDocuSignSettings, SSLStatusResponse, SSLSettingsUpdate } from '../../types';
import { FeatureFlagsSettings } from '../../components/admin/FeatureFlagsSettings';
import './Admin.css';

const DEFAULT_RUGGING_GUIDE: RuggingGuide = {
  '15+': { unclipped: 'None', partial: '0g', fully_clipped: '50g' },
  '10-15': { unclipped: 'None', partial: '50g', fully_clipped: '100-200g' },
  '5-10': { unclipped: '0-50g', partial: '100-200g', fully_clipped: '300g' },
  '0-5': { unclipped: '50-100g', partial: '300g', fully_clipped: '300g + neck' },
  '-5-0': { unclipped: '200g', partial: '300g + neck', fully_clipped: '400g + neck' },
  'below-5': { unclipped: '300g', partial: '400g + neck', fully_clipped: '400g + neck + liner' },
};

const TEMP_RANGES = ['15+', '10-15', '5-10', '0-5', '-5-0', 'below-5'] as const;
const TEMP_RANGE_LABELS: Record<string, string> = {
  '15+': '15°C+',
  '10-15': '10-15°C',
  '5-10': '5-10°C',
  '0-5': '0-5°C',
  '-5-0': '-5 to 0°C',
  'below-5': 'Below -5°C',
};

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

// Loading state keys for this component
type LoadingKey = 'initial' | 'saving' | 'uploading' | 'demo' | 'generating' | 'rollover' | 'schedule' | 'whatsapp';

// DocuSign Settings Section Component
function DocuSignSettingsSection() {
  const [settings, setSettings] = useState<DocuSignSettings | null>(null);
  const [formData, setFormData] = useState<UpdateDocuSignSettings>({
    docusign_enabled: false,
    docusign_integration_key: '',
    docusign_account_id: '',
    docusign_user_id: '',
    docusign_private_key: '',
    docusign_test_mode: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await contractsApi.getDocuSignSettings();
      setSettings(data);
      setFormData({
        docusign_enabled: data.docusign_enabled,
        docusign_integration_key: data.docusign_integration_key || '',
        docusign_account_id: data.docusign_account_id || '',
        docusign_user_id: data.docusign_user_id || '',
        docusign_private_key: '', // Never show existing private key
        docusign_test_mode: data.docusign_test_mode,
      });
    } catch {
      // Settings may not exist yet - that's fine
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      // Only send private key if it was entered
      const updateData: UpdateDocuSignSettings = {
        ...formData,
      };
      if (!formData.docusign_private_key) {
        delete updateData.docusign_private_key;
      }

      await contractsApi.updateDocuSignSettings(updateData);
      setSuccess('DocuSign settings saved successfully');
      await loadSettings();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setError('');
    setTestResult(null);
    setIsTesting(true);

    try {
      const result = await contractsApi.testDocuSignConnection();
      setTestResult({
        success: result.success,
        message: result.message,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to test connection';
      setTestResult({
        success: false,
        message: message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (isLoading) {
    return (
      <details className="form-section">
        <summary><h3 style={{ display: 'inline' }}>DocuSign Integration</h3></summary>
        <p>Loading...</p>
      </details>
    );
  }

  return (
    <details className="form-section">
      <summary><h3 style={{ display: 'inline' }}>DocuSign Integration</h3></summary>
      <p className="small-text">Configure DocuSign for electronic contract signing. Requires a DocuSign developer or production account.</p>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="feature-toggles">
        <div className="feature-toggle-block">
          <div className="feature-toggle-row">
            <div className="feature-toggle-info">
              <span className="feature-toggle-label">DocuSign E-Signature</span>
              <span className="feature-toggle-description">Enable electronic contract signing via DocuSign</span>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={formData.docusign_enabled || false}
                onChange={(e) => setFormData({ ...formData, docusign_enabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          {formData.docusign_enabled && (
            <div className="feature-config">
              <div className="ds-form-group">
                <label htmlFor="docusign_integration_key">Integration Key (Client ID)</label>
                <input
                  id="docusign_integration_key"
                  type="text"
                  value={formData.docusign_integration_key || ''}
                  onChange={(e) => setFormData({ ...formData, docusign_integration_key: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="docusign_account_id">Account ID</label>
                <input
                  id="docusign_account_id"
                  type="text"
                  value={formData.docusign_account_id || ''}
                  onChange={(e) => setFormData({ ...formData, docusign_account_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="docusign_user_id">User ID (API Username)</label>
                <input
                  id="docusign_user_id"
                  type="text"
                  value={formData.docusign_user_id || ''}
                  onChange={(e) => setFormData({ ...formData, docusign_user_id: e.target.value })}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="docusign_private_key">RSA Private Key</label>
                <textarea
                  id="docusign_private_key"
                  value={formData.docusign_private_key || ''}
                  onChange={(e) => setFormData({ ...formData, docusign_private_key: e.target.value })}
                  placeholder={settings?.has_private_key ? '(Private key is configured - enter new key to replace)' : '-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----'}
                  rows={4}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
                <small>Paste the full RSA private key from your DocuSign app configuration</small>
              </div>

              <div className="feature-toggle-row" style={{ marginTop: '1rem' }}>
                <div className="feature-toggle-info">
                  <span className="feature-toggle-label">Test Mode (Sandbox)</span>
                  <span className="feature-toggle-description">Use DocuSign demo environment for testing</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formData.docusign_test_mode ?? true}
                    onChange={(e) => setFormData({ ...formData, docusign_test_mode: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="test-button-row" style={{ marginTop: '1rem', gap: '12px', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ds-btn ds-btn-primary btn-small"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary btn-small"
                  onClick={handleTest}
                  disabled={isTesting || !formData.docusign_integration_key}
                >
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </button>
                {testResult && (
                  <span className={`test-result ${testResult.success ? 'success' : 'error'}`}>
                    {testResult.message}
                  </span>
                )}
              </div>

              <div className="ds-alert ds-alert-info" style={{ marginTop: '1rem' }}>
                <strong>Setup Guide:</strong>
                <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                  <li>Create a DocuSign developer account at developers.docusign.com</li>
                  <li>Create an app with JWT authentication enabled</li>
                  <li>Generate an RSA key pair and download the private key</li>
                  <li>Grant consent by visiting the consent URL for your app</li>
                  <li>Enter your credentials above and test the connection</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

// SSL/Domain Configuration Section Component
function SSLSettingsSection() {
  const [sslStatus, setSSLStatus] = useState<SSLStatusResponse | null>(null);
  const [formData, setFormData] = useState<SSLSettingsUpdate>({
    ssl_domain: '',
    ssl_acme_email: '',
    ssl_enabled: false,
    ssl_traefik_dashboard_enabled: false,
    ssl_traefik_dashboard_user: '',
    ssl_traefik_dashboard_password: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSSLStatus();
  }, []);

  const loadSSLStatus = async () => {
    try {
      const data = await settingsApi.getSSLStatus();
      setSSLStatus(data);
      setFormData({
        ssl_domain: data.settings.ssl_domain || '',
        ssl_acme_email: data.settings.ssl_acme_email || '',
        ssl_enabled: data.settings.ssl_enabled,
        ssl_traefik_dashboard_enabled: data.settings.ssl_traefik_dashboard_enabled,
        ssl_traefik_dashboard_user: data.settings.ssl_traefik_dashboard_user || '',
        ssl_traefik_dashboard_password: '',
      });
    } catch {
      // SSL settings may not exist yet
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      // Only send password if it was entered
      const updateData: SSLSettingsUpdate = { ...formData };
      if (!formData.ssl_traefik_dashboard_password) {
        delete updateData.ssl_traefik_dashboard_password;
      }

      await settingsApi.updateSSLSettings(updateData);
      setSuccess('SSL settings saved successfully');
      await loadSSLStatus();
      // Clear password field after save
      setFormData(prev => ({ ...prev, ssl_traefik_dashboard_password: '' }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save settings';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCheckCertificate = async () => {
    if (!formData.ssl_domain) return;
    setIsChecking(true);
    setError('');

    try {
      await settingsApi.checkCertificate(formData.ssl_domain);
      await loadSSLStatus();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check certificate';
      setError(message);
    } finally {
      setIsChecking(false);
    }
  };

  const copyConfig = () => {
    if (sslStatus?.traefik_config) {
      navigator.clipboard.writeText(sslStatus.traefik_config);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <details className="form-section">
        <summary><h3 style={{ display: 'inline' }}>SSL/Domain Configuration</h3></summary>
        <p>Loading...</p>
      </details>
    );
  }

  const cert = sslStatus?.certificate;

  return (
    <details className="form-section">
      <summary><h3 style={{ display: 'inline' }}>SSL/Domain Configuration</h3></summary>
      <p className="small-text">Configure your domain and Let's Encrypt SSL certificate for HTTPS access.</p>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="ds-alert ds-alert-success">{success}</div>}

      <div className="docusign-form">
        <div className="feature-toggle-row">
          <div className="feature-toggle-info">
            <span className="feature-toggle-label">Enable SSL</span>
            <span className="feature-toggle-description">Activate HTTPS with automatic Let's Encrypt certificates</span>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={formData.ssl_enabled ?? false}
              onChange={(e) => setFormData({ ...formData, ssl_enabled: e.target.checked })}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="form-row" style={{ marginTop: '1rem' }}>
          <div className="ds-form-group">
            <label htmlFor="ssl_domain">Domain Name</label>
            <input
              id="ssl_domain"
              type="text"
              value={formData.ssl_domain || ''}
              onChange={(e) => setFormData({ ...formData, ssl_domain: e.target.value })}
              placeholder="yard.example.com"
            />
            <small>Your domain (DNS must point to this server)</small>
          </div>
          <div className="ds-form-group">
            <label htmlFor="ssl_acme_email">ACME Email</label>
            <input
              id="ssl_acme_email"
              type="email"
              value={formData.ssl_acme_email || ''}
              onChange={(e) => setFormData({ ...formData, ssl_acme_email: e.target.value })}
              placeholder="admin@example.com"
            />
            <small>Email for Let's Encrypt notifications</small>
          </div>
        </div>

        {/* Certificate Status */}
        {formData.ssl_enabled && formData.ssl_domain && (
          <div className="ssl-certificate-status" style={{ marginTop: '1rem', padding: '1rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
            <h4 style={{ margin: '0 0 0.75rem 0' }}>Certificate Status</h4>
            {cert ? (
              cert.error ? (
                <div className="ds-alert ds-alert-warning" style={{ margin: 0 }}>
                  <strong>Certificate Check Failed:</strong> {cert.error}
                  <br /><small>This is normal if SSL is not yet configured on the server.</small>
                </div>
              ) : (
                <div className="certificate-details">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                    <div>
                      <strong>Status:</strong>
                      <span className={`ds-badge ${cert.is_valid ? 'ds-badge-success' : 'ds-badge-error'}`} style={{ marginLeft: '0.5rem' }}>
                        {cert.is_valid ? 'Valid' : 'Invalid/Expired'}
                      </span>
                    </div>
                    <div><strong>Issuer:</strong> {cert.issuer || 'Unknown'}</div>
                    <div><strong>Valid From:</strong> {formatDate(cert.valid_from)}</div>
                    <div><strong>Valid Until:</strong> {formatDate(cert.valid_until)}</div>
                    <div>
                      <strong>Expires In:</strong>
                      <span className={`ds-badge ${(cert.days_until_expiry ?? 0) > 30 ? 'ds-badge-success' : (cert.days_until_expiry ?? 0) > 7 ? 'ds-badge-warning' : 'ds-badge-error'}`} style={{ marginLeft: '0.5rem' }}>
                        {cert.days_until_expiry} days
                      </span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Save settings and check certificate status after configuring.</p>
            )}
            <button
              type="button"
              className="ds-btn ds-btn-secondary btn-small"
              onClick={handleCheckCertificate}
              disabled={isChecking || !formData.ssl_domain}
              style={{ marginTop: '0.75rem' }}
            >
              {isChecking ? 'Checking...' : 'Refresh Certificate Status'}
            </button>
          </div>
        )}

        {/* Traefik Dashboard Settings */}
        <details className="advanced-options" style={{ marginTop: '1rem' }}>
          <summary>Traefik Dashboard (Advanced)</summary>
          <div style={{ padding: '1rem 0' }}>
            <div className="feature-toggle-row">
              <div className="feature-toggle-info">
                <span className="feature-toggle-label">Enable Dashboard</span>
                <span className="feature-toggle-description">Access Traefik admin at traefik.{formData.ssl_domain || 'yourdomain.com'}</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={formData.ssl_traefik_dashboard_enabled ?? false}
                  onChange={(e) => setFormData({ ...formData, ssl_traefik_dashboard_enabled: e.target.checked })}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            {formData.ssl_traefik_dashboard_enabled && (
              <div className="form-row" style={{ marginTop: '1rem' }}>
                <div className="ds-form-group">
                  <label htmlFor="ssl_dashboard_user">Dashboard Username</label>
                  <input
                    id="ssl_dashboard_user"
                    type="text"
                    value={formData.ssl_traefik_dashboard_user || ''}
                    onChange={(e) => setFormData({ ...formData, ssl_traefik_dashboard_user: e.target.value })}
                    placeholder="admin"
                  />
                </div>
                <div className="ds-form-group">
                  <label htmlFor="ssl_dashboard_password">
                    Dashboard Password
                    {sslStatus?.settings.has_dashboard_password && <small style={{ marginLeft: '0.5rem', color: 'var(--color-success)' }}>(set)</small>}
                  </label>
                  <input
                    id="ssl_dashboard_password"
                    type="password"
                    value={formData.ssl_traefik_dashboard_password || ''}
                    onChange={(e) => setFormData({ ...formData, ssl_traefik_dashboard_password: e.target.value })}
                    placeholder={sslStatus?.settings.has_dashboard_password ? '••••••••' : 'Enter password'}
                  />
                </div>
              </div>
            )}
          </div>
        </details>

        {/* Generated Traefik Config */}
        {sslStatus?.traefik_config && formData.ssl_domain && formData.ssl_acme_email && (
          <details className="advanced-options" style={{ marginTop: '1rem' }}>
            <summary>Generated Docker Compose Configuration</summary>
            <div style={{ padding: '1rem 0' }}>
              <p className="small-text">Copy this configuration to your docker-compose.prod.yml file:</p>
              <div style={{ position: 'relative' }}>
                <pre style={{
                  background: 'var(--bg-body)',
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'auto',
                  maxHeight: '400px',
                  fontSize: '0.8125rem',
                  border: '1px solid var(--border-color)',
                }}>
                  {sslStatus.traefik_config}
                </pre>
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary btn-small"
                  onClick={copyConfig}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </details>
        )}

        <div className="test-button-row" style={{ marginTop: '1rem', gap: '12px', display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            className="ds-btn ds-btn-primary btn-small"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

        <div className="ds-alert ds-alert-info" style={{ marginTop: '1rem' }}>
          <strong>Deployment Steps:</strong>
          <ol style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
            <li>Point your domain's DNS A record to your server's IP address</li>
            <li>Configure the domain and ACME email above</li>
            <li>Copy the generated Docker Compose configuration to your server</li>
            <li>Run <code>docker compose -f docker-compose.prod.yml up -d</code></li>
            <li>Traefik will automatically obtain and renew Let's Encrypt certificates</li>
          </ol>
        </div>
      </div>
    </details>
  );
}

export function AdminSettings() {
  const { refreshSettings, applyThemePreview } = useSettings();

  // Consolidated loading states (replaces 7 separate useState calls)
  // IMPORTANT: Destructure to get stable function references - the hook object itself
  // is recreated each render, but the individual functions are stable (useCallback)
  const { isLoading, stopLoading, withLoading } = useLoadingStates<LoadingKey>('initial');

  // Track if initial load has completed to prevent form reset during edits
  // This is a safety guard in case other re-renders somehow trigger loadSettings
  const hasLoadedRef = useRef(false);

  // Consolidated error/success messages (replaces 2 useState calls)
  const { error, success, setError, setSuccess } = useRequestState();

  // UI state
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [demoDataEnabled, setDemoDataEnabled] = useState(false);
  const [canEnableDemo, setCanEnableDemo] = useState(false);
  const [demoUsers, setDemoUsers] = useState<Record<string, string[]>>({});

  // Scheduler state
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerJobs, setSchedulerJobs] = useState<SchedulerJob[]>([]);
  const [todaysTaskCounts, setTodaysTaskCounts] = useState<TaskCounts | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [previewData, setPreviewData] = useState<{ existing_tasks: TaskCounts; already_generated: boolean } | null>(null);
  const [rolloverResult, setRolloverResult] = useState<{ tasks_moved: number; message: string } | null>(null);
  const [whatsappTestResult, setWhatsappTestResult] = useState<{ success: boolean; message: string; test_mode?: boolean } | null>(null);
  const [ruggingGuide, setRuggingGuide] = useState<RuggingGuide>(DEFAULT_RUGGING_GUIDE);

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
    // Theme - Light mode
    theme_primary_color: '#3B82F6',
    theme_accent_color: '#10B981',
    // Theme - Dark mode
    theme_primary_color_dark: '#60A5FA',
    theme_accent_color_dark: '#34D399',
    // Theme general
    theme_font_family: 'Inter',
    theme_mode: 'auto',
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
    // Twilio credentials (shared by SMS and WhatsApp)
    sms_account_sid: '',
    sms_auth_token: '',
    // WhatsApp settings
    whatsapp_enabled: false,
    whatsapp_phone_number: '',
    whatsapp_test_mode: true,
    whatsapp_default_template: '',
    // WhatsApp notification types
    whatsapp_notify_invoice: true,
    whatsapp_notify_feed_alerts: true,
    whatsapp_notify_service_requests: true,
    whatsapp_notify_holiday_livery: true,
    access_token_expire_minutes: 30,
    refresh_token_expire_days: 7,
    frontend_url: 'http://localhost:3000',
    dev_mode: true,
    // Staff Leave Configuration
    leave_year_start_month: 1,
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

  const loadSchedulerStatus = useCallback(async () => {
    try {
      const status = await settingsApi.getSchedulerStatus();
      setSchedulerRunning(status.scheduler_running);
      setSchedulerJobs(status.jobs);
      setTodaysTaskCounts(status.todays_health_tasks);
    } catch {
      // Silently fail - scheduler status is non-essential
    }
  }, []);

  const loadSettings = useCallback(async () => {
    // Prevent re-loading form data after initial load (which would reset user edits)
    if (hasLoadedRef.current) {
      return;
    }

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
        // Theme - Light mode
        theme_primary_color: data.theme_primary_color || '#3B82F6',
        theme_accent_color: data.theme_accent_color || '#10B981',
        // Theme - Dark mode
        theme_primary_color_dark: data.theme_primary_color_dark || '#60A5FA',
        theme_accent_color_dark: data.theme_accent_color_dark || '#34D399',
        // Theme general
        theme_font_family: data.theme_font_family || 'Inter',
        theme_mode: data.theme_mode || 'auto',
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
        // Twilio credentials
        sms_account_sid: data.sms_account_sid || '',
        sms_auth_token: data.sms_auth_token || '',
        // WhatsApp settings
        whatsapp_enabled: data.whatsapp_enabled || false,
        whatsapp_phone_number: data.whatsapp_phone_number || '',
        whatsapp_test_mode: data.whatsapp_test_mode ?? true,
        whatsapp_default_template: data.whatsapp_default_template || '',
        // WhatsApp notification types
        whatsapp_notify_invoice: data.whatsapp_notify_invoice ?? true,
        whatsapp_notify_feed_alerts: data.whatsapp_notify_feed_alerts ?? true,
        whatsapp_notify_service_requests: data.whatsapp_notify_service_requests ?? true,
        whatsapp_notify_holiday_livery: data.whatsapp_notify_holiday_livery ?? true,
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
        // Staff Leave Configuration
        leave_year_start_month: data.leave_year_start_month ?? 1,
      });
      if (data.logo_url) {
        setLogoUrl(uploadsApi.getFileUrl(data.logo_url));
      }
      setDemoDataEnabled(data.demo_data_enabled || false);
      setRuggingGuide(data.rugging_guide || DEFAULT_RUGGING_GUIDE);

      try {
        const demoStatus = await settingsApi.getDemoStatus();
        setCanEnableDemo(demoStatus.can_enable_demo);
        setDemoUsers(demoStatus.demo_users || {});
      } catch {
        setCanEnableDemo(false);
        setDemoUsers({});
      }

      // Mark as loaded to prevent re-loading during edits
      hasLoadedRef.current = true;
    } catch {
      setError('Failed to load settings');
    } finally {
      stopLoading('initial');
    }
  }, [setError, stopLoading]);

  useEffect(() => {
    loadSettings();
    loadSchedulerStatus();
  }, [loadSettings, loadSchedulerStatus]);

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
    await withLoading('generating', async () => {
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
      }
    });
  };

  const handleRollover = async () => {
    setError('');
    setSuccess('');
    setRolloverResult(null);
    await withLoading('rollover', async () => {
      try {
        const result = await settingsApi.runTaskRollover();
        setRolloverResult({
          tasks_moved: result.tasks_moved,
          message: result.message,
        });
        setSuccess(result.message);
      } catch {
        setError('Failed to run task rollover');
      }
    });
  };

  const handleSaveSchedule = async () => {
    setError('');
    setSuccess('');
    await withLoading('schedule', async () => {
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
      }
    });
  };

  const handleTestWhatsApp = async () => {
    setError('');
    setSuccess('');
    setWhatsappTestResult(null);
    await withLoading('whatsapp', async () => {
      try {
        const result = await settingsApi.testWhatsApp();
        setWhatsappTestResult({
          success: true,
          message: result.message,
          test_mode: result.test_mode,
        });
        setSuccess(result.message);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to test WhatsApp';
        setWhatsappTestResult({
          success: false,
          message: message,
        });
        setError(message);
      }
    });
  };

  const handleSeedDemoData = async () => {
    setError('');
    setSuccess('');
    await withLoading('demo', async () => {
      try {
        await settingsApi.seedDemoData();
        setDemoDataEnabled(true);
        setSuccess('Demo data loaded successfully!');
        await refreshSettings();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to load demo data';
        setError(message);
      }
    });
  };

  const handleCleanDemoData = async () => {
    setError('');
    setSuccess('');
    await withLoading('demo', async () => {
      try {
        await settingsApi.cleanDemoData();
        setDemoDataEnabled(false);
        setSuccess('Demo data removed. You can now re-enable demo data.');
        await refreshSettings();
        // Refresh demo status to allow re-enabling
        const demoStatus = await settingsApi.getDemoStatus();
        setCanEnableDemo(demoStatus.can_enable_demo);
        setDemoUsers(demoStatus.demo_users || {});
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to remove demo data';
        setError(message);
      }
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    await withLoading('uploading', async () => {
      try {
        const result = await uploadsApi.uploadLogo(file);
        setLogoUrl(uploadsApi.getFileUrl(result.filename));
        setSuccess('Logo uploaded successfully');
        await refreshSettings();
      } catch {
        setError('Failed to upload logo');
      } finally {
        if (logoInputRef.current) logoInputRef.current.value = '';
      }
    });
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

  // Auto-save appearance settings immediately when changed
  const handleAppearanceChange = async (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    setFormData(newFormData);

    // Apply visual change instantly
    applyThemePreview({ [field]: value });

    try {
      await settingsApi.update({ [field]: value });
    } catch {
      setError('Failed to save appearance setting');
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

    await withLoading('saving', async () => {
      try {
        await settingsApi.update({ ...formData, rugging_guide: ruggingGuide });
        setSuccess('Settings saved successfully');
        await refreshSettings();
      } catch {
        setError('Failed to save settings');
      }
    });
  };

  if (isLoading('initial')) {
    return <div className="ds-loading">Loading settings...</div>;
  }

  return (
    <div className="admin-page settings-page">
      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleSubmit} className="settings-form">

        {/* ========== SECTION: BILLING MANAGEMENT ========== */}
        <details className="form-section">
          <summary><h3 style={{ display: 'inline' }}>Billing Management</h3></summary>

          <div className="ds-form-group" style={{ maxWidth: '200px' }}>
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
                  <div className="ds-form-group">
                    <label htmlFor="stripe_publishable_key">Publishable Key</label>
                    <input
                      id="stripe_publishable_key"
                      type="text"
                      value={formData.stripe_publishable_key || ''}
                      onChange={(e) => setFormData({ ...formData, stripe_publishable_key: e.target.value })}
                      placeholder="pk_test_... or pk_live_..."
                    />
                  </div>
                  <div className="ds-form-group">
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
                  <div className="ds-form-group">
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
        </details>

        {/* ========== SECTION: BOOKING MANAGEMENT ========== */}
        <details className="form-section">
          <summary><h3 style={{ display: 'inline' }}>Booking Management</h3></summary>

          <div className="ds-form-group" style={{ maxWidth: '200px' }}>
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
              <div className="ds-form-group">
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
              <div className="ds-form-group">
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
              <div className="ds-form-group">
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
              <div className="ds-form-group">
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
            <div className="ds-form-group">
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
        </details>

        {/* ========== SECTION: STAFF MANAGEMENT ========== */}
        <details className="form-section">
          <summary><h3 style={{ display: 'inline' }}>Staff Management</h3></summary>

          <div className="ds-form-group" style={{ maxWidth: '250px' }}>
            <label htmlFor="leave_year_start_month">Leave Year Start Month</label>
            <select
              id="leave_year_start_month"
              value={formData.leave_year_start_month ?? 1}
              onChange={(e) => setFormData({ ...formData, leave_year_start_month: parseInt(e.target.value) })}
            >
              <option value={1}>January (Calendar Year)</option>
              <option value={2}>February</option>
              <option value={3}>March</option>
              <option value={4}>April (Financial Year)</option>
              <option value={5}>May</option>
              <option value={6}>June</option>
              <option value={7}>July</option>
              <option value={8}>August</option>
              <option value={9}>September</option>
              <option value={10}>October</option>
              <option value={11}>November</option>
              <option value={12}>December</option>
            </select>
            <small>When the leave year begins (e.g., January for calendar year, April for financial year). Leave entitlement is pro-rated for staff joining or leaving mid-year.</small>
          </div>
        </details>

        {/* ========== SECTION: RUGGING GUIDE ========== */}
        <details className="form-section">
          <summary><h3 style={{ display: 'inline' }}>Rugging Guide</h3></summary>
          <p className="small-text">
            Customize rug weight suggestions shown on the weather widget. Based on{' '}
            <a href="https://www.bhs.org.uk/horse-care-and-welfare/health-care-management/seasonal-care/rugging/" target="_blank" rel="noopener noreferrer">
              BHS rugging guidance
            </a>.
          </p>

          <table className="rugging-guide-table">
            <thead>
              <tr>
                <th>Temperature</th>
                <th>Unclipped</th>
                <th>Partial Clip</th>
                <th>Fully Clipped</th>
              </tr>
            </thead>
            <tbody>
              {TEMP_RANGES.map((range) => (
                <tr key={range}>
                  <td className="temp-label">{TEMP_RANGE_LABELS[range]}</td>
                  <td>
                    <input
                      type="text"
                      value={ruggingGuide?.[range]?.unclipped || ''}
                      onChange={(e) => {
                        const newGuide = { ...ruggingGuide } as RuggingGuide;
                        newGuide[range] = { ...newGuide[range], unclipped: e.target.value };
                        setRuggingGuide(newGuide);
                      }}
                      placeholder="e.g., None, 0g, 50g"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={ruggingGuide?.[range]?.partial || ''}
                      onChange={(e) => {
                        const newGuide = { ...ruggingGuide } as RuggingGuide;
                        newGuide[range] = { ...newGuide[range], partial: e.target.value };
                        setRuggingGuide(newGuide);
                      }}
                      placeholder="e.g., 100g, 200g"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={ruggingGuide?.[range]?.fully_clipped || ''}
                      onChange={(e) => {
                        const newGuide = { ...ruggingGuide } as RuggingGuide;
                        newGuide[range] = { ...newGuide[range], fully_clipped: e.target.value };
                        setRuggingGuide(newGuide);
                      }}
                      placeholder="e.g., 300g, 400g + neck"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            className="ds-btn ds-btn-secondary btn-small"
            onClick={() => setRuggingGuide(DEFAULT_RUGGING_GUIDE)}
            style={{ marginTop: '1rem' }}
          >
            Reset to Defaults
          </button>
        </details>

        {/* ========== SECTION: VENUE DETAILS ========== */}
        <details className="form-section">
          <summary><h3 style={{ display: 'inline' }}>Venue Details</h3></summary>

          <div className="form-row">
            <div className="ds-form-group" style={{ flex: 2 }}>
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
            <div className="ds-form-group" style={{ flex: 1 }}>
              <label>Logo</label>
              {logoUrl ? (
                <div className="logo-inline-preview">
                  <img src={logoUrl} alt="Logo" />
                  <button type="button" className="btn-small" onClick={() => logoInputRef.current?.click()} disabled={isLoading('uploading')}>
                    Change
                  </button>
                  <button type="button" className="btn-small btn-danger" onClick={handleDeleteLogo} disabled={isLoading('uploading')}>
                    Remove
                  </button>
                </div>
              ) : (
                <button type="button" className="ds-btn ds-btn-secondary btn-small" onClick={() => logoInputRef.current?.click()} disabled={isLoading('uploading')}>
                  {isLoading('uploading') ? 'Uploading...' : 'Upload Logo'}
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

          <div className="ds-form-group">
            <label htmlFor="venue_tagline">Tagline</label>
            <input
              id="venue_tagline"
              type="text"
              value={formData.venue_tagline || ''}
              onChange={(e) => setFormData({ ...formData, venue_tagline: e.target.value })}
              placeholder="e.g., Premium Livery & Arena Hire"
            />
          </div>

          <div className="form-row">
            <div className="ds-form-group">
              <label htmlFor="contact_email">Email</label>
              <input
                id="contact_email"
                type="email"
                value={formData.contact_email || ''}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="contact@yourvenue.com"
              />
            </div>
            <div className="ds-form-group">
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

          <div className="ds-form-group">
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
            <div className="ds-form-group">
              <label htmlFor="address_town">Town</label>
              <input
                id="address_town"
                type="text"
                value={formData.address_town || ''}
                onChange={(e) => setFormData({ ...formData, address_town: e.target.value })}
                placeholder="e.g., Ashbourne"
              />
            </div>
            <div className="ds-form-group">
              <label htmlFor="address_county">County</label>
              <input
                id="address_county"
                type="text"
                value={formData.address_county || ''}
                onChange={(e) => setFormData({ ...formData, address_county: e.target.value })}
                placeholder="e.g., Derbyshire"
              />
            </div>
            <div className="ds-form-group" style={{ maxWidth: '140px' }}>
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

          <div className="ds-form-group" style={{ maxWidth: '200px' }}>
            <label htmlFor="what3words">What3Words</label>
            <input
              id="what3words"
              type="text"
              value={formData.what3words || ''}
              onChange={(e) => setFormData({ ...formData, what3words: e.target.value.toLowerCase() })}
              placeholder="e.g., filled.count.soap"
            />
            <small>Location identifier for emergency services</small>
          </div>

          <div className="form-subsection">
            <h4>Access & Security</h4>
            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="gate_code">Gate Code</label>
                <input
                  id="gate_code"
                  type="text"
                  value={formData.gate_code || ''}
                  onChange={(e) => setFormData({ ...formData, gate_code: e.target.value })}
                  placeholder="e.g., 1234"
                />
              </div>
              <div className="ds-form-group">
                <label htmlFor="key_safe_code">Key Safe Code</label>
                <input
                  id="key_safe_code"
                  type="text"
                  value={formData.key_safe_code || ''}
                  onChange={(e) => setFormData({ ...formData, key_safe_code: e.target.value })}
                  placeholder="e.g., 5678"
                />
              </div>
            </div>
            <div className="ds-form-group">
              <label htmlFor="security_info">Additional Security Info</label>
              <textarea
                id="security_info"
                value={formData.security_info || ''}
                onChange={(e) => setFormData({ ...formData, security_info: e.target.value })}
                placeholder="Any other security information for staff and liveries..."
                rows={3}
              />
              <small>Visible to livery clients and staff on the Security page</small>
            </div>
          </div>
        </details>

        {/* ========== SECTION: DOCUSIGN INTEGRATION ========== */}
        <DocuSignSettingsSection />

        {/* ========== SECTION: SSL/DOMAIN CONFIGURATION ========== */}
        <SSLSettingsSection />

        {/* ========== SECTION: WHATSAPP NOTIFICATIONS ========== */}
        <details className="form-section">
          <summary><h3 style={{ display: 'inline' }}>WhatsApp Notifications</h3></summary>
          <p className="small-text">Send notifications via WhatsApp using Twilio. Requires Twilio SMS credentials configured above.</p>

          <div className="feature-toggles">
            <div className="feature-toggle-block">
              <div className="feature-toggle-row">
                <div className="feature-toggle-info">
                  <span className="feature-toggle-label">WhatsApp Notifications</span>
                  <span className="feature-toggle-description">Send messages via WhatsApp Business API</span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={formData.whatsapp_enabled || false}
                    onChange={(e) => setFormData({ ...formData, whatsapp_enabled: e.target.checked })}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {formData.whatsapp_enabled && (
                <div className="feature-config">
                  <div className="ds-form-group">
                    <label htmlFor="sms_account_sid">Twilio Account SID</label>
                    <input
                      id="sms_account_sid"
                      type="text"
                      value={formData.sms_account_sid || ''}
                      onChange={(e) => setFormData({ ...formData, sms_account_sid: e.target.value })}
                      placeholder="AC..."
                    />
                  </div>
                  <div className="ds-form-group">
                    <label htmlFor="sms_auth_token">Twilio Auth Token</label>
                    <input
                      id="sms_auth_token"
                      type="password"
                      value={formData.sms_auth_token || ''}
                      onChange={(e) => setFormData({ ...formData, sms_auth_token: e.target.value })}
                      placeholder="Enter auth token"
                      autoComplete="off"
                    />
                  </div>
                  <div className="ds-form-group">
                    <label htmlFor="whatsapp_phone_number">WhatsApp Sender Number</label>
                    <input
                      id="whatsapp_phone_number"
                      type="text"
                      value={formData.whatsapp_phone_number || ''}
                      onChange={(e) => setFormData({ ...formData, whatsapp_phone_number: e.target.value })}
                      placeholder="+447123456789"
                    />
                    <small>Twilio WhatsApp-enabled number in E.164 format</small>
                  </div>

                  <div className="feature-toggle-row" style={{ marginTop: '1rem' }}>
                    <div className="feature-toggle-info">
                      <span className="feature-toggle-label">Test Mode</span>
                      <span className="feature-toggle-description">Log messages instead of sending (for testing)</span>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={formData.whatsapp_test_mode ?? true}
                        onChange={(e) => setFormData({ ...formData, whatsapp_test_mode: e.target.checked })}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>

                  <div className="ds-form-group" style={{ marginTop: '1rem' }}>
                    <label htmlFor="whatsapp_default_template">Default Template SID (Optional)</label>
                    <input
                      id="whatsapp_default_template"
                      type="text"
                      value={formData.whatsapp_default_template || ''}
                      onChange={(e) => setFormData({ ...formData, whatsapp_default_template: e.target.value })}
                      placeholder="HX..."
                    />
                    <small>Twilio Content Template SID for templated messages</small>
                  </div>

                  <div className="test-button-row" style={{ marginTop: '1rem' }}>
                    <button
                      type="button"
                      className="ds-btn ds-btn-secondary btn-small"
                      onClick={handleTestWhatsApp}
                      disabled={isLoading('whatsapp') || !formData.whatsapp_phone_number}
                    >
                      {isLoading('whatsapp') ? 'Testing...' : 'Send Test Message'}
                    </button>
                    {whatsappTestResult && (
                      <span className={`test-result ${whatsappTestResult.success ? 'success' : 'error'}`}>
                        {whatsappTestResult.message}
                        {whatsappTestResult.test_mode && ' (test mode)'}
                      </span>
                    )}
                  </div>

                  <div className="form-subsection" style={{ marginTop: '1.5rem' }}>
                    <h4>Notification Types</h4>
                    <p className="small-text">Choose which events trigger WhatsApp notifications</p>

                    <div className="notification-toggles">
                      <div className="feature-toggle-row">
                        <div className="feature-toggle-info">
                          <span className="feature-toggle-label">Invoice Delivery</span>
                          <span className="feature-toggle-description">Send billing PDFs and payment reminders</span>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={formData.whatsapp_notify_invoice ?? true}
                            onChange={(e) => setFormData({ ...formData, whatsapp_notify_invoice: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      <div className="feature-toggle-row">
                        <div className="feature-toggle-info">
                          <span className="feature-toggle-label">Feed & Medication Alerts</span>
                          <span className="feature-toggle-description">Low feed or medication supply notifications</span>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={formData.whatsapp_notify_feed_alerts ?? true}
                            onChange={(e) => setFormData({ ...formData, whatsapp_notify_feed_alerts: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      <div className="feature-toggle-row">
                        <div className="feature-toggle-info">
                          <span className="feature-toggle-label">Service Requests</span>
                          <span className="feature-toggle-description">Status updates when requests are accepted, rejected, or commented on</span>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={formData.whatsapp_notify_service_requests ?? true}
                            onChange={(e) => setFormData({ ...formData, whatsapp_notify_service_requests: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>

                      <div className="feature-toggle-row">
                        <div className="feature-toggle-info">
                          <span className="feature-toggle-label">Holiday Livery Requests</span>
                          <span className="feature-toggle-description">Status updates when holiday livery requests are accepted or rejected</span>
                        </div>
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={formData.whatsapp_notify_holiday_livery ?? true}
                            onChange={(e) => setFormData({ ...formData, whatsapp_notify_holiday_livery: e.target.checked })}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </details>

        {/* ========== SECTION: SYSTEM CAPABILITIES ========== */}
        <FeatureFlagsSettings />

        {/* ========== SAVE BUTTON ========== */}
        <div className="form-actions">
          <button type="submit" className="ds-btn ds-btn-primary" disabled={isLoading('saving')}>
            {isLoading('saving') ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* ========== ADVANCED SETTINGS (at bottom) ========== */}
      <details className="form-section advanced-section">
        <summary><h3 style={{ display: 'inline' }}>Advanced Settings</h3></summary>

        <div className="form-subsection">
          <h4>Appearance</h4>
          <div className="form-row">
            <div className="ds-form-group">
              <label htmlFor="theme_font_family">Font</label>
              <select
                id="theme_font_family"
                value={formData.theme_font_family || 'Inter'}
                onChange={(e) => handleAppearanceChange('theme_font_family', e.target.value)}
              >
                {FONT_OPTIONS.map((font) => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>
            <div className="ds-form-group">
              <label htmlFor="theme_mode">Theme</label>
              <select
                id="theme_mode"
                value={formData.theme_mode || 'auto'}
                onChange={(e) => handleAppearanceChange('theme_mode', e.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <div className="ds-form-group">
              <label htmlFor="theme_primary_color">Primary Color (Light)</label>
              <div className="color-input-group">
                <input
                  id="theme_primary_color"
                  type="color"
                  value={formData.theme_primary_color || '#3B82F6'}
                  onChange={(e) => handleAppearanceChange('theme_primary_color', e.target.value)}
                />
                <input
                  type="text"
                  value={formData.theme_primary_color || '#3B82F6'}
                  onChange={(e) => setFormData({ ...formData, theme_primary_color: e.target.value })}
                  onBlur={(e) => handleAppearanceChange('theme_primary_color', e.target.value)}
                  maxLength={7}
                  className="color-text-input"
                />
              </div>
            </div>
            <div className="ds-form-group">
              <label htmlFor="theme_accent_color">Accent Color (Light)</label>
              <div className="color-input-group">
                <input
                  id="theme_accent_color"
                  type="color"
                  value={formData.theme_accent_color || '#10B981'}
                  onChange={(e) => handleAppearanceChange('theme_accent_color', e.target.value)}
                />
                <input
                  type="text"
                  value={formData.theme_accent_color || '#10B981'}
                  onChange={(e) => setFormData({ ...formData, theme_accent_color: e.target.value })}
                  onBlur={(e) => handleAppearanceChange('theme_accent_color', e.target.value)}
                  maxLength={7}
                  className="color-text-input"
                />
              </div>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '0.5rem' }}>
            <div className="ds-form-group">
              <label htmlFor="theme_primary_color_dark">Primary Color (Dark)</label>
              <div className="color-input-group">
                <input
                  id="theme_primary_color_dark"
                  type="color"
                  value={formData.theme_primary_color_dark || '#60A5FA'}
                  onChange={(e) => handleAppearanceChange('theme_primary_color_dark', e.target.value)}
                />
                <input
                  type="text"
                  value={formData.theme_primary_color_dark || '#60A5FA'}
                  onChange={(e) => setFormData({ ...formData, theme_primary_color_dark: e.target.value })}
                  onBlur={(e) => handleAppearanceChange('theme_primary_color_dark', e.target.value)}
                  maxLength={7}
                  className="color-text-input"
                />
              </div>
            </div>
            <div className="ds-form-group">
              <label htmlFor="theme_accent_color_dark">Accent Color (Dark)</label>
              <div className="color-input-group">
                <input
                  id="theme_accent_color_dark"
                  type="color"
                  value={formData.theme_accent_color_dark || '#34D399'}
                  onChange={(e) => handleAppearanceChange('theme_accent_color_dark', e.target.value)}
                />
                <input
                  type="text"
                  value={formData.theme_accent_color_dark || '#34D399'}
                  onChange={(e) => setFormData({ ...formData, theme_accent_color_dark: e.target.value })}
                  onBlur={(e) => handleAppearanceChange('theme_accent_color_dark', e.target.value)}
                  maxLength={7}
                  className="color-text-input"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="form-subsection">
          <h4>Demo Mode</h4>
          <div className="feature-toggle-row">
            <div className="feature-toggle-info">
              <span className="feature-toggle-label">Demo Data</span>
              <span className="feature-toggle-description">
                {demoDataEnabled
                  ? 'Sample users, horses, and bookings are loaded'
                  : canEnableDemo
                    ? `Load sample data for testing (${Object.values(demoUsers).flat().length} demo users - password: password)`
                    : 'Database already has data. Demo mode only works on fresh installations.'}
              </span>
            </div>
            {(canEnableDemo || demoDataEnabled) ? (
              <>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={demoDataEnabled}
                    disabled={isLoading('demo')}
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
                {isLoading('demo') && <span className="toggle-loading">{demoDataEnabled ? 'Removing...' : 'Loading...'}</span>}
              </>
            ) : (
              <span className="toggle-status-text">Unavailable</span>
            )}
          </div>
        </div>

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
            <div className="ds-form-group">
              <label>Access Token Expiry (minutes)</label>
              <input
                type="number"
                min="5"
                value={formData.access_token_expire_minutes ?? 30}
                onChange={(e) => setFormData({ ...formData, access_token_expire_minutes: parseInt(e.target.value) || 30 })}
                style={{ maxWidth: '100px' }}
              />
            </div>
            <div className="ds-form-group">
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
          <div className="ds-form-group">
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
            <div className="ds-form-group">
              <label>Latitude</label>
              <input
                type="number"
                step="0.000001"
                value={formData.venue_latitude ?? ''}
                onChange={(e) => setFormData({ ...formData, venue_latitude: e.target.value ? parseFloat(e.target.value) : undefined })}
                placeholder="51.509865"
              />
            </div>
            <div className="ds-form-group">
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
                  <button type="button" className="ds-btn ds-btn-secondary btn-small" onClick={handlePreviewTasks}>
                    Check
                  </button>
                  <button type="button" className="ds-btn ds-btn-primary btn-small" onClick={handleGenerateTasks} disabled={isLoading('generating')}>
                    {isLoading('generating') ? 'Generating...' : 'Generate'}
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
                  <button type="button" className="ds-btn ds-btn-primary btn-small" onClick={handleRollover} disabled={isLoading('rollover')}>
                    {isLoading('rollover') ? 'Running...' : 'Run Rollover'}
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
                className="ds-btn ds-btn-primary"
                onClick={handleSaveSchedule}
                disabled={isLoading('schedule')}
              >
                {isLoading('schedule') ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </details>
        </div>

        <div className="form-actions">
          <button type="button" className="ds-btn ds-btn-primary" disabled={isLoading('saving')} onClick={handleSubmit}>
            {isLoading('saving') ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </details>
    </div>
  );
}
