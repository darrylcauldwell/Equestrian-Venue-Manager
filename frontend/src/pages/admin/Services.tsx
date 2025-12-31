import { useState, useEffect, useCallback } from 'react';
import { servicesApi } from '../../services/api';
import { useModalForm, useRequestState } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../../components/ui';
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

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);

  // Modal hook
  const serviceModal = useModalForm<CreateService>({
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
    is_insurance_claimable: false,
  });

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const loadServices = useCallback(async () => {
    try {
      const data = await servicesApi.listAll();
      setServices(data);
    } catch {
      setError('Failed to load services');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // Track editing service ID separately since Services use string IDs
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (serviceModal.isEditing && editingServiceId) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, category: _category, ...updateData } = serviceModal.formData;
        await servicesApi.update(editingServiceId, updateData);
      } else {
        await servicesApi.create(serviceModal.formData);
      }
      serviceModal.close();
      setEditingServiceId(null);
      await loadServices();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save service';
      setError(errorMessage);
    }
  };

  const handleEdit = (service: Service) => {
    setEditingServiceId(service.id);
    serviceModal.edit(0, {  // Use 0 as dummy ID, we track real ID separately
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
      is_insurance_claimable: service.is_insurance_claimable || false,
    });
  };

  const handleToggleActive = async (service: Service) => {
    try {
      await servicesApi.update(service.id, { is_active: !service.is_active });
      await loadServices();
    } catch {
      setError('Failed to update service status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await servicesApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadServices();
    } catch {
      setError('Cannot delete service with existing requests. Deactivate it instead.');
    }
  };

  // Helper to get the currently editing service
  const getEditingService = (): Service | null => {
    if (!editingServiceId) return null;
    return services.find(s => s.id === editingServiceId) || null;
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="ds-btn ds-btn-primary" onClick={() => serviceModal.open()}>
          + Add Service
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Service Modal */}
      <Modal
        isOpen={serviceModal.isOpen}
        onClose={serviceModal.close}
        title={serviceModal.isEditing ? 'Edit Service' : 'Add New Service'}
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={serviceModal.close}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmit}>
              {serviceModal.isEditing ? 'Save Changes' : 'Create Service'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormGroup label="Service ID" required>
              <Input
                value={serviceModal.formData.id}
                onChange={(e) => serviceModal.updateField('id', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                placeholder="e.g., basic_exercise"
                required
                disabled={serviceModal.isEditing}
              />
              <small>Unique identifier (no spaces, lowercase)</small>
            </FormGroup>

            <FormGroup label="Category" required>
              <Select
                value={serviceModal.formData.category}
                onChange={(e) => serviceModal.updateField('category', e.target.value as ServiceCategory)}
                required
                disabled={serviceModal.isEditing}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormGroup>
          </FormRow>

          <FormGroup label="Service Name" required>
            <Input
              value={serviceModal.formData.name}
              onChange={(e) => serviceModal.updateField('name', e.target.value)}
              placeholder="e.g., Basic Exercise (20 mins)"
              required
            />
          </FormGroup>

          <FormGroup label="Description">
            <Textarea
              value={serviceModal.formData.description || ''}
              onChange={(e) => serviceModal.updateField('description', e.target.value)}
              placeholder="Brief description of the service..."
              rows={3}
            />
          </FormGroup>

          <FormRow>
            <FormGroup label="Price (£)" required>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={serviceModal.formData.price_gbp}
                onChange={(e) => serviceModal.updateField('price_gbp', parseFloat(e.target.value) || 0)}
                required
              />
            </FormGroup>

            <FormGroup label="Duration (minutes)">
              <Input
                type="number"
                min="0"
                value={serviceModal.formData.duration_minutes ?? ''}
                onChange={(e) => serviceModal.updateField('duration_minutes', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="e.g., 30"
              />
            </FormGroup>

            <FormGroup label="Advance Notice (hours)">
              <Input
                type="number"
                min="0"
                value={serviceModal.formData.advance_notice_hours ?? 24}
                onChange={(e) => serviceModal.updateField('advance_notice_hours', parseInt(e.target.value) || 24)}
              />
            </FormGroup>
          </FormRow>

          <div className="form-row checkboxes">
            <div className="ds-form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={serviceModal.formData.requires_approval || false}
                  onChange={(e) => serviceModal.updateField('requires_approval', e.target.checked)}
                />
                Requires Approval
              </label>
              <small>Requests must be approved by admin before scheduling</small>
            </div>

            <div className="ds-form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={serviceModal.formData.is_active ?? true}
                  onChange={(e) => serviceModal.updateField('is_active', e.target.checked)}
                />
                Active
              </label>
              <small>Service is available for booking</small>
            </div>

            <div className="ds-form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={serviceModal.formData.is_insurance_claimable || false}
                  onChange={(e) => serviceModal.updateField('is_insurance_claimable', e.target.checked)}
                />
                Insurance Claimable
              </label>
              <small>Requests for this service default to insurance claimable</small>
            </div>
          </div>

          {serviceModal.formData.requires_approval && (
            <FormGroup label="Approval Reason">
              <Input
                value={serviceModal.formData.approval_reason || ''}
                onChange={(e) => serviceModal.updateField('approval_reason', e.target.value)}
                placeholder="Why does this service require approval?"
              />
            </FormGroup>
          )}

          <FormGroup label="Admin Notes">
            <Textarea
              value={serviceModal.formData.notes || ''}
              onChange={(e) => serviceModal.updateField('notes', e.target.value)}
              placeholder="Internal notes (not shown to clients)..."
              rows={2}
            />
          </FormGroup>

          {serviceModal.isEditing && getEditingService() && (
            <div className="danger-zone">
              <h3>Danger Zone</h3>
              <div className="danger-actions">
                <div className="danger-action">
                  <div>
                    <strong>{getEditingService()!.is_active ? 'Disable Service' : 'Enable Service'}</strong>
                    <p>{getEditingService()!.is_active
                      ? 'Hide this service from clients. Can be re-enabled later.'
                      : 'Make this service available for booking again.'}</p>
                  </div>
                  <button
                    type="button"
                    className={`btn-small ${getEditingService()!.is_active ? 'btn-warning' : 'btn-success'}`}
                    onClick={() => {
                      handleToggleActive(getEditingService()!);
                      serviceModal.close();
                    }}
                  >
                    {getEditingService()!.is_active ? 'Disable' : 'Enable'}
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
                      setDeleteTarget(getEditingService()!);
                      serviceModal.close();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Service"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Category</th>
            <th>Price</th>
            <th>Duration</th>
            <th>Notice</th>
            <th>Insurance</th>
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
                {service.is_insurance_claimable ? (
                  <span className="badge badge-info">Claimable</span>
                ) : (
                  <span className="small-text text-muted">-</span>
                )}
              </td>
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
        <div className="ds-empty">
          <p>No services configured yet. Click "Add Service" to create your first service.</p>
        </div>
      )}
    </div>
  );
}
