import { useState, useEffect, useRef } from 'react';
import { arenasApi, uploadsApi } from '../../services/api';
import { useModalForm, useRequestState } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../../components/ui';
import type { Arena, CreateArenaData } from '../../types';
import { PageActions, ActiveBadge } from '../../components/admin';
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);

  // Modal hook
  const arenaModal = useModalForm<CreateArenaData>(emptyFormData);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Arena | null>(null);

  const loadArenas = async () => {
    try {
      const data = await arenasApi.listAll();
      setArenas(data);
    } catch {
      setError('Failed to load arenas');
    } finally {
      setLoading(false);
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
      let imageUrl = arenaModal.formData.image_url;

      if (imageFile) {
        const uploadResult = await uploadsApi.uploadArenaImage(imageFile);
        imageUrl = uploadResult.filename;
      }

      const submitData = { ...arenaModal.formData, image_url: imageUrl || undefined };

      if (arenaModal.isEditing && arenaModal.editingId) {
        await arenasApi.update(arenaModal.editingId, submitData);
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
    arenaModal.updateField('image_url', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEdit = (arena: Arena) => {
    arenaModal.edit(arena.id, {
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
    arenaModal.close();
    setImageFile(null);
    setImagePreview(null);
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="ds-btn ds-btn-primary" onClick={() => arenaModal.open()}>
          + Add Arena
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Arena Modal */}
      <Modal
        isOpen={arenaModal.isOpen}
        onClose={handleCloseForm}
        title={arenaModal.isEditing ? 'Edit Arena' : 'Add New Arena'}
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={handleCloseForm}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : (arenaModal.isEditing ? 'Save Changes' : 'Create Arena')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <FormGroup label="Arena Name" required>
            <Input
              value={arenaModal.formData.name}
              onChange={(e) => arenaModal.updateField('name', e.target.value)}
              placeholder="e.g., Indoor Arena"
              required
            />
          </FormGroup>

          <FormGroup label="Description">
            <Textarea
              value={arenaModal.formData.description || ''}
              onChange={(e) => arenaModal.updateField('description', e.target.value)}
              placeholder="Brief description of the arena..."
              rows={3}
            />
          </FormGroup>

          <FormGroup label="Arena Photo">
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
          </FormGroup>

          <FormRow>
            <FormGroup label="Size">
              <Input
                value={arenaModal.formData.size || ''}
                onChange={(e) => arenaModal.updateField('size', e.target.value)}
                placeholder="e.g., 20x40, 60x40"
              />
            </FormGroup>

            <FormGroup label="Surface Type">
              <Select
                value={arenaModal.formData.surface_type || ''}
                onChange={(e) => arenaModal.updateField('surface_type', e.target.value)}
              >
                <option value="">Select surface...</option>
                <option value="sand">Sand</option>
                <option value="rubber">Rubber</option>
                <option value="fibre">Fibre</option>
                <option value="grass">Grass</option>
                <option value="all-weather">All-weather</option>
              </Select>
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Price per Hour (£)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={arenaModal.formData.price_per_hour ?? ''}
                onChange={(e) => arenaModal.updateField('price_per_hour', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 25.00"
              />
            </FormGroup>

            <FormGroup label="Jumps Type">
              <Select
                value={arenaModal.formData.jumps_type || ''}
                onChange={(e) => arenaModal.updateField('jumps_type', e.target.value)}
              >
                <option value="">No jumps</option>
                <option value="show_jumps">Show Jumps</option>
                <option value="working_hunter">Working Hunter</option>
                <option value="cross_country">Cross Country</option>
              </Select>
            </FormGroup>
          </FormRow>

          <div className="form-row checkboxes">
            <div className="ds-form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={arenaModal.formData.has_lights || false}
                  onChange={(e) => arenaModal.updateField('has_lights', e.target.checked)}
                />
                Has Lights
              </label>
              <small>Arena can be used during darkness</small>
            </div>

            <div className="ds-form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={arenaModal.formData.free_for_livery || false}
                  onChange={(e) => arenaModal.updateField('free_for_livery', e.target.checked)}
                />
                Free for Livery
              </label>
              <small>Livery clients can book without charge</small>
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Arena"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
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
