import { useState, useEffect, useCallback } from 'react';
import { complianceApi, usersApi } from '../../services/api';
import type { ComplianceItem, CreateComplianceItem, ComplianceCategory, ComplianceDashboard, User } from '../../types';
import { format } from 'date-fns';
import { PageActions } from '../../components/admin';
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
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [items, setItems] = useState<ComplianceItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ComplianceItem | null>(null);
  const [formData, setFormData] = useState<CreateComplianceItem>({
    name: '',
    category: 'insurance',
    renewal_frequency_months: 12,
    reminder_days_before: 30,
  });

  // Complete modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingItem, setCompletingItem] = useState<ComplianceItem | null>(null);
  const [completeData, setCompleteData] = useState({
    completed_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
    cost: '',
  });

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
      setIsLoading(false);
    }
  }, [filterCategory, showInactive]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openModal = (item?: ComplianceItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({
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
      setEditingItem(null);
      setFormData({
        name: '',
        category: 'insurance',
        renewal_frequency_months: 12,
        reminder_days_before: 30,
      });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingItem) {
        await complianceApi.update(editingItem.id, formData);
        setSuccess('Item updated successfully');
      } else {
        await complianceApi.create(formData);
        setSuccess('Item created successfully');
      }
      setShowModal(false);
      await loadData();
    } catch {
      setError('Failed to save compliance item');
    }
  };

  const handleDelete = async (item: ComplianceItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"? This will also delete its history.`)) return;
    setError('');
    try {
      await complianceApi.delete(item.id);
      setSuccess('Item deleted');
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
    setCompletingItem(item);
    setCompleteData({
      completed_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
      cost: '',
    });
    setShowCompleteModal(true);
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingItem) return;
    setError('');
    try {
      await complianceApi.complete(completingItem.id, {
        completed_date: new Date(completeData.completed_date).toISOString(),
        notes: completeData.notes || undefined,
        cost: completeData.cost ? parseFloat(completeData.cost) : undefined,
      });
      setSuccess(`${completingItem.name} marked as completed`);
      setShowCompleteModal(false);
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
    return <div className="loading">Loading compliance data...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="btn-primary" onClick={() => openModal()}>
          Add Compliance Item
        </button>
      </PageActions>

      {error && <div className="error-message">{error}</div>}
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
          <label>Category:</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
            <option value="">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
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
          <div key={item.id} className={`compliance-card ${getStatusClass(item)} ${!item.is_active ? 'inactive' : ''}`}>
            <div className="compliance-header">
              <div className="compliance-title">
                <h3>{item.name}</h3>
                <span className="category-badge">{CATEGORY_LABELS[item.category]}</span>
              </div>
              <div className={`status-indicator ${getStatusClass(item)}`}>
                {getStatusText(item)}
              </div>
            </div>
            <div className="compliance-body">
              {item.description && <p className="compliance-description">{item.description}</p>}
              <div className="compliance-details">
                <div>
                  <strong>Frequency:</strong> {FREQUENCY_OPTIONS.find(f => f.value === item.renewal_frequency_months)?.label || `${item.renewal_frequency_months} months`}
                </div>
                {item.next_due_date && (
                  <div>
                    <strong>Next Due:</strong> {format(new Date(item.next_due_date), 'dd MMM yyyy')}
                  </div>
                )}
                {item.last_completed_date && (
                  <div>
                    <strong>Last Completed:</strong> {format(new Date(item.last_completed_date), 'dd MMM yyyy')}
                  </div>
                )}
                {item.provider && (
                  <div>
                    <strong>Provider:</strong> {item.provider}
                  </div>
                )}
                {item.reference_number && (
                  <div>
                    <strong>Reference:</strong> {item.reference_number}
                  </div>
                )}
                {item.responsible_user_name && (
                  <div>
                    <strong>Responsible:</strong> {item.responsible_user_name}
                  </div>
                )}
              </div>
            </div>
            <div className="compliance-actions">
              <button className="btn-small btn-success" onClick={() => openCompleteModal(item)}>
                Mark Complete
              </button>
              <button className="btn-small" onClick={() => openModal(item)}>
                Edit
              </button>
              <button
                className={`btn-small ${item.is_active ? 'btn-warning' : ''}`}
                onClick={() => toggleActive(item)}
              >
                {item.is_active ? 'Disable' : 'Enable'}
              </button>
              <button className="btn-small btn-danger" onClick={() => handleDelete(item)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          <p>No compliance items found.</p>
          <p>Add items to track insurance renewals, safety certifications, and more.</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingItem ? 'Edit Compliance Item' : 'Add Compliance Item'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="item-name">Name</label>
                <input
                  id="item-name"
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Public Liability Insurance"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="item-category">Category</label>
                  <select
                    id="item-category"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value as ComplianceCategory })}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="item-frequency">Renewal Frequency</label>
                  <select
                    id="item-frequency"
                    value={formData.renewal_frequency_months}
                    onChange={e => setFormData({ ...formData, renewal_frequency_months: parseInt(e.target.value) })}
                  >
                    {FREQUENCY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="item-description">Description</label>
                <textarea
                  id="item-description"
                  value={formData.description || ''}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Details about this compliance requirement..."
                  rows={3}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="item-reference">Reference/Policy Number</label>
                  <input
                    id="item-reference"
                    type="text"
                    value={formData.reference_number || ''}
                    onChange={e => setFormData({ ...formData, reference_number: e.target.value })}
                    placeholder="e.g., POL-123456"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="item-provider">Provider/Company</label>
                  <input
                    id="item-provider"
                    type="text"
                    value={formData.provider || ''}
                    onChange={e => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="e.g., ABC Insurance Ltd"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="item-due-date">Next Due Date</label>
                  <input
                    id="item-due-date"
                    type="date"
                    value={formData.next_due_date || ''}
                    onChange={e => setFormData({ ...formData, next_due_date: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="item-reminder">Reminder (days before)</label>
                  <input
                    id="item-reminder"
                    type="number"
                    value={formData.reminder_days_before}
                    onChange={e => setFormData({ ...formData, reminder_days_before: parseInt(e.target.value) || 30 })}
                    min={1}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="item-responsible">Responsible Person</label>
                <select
                  id="item-responsible"
                  value={formData.responsible_user_id || ''}
                  onChange={e => setFormData({ ...formData, responsible_user_id: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <option value="">Not assigned</option>
                  {users.filter(u => u.role === 'admin').map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="item-notes">Notes</label>
                <textarea
                  id="item-notes"
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Any additional notes..."
                  rows={2}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingItem ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && completingItem && (
        <div className="modal-overlay" onClick={() => setShowCompleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Mark as Completed</h2>
            <p className="modal-subtitle">Recording completion for: {completingItem.name}</p>
            <form onSubmit={handleComplete}>
              <div className="form-group">
                <label htmlFor="complete-date">Completion Date</label>
                <input
                  id="complete-date"
                  type="date"
                  value={completeData.completed_date}
                  onChange={e => setCompleteData({ ...completeData, completed_date: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="complete-cost">Cost (optional)</label>
                <input
                  id="complete-cost"
                  type="number"
                  step="0.01"
                  value={completeData.cost}
                  onChange={e => setCompleteData({ ...completeData, cost: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label htmlFor="complete-notes">Notes</label>
                <textarea
                  id="complete-notes"
                  value={completeData.notes}
                  onChange={e => setCompleteData({ ...completeData, notes: e.target.value })}
                  placeholder="Renewal details, certificate reference, etc."
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCompleteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Mark Complete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
