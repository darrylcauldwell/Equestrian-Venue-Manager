import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { arenasApi, bookingsApi, uploadsApi } from '../../services/api';
import { useModalForm, useRequestState } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../../components/ui';
import type { Arena, CreateArenaData, ArenaUsageReport, PeriodUsageReport } from '../../types';
import { PageActions, ActiveBadge } from '../../components/admin';
import './Admin.css';

type TabType = 'arenas' | 'usage';

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
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state
  const getInitialTab = (): TabType => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'usage') return 'usage';
    return 'arenas';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);

  // React to URL changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'usage') {
      setActiveTab('usage');
    } else {
      setActiveTab('arenas');
    }
  }, [searchParams]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab === 'arenas') {
      setSearchParams({});
    } else {
      setSearchParams({ tab });
    }
  };

  // Arena management state
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Usage report state
  const [report, setReport] = useState<ArenaUsageReport | null>(null);
  const [activePeriod, setActivePeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);

  // Modal hook
  const arenaModal = useModalForm<CreateArenaData>(emptyFormData);

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<Arena | null>(null);

  const loadArenas = useCallback(async () => {
    try {
      const data = await arenasApi.listAll();
      setArenas(data);
    } catch {
      setError('Failed to load arenas');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  const loadReport = useCallback(async () => {
    try {
      const data = await bookingsApi.getUsageReport();
      setReport(data);
    } catch {
      setError('Failed to load arena usage report');
    }
  }, [setError]);

  useEffect(() => {
    loadArenas();
    loadReport();
  }, [loadArenas, loadReport]);

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

  // Usage report helpers
  const formatHours = (hours: number): string => {
    if (hours === 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const getPercentage = (value: number, total: number): string => {
    if (total === 0) return '0%';
    return `${Math.round((value / total) * 100)}%`;
  };

  const getActivePeriod = (): PeriodUsageReport | null => {
    if (!report) return null;
    switch (activePeriod) {
      case 'month':
        return report.previous_month;
      case 'quarter':
        return report.previous_quarter;
      case 'year':
        return report.previous_year;
    }
  };

  const getBookingTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      public: 'var(--color-error)',
      livery: 'var(--color-success)',
      event: 'var(--color-purple)',
      maintenance: 'var(--text-secondary)',
      training_clinic: 'var(--color-info)',
    };
    return colors[type] || 'var(--text-muted)';
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  const period = getActivePeriod();

  return (
    <div className="admin-page">
      {/* Tab Navigation */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === 'arenas' ? 'active' : ''}`}
          onClick={() => handleTabChange('arenas')}
        >
          Arenas
        </button>
        <button
          className={`admin-tab ${activeTab === 'usage' ? 'active' : ''}`}
          onClick={() => handleTabChange('usage')}
        >
          Usage Report
        </button>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Arenas Tab */}
      {activeTab === 'arenas' && (
        <>
          <PageActions>
            <button className="ds-btn ds-btn-primary" onClick={() => arenaModal.open()}>
              + Add Arena
            </button>
          </PageActions>

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
        </>
      )}

      {/* Usage Report Tab */}
      {activeTab === 'usage' && (
        <>
          {/* Period Selector */}
          <div className="period-selector">
            <button
              className={`period-btn ${activePeriod === 'month' ? 'active' : ''}`}
              onClick={() => setActivePeriod('month')}
            >
              Previous Month
              {report && <span className="period-label">{report.previous_month.period_label}</span>}
            </button>
            <button
              className={`period-btn ${activePeriod === 'quarter' ? 'active' : ''}`}
              onClick={() => setActivePeriod('quarter')}
            >
              Previous Quarter
              {report && <span className="period-label">{report.previous_quarter.period_label}</span>}
            </button>
            <button
              className={`period-btn ${activePeriod === 'year' ? 'active' : ''}`}
              onClick={() => setActivePeriod('year')}
            >
              Previous Year
              {report && <span className="period-label">{report.previous_year.period_label}</span>}
            </button>
          </div>

          {period && (
            <>
              {/* Summary Cards */}
              <div className="report-summary">
                <div className="summary-card">
                  <h3>Total Usage</h3>
                  <div className="summary-value">{formatHours(period.total_hours)}</div>
                  <div className="summary-label">across all arenas</div>
                </div>
                <div className="summary-card">
                  <h3>Arenas</h3>
                  <div className="summary-value">{period.arena_summaries.length}</div>
                  <div className="summary-label">active arenas</div>
                </div>
              </div>

              {/* Usage Type Legend */}
              <div className="usage-legend">
                <h3>Usage Types</h3>
                <div className="legend-items">
                  <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: getBookingTypeColor('livery') }}></span>
                    <span>Livery Usage (Free)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: getBookingTypeColor('public') }}></span>
                    <span>Private/External (Paid)</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: getBookingTypeColor('training_clinic') }}></span>
                    <span>Training Clinics</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: getBookingTypeColor('event') }}></span>
                    <span>Events</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ backgroundColor: getBookingTypeColor('maintenance') }}></span>
                    <span>Maintenance</span>
                  </div>
                </div>
              </div>

              {/* Arena Breakdown */}
              {period.arena_summaries.map((arena) => (
                <div key={arena.arena_id} className="arena-usage-card">
                  <div className="arena-usage-header">
                    <h3>{arena.arena_name}</h3>
                    <div className="arena-total">{formatHours(arena.total_hours)} total</div>
                  </div>

                  {arena.total_hours > 0 ? (
                    <>
                      {/* Usage Bar */}
                      <div className="usage-bar">
                        {arena.usage_by_type
                          .filter(u => u.total_hours > 0)
                          .map((usage) => (
                            <div
                              key={usage.booking_type}
                              className="usage-segment"
                              style={{
                                width: getPercentage(usage.total_hours, arena.total_hours),
                                backgroundColor: getBookingTypeColor(usage.booking_type),
                              }}
                              title={`${usage.label}: ${formatHours(usage.total_hours)} (${usage.booking_count} bookings)`}
                            />
                          ))}
                      </div>

                      {/* Detailed Breakdown */}
                      <div className="usage-details">
                        {arena.usage_by_type
                          .filter(u => u.total_hours > 0)
                          .sort((a, b) => b.total_hours - a.total_hours)
                          .map((usage) => (
                            <div key={usage.booking_type} className="usage-detail-row">
                              <div className="usage-detail-label">
                                <span
                                  className="usage-dot"
                                  style={{ backgroundColor: getBookingTypeColor(usage.booking_type) }}
                                />
                                <span>{usage.label}</span>
                              </div>
                              <div className="usage-detail-stats">
                                <span className="usage-hours">{formatHours(usage.total_hours)}</span>
                                <span className="usage-percentage">
                                  ({getPercentage(usage.total_hours, arena.total_hours)})
                                </span>
                                <span className="usage-count">{usage.booking_count} booking{usage.booking_count !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </>
                  ) : (
                    <div className="no-usage">No usage recorded for this period</div>
                  )}
                </div>
              ))}

              {period.arena_summaries.length === 0 && (
                <div className="ds-empty">
                  <p>No active arenas found.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      <style>{`
        .admin-tabs {
          display: flex;
          gap: 0;
          margin-bottom: 1.5rem;
          border-bottom: 2px solid var(--border-color);
        }

        .admin-tab {
          padding: 0.75rem 1.5rem;
          border: none;
          background: transparent;
          cursor: pointer;
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--text-secondary);
          position: relative;
          transition: color 0.2s;
        }

        .admin-tab:hover {
          color: var(--text-primary);
        }

        .admin-tab.active {
          color: var(--color-primary);
        }

        .admin-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--color-primary);
        }

        .period-selector {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .period-btn {
          padding: 0.75rem 1.5rem;
          border: 2px solid var(--border-color);
          background: var(--bg-card);
          border-radius: var(--radius-lg);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
          transition: all 0.2s;
          color: var(--text-primary);
        }

        .period-btn:hover {
          border-color: var(--color-primary);
        }

        .period-btn.active {
          border-color: var(--color-primary);
          background: var(--color-primary);
          color: var(--text-inverse);
        }

        .period-label {
          font-size: 0.75rem;
          opacity: 0.7;
        }

        .report-summary {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .summary-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          text-align: center;
        }

        .summary-card h3 {
          margin: 0 0 0.5rem 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .summary-value {
          font-size: 2rem;
          font-weight: 700;
          color: var(--color-primary);
        }

        .summary-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        .usage-legend {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .usage-legend h3 {
          margin: 0 0 0.75rem 0;
          font-size: 0.875rem;
          font-weight: 600;
        }

        .legend-items {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .legend-color {
          width: 12px;
          height: 12px;
          border-radius: 3px;
        }

        .arena-usage-card {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          margin-bottom: 1rem;
        }

        .arena-usage-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .arena-usage-header h3 {
          margin: 0;
          font-size: 1.125rem;
        }

        .arena-total {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-primary);
        }

        .usage-bar {
          display: flex;
          height: 24px;
          border-radius: var(--radius-sm);
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .usage-segment {
          height: 100%;
          transition: width 0.3s;
          cursor: help;
        }

        .usage-details {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .usage-detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: var(--bg-secondary);
          border-radius: var(--radius-sm);
        }

        .usage-detail-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .usage-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }

        .usage-detail-stats {
          display: flex;
          gap: 1rem;
          font-size: 0.875rem;
        }

        .usage-hours {
          font-weight: 600;
          min-width: 60px;
          text-align: right;
        }

        .usage-percentage {
          color: var(--text-secondary);
          min-width: 50px;
        }

        .usage-count {
          color: var(--text-secondary);
          min-width: 100px;
          text-align: right;
        }

        .no-usage {
          text-align: center;
          color: var(--text-secondary);
          padding: 1rem;
          font-style: italic;
        }

        @media (max-width: 640px) {
          .period-btn {
            flex: 1;
            text-align: center;
            align-items: center;
          }

          .usage-detail-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .usage-detail-stats {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
