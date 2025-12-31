import { useState, useEffect, useMemo, useCallback } from 'react';
import { contractsApi, usersApi } from '../../services/api';
import { useRequestState } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, Select, Textarea } from '../../components/ui';
import type {
  ContractSignatureSummary,
  ContractTemplateSummary,
  User
} from '../../types';
import { PageActions } from '../../components/admin';
import './Admin.css';

export function AdminContractSignatures() {
  const [signatures, setSignatures] = useState<ContractSignatureSummary[]>([]);
  const [templates, setTemplates] = useState<ContractTemplateSummary[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [templateFilter, setTemplateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showResignModal, setShowResignModal] = useState(false);
  const [voidConfirm, setVoidConfirm] = useState<ContractSignatureSummary | null>(null);

  // Form state
  const [requestForm, setRequestForm] = useState({
    template_id: '',
    user_id: '',
    notes: '',
  });
  const [resignForm, setResignForm] = useState({
    template_id: '',
    notes: '',
  });

  const loadData = useCallback(async () => {
    try {
      const [sigData, templateData, userData] = await Promise.all([
        contractsApi.listSignatures(),
        contractsApi.listTemplates(),
        usersApi.list(),
      ]);
      setSignatures(sigData);
      setTemplates(templateData);
      setUsers(userData);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredSignatures = useMemo(() => {
    return signatures.filter((sig) => {
      // Status filter
      if (statusFilter !== 'all' && sig.status !== statusFilter) {
        return false;
      }
      // Template filter
      if (templateFilter !== 'all' && sig.contract_version?.template_id?.toString() !== templateFilter) {
        return false;
      }
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const userName = sig.user?.full_name?.toLowerCase() || '';
        const userEmail = sig.user?.email?.toLowerCase() || '';
        const templateName = sig.contract_version?.template?.name?.toLowerCase() || '';
        if (!userName.includes(query) && !userEmail.includes(query) && !templateName.includes(query)) {
          return false;
        }
      }
      return true;
    });
  }, [signatures, statusFilter, templateFilter, searchQuery]);

  const handleRequestSignature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.template_id || !requestForm.user_id) return;
    setError('');
    setIsSubmitting(true);

    try {
      await contractsApi.requestSignature(parseInt(requestForm.template_id), {
        user_id: parseInt(requestForm.user_id),
        notes: requestForm.notes || undefined,
      });
      setShowRequestModal(false);
      setRequestForm({ template_id: '', user_id: '', notes: '' });
      await loadData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request signature';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerResign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resignForm.template_id) return;
    setError('');
    setIsSubmitting(true);

    try {
      await contractsApi.triggerResign(parseInt(resignForm.template_id), {
        notes: resignForm.notes || 'Contract terms updated',
      });
      setShowResignModal(false);
      setResignForm({ template_id: '', notes: '' });
      await loadData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to trigger re-signing';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!voidConfirm) return;
    try {
      await contractsApi.voidSignature(voidConfirm.id, 'Voided by admin');
      setVoidConfirm(null);
      await loadData();
    } catch {
      setError('Failed to void signature');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { class: string; label: string }> = {
      pending: { class: 'badge-warning', label: 'Pending' },
      sent: { class: 'badge-info', label: 'Sent' },
      signed: { class: 'badge-success', label: 'Signed' },
      declined: { class: 'badge-danger', label: 'Declined' },
      voided: { class: 'badge-secondary', label: 'Voided' },
    };
    const config = statusConfig[status] || { class: 'badge-secondary', label: status };
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get eligible users for signature requests (livery or staff)
  const eligibleUsers = useMemo(() => {
    return users.filter((u) =>
      u.role === 'livery' || u.role === 'staff' || u.role === 'admin'
    );
  }, [users]);

  // Get active templates
  const activeTemplates = useMemo(() => {
    return templates.filter((t) => t.is_active);
  }, [templates]);

  // Stats
  const stats = useMemo(() => ({
    total: signatures.length,
    pending: signatures.filter((s) => s.status === 'pending' || s.status === 'sent').length,
    signed: signatures.filter((s) => s.status === 'signed').length,
    declined: signatures.filter((s) => s.status === 'declined').length,
  }), [signatures]);

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="ds-btn ds-btn-primary" onClick={() => setShowRequestModal(true)}>
          + Request Signature
        </button>
        <button className="ds-btn ds-btn-secondary" onClick={() => setShowResignModal(true)}>
          Trigger Re-Sign
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Signatures</div>
        </div>
        <div className="stat-card stat-warning">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card stat-success">
          <div className="stat-value">{stats.signed}</div>
          <div className="stat-label">Signed</div>
        </div>
        <div className="stat-card stat-danger">
          <div className="stat-value">{stats.declined}</div>
          <div className="stat-label">Declined</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          className="ds-input"
          placeholder="Search by name, email, or template..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: '300px' }}
        />
        <select
          className="ds-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="signed">Signed</option>
          <option value="declined">Declined</option>
          <option value="voided">Voided</option>
        </select>
        <select
          className="ds-select"
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
        >
          <option value="all">All Templates</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Request Modal */}
      <Modal
        isOpen={showRequestModal}
        onClose={() => setShowRequestModal(false)}
        title="Request Signature"
        size="md"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => setShowRequestModal(false)}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleRequestSignature}
              disabled={isSubmitting || !requestForm.template_id || !requestForm.user_id}
            >
              {isSubmitting ? 'Sending...' : 'Request Signature'}
            </button>
          </>
        }
      >
        <form onSubmit={handleRequestSignature}>
          <FormGroup label="Contract Template" required>
            <Select
              value={requestForm.template_id}
              onChange={(e) => setRequestForm({ ...requestForm, template_id: e.target.value })}
              required
            >
              <option value="">-- Select Template --</option>
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (v{t.current_version_number || 1})
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="User" required>
            <Select
              value={requestForm.user_id}
              onChange={(e) => setRequestForm({ ...requestForm, user_id: e.target.value })}
              required
            >
              <option value="">-- Select User --</option>
              {eligibleUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) - {u.role}
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Notes (optional)">
            <Textarea
              value={requestForm.notes}
              onChange={(e) => setRequestForm({ ...requestForm, notes: e.target.value })}
              placeholder="Any additional notes for the user..."
              rows={3}
            />
          </FormGroup>
        </form>
      </Modal>

      {/* Re-Sign Modal */}
      <Modal
        isOpen={showResignModal}
        onClose={() => setShowResignModal(false)}
        title="Trigger Re-Signing"
        size="md"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => setShowResignModal(false)}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-warning"
              onClick={handleTriggerResign}
              disabled={isSubmitting || !resignForm.template_id}
            >
              {isSubmitting ? 'Processing...' : 'Trigger Re-Sign'}
            </button>
          </>
        }
      >
        <div className="ds-alert ds-alert-warning" style={{ marginBottom: '16px' }}>
          This will send new signature requests to all users who have previously signed this contract.
          They will see the changes highlighted when signing the new version.
        </div>
        <form onSubmit={handleTriggerResign}>
          <FormGroup label="Contract Template" required>
            <Select
              value={resignForm.template_id}
              onChange={(e) => setResignForm({ ...resignForm, template_id: e.target.value })}
              required
            >
              <option value="">-- Select Template --</option>
              {activeTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (v{t.current_version_number || 1})
                </option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Reason for Re-Signing">
            <Textarea
              value={resignForm.notes}
              onChange={(e) => setResignForm({ ...resignForm, notes: e.target.value })}
              placeholder="e.g., Updated terms and conditions..."
              rows={3}
            />
          </FormGroup>
        </form>
      </Modal>

      {/* Void Confirmation */}
      <ConfirmModal
        isOpen={!!voidConfirm}
        onClose={() => setVoidConfirm(null)}
        onConfirm={handleVoid}
        title="Void Signature Request"
        message={`Are you sure you want to void the signature request for ${voidConfirm?.user?.full_name}? This will cancel the DocuSign envelope.`}
        confirmLabel="Void"
        variant="danger"
      />

      {/* Signatures Table */}
      <table className="admin-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Contract</th>
            <th>Version</th>
            <th>Status</th>
            <th>Requested</th>
            <th>Signed</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSignatures.map((sig) => (
            <tr key={sig.id}>
              <td>
                <strong>{sig.user?.full_name || 'Unknown'}</strong>
                <div className="small-text">{sig.user?.email}</div>
              </td>
              <td>
                {sig.contract_version?.template?.name || 'Unknown Template'}
              </td>
              <td>v{sig.contract_version?.version_number || '?'}</td>
              <td>{getStatusBadge(sig.status)}</td>
              <td>
                {formatDate(sig.requested_at)}
                {sig.requested_by && (
                  <div className="small-text">by {sig.requested_by.full_name}</div>
                )}
              </td>
              <td>{formatDate(sig.signed_at)}</td>
              <td className="actions-cell">
                {(sig.status === 'pending' || sig.status === 'sent') && (
                  <button
                    className="btn-small btn-danger"
                    onClick={() => setVoidConfirm(sig)}
                  >
                    Void
                  </button>
                )}
                {sig.signed_pdf_filename && (
                  <a
                    href={`/api/uploads/${sig.signed_pdf_filename}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-small"
                  >
                    Download PDF
                  </a>
                )}
                {sig.notes && (
                  <span className="small-text" title={sig.notes}>
                    (has notes)
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredSignatures.length === 0 && (
        <div className="ds-empty">
          <p>
            {signatures.length === 0
              ? 'No signature requests yet. Click "Request Signature" to send a contract for signing.'
              : 'No signatures match your filters.'}
          </p>
        </div>
      )}

      <style>{`
        .stats-row {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
        }
        .stat-card {
          flex: 1;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          text-align: center;
        }
        .stat-card.stat-warning {
          background: #fff3cd;
        }
        .stat-card.stat-success {
          background: #d4edda;
        }
        .stat-card.stat-danger {
          background: #f8d7da;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #333;
        }
        .stat-label {
          font-size: 12px;
          color: #666;
          margin-top: 4px;
        }
        .filter-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 20px;
        }
        .filter-bar .ds-select {
          min-width: 150px;
        }
      `}</style>
    </div>
  );
}
