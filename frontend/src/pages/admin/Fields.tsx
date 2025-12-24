import { useState, useEffect } from 'react';
import { fieldsApi } from '../../services/api';
import type { Field, CreateField, UpdateField, FieldCondition, FieldConditionUpdate, FieldRestPeriod } from '../../types';
import '../../styles/AdminFields.css';

const conditionLabels: Record<FieldCondition, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  resting: 'Resting',
};

const conditionColors: Record<FieldCondition, string> = {
  excellent: 'condition-excellent',
  good: 'condition-good',
  fair: 'condition-fair',
  poor: 'condition-poor',
  resting: 'condition-resting',
};

export default function Fields() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showFieldModal, setShowFieldModal] = useState(false);
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [showRestModal, setShowRestModal] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [saving, setSaving] = useState(false);

  const [fieldForm, setFieldForm] = useState<CreateField>({
    name: '',
    max_horses: 4,
    is_active: true,
  });

  const [conditionForm, setConditionForm] = useState<FieldConditionUpdate>({
    current_condition: 'good',
  });

  const [restForm, setRestForm] = useState<FieldRestPeriod>({
    rest_start_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    loadFields();
  }, []);

  const loadFields = async () => {
    try {
      setLoading(true);
      const data = await fieldsApi.list();
      setFields(data);
      setError('');
    } catch (err) {
      setError('Failed to load fields');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingField(null);
    setFieldForm({
      name: '',
      max_horses: 4,
      is_active: true,
    });
    setShowFieldModal(true);
  };

  const openEditModal = (field: Field) => {
    setEditingField(field);
    setFieldForm({
      name: field.name,
      description: field.description,
      max_horses: field.max_horses,
      size_acres: field.size_acres,
      has_shelter: field.has_shelter,
      has_water: field.has_water,
      is_electric_fenced: field.is_electric_fenced,
      is_active: field.is_active,
      display_order: field.display_order,
    });
    setShowFieldModal(true);
  };

  const openConditionModal = (field: Field) => {
    setSelectedField(field);
    setConditionForm({
      current_condition: field.current_condition,
      condition_notes: field.condition_notes || '',
    });
    setShowConditionModal(true);
  };

  const openRestModal = (field: Field) => {
    setSelectedField(field);
    setRestForm({
      rest_start_date: new Date().toISOString().split('T')[0],
    });
    setShowRestModal(true);
  };

  const handleSaveField = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSaving(true);
      if (editingField) {
        await fieldsApi.update(editingField.id, fieldForm as UpdateField);
      } else {
        await fieldsApi.create(fieldForm);
      }
      await loadFields();
      setShowFieldModal(false);
    } catch (err) {
      setError('Failed to save field');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCondition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedField) return;

    try {
      setSaving(true);
      await fieldsApi.updateCondition(selectedField.id, conditionForm);
      await loadFields();
      setShowConditionModal(false);
    } catch (err) {
      setError('Failed to update condition');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleStartRest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedField) return;

    try {
      setSaving(true);
      await fieldsApi.startRest(selectedField.id, restForm);
      await loadFields();
      setShowRestModal(false);
    } catch (err) {
      setError('Failed to start rest period');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEndRest = async (field: Field) => {
    if (!confirm(`End rest period for ${field.name}?`)) return;

    try {
      await fieldsApi.endRest(field.id);
      await loadFields();
    } catch (err) {
      setError('Failed to end rest period');
      console.error(err);
    }
  };

  const handleDeactivate = async (field: Field) => {
    if (!confirm(`Deactivate field "${field.name}"?`)) return;

    try {
      await fieldsApi.update(field.id, { is_active: false });
      await loadFields();
    } catch (err) {
      setError('Failed to deactivate field');
      console.error(err);
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Separate active and resting fields
  const activeFields = fields.filter(f => f.is_active && !f.is_resting);
  const restingFields = fields.filter(f => f.is_resting);
  const inactiveFields = fields.filter(f => !f.is_active && !f.is_resting);

  if (loading) {
    return (
      <div className="admin-fields-page">
        <div className="loading">Loading fields...</div>
      </div>
    );
  }

  return (
    <div className="admin-fields-page">
      <header className="page-header">
        <h1>Field Management</h1>
        <button className="btn-add" onClick={openAddModal}>
          + Add Field
        </button>
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Active Fields */}
      <section className="fields-section">
        <h2>Active Fields ({activeFields.length})</h2>
        {activeFields.length === 0 ? (
          <div className="empty-state">No active fields</div>
        ) : (
          <div className="fields-grid">
            {activeFields.map(field => (
              <div key={field.id} className="field-card">
                <div className="field-header">
                  <h3>{field.name}</h3>
                  <span className={`condition-badge ${conditionColors[field.current_condition]}`}>
                    {conditionLabels[field.current_condition]}
                  </span>
                </div>

                {field.description && (
                  <p className="field-description">{field.description}</p>
                )}

                <div className="field-stats">
                  <div className="stat">
                    <span className="stat-label">Capacity</span>
                    <span className="stat-value">{field.max_horses} horses</span>
                  </div>
                  {field.size_acres && (
                    <div className="stat">
                      <span className="stat-label">Size</span>
                      <span className="stat-value">{field.size_acres} acres</span>
                    </div>
                  )}
                </div>

                <div className="field-features">
                  {field.has_shelter && <span className="feature">Shelter</span>}
                  {field.has_water && <span className="feature">Water</span>}
                  {field.is_electric_fenced && <span className="feature">Electric</span>}
                </div>

                {field.condition_notes && (
                  <p className="condition-notes">{field.condition_notes}</p>
                )}

                <div className="field-meta">
                  Last updated: {formatDate(field.last_condition_update)}
                </div>

                <div className="field-actions">
                  <button className="btn-small" onClick={() => openConditionModal(field)}>
                    Update Condition
                  </button>
                  <button className="btn-small warning" onClick={() => openRestModal(field)}>
                    Rest Field
                  </button>
                  <button className="btn-small" onClick={() => openEditModal(field)}>
                    Edit
                  </button>
                  <button className="btn-small danger" onClick={() => handleDeactivate(field)}>
                    Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Resting Fields */}
      {restingFields.length > 0 && (
        <section className="fields-section resting">
          <h2>Resting Fields ({restingFields.length})</h2>
          <div className="fields-grid">
            {restingFields.map(field => (
              <div key={field.id} className="field-card resting">
                <div className="field-header">
                  <h3>{field.name}</h3>
                  <span className="condition-badge condition-resting">Resting</span>
                </div>

                <div className="rest-info">
                  <p>Rest started: {formatDate(field.rest_start_date)}</p>
                  {field.rest_end_date && (
                    <p>Expected end: {formatDate(field.rest_end_date)}</p>
                  )}
                </div>

                {field.condition_notes && (
                  <p className="condition-notes">{field.condition_notes}</p>
                )}

                <div className="field-actions">
                  <button className="btn-small success" onClick={() => handleEndRest(field)}>
                    End Rest Period
                  </button>
                  <button className="btn-small" onClick={() => openEditModal(field)}>
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Inactive Fields */}
      {inactiveFields.length > 0 && (
        <section className="fields-section inactive">
          <h2>Inactive Fields ({inactiveFields.length})</h2>
          <div className="fields-grid">
            {inactiveFields.map(field => (
              <div key={field.id} className="field-card inactive">
                <div className="field-header">
                  <h3>{field.name}</h3>
                  <span className="inactive-badge">Inactive</span>
                </div>
                <div className="field-actions">
                  <button className="btn-small" onClick={() => openEditModal(field)}>
                    Edit
                  </button>
                  <button className="btn-small success" onClick={() => fieldsApi.update(field.id, { is_active: true }).then(() => loadFields())}>
                    Reactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add/Edit Field Modal */}
      {showFieldModal && (
        <div className="modal-overlay" onClick={() => setShowFieldModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingField ? 'Edit Field' : 'Add Field'}</h2>
              <button className="btn-close" onClick={() => setShowFieldModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSaveField}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Field Name *</label>
                  <input
                    type="text"
                    value={fieldForm.name}
                    onChange={e => setFieldForm({ ...fieldForm, name: e.target.value })}
                    placeholder="e.g., Top Field, River Paddock"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={fieldForm.description || ''}
                    onChange={e => setFieldForm({ ...fieldForm, description: e.target.value })}
                    placeholder="Description of the field"
                    rows={2}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Max Horses *</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={fieldForm.max_horses}
                      onChange={e => setFieldForm({ ...fieldForm, max_horses: Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Size (acres)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={fieldForm.size_acres || ''}
                      onChange={e => setFieldForm({ ...fieldForm, size_acres: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Display Order</label>
                  <input
                    type="number"
                    min="0"
                    value={fieldForm.display_order || 0}
                    onChange={e => setFieldForm({ ...fieldForm, display_order: Number(e.target.value) })}
                  />
                </div>

                <div className="checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={fieldForm.has_shelter || false}
                      onChange={e => setFieldForm({ ...fieldForm, has_shelter: e.target.checked })}
                    />
                    Has Shelter
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={fieldForm.has_water || false}
                      onChange={e => setFieldForm({ ...fieldForm, has_water: e.target.checked })}
                    />
                    Has Water
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={fieldForm.is_electric_fenced || false}
                      onChange={e => setFieldForm({ ...fieldForm, is_electric_fenced: e.target.checked })}
                    />
                    Electric Fencing
                  </label>
                </div>

                <div className="form-group checkbox-group">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={fieldForm.is_active}
                    onChange={e => setFieldForm({ ...fieldForm, is_active: e.target.checked })}
                  />
                  <label htmlFor="isActive">Active</label>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowFieldModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? 'Saving...' : editingField ? 'Update' : 'Add Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Condition Modal */}
      {showConditionModal && selectedField && (
        <div className="modal-overlay" onClick={() => setShowConditionModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Condition</h2>
              <button className="btn-close" onClick={() => setShowConditionModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleUpdateCondition}>
              <div className="modal-body">
                <p className="modal-context">{selectedField.name}</p>

                <div className="form-group">
                  <label>Condition *</label>
                  <select
                    value={conditionForm.current_condition}
                    onChange={e => setConditionForm({ ...conditionForm, current_condition: e.target.value as FieldCondition })}
                    required
                  >
                    {Object.entries(conditionLabels).filter(([k]) => k !== 'resting').map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Notes</label>
                  <textarea
                    value={conditionForm.condition_notes || ''}
                    onChange={e => setConditionForm({ ...conditionForm, condition_notes: e.target.value })}
                    placeholder="Any notes about the field condition"
                    rows={3}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowConditionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Update Condition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Start Rest Modal */}
      {showRestModal && selectedField && (
        <div className="modal-overlay" onClick={() => setShowRestModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Rest Field</h2>
              <button className="btn-close" onClick={() => setShowRestModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleStartRest}>
              <div className="modal-body">
                <p className="modal-context">{selectedField.name}</p>

                <div className="form-row">
                  <div className="form-group">
                    <label>Start Date *</label>
                    <input
                      type="date"
                      value={restForm.rest_start_date}
                      onChange={e => setRestForm({ ...restForm, rest_start_date: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Expected End Date</label>
                    <input
                      type="date"
                      value={restForm.rest_end_date || ''}
                      onChange={e => setRestForm({ ...restForm, rest_end_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setShowRestModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Start Rest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
