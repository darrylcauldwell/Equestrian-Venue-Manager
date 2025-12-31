import { useState, useEffect, useCallback } from 'react';
import { complianceApi, usersApi } from '../../services/api';
import type { ComplianceItem, CreateComplianceItem, ComplianceCategory, ComplianceDashboard, User } from '../../types';
import { format } from 'date-fns';
import { PageActions } from '../../components/admin';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../../components/ui';
import './Admin.css';

const CATEGORY_LABELS: Record<ComplianceCategory, string> = {
  insurance: 'Insurance',
  fire_safety: 'Fire Safety',
  electrical: 'Electrical',
  equipment: 'Equipment',
  first_aid: 'First Aid',
  health_safety: 'Health & Safety',
  other: 'Other',
};

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Monthly' },
  { value: 3, label: 'Quarterly' },
  { value: 6, label: 'Bi-annually' },
  { value: 12, label: 'Annually' },
  { value: 24, label: 'Every 2 years' },
  { value: 60, label: 'Every 5 years' },
];

export function AdminCompliance() {
  // Data state
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);

  // Request state
  const { loading: isLoading, error, success, setError, setSuccess, setLoading } = useRequestState(true);

  // Modal hooks
  const itemModal = useModalForm<CreateComplianceItem>({
    name: '',
    category: 'insurance',
    renewal_frequency_months: 12,
    reminder_days_before: 30,
  });

  const completeModal = useModalForm({
    completed_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    cost: '',
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ComplianceItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [dashboardData, itemsData, usersData] = await Promise.all([
        complianceApi.getDashboard(),
        complianceApi.list(!showInactive, filterCategory || undefined),
        usersApi.list(),
      ]);
      setDashboard(dashboardData);
      setItems(itemsData);
      setUsers(usersData);
    } catch {
      setError('Failed to load compliance data');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, showInactive, setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openModal = (item?: ComplianceItem) => {
    if (item) {
      itemModal.edit(item.id, {
        name: item.name,
        category: item.category,
        description: item.description,
        reference_number: item.reference_number,
        provider: item.provider,
        renewal_frequency_months: item.renewal_frequency_months,
        next_due_date: item.next_due_date ? item.next_due_date.slice(0, 10) : undefined,
        reminder_days_before: item.reminder_days_before,
        responsible_user_id: item.responsible_user_id,
        notes: item.notes,
      });
    } else {
      itemModal.open();
    }
  };

  const handleSubmit = async () => {
    setError('');
    try {
      if (itemModal.isEditing && itemModal.editingId) {
        await complianceApi.update(itemModal.editingId, itemModal.formData);
        setSuccess('Item updated successfully');
      } else {
        await complianceApi.create(itemModal.formData);
        setSuccess('Item created successfully');
      }
      itemModal.close();
      await loadData();
    } catch {
      setError('Failed to save compliance item');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      await complianceApi.delete(deleteTarget.id);
      setSuccess('Item deleted');
      setDeleteTarget(null);
      await loadData();
    } catch {
      setError('Failed to delete item');
    }
  };

  const toggleActive = async (item: ComplianceItem) => {
    try {
      await complianceApi.update(item.id, { is_active: !item.is_active });
      await loadData();
    } catch {
      setError('Failed to update item');
    }
  };

  const openCompleteModal = (item: ComplianceItem) => {
    completeModal.edit(item.id, {
      completed_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      cost: '',
    });
  };

  const getCompletingItemName = () => {
    if (!completeModal.editingId) return '';
    return items.find(i => i.id === completeModal.editingId)?.name || '';
  };

  const handleComplete = async () => {
    if (!completeModal.editingId) return;
    setError('');
    try {
      await complianceApi.complete(completeModal.editingId, {
        completed_date: new Date(completeModal.formData.completed_date).toISOString(),
        notes: completeModal.formData.notes || undefined,
        cost: completeModal.formData.cost ? parseFloat(completeModal.formData.cost) : undefined,
      });
      setSuccess(`${getCompletingItemName()} marked as completed`);
      completeModal.close();
      await loadData();
    } catch {
      setError('Failed to complete item');
    }
  };

  const getStatusClass = (item: ComplianceItem): string => {
    if (item.is_overdue) return 'status-overdue';
    if (item.days_until_due !== undefined && item.days_until_due <= item.reminder_days_before) return 'status-due-soon';
    return 'status-ok';
  };

  const getStatusText = (item: ComplianceItem): string => {
    if (item.is_overdue) return `Overdue by ${Math.abs(item.days_until_due || 0)} days`;
    if (item.days_until_due !== undefined && item.days_until_due <= item.reminder_days_before) return `Due in ${item.days_until_due} days`;
    if (item.days_until_due !== undefined) return `${item.days_until_due} days until due`;
    return 'No due date set';
  };

  if (isLoading) {
    return <div className="ds-loading">Loading compliance data...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="ds-btn ds-btn-primary" onClick={() => openModal()}>
          Add Compliance Item
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Dashboard Summary */}
      {dashboard && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{dashboard.total_items}</div>
            <div className="stat-label">Total Items</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #dc2626' }}>
            <div className="stat-value" style={{ color: '#dc2626' }}>{dashboard.overdue_count}</div>
            <div className="stat-label">Overdue</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="stat-value" style={{ color: '#f59e0b' }}>{dashboard.due_soon_count}</div>
            <div className="stat-label">Due Soon</div>
          </div>
          <div className="stat-card" style={{ borderLeft: '4px solid #10b981' }}>
            <div className="stat-value" style={{ color: '#10b981' }}>{dashboard.up_to_date_count}</div>
            <div className="stat-label">Up to Date</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <FormGroup label="Category">
            <Select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </FormGroup>
        </div>
        <div className="filter-group">
          <label>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
            />
            Show Inactive
          </label>
        </div>
      </div>

      {/* Items List */}
      <div className="compliance-list">
        {items.map(item => (
          <ComplianceCard
            key={item.id}
            item={item}
            categoryLabel={CATEGORY_LABELS[item.category]}
            frequencyLabel={FREQUENCY_OPTIONS.find(f => f.value === item.renewal_frequency_months)?.label || `${item.renewal_frequency_months} months`}
            statusClass={getStatusClass(item)}
            statusText={getStatusText(item)}
            onComplete={() => openCompleteModal(item)}
            onEdit={() => openModal(item)}
            onToggleActive={() => toggleActive(item)}
            onDelete={() => setDeleteTarget(item)}
          />
        ))}
      </div>

      {items.length === 0 && (
        <div className="ds-empty">
          <p>No compliance items found.</p>
          <p>Add items to track insurance renewals, safety certifications, and more.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={itemModal.isOpen}
        onClose={itemModal.close}
        title={itemModal.isEditing ? 'Edit Compliance Item' : 'Add Compliance Item'}
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={itemModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmit}>
              {itemModal.isEditing ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <FormGroup label="Name" required>
          <Input
            value={itemModal.formData.name}
            onChange={e => itemModal.updateField('name', e.target.value)}
            placeholder="e.g., Public Liability Insurance"
            required
          />
        </FormGroup>

        <FormRow>
          <FormGroup label="Category">
            <Select
              value={itemModal.formData.category}
              onChange={e => itemModal.updateField('category', e.target.value as ComplianceCategory)}
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </FormGroup>
          <FormGroup label="Renewal Frequency">
            <Select
              value={itemModal.formData.renewal_frequency_months}
              onChange={e => itemModal.updateField('renewal_frequency_months', parseInt(e.target.value))}
            >
              {FREQUENCY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </FormGroup>
        </FormRow>

        <FormGroup label="Description">
          <Textarea
            value={itemModal.formData.description || ''}
            onChange={e => itemModal.updateField('description', e.target.value)}
            placeholder="Details about this compliance requirement..."
            rows={3}
          />
        </FormGroup>

        <FormRow>
          <FormGroup label="Reference/Policy Number">
            <Input
              value={itemModal.formData.reference_number || ''}
              onChange={e => itemModal.updateField('reference_number', e.target.value)}
              placeholder="e.g., POL-123456"
            />
          </FormGroup>
          <FormGroup label="Provider/Company">
            <Input
              value={itemModal.formData.provider || ''}
              onChange={e => itemModal.updateField('provider', e.target.value)}
              placeholder="e.g., ABC Insurance Ltd"
            />
          </FormGroup>
        </FormRow>

        <FormRow>
          <FormGroup label="Next Due Date">
            <Input
              type="date"
              value={itemModal.formData.next_due_date || ''}
              onChange={e => itemModal.updateField('next_due_date', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Reminder (days before)">
            <Input
              type="number"
              value={itemModal.formData.reminder_days_before}
              onChange={e => itemModal.updateField('reminder_days_before', parseInt(e.target.value) || 30)}
              min={1}
            />
          </FormGroup>
        </FormRow>

        <FormGroup label="Responsible Person">
          <Select
            value={itemModal.formData.responsible_user_id || ''}
            onChange={e => itemModal.updateField('responsible_user_id', e.target.value ? parseInt(e.target.value) : undefined)}
          >
            <option value="">Not assigned</option>
            {users.filter(u => u.role === 'admin').map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Notes">
          <Textarea
            value={itemModal.formData.notes || ''}
            onChange={e => itemModal.updateField('notes', e.target.value)}
            placeholder="Any additional notes..."
            rows={2}
          />
        </FormGroup>
      </Modal>

      {/* Complete Modal */}
      <Modal
        isOpen={completeModal.isOpen}
        onClose={completeModal.close}
        title="Mark as Completed"
        size="sm"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={completeModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleComplete}>Mark Complete</button>
          </>
        }
      >
        <p className="modal-subtitle">Recording completion for: {getCompletingItemName()}</p>

        <FormGroup label="Completion Date" required>
          <Input
            type="date"
            value={completeModal.formData.completed_date}
            onChange={e => completeModal.updateField('completed_date', e.target.value)}
            required
          />
        </FormGroup>

        <FormGroup label="Cost (optional)">
          <Input
            type="number"
            step="0.01"
            value={completeModal.formData.cost}
            onChange={e => completeModal.updateField('cost', e.target.value)}
            placeholder="0.00"
          />
        </FormGroup>

        <FormGroup label="Notes">
          <Textarea
            value={completeModal.formData.notes}
            onChange={e => completeModal.updateField('notes', e.target.value)}
            placeholder="Renewal details, certificate reference, etc."
            rows={3}
          />
        </FormGroup>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Compliance Item"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete its history.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

// Extracted ComplianceCard component
interface ComplianceCardProps {
  item: ComplianceItem;
  categoryLabel: string;
  frequencyLabel: string;
  statusClass: string;
  statusText: string;
  onComplete: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}

function ComplianceCard({
  item,
  categoryLabel,
  frequencyLabel,
  statusClass,
  statusText,
  onComplete,
  onEdit,
  onToggleActive,
  onDelete,
}: ComplianceCardProps) {
  return (
    <div className={`compliance-card ${statusClass} ${!item.is_active ? 'inactive' : ''}`}>
      <div className="compliance-header">
        <div className="compliance-title">
          <h3>{item.name}</h3>
          <span className="category-badge">{categoryLabel}</span>
        </div>
        <div className={`status-indicator ${statusClass}`}>
          {statusText}
        </div>
      </div>
      <div className="compliance-body">
        {item.description && <p className="compliance-description">{item.description}</p>}
        <div className="compliance-details">
          <div><strong>Frequency:</strong> {frequencyLabel}</div>
          {item.next_due_date && (
            <div><strong>Next Due:</strong> {format(new Date(item.next_due_date), 'dd MMM yyyy')}</div>
          )}
          {item.last_completed_date && (
            <div><strong>Last Completed:</strong> {format(new Date(item.last_completed_date), 'dd MMM yyyy')}</div>
          )}
          {item.provider && <div><strong>Provider:</strong> {item.provider}</div>}
          {item.reference_number && <div><strong>Reference:</strong> {item.reference_number}</div>}
          {item.responsible_user_name && <div><strong>Responsible:</strong> {item.responsible_user_name}</div>}
        </div>
      </div>
      <div className="compliance-actions">
        <button className="btn-small btn-success" onClick={onComplete}>Mark Complete</button>
        <button className="btn-small" onClick={onEdit}>Edit</button>
        <button
          className={`btn-small ${item.is_active ? 'btn-warning' : ''}`}
          onClick={onToggleActive}
        >
          {item.is_active ? 'Disable' : 'Enable'}
        </button>
        <button className="btn-small btn-danger" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
