import { useState, useEffect } from 'react';
import { stableBlocksApi, stablesApi, horsesApi, liveryPackagesApi, usersApi } from '../../services/api';
import type { StableBlock, Stable, CreateStableBlockData, CreateStableData, Horse, LiveryPackage, User } from '../../types';
import { PageActions } from '../../components/admin';
import { useModalForm } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select } from '../../components/ui';
import './Admin.css';

interface AssignModalState {
  stable: Stable | null;
  mode: 'assign' | 'create';
  selectedHorseId: number | '';
  newHorseName: string;
  newHorseOwnerId: number | '';
}

const defaultAssignState: AssignModalState = {
  stable: null,
  mode: 'assign',
  selectedHorseId: '',
  newHorseName: '',
  newHorseOwnerId: '',
};

export function AdminStables() {
  // Data state
  const [blocks, setBlocks] = useState<StableBlock[]>([]);
  const [stables, setStables] = useState<Stable[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [packages, setPackages] = useState<LiveryPackage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal hooks - replaces 12 useState calls with 4 hooks
  const blockModal = useModalForm<CreateStableBlockData>({ name: '', sequence: 0 });
  const stableModal = useModalForm<CreateStableData>({ name: '', sequence: 0 });
  const liveryModal = useModalForm<{
    livery_package_id: number | null;
    livery_start_date: string;
    livery_end_date: string;
  }>({ livery_package_id: null, livery_start_date: '', livery_end_date: '' });

  // Assign modal has complex state (toggle between modes)
  const [assignModal, setAssignModal] = useState<AssignModalState>(defaultAssignState);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);

  // Confirm delete state
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'block' | 'stable';
    item: StableBlock | Stable;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [blocksData, stablesData, horsesData, packagesData, usersData] = await Promise.all([
        stableBlocksApi.list(),
        stablesApi.list(),
        horsesApi.list(),
        liveryPackagesApi.list(),
        usersApi.list(),
      ]);
      setBlocks(blocksData);
      setStables(stablesData);
      setHorses(horsesData);
      setPackages(packagesData.filter(p => p.is_active));
      setUsers(usersData.filter(u => u.is_active));
    } catch {
      setError('Failed to load stables data');
    } finally {
      setIsLoading(false);
    }
  };

  // Block operations
  const openBlockModal = (block?: StableBlock) => {
    if (block) {
      blockModal.edit(block.id, { name: block.name, sequence: block.sequence });
    } else {
      const maxSequence = blocks.length > 0 ? Math.max(...blocks.map(b => b.sequence)) + 1 : 0;
      blockModal.open({ name: '', sequence: maxSequence });
    }
  };

  const handleBlockSubmit = async () => {
    setError('');
    try {
      if (blockModal.isEditing) {
        await stableBlocksApi.update(blockModal.editingId!, blockModal.formData);
        setSuccess('Block updated successfully');
      } else {
        await stableBlocksApi.create(blockModal.formData);
        setSuccess('Block created successfully');
      }
      blockModal.close();
      await loadData();
    } catch {
      setError('Failed to save block');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setError('');
    try {
      if (deleteTarget.type === 'block') {
        await stableBlocksApi.delete(deleteTarget.item.id);
        setSuccess('Block deleted');
      } else {
        await stablesApi.delete(deleteTarget.item.id);
        setSuccess('Stable deleted');
      }
      setDeleteTarget(null);
      await loadData();
    } catch {
      setError(deleteTarget.type === 'block'
        ? 'Cannot delete block - remove stables first'
        : 'Cannot delete stable - remove horses first');
    }
  };

  const toggleBlockActive = async (block: StableBlock) => {
    try {
      await stableBlocksApi.update(block.id, { is_active: !block.is_active });
      await loadData();
    } catch {
      setError('Failed to update block');
    }
  };

  // Stable operations
  const openStableModal = (stable?: Stable, defaultBlockId?: number) => {
    if (stable) {
      stableModal.edit(stable.id, {
        name: stable.name,
        block_id: stable.block_id,
        number: stable.number,
        sequence: stable.sequence,
      });
    } else {
      const maxSequence = stables.length > 0 ? Math.max(...stables.map(s => s.sequence)) + 1 : 0;
      stableModal.open({
        name: '',
        block_id: defaultBlockId,
        number: undefined,
        sequence: maxSequence,
      });
    }
  };

  const handleStableSubmit = async () => {
    setError('');
    try {
      if (stableModal.isEditing) {
        await stablesApi.update(stableModal.editingId!, stableModal.formData);
        setSuccess('Stable updated successfully');
      } else {
        await stablesApi.create(stableModal.formData);
        setSuccess('Stable created successfully');
      }
      stableModal.close();
      await loadData();
    } catch {
      setError('Failed to save stable');
    }
  };

  const toggleStableActive = async (stable: Stable) => {
    try {
      await stablesApi.update(stable.id, { is_active: !stable.is_active });
      await loadData();
    } catch {
      setError('Failed to update stable');
    }
  };

  // Horse assignment operations
  const openAssignModal = (stable: Stable) => {
    setAssignModal({
      stable,
      mode: 'assign',
      selectedHorseId: '',
      newHorseName: '',
      newHorseOwnerId: '',
    });
  };

  const closeAssignModal = () => {
    setAssignModal(defaultAssignState);
  };

  const handleAssignHorse = async () => {
    if (!assignModal.stable || !assignModal.selectedHorseId) return;
    setError('');
    try {
      await stablesApi.assignHorse(assignModal.stable.id, assignModal.selectedHorseId as number);
      setSuccess('Horse assigned to stable');
      closeAssignModal();
      await loadData();
    } catch {
      setError('Failed to assign horse');
    }
  };

  const handleCreateHorse = async () => {
    if (!assignModal.stable || !assignModal.newHorseName || !assignModal.newHorseOwnerId) return;
    setError('');
    try {
      const newHorse = await horsesApi.create({
        name: assignModal.newHorseName,
        owner_id: assignModal.newHorseOwnerId as number,
      });
      await stablesApi.assignHorse(assignModal.stable.id, newHorse.id);
      setSuccess(`${newHorse.name} created and assigned to ${assignModal.stable.name}`);
      closeAssignModal();
      await loadData();
    } catch {
      setError('Failed to create horse');
    }
  };

  const handleUnassignHorse = async (stable: Stable, horse: Horse) => {
    if (!confirm(`Remove ${horse.name} from ${stable.name}?`)) return;
    setError('');
    try {
      await stablesApi.unassignHorse(stable.id, horse.id);
      setSuccess(`${horse.name} removed from stable`);
      await loadData();
    } catch {
      setError('Failed to remove horse');
    }
  };

  // Livery package operations
  const openLiveryModal = (horse: Horse) => {
    setEditingHorse(horse);
    liveryModal.open({
      livery_package_id: horse.livery_package_id || null,
      livery_start_date: horse.livery_start_date || '',
      livery_end_date: horse.livery_end_date || '',
    });
  };

  const handleLiverySubmit = async () => {
    if (!editingHorse) return;
    setError('');
    try {
      await horsesApi.update(editingHorse.id, {
        livery_package_id: liveryModal.formData.livery_package_id || undefined,
        livery_start_date: liveryModal.formData.livery_start_date || undefined,
        livery_end_date: liveryModal.formData.livery_end_date || undefined,
      });
      setSuccess(`Livery package updated for ${editingHorse.name}`);
      liveryModal.close();
      setEditingHorse(null);
      await loadData();
    } catch {
      setError('Failed to update livery package');
    }
  };

  // Helper functions
  const getHorsesInStable = (stableId: number) => horses.filter(h => h.stable_id === stableId);
  const getUnassignedHorses = () => horses.filter(h => !h.stable_id);
  const getStablesForBlock = (blockId: number) =>
    stables.filter(s => s.block_id === blockId).sort((a, b) => (a.number || 0) - (b.number || 0));
  const getUnassignedStables = () =>
    stables.filter(s => !s.block_id).sort((a, b) => a.sequence - b.sequence);

  if (isLoading) {
    return <div className="ds-loading">Loading stables...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="ds-btn ds-btn-secondary" onClick={() => openBlockModal()}>
          Add Block
        </button>
        <button className="ds-btn ds-btn-primary" onClick={() => openStableModal()}>
          Add Stable
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {/* Stable Blocks */}
      <div className="stables-grid">
        {blocks.map(block => (
          <div key={block.id} className={`stable-block-card ${!block.is_active ? 'inactive' : ''}`}>
            <div className="block-header">
              <h3>{block.name}</h3>
              <div className="block-actions">
                <button
                  className="btn-small"
                  onClick={() => openStableModal(undefined, block.id)}
                  title="Add stable to this block"
                >
                  +
                </button>
                <button className="btn-small" onClick={() => openBlockModal(block)}>
                  Edit
                </button>
                <button
                  className={`btn-small ${block.is_active ? 'btn-warning' : 'btn-success'}`}
                  onClick={() => toggleBlockActive(block)}
                >
                  {block.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  className="btn-small btn-danger"
                  onClick={() => setDeleteTarget({ type: 'block', item: block })}
                >
                  Delete
                </button>
              </div>
            </div>
            <div className="block-stables">
              {getStablesForBlock(block.id).map(stable => (
                <StableItem
                  key={stable.id}
                  stable={stable}
                  horses={getHorsesInStable(stable.id)}
                  onEdit={() => openStableModal(stable)}
                  onToggleActive={() => toggleStableActive(stable)}
                  onDelete={() => setDeleteTarget({ type: 'stable', item: stable })}
                  onAssign={() => openAssignModal(stable)}
                  onUnassign={(horse) => handleUnassignHorse(stable, horse)}
                  onEditLivery={openLiveryModal}
                />
              ))}
              {getStablesForBlock(block.id).length === 0 && (
                <p className="no-stables">No stables in this block</p>
              )}
            </div>
          </div>
        ))}

        {/* Unassigned Stables */}
        {getUnassignedStables().length > 0 && (
          <div className="stable-block-card unassigned">
            <div className="block-header">
              <h3>Unassigned Stables</h3>
            </div>
            <div className="block-stables">
              {getUnassignedStables().map(stable => (
                <div key={stable.id} className={`stable-item ${!stable.is_active ? 'inactive' : ''}`}>
                  <div className="stable-info">
                    <span className="stable-name">{stable.name}</span>
                    {stable.horse_count !== undefined && stable.horse_count > 0 && (
                      <span className="stable-horse-count">{stable.horse_count} horse(s)</span>
                    )}
                  </div>
                  <div className="stable-actions">
                    <button className="btn-small" onClick={() => openStableModal(stable)}>
                      Edit
                    </button>
                    <button
                      className="btn-small btn-danger"
                      onClick={() => setDeleteTarget({ type: 'stable', item: stable })}
                    >
                      Del
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {blocks.length === 0 && stables.length === 0 && (
        <div className="ds-empty">
          <p>No stable blocks or stables configured yet.</p>
          <p>Create a block first, then add stables to it.</p>
        </div>
      )}

      {/* Block Modal */}
      <Modal
        isOpen={blockModal.isOpen}
        onClose={blockModal.close}
        title={blockModal.isEditing ? 'Edit Block' : 'Add Block'}
        size="sm"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={blockModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleBlockSubmit}>
              {blockModal.isEditing ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <FormGroup label="Block Name" required>
          <Input
            value={blockModal.formData.name}
            onChange={e => blockModal.updateField('name', e.target.value)}
            placeholder="e.g., Front Block"
            required
          />
        </FormGroup>
        <FormGroup label="Display Order" help="Lower numbers appear first">
          <Input
            type="number"
            value={blockModal.formData.sequence}
            onChange={e => blockModal.updateField('sequence', parseInt(e.target.value) || 0)}
            min={0}
          />
        </FormGroup>
      </Modal>

      {/* Stable Modal */}
      <Modal
        isOpen={stableModal.isOpen}
        onClose={stableModal.close}
        title={stableModal.isEditing ? 'Edit Stable' : 'Add Stable'}
        size="sm"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={stableModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleStableSubmit}>
              {stableModal.isEditing ? 'Update' : 'Create'}
            </button>
          </>
        }
      >
        <FormGroup label="Stable Name" required>
          <Input
            value={stableModal.formData.name}
            onChange={e => stableModal.updateField('name', e.target.value)}
            placeholder="e.g., Front Block 1"
            required
          />
        </FormGroup>
        <FormGroup label="Block">
          <Select
            value={stableModal.formData.block_id || ''}
            onChange={e => stableModal.updateField('block_id', e.target.value ? parseInt(e.target.value) : undefined)}
          >
            <option value="">No block (unassigned)</option>
            {blocks.filter(b => b.is_active).map(block => (
              <option key={block.id} value={block.id}>{block.name}</option>
            ))}
          </Select>
        </FormGroup>
        <FormRow>
          <FormGroup label="Number in Block" help="Position within the block">
            <Input
              type="number"
              value={stableModal.formData.number || ''}
              onChange={e => stableModal.updateField('number', e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="e.g., 1, 2, 3"
              min={1}
            />
          </FormGroup>
          <FormGroup label="Feed Order" help="Global order for feed prep">
            <Input
              type="number"
              value={stableModal.formData.sequence}
              onChange={e => stableModal.updateField('sequence', parseInt(e.target.value) || 0)}
              min={0}
            />
          </FormGroup>
        </FormRow>
      </Modal>

      {/* Horse Assignment Modal */}
      <Modal
        isOpen={!!assignModal.stable}
        onClose={closeAssignModal}
        title={`Assign Horse to ${assignModal.stable?.name || ''}`}
        size="sm"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={closeAssignModal}>Cancel</button>
            {assignModal.mode === 'assign' ? (
              <button
                className="ds-btn ds-btn-primary"
                onClick={handleAssignHorse}
                disabled={!assignModal.selectedHorseId}
              >
                Assign
              </button>
            ) : (
              <button
                className="ds-btn ds-btn-primary"
                onClick={handleCreateHorse}
                disabled={!assignModal.newHorseName || !assignModal.newHorseOwnerId}
              >
                Create & Assign
              </button>
            )}
          </>
        }
      >
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button
            type="button"
            className={`btn-small ${assignModal.mode === 'assign' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAssignModal(prev => ({ ...prev, mode: 'assign' }))}
          >
            Assign Existing
          </button>
          <button
            type="button"
            className={`btn-small ${assignModal.mode === 'create' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAssignModal(prev => ({ ...prev, mode: 'create' }))}
          >
            Create New Horse
          </button>
        </div>

        {assignModal.mode === 'assign' ? (
          <FormGroup label="Select Horse">
            <Select
              value={assignModal.selectedHorseId}
              onChange={e => setAssignModal(prev => ({
                ...prev,
                selectedHorseId: e.target.value ? parseInt(e.target.value) : ''
              }))}
            >
              <option value="">Choose a horse...</option>
              {getUnassignedHorses().map(horse => (
                <option key={horse.id} value={horse.id}>{horse.name}</option>
              ))}
            </Select>
            {getUnassignedHorses().length === 0 && (
              <small className="text-muted">No unassigned horses available. Create a new one instead.</small>
            )}
          </FormGroup>
        ) : (
          <>
            <FormGroup label="Horse Name" required>
              <Input
                value={assignModal.newHorseName}
                onChange={e => setAssignModal(prev => ({ ...prev, newHorseName: e.target.value }))}
                placeholder="Enter horse name"
                required
              />
            </FormGroup>
            <FormGroup label="Owner" required>
              <Select
                value={assignModal.newHorseOwnerId}
                onChange={e => setAssignModal(prev => ({
                  ...prev,
                  newHorseOwnerId: e.target.value ? parseInt(e.target.value) : ''
                }))}
                required
              >
                <option value="">Select owner...</option>
                {users.filter(u => u.role === 'livery' || u.role === 'admin').map(user => (
                  <option key={user.id} value={user.id}>{user.name} ({user.username})</option>
                ))}
              </Select>
            </FormGroup>
          </>
        )}
      </Modal>

      {/* Livery Package Modal */}
      <Modal
        isOpen={liveryModal.isOpen}
        onClose={() => { liveryModal.close(); setEditingHorse(null); }}
        title={`Livery Package for ${editingHorse?.name || ''}`}
        size="sm"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => { liveryModal.close(); setEditingHorse(null); }}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleLiverySubmit}>Save</button>
          </>
        }
      >
        <FormGroup label="Livery Package">
          <Select
            value={liveryModal.formData.livery_package_id || ''}
            onChange={e => liveryModal.updateField('livery_package_id', e.target.value ? parseInt(e.target.value) : null)}
          >
            <option value="">No package assigned</option>
            {packages.map(pkg => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name} {pkg.monthly_price ? `(£${pkg.monthly_price}/month)` : `- ${pkg.price_display}`}
              </option>
            ))}
          </Select>
        </FormGroup>
        <FormRow>
          <FormGroup label="Start Date" help="When livery started (for pro-rata billing)">
            <Input
              type="date"
              value={liveryModal.formData.livery_start_date}
              onChange={e => liveryModal.updateField('livery_start_date', e.target.value)}
            />
          </FormGroup>
          <FormGroup label="End Date" help="Leave blank if ongoing">
            <Input
              type="date"
              value={liveryModal.formData.livery_end_date}
              onChange={e => liveryModal.updateField('livery_end_date', e.target.value)}
            />
          </FormGroup>
        </FormRow>
      </Modal>

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title={`Delete ${deleteTarget?.type === 'block' ? 'Block' : 'Stable'}`}
        message={`Are you sure you want to delete "${(deleteTarget?.item as StableBlock | Stable)?.name}"?`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

// Extracted StableItem component
interface StableItemProps {
  stable: Stable;
  horses: Horse[];
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onUnassign: (horse: Horse) => void;
  onEditLivery: (horse: Horse) => void;
}

function StableItem({
  stable,
  horses,
  onEdit,
  onToggleActive,
  onDelete,
  onAssign,
  onUnassign,
  onEditLivery,
}: StableItemProps) {
  return (
    <div className={`stable-item ${!stable.is_active ? 'inactive' : ''}`}>
      <div className="stable-info">
        <span className="stable-number">{stable.number || '-'}</span>
        <span className="stable-name">{stable.name}</span>
      </div>
      <div className="stable-horses">
        {horses.map(horse => (
          <span key={horse.id} className="horse-tag">
            <span
              className="horse-name-link"
              onClick={() => onEditLivery(horse)}
              title="Click to edit livery package"
            >
              {horse.name}
              {horse.livery_package_name && (
                <span className="horse-package-badge">{horse.livery_package_name}</span>
              )}
            </span>
            <button
              className="horse-remove-btn"
              onClick={() => onUnassign(horse)}
              title="Remove from stable"
            >
              x
            </button>
          </span>
        ))}
        <button
          className="btn-small btn-assign"
          onClick={onAssign}
          title="Assign horse"
        >
          + Horse
        </button>
      </div>
      <div className="stable-actions">
        <button className="btn-small" onClick={onEdit}>Edit</button>
        <button
          className={`btn-small ${stable.is_active ? 'btn-warning' : 'btn-success'}`}
          onClick={onToggleActive}
        >
          {stable.is_active ? 'Off' : 'On'}
        </button>
        <button className="btn-small btn-danger" onClick={onDelete}>Del</button>
      </div>
    </div>
  );
}
