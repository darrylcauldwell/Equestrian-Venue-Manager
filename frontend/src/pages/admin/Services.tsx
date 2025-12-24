import { useState, useEffect } from 'react';
import { servicesApi } from '../../services/api';
import type { Service, CreateService, ServiceCategory } from '../../types';
import { PageActions } from '../../components/admin';
import './Admin.css';

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  exercise: 'Exercise',
  schooling: 'Schooling',
  grooming: 'Grooming',
  third_party: 'Third Party',
  rehab: 'Rehab Assistance',
};

export function AdminServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<CreateService>({
    id: '',
    category: 'exercise',
    name: '',
    description: '',
    duration_minutes: undefined,
    price_gbp: 0,
    requires_approval: false,
    approval_reason: '',
    advance_notice_hours: 24,
    is_active: true,
    notes: '',
  });

  const loadServices = async () => {
    try {
      const data = await servicesApi.listAll();
      setServices(data);
    } catch {
      setError('Failed to load services');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (editingService) {
        const { id, category, ...updateData } = formData;
        await servicesApi.update(editingService.id, updateData);
      } else {
        await servicesApi.create(formData);
      }
      setShowForm(false);
      setEditingService(null);
      resetForm();
      await loadServices();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save service';
      setError(errorMessage);
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      category: 'exercise',
      name: '',
      description: '',
      duration_minutes: undefined,
      price_gbp: 0,
      requires_approval: false,
      approval_reason: '',
      advance_notice_hours: 24,
      is_active: true,
      notes: '',
    });
  };

  const handleEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      id: service.id,
      category: service.category,
      name: service.name,
      description: service.description || '',
      duration_minutes: service.duration_minutes,
      price_gbp: service.price_gbp,
      requires_approval: service.requires_approval,
      approval_reason: service.approval_reason || '',
      advance_notice_hours: service.advance_notice_hours,
      is_active: service.is_active,
      notes: service.notes || '',
    });
    setShowForm(true);
  };

  const handleToggleActive = async (service: Service) => {
    try {
      await servicesApi.update(service.id, { is_active: !service.is_active });
      await loadServices();
    } catch {
      setError('Failed to update service status');
    }
  };

  const handleDelete = async (service: Service) => {
    if (!confirm(`Are you sure you want to delete "${service.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await servicesApi.delete(service.id);
      await loadServices();
    } catch {
      setError('Cannot delete service with existing requests. Deactivate it instead.');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingService(null);
    resetForm();
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add Service
        </button>
      </PageActions>

      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="admin-form-container">
          <form onSubmit={handleSubmit} className="admin-form">
            <h2>{editingService ? 'Edit Service' : 'Add New Service'}</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="id">Service ID</label>
                <input
                  id="id"
                  type="text"
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g., basic_exercise"
                  required
                  disabled={!!editingService}
                />
                <small>Unique identifier (no spaces, lowercase)</small>
              </div>

              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as ServiceCategory })}
                  required
                  disabled={!!editingService}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="name">Service Name</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Basic Exercise (20 mins)"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the service..."
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="price_gbp">Price (£)</label>
                <input
                  id="price_gbp"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_gbp}
                  onChange={(e) => setFormData({ ...formData, price_gbp: parseFloat(e.target.value) || 0 })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="duration_minutes">Duration (minutes)</label>
                <input
                  id="duration_minutes"
                  type="number"
                  min="0"
                  value={formData.duration_minutes ?? ''}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder="e.g., 30"
                />
              </div>

              <div className="form-group">
                <label htmlFor="advance_notice_hours">Advance Notice (hours)</label>
                <input
                  id="advance_notice_hours"
                  type="number"
                  min="0"
                  value={formData.advance_notice_hours ?? 24}
                  onChange={(e) => setFormData({ ...formData, advance_notice_hours: parseInt(e.target.value) || 24 })}
                />
              </div>
            </div>

            <div className="form-row checkboxes">
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.requires_approval || false}
                    onChange={(e) => setFormData({ ...formData, requires_approval: e.target.checked })}
                  />
                  Requires Approval
                </label>
                <small>Requests must be approved by admin before scheduling</small>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.is_active ?? true}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Active
                </label>
                <small>Service is available for booking</small>
              </div>
            </div>

            {formData.requires_approval && (
              <div className="form-group">
                <label htmlFor="approval_reason">Approval Reason</label>
                <input
                  id="approval_reason"
                  type="text"
                  value={formData.approval_reason}
                  onChange={(e) => setFormData({ ...formData, approval_reason: e.target.value })}
                  placeholder="Why does this service require approval?"
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="notes">Admin Notes</label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Internal notes (not shown to clients)..."
                rows={2}
              />
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleCancel} className="btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                {editingService ? 'Save Changes' : 'Create Service'}
              </button>
            </div>

            {editingService && (
              <div className="danger-zone">
                <h3>Danger Zone</h3>
                <div className="danger-actions">
                  <div className="danger-action">
                    <div>
                      <strong>{editingService.is_active ? 'Disable Service' : 'Enable Service'}</strong>
                      <p>{editingService.is_active
                        ? 'Hide this service from clients. Can be re-enabled later.'
                        : 'Make this service available for booking again.'}</p>
                    </div>
                    <button
                      type="button"
                      className={`btn-small ${editingService.is_active ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => {
                        handleToggleActive(editingService);
                        handleCancel();
                      }}
                    >
                      {editingService.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                  <div className="danger-action">
                    <div>
                      <strong>Delete Service</strong>
                      <p>Permanently delete this service. This cannot be undone.</p>
                    </div>
                    <button
                      type="button"
                      className="btn-small btn-danger"
                      onClick={() => {
                        handleDelete(editingService);
                        handleCancel();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Category</th>
            <th>Price</th>
            <th>Duration</th>
            <th>Notice</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {services.map((service) => (
            <tr key={service.id}>
              <td>
                <strong>{service.name}</strong>
                {service.description && <div className="small-text">{service.description}</div>}
                <div className="small-text muted">ID: {service.id}</div>
              </td>
              <td>{CATEGORY_LABELS[service.category] || service.category}</td>
              <td>£{Number(service.price_gbp).toFixed(2)}</td>
              <td>{service.duration_minutes ? `${service.duration_minutes} min` : '-'}</td>
              <td>{service.advance_notice_hours}h</td>
              <td>
                <span className={`badge ${service.is_active ? 'active' : 'inactive'}`}>
                  {service.is_active ? 'Active' : 'Inactive'}
                </span>
                {service.requires_approval && (
                  <span className="badge approval">Approval</span>
                )}
              </td>
              <td>
                <button className="btn-small" onClick={() => handleEdit(service)}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {services.length === 0 && (
        <div className="empty-state">
          <p>No services configured yet. Click "Add Service" to create your first service.</p>
        </div>
      )}
    </div>
  );
}
