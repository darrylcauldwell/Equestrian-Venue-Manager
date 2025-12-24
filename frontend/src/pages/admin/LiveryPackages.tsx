import { useState, useEffect } from 'react';
import { liveryPackagesApi } from '../../services/api';
import type { LiveryPackage, CreateLiveryPackage } from '../../types';
import {
  PageActions,
  ConfirmModal,
  FormModal,
  ErrorMessage,
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
};

export function AdminLiveryPackages() {
  const [packages, setPackages] = useState<LiveryPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<LiveryPackage | null>(null);
  const [featuresInput, setFeaturesInput] = useState('');
  const [formData, setFormData] = useState<CreateLiveryPackage>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<LiveryPackage | null>(null);

  const loadPackages = async () => {
    try {
      const data = await liveryPackagesApi.listAll();
      setPackages(data);
    } catch {
      setError('Failed to load livery packages');
    } finally {
      setIsLoading(false);
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

    const submitData = { ...formData, features };

    try {
      if (editingPackage) {
        await liveryPackagesApi.update(editingPackage.id, submitData);
      } else {
        await liveryPackagesApi.create(submitData);
      }
      handleCloseForm();
      await loadPackages();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save package';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingPackage(null);
    setFormData(emptyFormData);
    setFeaturesInput('');
  };

  const handleEdit = (pkg: LiveryPackage) => {
    setEditingPackage(pkg);
    setFormData({
      name: pkg.name,
      price_display: pkg.price_display,
      monthly_price: pkg.monthly_price,
      description: pkg.description || '',
      features: pkg.features || [],
      additional_note: pkg.additional_note || '',
      is_featured: pkg.is_featured,
      display_order: pkg.display_order,
      is_active: pkg.is_active,
    });
    setFeaturesInput((pkg.features || []).join('\n'));
    setShowForm(true);
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
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add Package
        </button>
      </PageActions>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      <FormModal
        isOpen={showForm}
        title={editingPackage ? 'Edit Package' : 'Add New Package'}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        submitText={editingPackage ? 'Save Changes' : 'Create Package'}
        isSubmitting={isSubmitting}
        size="lg"
      >
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="name">Package Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Full Livery"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="price_display">Price Display</label>
            <input
              id="price_display"
              type="text"
              value={formData.price_display}
              onChange={(e) => setFormData({ ...formData, price_display: e.target.value })}
              placeholder="e.g., £165/week or from £250/week"
              required
            />
            <small>Displayed on public page (include £ symbol)</small>
          </div>
        </div>

        <div className="form-group" style={{ maxWidth: '200px' }}>
          <label htmlFor="monthly_price">Monthly Billing Amount (£)</label>
          <input
            id="monthly_price"
            type="number"
            step="0.01"
            min="0"
            value={formData.monthly_price || ''}
            onChange={(e) => setFormData({ ...formData, monthly_price: e.target.value ? parseFloat(e.target.value) : undefined })}
            placeholder="e.g., 715.00"
          />
          <small>Used for billing calculations and pro-rata</small>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the package..."
            rows={2}
          />
        </div>

        <div className="form-group">
          <label htmlFor="features">Features (one per line)</label>
          <textarea
            id="features"
            value={featuresInput}
            onChange={(e) => setFeaturesInput(e.target.value)}
            placeholder="Spacious stables&#10;Daily turnout&#10;Hay/haylage provision&#10;Rug changes as needed"
            rows={6}
          />
          <small>Each line becomes a bullet point on the public page</small>
        </div>

        <div className="form-group">
          <label htmlFor="additional_note">Additional Note</label>
          <textarea
            id="additional_note"
            value={formData.additional_note}
            onChange={(e) => setFormData({ ...formData, additional_note: e.target.value })}
            placeholder="e.g., Additional services available..."
            rows={2}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="display_order">Display Order</label>
            <input
              id="display_order"
              type="number"
              min="0"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
            />
            <small>Lower numbers appear first</small>
          </div>
        </div>

        <div className="form-row checkboxes">
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.is_featured || false}
                onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
              />
              Featured Package
            </label>
            <small>Highlighted with a special style on the page</small>
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
            <small>Show on the public Livery Services page</small>
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Package"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Package</th>
            <th>Display Price</th>
            <th>Monthly Rate</th>
            <th>Features</th>
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
        <div className="empty-state">
          <p>No livery packages configured yet. Click "Add Package" to create your first package.</p>
        </div>
      )}
    </div>
  );
}
