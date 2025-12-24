import { useState, useEffect, useRef } from 'react';
import { backupApi } from '../../services/api';
import type { Backup, BackupSchedule, BackupValidationResult, BackupImportResult } from '../../types';
import { format } from 'date-fns';
import './Admin.css';

const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminBackups() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Validation modal state
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const validateFileInputRef = useRef<HTMLInputElement>(null);

  // Restore modal state
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreValidation, setRestoreValidation] = useState<BackupValidationResult | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<BackupImportResult | null>(null);
  const [clearBeforeRestore, setClearBeforeRestore] = useState(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    is_enabled: false,
    frequency: 'daily',
    retention_days: 30,
    s3_enabled: false,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [backupsData, scheduleData] = await Promise.all([
        backupApi.list(),
        backupApi.getSchedule(),
      ]);
      setBackups(backupsData.backups);
      setSchedule(scheduleData);
    } catch {
      setError('Failed to load backup data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsCreating(true);
    setError('');
    setSuccess('');
    try {
      const backup = await backupApi.create();
      setBackups([backup, ...backups]);
      setSuccess('Backup created successfully');
    } catch {
      setError('Failed to create backup');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDownload = async (backup: Backup) => {
    try {
      await backupApi.download(backup.id);
    } catch {
      setError('Failed to download backup');
    }
  };

  const handleDelete = async (backup: Backup) => {
    if (!window.confirm(`Delete backup ${backup.filename}? This cannot be undone.`)) {
      return;
    }
    try {
      await backupApi.delete(backup.id);
      setBackups(backups.filter(b => b.id !== backup.id));
      setSuccess('Backup deleted');
    } catch {
      setError('Failed to delete backup');
    }
  };

  // Validate file handler
  const handleValidateFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsValidating(true);
    setValidationResult(null);
    setShowValidateModal(true);

    try {
      const result = await backupApi.validate(file);
      setValidationResult(result);
    } catch {
      setValidationResult({
        is_valid: false,
        errors: ['Failed to validate file'],
        warnings: [],
      });
    } finally {
      setIsValidating(false);
      if (validateFileInputRef.current) {
        validateFileInputRef.current.value = '';
      }
    }
  };

  // Restore file selection handler
  const handleRestoreFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    setRestoreValidation(null);
    setRestoreResult(null);
    setShowRestoreModal(true);

    // Validate the file first
    try {
      const result = await backupApi.validate(file);
      setRestoreValidation(result);
    } catch {
      setRestoreValidation({
        is_valid: false,
        errors: ['Failed to validate file'],
        warnings: [],
      });
    }

    if (restoreFileInputRef.current) {
      restoreFileInputRef.current.value = '';
    }
  };

  // Perform restore
  const handleRestore = async () => {
    if (!restoreFile || !restoreValidation?.is_valid) return;

    if (clearBeforeRestore) {
      const confirmed = window.confirm(
        'WARNING: You are about to clear ALL existing data before restoring. ' +
        'This action cannot be undone. Are you absolutely sure?'
      );
      if (!confirmed) return;
    }

    setIsRestoring(true);
    setError('');

    try {
      const result = await backupApi.import(restoreFile, clearBeforeRestore);
      setRestoreResult(result);
      setSuccess('Restore completed successfully');
      loadData(); // Refresh backup list
    } catch {
      setError('Restore failed. Check the file format and try again.');
    } finally {
      setIsRestoring(false);
    }
  };

  const closeRestoreModal = () => {
    setShowRestoreModal(false);
    setRestoreFile(null);
    setRestoreValidation(null);
    setRestoreResult(null);
    setClearBeforeRestore(false);
  };

  const openScheduleModal = () => {
    if (schedule) {
      setScheduleForm({
        is_enabled: schedule.is_enabled,
        frequency: schedule.frequency,
        retention_days: schedule.retention_days,
        s3_enabled: schedule.s3_enabled,
      });
    }
    setShowScheduleModal(true);
  };

  const handleSaveSchedule = async () => {
    try {
      const updated = await backupApi.updateSchedule(scheduleForm);
      setSchedule(updated);
      setShowScheduleModal(false);
      setSuccess('Backup schedule updated');
    } catch {
      setError('Failed to update schedule');
    }
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-page">

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Actions Bar */}
      <div className="actions-bar">
        <button
          className="btn btn-primary"
          onClick={handleCreateBackup}
          disabled={isCreating}
        >
          {isCreating ? 'Creating...' : 'Create Backup Now'}
        </button>
        <label className="btn btn-secondary">
          Validate File
          <input
            type="file"
            accept=".json"
            onChange={handleValidateFile}
            ref={validateFileInputRef}
            style={{ display: 'none' }}
          />
        </label>
        <label className="btn btn-warning">
          Restore from File
          <input
            type="file"
            accept=".json"
            onChange={handleRestoreFileSelect}
            ref={restoreFileInputRef}
            style={{ display: 'none' }}
          />
        </label>
        <button className="btn btn-secondary" onClick={openScheduleModal}>
          Schedule Settings
        </button>
      </div>

      {/* Schedule Status */}
      {schedule && (
        <div className="info-card">
          <h3>Automatic Backups</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Status:</span>
              <span className={`badge ${schedule.is_enabled ? 'badge-success' : 'badge-secondary'}`}>
                {schedule.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {schedule.is_enabled && (
              <>
                <div className="info-item">
                  <span className="label">Frequency:</span>
                  <span className="capitalize">{schedule.frequency}</span>
                </div>
                <div className="info-item">
                  <span className="label">Retention:</span>
                  <span>{schedule.retention_days} days</span>
                </div>
                {schedule.next_run && (
                  <div className="info-item">
                    <span className="label">Next Run:</span>
                    <span>{format(new Date(schedule.next_run), 'PPp')}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Backups List */}
      <div className="section">
        <h2>Backup History</h2>
        {backups.length === 0 ? (
          <p className="no-data">No backups yet. Create your first backup above.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Filename</th>
                <th>Size</th>
                <th>Entities</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {backups.map(backup => (
                <tr key={backup.id}>
                  <td>{format(new Date(backup.backup_date), 'PPp')}</td>
                  <td>{backup.filename}</td>
                  <td>{formatFileSize(backup.file_size)}</td>
                  <td>
                    {backup.entity_counts ? (
                      <span className="entity-counts">
                        {Object.entries(backup.entity_counts)
                          .slice(0, 3)
                          .map(([key, val]) => `${key}: ${val}`)
                          .join(', ')}
                        {Object.keys(backup.entity_counts).length > 3 && '...'}
                      </span>
                    ) : '-'}
                  </td>
                  <td>{backup.created_by_name || '-'}</td>
                  <td className="actions">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleDownload(backup)}
                    >
                      Download
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(backup)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Validation Modal */}
      {showValidateModal && (
        <div className="modal-overlay" onClick={() => setShowValidateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Backup Validation</h2>
              <button className="close-btn" onClick={() => setShowValidateModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {isValidating ? (
                <div className="loading">Validating backup file...</div>
              ) : validationResult ? (
                <>
                  <div className={`validation-status ${validationResult.is_valid ? 'valid' : 'invalid'}`}>
                    {validationResult.is_valid ? 'Backup file is valid' : 'Backup file has errors'}
                  </div>

                  {validationResult.errors.length > 0 && (
                    <div className="validation-section">
                      <h4>Errors</h4>
                      <ul className="error-list">
                        {validationResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.warnings.length > 0 && (
                    <div className="validation-section">
                      <h4>Warnings</h4>
                      <ul className="warning-list">
                        {validationResult.warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {validationResult.entity_counts && (
                    <div className="validation-section">
                      <h4>Entity Counts</h4>
                      <div className="entity-grid">
                        {Object.entries(validationResult.entity_counts).map(([key, count]) => (
                          <div key={key} className="entity-item">
                            <span className="entity-name">{key.replace(/_/g, ' ')}</span>
                            <span className="entity-count">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowValidateModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="modal-overlay" onClick={closeRestoreModal}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Restore from Backup</h2>
              <button className="close-btn" onClick={closeRestoreModal}>&times;</button>
            </div>
            <div className="modal-body">
              {restoreResult ? (
                <>
                  <div className="validation-status valid">
                    Restore completed successfully
                  </div>
                  <div className="validation-section">
                    <h4>Entities Imported</h4>
                    <div className="entity-grid">
                      {Object.entries(restoreResult.entity_counts).map(([key, count]) => (
                        <div key={key} className="entity-item">
                          <span className="entity-name">{key.replace(/_/g, ' ')}</span>
                          <span className="entity-count">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {restoreResult.logs.length > 0 && (
                    <div className="validation-section">
                      <h4>Import Log</h4>
                      <div className="log-output">
                        {restoreResult.logs.map((log, i) => (
                          <div key={i}>{log}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : restoreValidation ? (
                <>
                  <p><strong>File:</strong> {restoreFile?.name}</p>

                  <div className={`validation-status ${restoreValidation.is_valid ? 'valid' : 'invalid'}`}>
                    {restoreValidation.is_valid ? 'File is valid and ready to restore' : 'File has errors and cannot be restored'}
                  </div>

                  {restoreValidation.errors.length > 0 && (
                    <div className="validation-section">
                      <h4>Errors</h4>
                      <ul className="error-list">
                        {restoreValidation.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {restoreValidation.warnings.length > 0 && (
                    <div className="validation-section">
                      <h4>Warnings</h4>
                      <ul className="warning-list">
                        {restoreValidation.warnings.map((warn, i) => (
                          <li key={i}>{warn}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {restoreValidation.entity_counts && (
                    <div className="validation-section">
                      <h4>Entities to Import</h4>
                      <div className="entity-grid">
                        {Object.entries(restoreValidation.entity_counts).map(([key, count]) => (
                          <div key={key} className="entity-item">
                            <span className="entity-name">{key.replace(/_/g, ' ')}</span>
                            <span className="entity-count">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {restoreValidation.is_valid && (
                    <div className="restore-options">
                      <label className="checkbox-label warning-checkbox">
                        <input
                          type="checkbox"
                          checked={clearBeforeRestore}
                          onChange={e => setClearBeforeRestore(e.target.checked)}
                        />
                        <span>Clear ALL existing data before restore (destructive!)</span>
                      </label>
                      <p className="help-text">
                        {clearBeforeRestore
                          ? 'All existing data will be deleted. This cannot be undone.'
                          : 'Existing records will be skipped. Only new records will be added.'}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="loading">Validating backup file...</div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeRestoreModal}>
                {restoreResult ? 'Close' : 'Cancel'}
              </button>
              {!restoreResult && restoreValidation?.is_valid && (
                <button
                  className={`btn ${clearBeforeRestore ? 'btn-danger' : 'btn-primary'}`}
                  onClick={handleRestore}
                  disabled={isRestoring}
                >
                  {isRestoring ? 'Restoring...' : clearBeforeRestore ? 'Clear & Restore' : 'Restore'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="modal-overlay" onClick={() => setShowScheduleModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Backup Schedule Settings</h2>
              <button className="close-btn" onClick={() => setShowScheduleModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={scheduleForm.is_enabled}
                  onChange={e => setScheduleForm({ ...scheduleForm, is_enabled: e.target.checked })}
                />
                Enable automatic backups
              </label>

              {scheduleForm.is_enabled && (
                <>
                  <label>
                    Frequency
                    <select
                      value={scheduleForm.frequency}
                      onChange={e => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                    >
                      {FREQUENCY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Retention Period (days)
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={scheduleForm.retention_days}
                      onChange={e => setScheduleForm({ ...scheduleForm, retention_days: parseInt(e.target.value) || 30 })}
                    />
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={scheduleForm.s3_enabled}
                      onChange={e => setScheduleForm({ ...scheduleForm, s3_enabled: e.target.checked })}
                    />
                    Also upload to S3 (requires AWS configuration)
                  </label>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowScheduleModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveSchedule}>
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminBackups;
