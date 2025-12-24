import { useState, useEffect } from 'react';
import { stableBlocksApi, stablesApi, horsesApi, liveryPackagesApi, usersApi } from '../../services/api';
import type { StableBlock, Stable, CreateStableBlockData, CreateStableData, Horse, LiveryPackage, User } from '../../types';
import { PageActions } from '../../components/admin';
import './Admin.css';

export function AdminStables() {
  const [blocks, setBlocks] = useState<StableBlock[]>([]);
  const [stables, setStables] = useState<Stable[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [packages, setPackages] = useState<LiveryPackage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Block modal state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<StableBlock | null>(null);
  const [blockForm, setBlockForm] = useState<CreateStableBlockData>({ name: '', sequence: 0 });

  // Stable modal state
  const [showStableModal, setShowStableModal] = useState(false);
  const [editingStable, setEditingStable] = useState<Stable | null>(null);
  const [stableForm, setStableForm] = useState<CreateStableData>({ name: '', sequence: 0 });

  // Horse assignment modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningStable, setAssigningStable] = useState<Stable | null>(null);
  const [selectedHorseId, setSelectedHorseId] = useState<number | ''>('');
  const [showCreateHorse, setShowCreateHorse] = useState(false);
  const [newHorseForm, setNewHorseForm] = useState<{ name: string; owner_id: number | '' }>({ name: '', owner_id: '' });

  // Horse livery package modal state
  const [showLiveryModal, setShowLiveryModal] = useState(false);
  const [editingHorse, setEditingHorse] = useState<Horse | null>(null);
  const [liveryForm, setLiveryForm] = useState<{
    livery_package_id: number | null;
    livery_start_date: string;
    livery_end_date: string;
  }>({ livery_package_id: null, livery_start_date: '', livery_end_date: '' });

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
      setEditingBlock(block);
      setBlockForm({ name: block.name, sequence: block.sequence });
    } else {
      setEditingBlock(null);
      const maxSequence = blocks.length > 0 ? Math.max(...blocks.map(b => b.sequence)) + 1 : 0;
      setBlockForm({ name: '', sequence: maxSequence });
    }
    setShowBlockModal(true);
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingBlock) {
        await stableBlocksApi.update(editingBlock.id, blockForm);
        setSuccess('Block updated successfully');
      } else {
        await stableBlocksApi.create(blockForm);
        setSuccess('Block created successfully');
      }
      setShowBlockModal(false);
      await loadData();
    } catch {
      setError('Failed to save block');
    }
  };

  const handleDeleteBlock = async (block: StableBlock) => {
    if (!confirm(`Are you sure you want to delete "${block.name}"?`)) return;
    setError('');
    try {
      await stableBlocksApi.delete(block.id);
      setSuccess('Block deleted');
      await loadData();
    } catch {
      setError('Cannot delete block - remove stables first');
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
      setEditingStable(stable);
      setStableForm({
        name: stable.name,
        block_id: stable.block_id,
        number: stable.number,
        sequence: stable.sequence,
      });
    } else {
      setEditingStable(null);
      const maxSequence = stables.length > 0 ? Math.max(...stables.map(s => s.sequence)) + 1 : 0;
      setStableForm({
        name: '',
        block_id: defaultBlockId,
        number: undefined,
        sequence: maxSequence,
      });
    }
    setShowStableModal(true);
  };

  const handleStableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingStable) {
        await stablesApi.update(editingStable.id, stableForm);
        setSuccess('Stable updated successfully');
      } else {
        await stablesApi.create(stableForm);
        setSuccess('Stable created successfully');
      }
      setShowStableModal(false);
      await loadData();
    } catch {
      setError('Failed to save stable');
    }
  };

  const handleDeleteStable = async (stable: Stable) => {
    if (!confirm(`Are you sure you want to delete "${stable.name}"?`)) return;
    setError('');
    try {
      await stablesApi.delete(stable.id);
      setSuccess('Stable deleted');
      await loadData();
    } catch {
      setError('Cannot delete stable - remove horses first');
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
    setAssigningStable(stable);
    setSelectedHorseId('');
    setShowCreateHorse(false);
    setNewHorseForm({ name: '', owner_id: '' });
    setShowAssignModal(true);
  };

  const handleCreateHorse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningStable || !newHorseForm.name || !newHorseForm.owner_id) return;
    setError('');
    try {
      const newHorse = await horsesApi.create({
        name: newHorseForm.name,
        owner_id: newHorseForm.owner_id as number,
      });
      // Assign the new horse to the stable
      await stablesApi.assignHorse(assigningStable.id, newHorse.id);
      setSuccess(`${newHorse.name} created and assigned to ${assigningStable.name}`);
      setShowAssignModal(false);
      await loadData();
    } catch {
      setError('Failed to create horse');
    }
  };

  const getHorsesInStable = (stableId: number) => {
    return horses.filter(h => h.stable_id === stableId);
  };

  const getUnassignedHorses = () => {
    return horses.filter(h => !h.stable_id);
  };

  const handleAssignHorse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigningStable || !selectedHorseId) return;
    setError('');
    try {
      await stablesApi.assignHorse(assigningStable.id, selectedHorseId as number);
      setSuccess('Horse assigned to stable');
      setShowAssignModal(false);
      await loadData();
    } catch {
      setError('Failed to assign horse');
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
    setLiveryForm({
      livery_package_id: horse.livery_package_id || null,
      livery_start_date: horse.livery_start_date || '',
      livery_end_date: horse.livery_end_date || '',
    });
    setShowLiveryModal(true);
  };

  const handleLiverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHorse) return;
    setError('');
    try {
      await horsesApi.update(editingHorse.id, {
        livery_package_id: liveryForm.livery_package_id || undefined,
        livery_start_date: liveryForm.livery_start_date || undefined,
        livery_end_date: liveryForm.livery_end_date || undefined,
      });
      setSuccess(`Livery package updated for ${editingHorse.name}`);
      setShowLiveryModal(false);
      await loadData();
    } catch {
      setError('Failed to update livery package');
    }
  };

  // Group stables by block
  const getStablesForBlock = (blockId: number) => {
    return stables.filter(s => s.block_id === blockId).sort((a, b) => (a.number || 0) - (b.number || 0));
  };

  const getUnassignedStables = () => {
    return stables.filter(s => !s.block_id).sort((a, b) => a.sequence - b.sequence);
  };

  if (isLoading) {
    return <div className="loading">Loading stables...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="btn-secondary" onClick={() => openBlockModal()}>
          Add Block
        </button>
        <button className="btn-primary" onClick={() => openStableModal()}>
          Add Stable
        </button>
      </PageActions>

      {error && <div className="error-message">{error}</div>}
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
                <button className="btn-small btn-danger" onClick={() => handleDeleteBlock(block)}>
                  Delete
                </button>
              </div>
            </div>
            <div className="block-stables">
              {getStablesForBlock(block.id).map(stable => (
                <div key={stable.id} className={`stable-item ${!stable.is_active ? 'inactive' : ''}`}>
                  <div className="stable-info">
                    <span className="stable-number">{stable.number || '-'}</span>
                    <span className="stable-name">{stable.name}</span>
                  </div>
                  <div className="stable-horses">
                    {getHorsesInStable(stable.id).map(horse => (
                      <span key={horse.id} className="horse-tag">
                        <span
                          className="horse-name-link"
                          onClick={() => openLiveryModal(horse)}
                          title="Click to edit livery package"
                        >
                          {horse.name}
                          {horse.livery_package_name && (
                            <span className="horse-package-badge">{horse.livery_package_name}</span>
                          )}
                        </span>
                        <button
                          className="horse-remove-btn"
                          onClick={() => handleUnassignHorse(stable, horse)}
                          title="Remove from stable"
                        >
                          x
                        </button>
                      </span>
                    ))}
                    <button
                      className="btn-small btn-assign"
                      onClick={() => openAssignModal(stable)}
                      title="Assign horse"
                    >
                      + Horse
                    </button>
                  </div>
                  <div className="stable-actions">
                    <button className="btn-small" onClick={() => openStableModal(stable)}>
                      Edit
                    </button>
                    <button
                      className={`btn-small ${stable.is_active ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => toggleStableActive(stable)}
                    >
                      {stable.is_active ? 'Off' : 'On'}
                    </button>
                    <button className="btn-small btn-danger" onClick={() => handleDeleteStable(stable)}>
                      Del
                    </button>
                  </div>
                </div>
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
                    <button className="btn-small btn-danger" onClick={() => handleDeleteStable(stable)}>
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
        <div className="empty-state">
          <p>No stable blocks or stables configured yet.</p>
          <p>Create a block first, then add stables to it.</p>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="modal-overlay" onClick={() => setShowBlockModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingBlock ? 'Edit Block' : 'Add Block'}</h2>
            <form onSubmit={handleBlockSubmit}>
              <div className="form-group">
                <label htmlFor="block-name">Block Name</label>
                <input
                  id="block-name"
                  type="text"
                  value={blockForm.name}
                  onChange={e => setBlockForm({ ...blockForm, name: e.target.value })}
                  placeholder="e.g., Front Block"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="block-sequence">Display Order</label>
                <input
                  id="block-sequence"
                  type="number"
                  value={blockForm.sequence}
                  onChange={e => setBlockForm({ ...blockForm, sequence: parseInt(e.target.value) || 0 })}
                  min={0}
                />
                <small>Lower numbers appear first</small>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowBlockModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingBlock ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stable Modal */}
      {showStableModal && (
        <div className="modal-overlay" onClick={() => setShowStableModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>{editingStable ? 'Edit Stable' : 'Add Stable'}</h2>
            <form onSubmit={handleStableSubmit}>
              <div className="form-group">
                <label htmlFor="stable-name">Stable Name</label>
                <input
                  id="stable-name"
                  type="text"
                  value={stableForm.name}
                  onChange={e => setStableForm({ ...stableForm, name: e.target.value })}
                  placeholder="e.g., Front Block 1"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="stable-block">Block</label>
                <select
                  id="stable-block"
                  value={stableForm.block_id || ''}
                  onChange={e => setStableForm({ ...stableForm, block_id: e.target.value ? parseInt(e.target.value) : undefined })}
                >
                  <option value="">No block (unassigned)</option>
                  {blocks.filter(b => b.is_active).map(block => (
                    <option key={block.id} value={block.id}>
                      {block.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stable-number">Number in Block</label>
                  <input
                    id="stable-number"
                    type="number"
                    value={stableForm.number || ''}
                    onChange={e => setStableForm({ ...stableForm, number: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="e.g., 1, 2, 3"
                    min={1}
                  />
                  <small>Position within the block</small>
                </div>
                <div className="form-group">
                  <label htmlFor="stable-sequence">Feed Order</label>
                  <input
                    id="stable-sequence"
                    type="number"
                    value={stableForm.sequence}
                    onChange={e => setStableForm({ ...stableForm, sequence: parseInt(e.target.value) || 0 })}
                    min={0}
                  />
                  <small>Global order for feed prep</small>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowStableModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingStable ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Horse Assignment Modal */}
      {showAssignModal && assigningStable && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Assign Horse to {assigningStable.name}</h2>

            {/* Toggle between assign existing and create new */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className={`btn-small ${!showCreateHorse ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowCreateHorse(false)}
                >
                  Assign Existing
                </button>
                <button
                  type="button"
                  className={`btn-small ${showCreateHorse ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setShowCreateHorse(true)}
                >
                  Create New Horse
                </button>
              </div>
            </div>

            {!showCreateHorse ? (
              // Assign existing horse form
              <form onSubmit={handleAssignHorse}>
                <div className="form-group">
                  <label htmlFor="horse-select">Select Horse</label>
                  <select
                    id="horse-select"
                    value={selectedHorseId}
                    onChange={e => setSelectedHorseId(e.target.value ? parseInt(e.target.value) : '')}
                    required
                  >
                    <option value="">Choose a horse...</option>
                    {getUnassignedHorses().map(horse => (
                      <option key={horse.id} value={horse.id}>
                        {horse.name}
                      </option>
                    ))}
                  </select>
                  {getUnassignedHorses().length === 0 && (
                    <small className="text-muted">No unassigned horses available. Create a new one instead.</small>
                  )}
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAssignModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={!selectedHorseId}>
                    Assign
                  </button>
                </div>
              </form>
            ) : (
              // Create new horse form
              <form onSubmit={handleCreateHorse}>
                <div className="form-group">
                  <label htmlFor="new-horse-name">Horse Name</label>
                  <input
                    id="new-horse-name"
                    type="text"
                    value={newHorseForm.name}
                    onChange={e => setNewHorseForm({ ...newHorseForm, name: e.target.value })}
                    placeholder="Enter horse name"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-horse-owner">Owner</label>
                  <select
                    id="new-horse-owner"
                    value={newHorseForm.owner_id}
                    onChange={e => setNewHorseForm({ ...newHorseForm, owner_id: e.target.value ? parseInt(e.target.value) : '' })}
                    required
                  >
                    <option value="">Select owner...</option>
                    {users.filter(u => u.role === 'livery' || u.role === 'admin').map(user => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({user.username})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowAssignModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={!newHorseForm.name || !newHorseForm.owner_id}>
                    Create & Assign
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Livery Package Modal */}
      {showLiveryModal && editingHorse && (
        <div className="modal-overlay" onClick={() => setShowLiveryModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Livery Package for {editingHorse.name}</h2>
            <form onSubmit={handleLiverySubmit}>
              <div className="form-group">
                <label htmlFor="livery-package">Livery Package</label>
                <select
                  id="livery-package"
                  value={liveryForm.livery_package_id || ''}
                  onChange={e => setLiveryForm({
                    ...liveryForm,
                    livery_package_id: e.target.value ? parseInt(e.target.value) : null
                  })}
                >
                  <option value="">No package assigned</option>
                  {packages.map(pkg => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} {pkg.monthly_price ? `(£${pkg.monthly_price}/month)` : `- ${pkg.price_display}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="livery-start">Start Date</label>
                  <input
                    id="livery-start"
                    type="date"
                    value={liveryForm.livery_start_date}
                    onChange={e => setLiveryForm({ ...liveryForm, livery_start_date: e.target.value })}
                  />
                  <small>When livery started (for pro-rata billing)</small>
                </div>
                <div className="form-group">
                  <label htmlFor="livery-end">End Date</label>
                  <input
                    id="livery-end"
                    type="date"
                    value={liveryForm.livery_end_date}
                    onChange={e => setLiveryForm({ ...liveryForm, livery_end_date: e.target.value })}
                  />
                  <small>Leave blank if ongoing</small>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowLiveryModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
