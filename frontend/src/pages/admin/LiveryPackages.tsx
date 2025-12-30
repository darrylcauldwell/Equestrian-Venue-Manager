import { useState, useEffect } from 'react';
import { liveryPackagesApi } from '../../services/api';
import { useModalForm, useRequestState } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Textarea } from '../../components/ui';
import type { LiveryPackage, CreateLiveryPackage } from '../../types';
import {
  PageActions,
  ActiveBadge,
  FeaturedBadge,
} from '../../components/admin';
import './Admin.css';

const emptyFormData: CreateLiveryPackage = {
  name: '',
  price_display: '',
  monthly_price: undefined,
  description: '',
  features: [],
  additional_note: '',
  is_featured: false,
  display_order: 0,
  is_active: true,
  is_insurance_claimable: false,
};

export function AdminLiveryPackages() {
  const [packages, setPackages] = useState<LiveryPackage[]>([]);

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal hook
  const packageModal = useModalForm<CreateLiveryPackage>(emptyFormData);
  const [featuresInput, setFeaturesInput] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<LiveryPackage | null>(null);

  const loadPackages = async () => {
    try {
      const data = await liveryPackagesApi.listAll();
      setPackages(data);
    } catch {
      setError('Failed to load livery packages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const features = featuresInput
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    const submitData = { ...packageModal.formData, features };

    try {
      if (packageModal.isEditing && packageModal.editingId) {
        await liveryPackagesApi.update(packageModal.editingId, submitData);
      } else {
        await liveryPackagesApi.create(submitData);
      }
      packageModal.close();
      setFeaturesInput('');
      await loadPackages();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save package';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (pkg: LiveryPackage) => {
    packageModal.edit(pkg.id, {
      name: pkg.name,
      price_display: pkg.price_display,
      monthly_price: pkg.monthly_price,
      description: pkg.description || '',
      features: pkg.features || [],
      additional_note: pkg.additional_note || '',
      is_featured: pkg.is_featured,
      display_order: pkg.display_order,
      is_active: pkg.is_active,
      is_insurance_claimable: pkg.is_insurance_claimable || false,
    });
    setFeaturesInput((pkg.features || []).join('\n'));
  };

  const handleToggleActive = async (pkg: LiveryPackage) => {
    try {
      await liveryPackagesApi.update(pkg.id, { is_active: !pkg.is_active });
      await loadPackages();
    } catch {
      setError('Failed to update package status');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await liveryPackagesApi.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadPackages();
    } catch {
      setError('Failed to delete package');
    }
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="ds-btn ds-btn-primary" onClick={() => packageModal.open()}>
          + Add Package
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Package Modal */}
      <Modal
        isOpen={packageModal.isOpen}
        onClose={packageModal.close}
        title={packageModal.isEditing ? 'Edit Package' : 'Add New Package'}
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={packageModal.close}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (packageModal.isEditing ? 'Save Changes' : 'Create Package')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormGroup label="Package Name" required>
              <Input
                value={packageModal.formData.name}
                onChange={(e) => packageModal.updateField('name', e.target.value)}
                placeholder="e.g., Full Livery"
                required
              />
            </FormGroup>

            <FormGroup label="Price Display" required>
              <Input
                value={packageModal.formData.price_display}
                onChange={(e) => packageModal.updateField('price_display', e.target.value)}
                placeholder="e.g., £165/week or from £250/week"
                required
              />
              <small>Displayed on public page (include £ symbol)</small>
            </FormGroup>
          </FormRow>

          <FormGroup label="Monthly Billing Amount (£)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={packageModal.formData.monthly_price || ''}
              onChange={(e) => packageModal.updateField('monthly_price', e.target.value ? parseFloat(e.target.value) : undefined)}
              placeholder="e.g., 715.00"
              style={{ maxWidth: '200px' }}
            />
            <small>Used for billing calculations and pro-rata</small>
          </FormGroup>

          <FormGroup label="Description">
            <Textarea
              value={packageModal.formData.description || ''}
              onChange={(e) => packageModal.updateField('description', e.target.value)}
              placeholder="Brief description of the package..."
              rows={2}
            />
          </FormGroup>

          <FormGroup label="Features (one per line)">
            <Textarea
              value={featuresInput}
              onChange={(e) => setFeaturesInput(e.target.value)}
              placeholder="Spacious stables&#10;Daily turnout&#10;Hay/haylage provision&#10;Rug changes as needed"
              rows={6}
            />
            <small>Each line becomes a bullet point on the public page</small>
          </FormGroup>

          <FormGroup label="Additional Note">
            <Textarea
              value={packageModal.formData.additional_note || ''}
              onChange={(e) => packageModal.updateField('additional_note', e.target.value)}
              placeholder="e.g., Additional services available..."
              rows={2}
            />
          </FormGroup>

          <FormGroup label="Display Order">
            <Input
              type="number"
              min="0"
              value={packageModal.formData.display_order}
              onChange={(e) => packageModal.updateField('display_order', parseInt(e.target.value) || 0)}
              style={{ maxWidth: '100px' }}
            />
            <small>Lower numbers appear first</small>
          </FormGroup>

          <div className="form-row checkboxes">
            <div className="ds-form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={packageModal.formData.is_featured || false}
                  onChange={(e) => packageModal.updateField('is_featured', e.target.checked)}
                />
                Featured Package
              </label>
              <small>Highlighted with a special style on the page</small>
            </div>

            <div className="ds-form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={packageModal.formData.is_active ?? true}
                  onChange={(e) => packageModal.updateField('is_active', e.target.checked)}
                />
                Active
              </label>
              <small>Show on the public Livery Services page</small>
            </div>

            <div className="ds-form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={packageModal.formData.is_insurance_claimable || false}
                  onChange={(e) => packageModal.updateField('is_insurance_claimable', e.target.checked)}
                />
                Insurance Claimable (Rehab)
              </label>
              <small>Include charges in insurance statements for rehab horses</small>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Package"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Package</th>
            <th>Display Price</th>
            <th>Monthly Rate</th>
            <th>Features</th>
            <th>Insurance</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {packages.map((pkg) => (
            <tr key={pkg.id}>
              <td>{pkg.display_order}</td>
              <td>
                <strong>{pkg.name}</strong>
                {pkg.is_featured && <> <FeaturedBadge /></>}
                {pkg.description && <div className="small-text">{pkg.description}</div>}
              </td>
              <td>{pkg.price_display}</td>
              <td>
                {pkg.monthly_price
                  ? `£${Number(pkg.monthly_price).toFixed(2)}`
                  : <span className="small-text text-muted">Not set</span>}
              </td>
              <td>
                <span className="small-text">{(pkg.features || []).length} features</span>
              </td>
              <td>
                {pkg.is_insurance_claimable ? (
                  <span className="badge badge-info">Claimable</span>
                ) : (
                  <span className="small-text text-muted">-</span>
                )}
              </td>
              <td>
                <ActiveBadge isActive={pkg.is_active} />
              </td>
              <td className="actions-cell">
                <button className="btn-small" onClick={() => handleEdit(pkg)}>
                  Edit
                </button>
                <button
                  className={`btn-small ${pkg.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleActive(pkg)}
                >
                  {pkg.is_active ? 'Hide' : 'Show'}
                </button>
                <button
                  className="btn-small btn-danger"
                  onClick={() => setDeleteConfirm(pkg)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {packages.length === 0 && (
        <div className="ds-empty">
          <p>No livery packages configured yet. Click "Add Package" to create your first package.</p>
        </div>
      )}
    </div>
  );
}
