import { useState, useEffect, useRef, useCallback } from 'react';
import { backupApi } from '../../services/api';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, ConfirmModal } from '../../components/ui';
import type { Backup, BackupSchedule, BackupValidationResult, BackupImportResult, DatabaseBackup } from '../../types';
import { format } from 'date-fns';
import './Admin.css';

interface ScheduleFormData {
  is_enabled: boolean;
  frequency: string;
  retention_days: number;
  s3_enabled: boolean;
}

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
  // Data Export state (JSON)
  const [backups, setBackups] = useState<Backup[]>([]);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [isCreatingExport, setIsCreatingExport] = useState(false);

  // Database Backup state (pg_dump)
  const [dbBackups, setDbBackups] = useState<DatabaseBackup[]>([]);
  const [isCreatingDbBackup, setIsCreatingDbBackup] = useState(false);
  const [deleteDbTarget, setDeleteDbTarget] = useState<DatabaseBackup | null>(null);

  // Request state
  const { loading: isLoading, error, success, setError, setSuccess, setLoading } = useRequestState(true);

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

  // Schedule modal
  const scheduleModal = useModalForm<ScheduleFormData>({
    is_enabled: false,
    frequency: 'daily',
    retention_days: 30,
    s3_enabled: false,
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Backup | null>(null);

  // Clear before restore confirmation
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [backupsData, scheduleData, dbBackupsData] = await Promise.all([
        backupApi.list(),
        backupApi.getSchedule(),
        backupApi.listDatabaseBackups(),
      ]);
      setBackups(backupsData.backups);
      setSchedule(scheduleData);
      setDbBackups(dbBackupsData.backups);
    } catch {
      setError('Failed to load backup data');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // =====================================================
  // Database Backup (pg_dump) handlers
  // =====================================================

  const handleCreateDbBackup = async () => {
    setIsCreatingDbBackup(true);
    setError('');
    setSuccess('');
    try {
      const backup = await backupApi.createDatabaseBackup();
      setDbBackups([backup, ...dbBackups]);
      setSuccess('Database backup created successfully');
    } catch {
      setError('Failed to create database backup');
    } finally {
      setIsCreatingDbBackup(false);
    }
  };

  const handleDownloadDbBackup = async (backup: DatabaseBackup) => {
    try {
      await backupApi.downloadDatabaseBackup(backup.filename);
    } catch {
      setError('Failed to download database backup');
    }
  };

  const handleDeleteDbBackup = async () => {
    if (!deleteDbTarget) return;
    try {
      await backupApi.deleteDatabaseBackup(deleteDbTarget.filename);
      setDbBackups(dbBackups.filter(b => b.filename !== deleteDbTarget.filename));
      setSuccess('Database backup deleted');
    } catch {
      setError('Failed to delete database backup');
    } finally {
      setDeleteDbTarget(null);
    }
  };

  // =====================================================
  // Data Export (JSON) handlers
  // =====================================================

  const handleCreateExport = async () => {
    setIsCreatingExport(true);
    setError('');
    setSuccess('');
    try {
      const backup = await backupApi.create();
      setBackups([backup, ...backups]);
      setSuccess('Data export created successfully');
    } catch {
      setError('Failed to create data export');
    } finally {
      setIsCreatingExport(false);
    }
  };

  const handleDownload = async (backup: Backup) => {
    try {
      await backupApi.download(backup.id);
    } catch {
      setError('Failed to download backup');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await backupApi.delete(deleteTarget.id);
      setBackups(backups.filter(b => b.id !== deleteTarget.id));
      setSuccess('Backup deleted');
      setDeleteTarget(null);
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
      setShowClearConfirm(true);
      return;
    }

    await performRestore();
  };

  const performRestore = async () => {
    if (!restoreFile) return;
    setShowClearConfirm(false);
    setIsRestoring(true);

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
      scheduleModal.open({
        is_enabled: schedule.is_enabled,
        frequency: schedule.frequency,
        retention_days: schedule.retention_days,
        s3_enabled: schedule.s3_enabled,
      });
    } else {
      scheduleModal.open({
        is_enabled: false,
        frequency: 'daily',
        retention_days: 30,
        s3_enabled: false,
      });
    }
  };

  const handleSaveSchedule = async () => {
    try {
      const updated = await backupApi.updateSchedule(scheduleModal.formData);
      setSchedule(updated);
      scheduleModal.close();
      setSuccess('Backup schedule updated');
    } catch {
      setError('Failed to update schedule');
    }
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* ============================================================ */}
      {/* DATABASE BACKUP (pg_dump) - For disaster recovery */}
      {/* ============================================================ */}
      <div className="section">
        <h2>Database Backup</h2>
        <p className="section-description">
          Full PostgreSQL backup for disaster recovery. Download to your laptop for safekeeping.
        </p>

        <div className="actions-bar" style={{ marginBottom: 'var(--space-4)' }}>
          <button
            className="ds-btn ds-btn-primary"
            onClick={handleCreateDbBackup}
            disabled={isCreatingDbBackup}
          >
            {isCreatingDbBackup ? 'Creating...' : 'Create Database Backup'}
          </button>
        </div>

        {dbBackups.length === 0 ? (
          <p className="no-data">No database backups yet. Create your first backup above.</p>
        ) : (
          <table className="ds-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Filename</th>
                <th>Size</th>
                <th>Created By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dbBackups.map(backup => (
                <tr key={backup.filename}>
                  <td>{format(new Date(backup.created_at), 'PPp')}</td>
                  <td>{backup.filename}</td>
                  <td>{formatFileSize(backup.file_size)}</td>
                  <td>{backup.created_by || '-'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="ds-btn ds-btn-secondary ds-btn-sm"
                        onClick={() => handleDownloadDbBackup(backup)}
                      >
                        Download
                      </button>
                      <button
                        className="ds-btn ds-btn-danger ds-btn-sm"
                        onClick={() => setDeleteDbTarget(backup)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ============================================================ */}
      {/* DATA EXPORT/IMPORT (JSON) - For seeding and portability */}
      {/* ============================================================ */}
      <div className="section" style={{ marginTop: 'var(--space-8)' }}>
        <h2>Data Export / Import</h2>
        <p className="section-description">
          Human-readable JSON export for seeding new environments or data portability.
        </p>

        <div className="actions-bar">
          <button
            className="ds-btn ds-btn-primary"
            onClick={handleCreateExport}
            disabled={isCreatingExport}
          >
            {isCreatingExport ? 'Creating...' : 'Export Data Now'}
          </button>
          <label className="ds-btn ds-btn-secondary">
            Validate File
            <input
              type="file"
              accept=".json"
              onChange={handleValidateFile}
              ref={validateFileInputRef}
              style={{ display: 'none' }}
            />
          </label>
          <label className="ds-btn ds-btn-warning">
            Import from File
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreFileSelect}
              ref={restoreFileInputRef}
              style={{ display: 'none' }}
            />
          </label>
          <button className="ds-btn ds-btn-secondary" onClick={openScheduleModal}>
            Schedule Settings
          </button>
        </div>

        {/* Schedule Status */}
        {schedule && (
          <div className="info-card" style={{ marginTop: 'var(--space-4)' }}>
            <h3>Automatic Exports</h3>
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
      </div>

      {/* Data Export History */}
      <div className="section">
        <h2>Export History</h2>
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
                      onClick={() => setDeleteTarget(backup)}
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
        <div className="ds-modal-overlay" onClick={() => setShowValidateModal(false)}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Backup Validation</h2>
              <button className="close-btn" onClick={() => setShowValidateModal(false)}>&times;</button>
            </div>
            <div className="ds-modal-body">
              {isValidating ? (
                <div className="ds-loading">Validating backup file...</div>
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
            <div className="ds-modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowValidateModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Modal */}
      {showRestoreModal && (
        <div className="ds-modal-overlay" onClick={closeRestoreModal}>
          <div className="ds-modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Restore from Backup</h2>
              <button className="close-btn" onClick={closeRestoreModal}>&times;</button>
            </div>
            <div className="ds-modal-body">
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
                <div className="ds-loading">Validating backup file...</div>
              )}
            </div>
            <div className="ds-modal-footer">
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
      <Modal
        isOpen={scheduleModal.isOpen}
        onClose={() => scheduleModal.close()}
        title="Backup Schedule Settings"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => scheduleModal.close()}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleSaveSchedule}>
              Save Settings
            </button>
          </>
        }
      >
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={scheduleModal.formData.is_enabled}
            onChange={e => scheduleModal.updateField('is_enabled', e.target.checked)}
          />
          Enable automatic backups
        </label>

        {scheduleModal.formData.is_enabled && (
          <>
            <label>
              Frequency
              <select
                value={scheduleModal.formData.frequency}
                onChange={e => scheduleModal.updateField('frequency', e.target.value)}
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
                value={scheduleModal.formData.retention_days}
                onChange={e => scheduleModal.updateField('retention_days', parseInt(e.target.value) || 30)}
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={scheduleModal.formData.s3_enabled}
                onChange={e => scheduleModal.updateField('s3_enabled', e.target.checked)}
              />
              Also upload to S3 (requires AWS configuration)
            </label>
          </>
        )}
      </Modal>

      {/* Delete Data Export Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Export"
        message={`Delete export ${deleteTarget?.filename}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Delete Database Backup Confirmation */}
      <ConfirmModal
        isOpen={!!deleteDbTarget}
        onClose={() => setDeleteDbTarget(null)}
        onConfirm={handleDeleteDbBackup}
        title="Delete Database Backup"
        message={`Delete database backup ${deleteDbTarget?.filename}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Clear Data Confirmation */}
      <ConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={performRestore}
        title="Clear All Data?"
        message="WARNING: You are about to clear ALL existing data before restoring. This action cannot be undone. Are you absolutely sure?"
        confirmLabel="Clear & Restore"
        variant="danger"
      />
    </div>
  );
}

export default AdminBackups;
