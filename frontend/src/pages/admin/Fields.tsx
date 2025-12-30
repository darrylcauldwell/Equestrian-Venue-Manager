import { useState, useEffect } from 'react';
import { fieldsApi } from '../../services/api';
import type { Field, CreateField, FieldCondition, FieldConditionUpdate, FieldRestPeriod } from '../../types';
import { useModalForm } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea, Checkbox } from '../../components/ui';
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

const defaultFieldForm: CreateField = {
  name: '',
  max_horses: 4,
  is_active: true,
};

const defaultConditionForm: FieldConditionUpdate = {
  current_condition: 'good',
};

const defaultRestForm: FieldRestPeriod = {
  rest_start_date: new Date().toISOString().split('T')[0],
};

export default function Fields() {
  // Data state
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal hooks - replaces 6 useState calls with 3 hook calls
  const fieldModal = useModalForm<CreateField>(defaultFieldForm);
  const conditionModal = useModalForm<FieldConditionUpdate>(defaultConditionForm);
  const restModal = useModalForm<FieldRestPeriod>(defaultRestForm);

  // Track selected field for condition/rest modals
  const [selectedField, setSelectedField] = useState<Field | null>(null);

  // Confirm modal state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'deactivate' | 'endRest' | 'reactivate';
    field: Field;
  } | null>(null);

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

  // Open edit modal with field data
  const openEditModal = (field: Field) => {
    fieldModal.edit(field.id, {
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
  };

  // Open condition modal
  const openConditionModal = (field: Field) => {
    setSelectedField(field);
    conditionModal.open({
      current_condition: field.current_condition,
      condition_notes: field.condition_notes || '',
    });
  };

  // Open rest modal
  const openRestModal = (field: Field) => {
    setSelectedField(field);
    restModal.open({
      rest_start_date: new Date().toISOString().split('T')[0],
    });
  };

  const handleSaveField = async () => {
    try {
      setSaving(true);
      if (fieldModal.isEditing) {
        await fieldsApi.update(fieldModal.editingId!, fieldModal.formData);
      } else {
        await fieldsApi.create(fieldModal.formData);
      }
      await loadFields();
      fieldModal.close();
    } catch (err) {
      setError('Failed to save field');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCondition = async () => {
    if (!selectedField) return;
    try {
      setSaving(true);
      await fieldsApi.updateCondition(selectedField.id, conditionModal.formData);
      await loadFields();
      conditionModal.close();
      setSelectedField(null);
    } catch (err) {
      setError('Failed to update condition');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleStartRest = async () => {
    if (!selectedField) return;
    try {
      setSaving(true);
      await fieldsApi.startRest(selectedField.id, restModal.formData);
      await loadFields();
      restModal.close();
      setSelectedField(null);
    } catch (err) {
      setError('Failed to start rest period');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    const { type, field } = confirmAction;

    try {
      if (type === 'deactivate') {
        await fieldsApi.update(field.id, { is_active: false });
      } else if (type === 'endRest') {
        await fieldsApi.endRest(field.id);
      } else if (type === 'reactivate') {
        await fieldsApi.update(field.id, { is_active: true });
      }
      await loadFields();
      setConfirmAction(null);
    } catch (err) {
      setError(`Failed to ${type} field`);
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
        <div className="ds-loading">Loading fields...</div>
      </div>
    );
  }

  return (
    <div className="admin-fields-page">
      <header className="page-header">
        <h1>Field Management</h1>
        <button className="btn-add" onClick={() => fieldModal.open()}>
          + Add Field
        </button>
      </header>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Active Fields */}
      <section className="fields-section">
        <h2>Active Fields ({activeFields.length})</h2>
        {activeFields.length === 0 ? (
          <div className="ds-empty">No active fields</div>
        ) : (
          <div className="fields-grid">
            {activeFields.map(field => (
              <FieldCard
                key={field.id}
                field={field}
                conditionLabels={conditionLabels}
                conditionColors={conditionColors}
                formatDate={formatDate}
                onUpdateCondition={() => openConditionModal(field)}
                onRest={() => openRestModal(field)}
                onEdit={() => openEditModal(field)}
                onDeactivate={() => setConfirmAction({ type: 'deactivate', field })}
              />
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
                  <button className="btn-small success" onClick={() => setConfirmAction({ type: 'endRest', field })}>
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
                  <button className="btn-small success" onClick={() => setConfirmAction({ type: 'reactivate', field })}>
                    Reactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Add/Edit Field Modal */}
      <Modal
        isOpen={fieldModal.isOpen}
        onClose={fieldModal.close}
        title={fieldModal.isEditing ? 'Edit Field' : 'Add Field'}
        size="md"
        footer={
          <>
            <button className="btn-cancel" onClick={fieldModal.close}>Cancel</button>
            <button className="btn-submit" onClick={handleSaveField} disabled={saving}>
              {saving ? 'Saving...' : fieldModal.isEditing ? 'Update' : 'Add Field'}
            </button>
          </>
        }
      >
        <FormGroup label="Field Name" required>
          <Input
            type="text"
            value={fieldModal.formData.name}
            onChange={e => fieldModal.updateField('name', e.target.value)}
            placeholder="e.g., Top Field, River Paddock"
            required
          />
        </FormGroup>

        <FormGroup label="Description">
          <Textarea
            value={fieldModal.formData.description || ''}
            onChange={e => fieldModal.updateField('description', e.target.value)}
            placeholder="Description of the field"
            rows={2}
          />
        </FormGroup>

        <FormRow>
          <FormGroup label="Max Horses" required>
            <Input
              type="number"
              min={1}
              max={20}
              value={fieldModal.formData.max_horses}
              onChange={e => fieldModal.updateField('max_horses', Number(e.target.value))}
              required
            />
          </FormGroup>
          <FormGroup label="Size (acres)">
            <Input
              type="number"
              step={0.1}
              min={0}
              value={fieldModal.formData.size_acres || ''}
              onChange={e => fieldModal.updateField('size_acres', e.target.value ? Number(e.target.value) : undefined)}
            />
          </FormGroup>
        </FormRow>

        <FormGroup label="Display Order">
          <Input
            type="number"
            min={0}
            value={fieldModal.formData.display_order || 0}
            onChange={e => fieldModal.updateField('display_order', Number(e.target.value))}
          />
        </FormGroup>

        <div className="checkbox-row">
          <Checkbox
            label="Has Shelter"
            checked={fieldModal.formData.has_shelter || false}
            onChange={e => fieldModal.updateField('has_shelter', e.target.checked)}
          />
          <Checkbox
            label="Has Water"
            checked={fieldModal.formData.has_water || false}
            onChange={e => fieldModal.updateField('has_water', e.target.checked)}
          />
          <Checkbox
            label="Electric Fencing"
            checked={fieldModal.formData.is_electric_fenced || false}
            onChange={e => fieldModal.updateField('is_electric_fenced', e.target.checked)}
          />
        </div>

        <FormGroup>
          <Checkbox
            label="Active"
            checked={fieldModal.formData.is_active}
            onChange={e => fieldModal.updateField('is_active', e.target.checked)}
          />
        </FormGroup>
      </Modal>

      {/* Update Condition Modal */}
      <Modal
        isOpen={conditionModal.isOpen}
        onClose={() => { conditionModal.close(); setSelectedField(null); }}
        title="Update Condition"
        size="sm"
        footer={
          <>
            <button className="btn-cancel" onClick={() => { conditionModal.close(); setSelectedField(null); }}>Cancel</button>
            <button className="btn-submit" onClick={handleUpdateCondition} disabled={saving}>
              {saving ? 'Saving...' : 'Update Condition'}
            </button>
          </>
        }
      >
        {selectedField && <p className="modal-context">{selectedField.name}</p>}

        <FormGroup label="Condition" required>
          <Select
            value={conditionModal.formData.current_condition}
            onChange={e => conditionModal.updateField('current_condition', e.target.value as FieldCondition)}
            required
          >
            {Object.entries(conditionLabels)
              .filter(([k]) => k !== 'resting')
              .map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
          </Select>
        </FormGroup>

        <FormGroup label="Notes">
          <Textarea
            value={conditionModal.formData.condition_notes || ''}
            onChange={e => conditionModal.updateField('condition_notes', e.target.value)}
            placeholder="Any notes about the field condition"
            rows={3}
          />
        </FormGroup>
      </Modal>

      {/* Start Rest Modal */}
      <Modal
        isOpen={restModal.isOpen}
        onClose={() => { restModal.close(); setSelectedField(null); }}
        title="Rest Field"
        size="sm"
        footer={
          <>
            <button className="btn-cancel" onClick={() => { restModal.close(); setSelectedField(null); }}>Cancel</button>
            <button className="btn-submit" onClick={handleStartRest} disabled={saving}>
              {saving ? 'Saving...' : 'Start Rest'}
            </button>
          </>
        }
      >
        {selectedField && <p className="modal-context">{selectedField.name}</p>}

        <FormRow>
          <FormGroup label="Start Date" required>
            <Input
              type="date"
              value={restModal.formData.rest_start_date}
              onChange={e => restModal.updateField('rest_start_date', e.target.value)}
              required
            />
          </FormGroup>
          <FormGroup label="Expected End Date">
            <Input
              type="date"
              value={restModal.formData.rest_end_date || ''}
              onChange={e => restModal.updateField('rest_end_date', e.target.value)}
            />
          </FormGroup>
        </FormRow>
      </Modal>

      {/* Confirm Actions Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
        title={
          confirmAction?.type === 'deactivate' ? 'Deactivate Field' :
          confirmAction?.type === 'endRest' ? 'End Rest Period' :
          'Reactivate Field'
        }
        message={
          confirmAction?.type === 'deactivate'
            ? `Deactivate field "${confirmAction?.field.name}"?`
            : confirmAction?.type === 'endRest'
            ? `End rest period for "${confirmAction?.field.name}"?`
            : `Reactivate field "${confirmAction?.field.name}"?`
        }
        confirmLabel={
          confirmAction?.type === 'deactivate' ? 'Deactivate' :
          confirmAction?.type === 'endRest' ? 'End Rest' :
          'Reactivate'
        }
        variant={confirmAction?.type === 'deactivate' ? 'danger' : 'primary'}
      />
    </div>
  );
}

// Extracted FieldCard component for active fields
interface FieldCardProps {
  field: Field;
  conditionLabels: Record<FieldCondition, string>;
  conditionColors: Record<FieldCondition, string>;
  formatDate: (dateStr: string | undefined) => string;
  onUpdateCondition: () => void;
  onRest: () => void;
  onEdit: () => void;
  onDeactivate: () => void;
}

function FieldCard({
  field,
  conditionLabels,
  conditionColors,
  formatDate,
  onUpdateCondition,
  onRest,
  onEdit,
  onDeactivate,
}: FieldCardProps) {
  return (
    <div className="field-card">
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
        <button className="btn-small" onClick={onUpdateCondition}>
          Update Condition
        </button>
        <button className="btn-small warning" onClick={onRest}>
          Rest Field
        </button>
        <button className="btn-small" onClick={onEdit}>
          Edit
        </button>
        <button className="btn-small danger" onClick={onDeactivate}>
          Deactivate
        </button>
      </div>
    </div>
  );
}
