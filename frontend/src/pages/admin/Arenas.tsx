import { useState, useEffect, useRef } from 'react';
import { arenasApi, uploadsApi } from '../../services/api';
import type { Arena, CreateArenaData } from '../../types';
import {
  PageActions,
  ConfirmModal,
  FormModal,
  ErrorMessage,
  ActiveBadge,
} from '../../components/admin';
import './Admin.css';

const emptyFormData: CreateArenaData = {
  name: '',
  description: '',
  size: '',
  surface_type: '',
  price_per_hour: undefined,
  has_lights: false,
  jumps_type: '',
  free_for_livery: false,
  image_url: '',
};

export function AdminArenas() {
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingArena, setEditingArena] = useState<Arena | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState<CreateArenaData>(emptyFormData);
  const [deleteConfirm, setDeleteConfirm] = useState<Arena | null>(null);

  const loadArenas = async () => {
    try {
      const data = await arenasApi.listAll();
      setArenas(data);
    } catch {
      setError('Failed to load arenas');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadArenas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      let imageUrl = formData.image_url;

      if (imageFile) {
        const uploadResult = await uploadsApi.uploadArenaImage(imageFile);
        imageUrl = uploadResult.filename;
      }

      const submitData = { ...formData, image_url: imageUrl || undefined };

      if (editingArena) {
        await arenasApi.update(editingArena.id, submitData);
      } else {
        await arenasApi.create(submitData);
      }
      handleCloseForm();
      await loadArenas();
    } catch {
      setError('Failed to save arena');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setFormData({ ...formData, image_url: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEdit = (arena: Arena) => {
    setEditingArena(arena);
    setFormData({
      name: arena.name,
      description: arena.description || '',
      size: arena.size || '',
      surface_type: arena.surface_type || '',
      price_per_hour: arena.price_per_hour,
      has_lights: arena.has_lights,
      jumps_type: arena.jumps_type || '',
      free_for_livery: arena.free_for_livery,
      image_url: arena.image_url || '',
    });
    setImageFile(null);
    setImagePreview(arena.image_url ? uploadsApi.getFileUrl(arena.image_url) : null);
    setShowForm(true);
  };

  const handleToggleActive = async (arena: Arena) => {
    try {
      await arenasApi.update(arena.id, { is_active: !arena.is_active });
      await loadArenas();
    } catch {
      setError('Failed to update arena status');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await arenasApi.delete(deleteConfirm.id);
      setDeleteConfirm(null);
      await loadArenas();
      setError('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || 'Failed to delete arena');
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingArena(null);
    setImageFile(null);
    setImagePreview(null);
    setFormData(emptyFormData);
  };

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Add Arena
        </button>
      </PageActions>

      <ErrorMessage message={error} onDismiss={() => setError('')} />

      <FormModal
        isOpen={showForm}
        title={editingArena ? 'Edit Arena' : 'Add New Arena'}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        submitText={isSubmitting ? 'Uploading...' : editingArena ? 'Save Changes' : 'Create Arena'}
        isSubmitting={isSubmitting}
        size="lg"
      >
        <div className="form-group">
          <label htmlFor="name">Arena Name</label>
          <input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Indoor Arena"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the arena..."
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Arena Photo</label>
          {imagePreview && (
            <div className="image-preview">
              <img src={imagePreview} alt="Arena preview" />
              <button type="button" className="btn-small btn-danger" onClick={handleRemoveImage}>
                Remove
              </button>
            </div>
          )}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/*"
          />
          <small>Upload a photo of the arena (max 5MB)</small>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="size">Size</label>
            <input
              id="size"
              type="text"
              value={formData.size || ''}
              onChange={(e) => setFormData({ ...formData, size: e.target.value })}
              placeholder="e.g., 20x40, 60x40"
            />
          </div>

          <div className="form-group">
            <label htmlFor="surface_type">Surface Type</label>
            <select
              id="surface_type"
              value={formData.surface_type || ''}
              onChange={(e) => setFormData({ ...formData, surface_type: e.target.value })}
            >
              <option value="">Select surface...</option>
              <option value="sand">Sand</option>
              <option value="rubber">Rubber</option>
              <option value="fibre">Fibre</option>
              <option value="grass">Grass</option>
              <option value="all-weather">All-weather</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="price_per_hour">Price per Hour (£)</label>
            <input
              id="price_per_hour"
              type="number"
              step="0.01"
              min="0"
              value={formData.price_per_hour ?? ''}
              onChange={(e) => setFormData({ ...formData, price_per_hour: e.target.value ? parseFloat(e.target.value) : undefined })}
              placeholder="e.g., 25.00"
            />
          </div>

          <div className="form-group">
            <label htmlFor="jumps_type">Jumps Type</label>
            <select
              id="jumps_type"
              value={formData.jumps_type || ''}
              onChange={(e) => setFormData({ ...formData, jumps_type: e.target.value })}
            >
              <option value="">No jumps</option>
              <option value="show_jumps">Show Jumps</option>
              <option value="working_hunter">Working Hunter</option>
              <option value="cross_country">Cross Country</option>
            </select>
          </div>
        </div>

        <div className="form-row checkboxes">
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.has_lights || false}
                onChange={(e) => setFormData({ ...formData, has_lights: e.target.checked })}
              />
              Has Lights
            </label>
            <small>Arena can be used during darkness</small>
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={formData.free_for_livery || false}
                onChange={(e) => setFormData({ ...formData, free_for_livery: e.target.checked })}
              />
              Free for Livery
            </label>
            <small>Livery clients can book without charge</small>
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        title="Delete Arena"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Size</th>
            <th>Surface</th>
            <th>Price/hr</th>
            <th>Features</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {arenas.map((arena) => (
            <tr key={arena.id}>
              <td>
                <strong>{arena.name}</strong>
                {arena.description && <div className="small-text">{arena.description}</div>}
              </td>
              <td>{arena.size || '-'}</td>
              <td>{arena.surface_type || '-'}</td>
              <td>{arena.price_per_hour ? `£${arena.price_per_hour}` : 'Free'}</td>
              <td>
                <div className="feature-badges">
                  {arena.has_lights && <span className="feature-badge lights">Lights</span>}
                  {arena.free_for_livery && <span className="feature-badge livery">Free Livery</span>}
                  {arena.jumps_type && <span className="feature-badge jumps">{arena.jumps_type.replace('_', ' ')}</span>}
                </div>
              </td>
              <td>
                <ActiveBadge isActive={arena.is_active} />
              </td>
              <td className="actions-cell">
                <button className="btn-small" onClick={() => handleEdit(arena)}>
                  Edit
                </button>
                <button
                  className={`btn-small ${arena.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => handleToggleActive(arena)}
                >
                  {arena.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  className="btn-small btn-danger"
                  onClick={() => setDeleteConfirm(arena)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
