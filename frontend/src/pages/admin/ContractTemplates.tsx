import { useState, useEffect, useCallback } from 'react';
import { contractsApi, liveryPackagesApi } from '../../services/api';
import { useModalForm, useRequestState } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Textarea, Select } from '../../components/ui';
import RichTextEditor from '../../components/RichTextEditor';
import type {
  ContractTemplateSummary,
  CreateContractTemplate,
  ContractVersionSummary,
  CreateContractVersion,
  LiveryPackage
} from '../../types';
import {
  PageActions,
  ActiveBadge,
} from '../../components/admin';
import './Admin.css';

const emptyTemplateForm: CreateContractTemplate = {
  name: '',
  contract_type: 'livery',
  description: '',
  is_active: true,
};

const emptyVersionForm: CreateContractVersion = {
  html_content: '',
  change_summary: '',
};

export function AdminContractTemplates() {
  const [templates, setTemplates] = useState<ContractTemplateSummary[]>([]);
  const [liveryPackages, setLiveryPackages] = useState<LiveryPackage[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ContractTemplateSummary | null>(null);
  const [versions, setVersions] = useState<ContractVersionSummary[]>([]);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<ContractVersionSummary | null>(null);
  const [diffHtml, setDiffHtml] = useState<string>('');
  const [showDiffModal, setShowDiffModal] = useState(false);

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal hooks
  const templateModal = useModalForm<CreateContractTemplate>(emptyTemplateForm);
  const [versionForm, setVersionForm] = useState<CreateContractVersion>(emptyVersionForm);
  const [editContent, setEditContent] = useState<string>('');
  const [editChangeSummary, setEditChangeSummary] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<ContractTemplateSummary | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await contractsApi.listTemplates();
      setTemplates(data);
    } catch {
      setError('Failed to load contract templates');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  const loadLiveryPackages = useCallback(async () => {
    try {
      const data = await liveryPackagesApi.listAll();
      setLiveryPackages(data);
    } catch {
      // Non-critical, can proceed without
    }
  }, []);

  const loadVersions = useCallback(async (templateId: number) => {
    try {
      const data = await contractsApi.listVersions(templateId);
      setVersions(data);
    } catch {
      setError('Failed to load template versions');
    }
  }, [setError]);

  useEffect(() => {
    loadTemplates();
    loadLiveryPackages();
  }, [loadTemplates, loadLiveryPackages]);

  useEffect(() => {
    if (selectedTemplate) {
      loadVersions(selectedTemplate.id);
    } else {
      setVersions([]);
    }
  }, [selectedTemplate, loadVersions]);

  const handleSubmitTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (templateModal.isEditing && templateModal.editingId) {
        await contractsApi.updateTemplate(templateModal.editingId, templateModal.formData);

        // If content changed, create a new version
        if (editContent !== originalContent && editContent.trim()) {
          await contractsApi.createVersion(templateModal.editingId, {
            html_content: editContent,
            change_summary: editChangeSummary || 'Content updated',
          });
        }
      } else {
        // Backend requires html_content in the create request
        // Include the content from the editor (or a placeholder if empty)
        const newTemplate = await contractsApi.createTemplate({
          ...templateModal.formData,
          html_content: editContent.trim() || '<p>Contract content to be added</p>',
        });

        // Note: Backend now creates initial version automatically with the provided html_content
        // No need to create a separate version
        void newTemplate; // Template created with content
      }
      templateModal.close();
      setEditContent('');
      setOriginalContent('');
      setEditChangeSummary('');
      await loadTemplates();
      if (selectedTemplate) {
        await loadVersions(selectedTemplate.id);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save template';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTemplate = async (template: ContractTemplateSummary) => {
    templateModal.edit(template.id, {
      name: template.name,
      contract_type: template.contract_type,
      description: template.description || '',
      is_active: template.is_active,
    });

    // Load current version content
    try {
      const templateVersions = await contractsApi.listVersions(template.id);
      const currentVersion = templateVersions.find(v => v.is_current);
      setEditContent(currentVersion?.html_content || '');
      setOriginalContent(currentVersion?.html_content || '');
      setEditChangeSummary('');
    } catch {
      setEditContent('');
      setOriginalContent('');
      setEditChangeSummary('');
    }
  };

  const handleToggleActive = async (template: ContractTemplateSummary) => {
    try {
      await contractsApi.updateTemplate(template.id, { is_active: !template.is_active });
      await loadTemplates();
    } catch {
      setError('Failed to update template status');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await contractsApi.deleteTemplate(deleteConfirm.id);
      setDeleteConfirm(null);
      if (selectedTemplate?.id === deleteConfirm.id) {
        setSelectedTemplate(null);
      }
      await loadTemplates();
    } catch {
      setError('Failed to delete template');
    }
  };

  const handleSubmitVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    setError('');
    setIsSubmitting(true);

    try {
      await contractsApi.createVersion(selectedTemplate.id, versionForm);
      setShowVersionModal(false);
      setVersionForm(emptyVersionForm);
      await loadVersions(selectedTemplate.id);
      await loadTemplates(); // Refresh to get updated version count
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create version';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewDiff = async (version: ContractVersionSummary) => {
    if (version.version_number <= 1) return;
    try {
      const diff = await contractsApi.getVersionDiff(
        selectedTemplate!.id,
        version.version_number - 1,
        version.version_number
      );
      setDiffHtml(diff.diff_html);
      setShowDiffModal(true);
    } catch {
      setError('Failed to load version diff');
    }
  };

  const getContractTypeLabel = (type: string) => {
    switch (type) {
      case 'livery': return 'Livery Agreement';
      case 'employment': return 'Employment Contract';
      case 'custom': return 'Custom Contract';
      default: return type;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <button className="ds-btn ds-btn-primary" onClick={() => templateModal.open()}>
          + Create Template
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Template Modal */}
      <Modal
        isOpen={templateModal.isOpen}
        onClose={templateModal.close}
        title={templateModal.isEditing ? 'Edit Template' : 'Create Contract Template'}
        size="lg"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={templateModal.close}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitTemplate} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : (templateModal.isEditing ? 'Save Changes' : 'Create Template')}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitTemplate}>
          <FormRow>
            <FormGroup label="Template Name" required>
              <Input
                value={templateModal.formData.name}
                onChange={(e) => templateModal.updateField('name', e.target.value)}
                placeholder="e.g., Standard Livery Agreement"
                required
              />
            </FormGroup>

            <FormGroup label="Contract Type" required>
              <Select
                value={templateModal.formData.contract_type}
                onChange={(e) => templateModal.updateField('contract_type', e.target.value as 'livery' | 'employment' | 'custom')}
                required
              >
                <option value="livery">Livery Agreement</option>
                <option value="employment">Employment Contract</option>
                <option value="custom">Custom Contract</option>
              </Select>
            </FormGroup>
          </FormRow>

          {templateModal.formData.contract_type === 'livery' && (
            <FormGroup label="Link to Livery Package (optional)">
              <Select
                value={templateModal.formData.livery_package_id || ''}
                onChange={(e) => templateModal.updateField('livery_package_id', e.target.value ? parseInt(e.target.value) : undefined)}
              >
                <option value="">-- No specific package --</option>
                {liveryPackages.map((pkg) => (
                  <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                ))}
              </Select>
              <small>If linked, this contract will be automatically associated with users on this package</small>
            </FormGroup>
          )}

          <FormGroup label="Description">
            <Textarea
              value={templateModal.formData.description || ''}
              onChange={(e) => templateModal.updateField('description', e.target.value)}
              placeholder="Internal description of this contract template..."
              rows={2}
            />
          </FormGroup>

          <div className="ds-form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={templateModal.formData.is_active ?? true}
                onChange={(e) => templateModal.updateField('is_active', e.target.checked)}
              />
              Active
            </label>
            <small>Active templates can be used to request signatures</small>
          </div>

          <FormGroup label="Contract Content">
            <RichTextEditor
              value={editContent}
              onChange={(value) => setEditContent(value)}
              placeholder="Enter the full contract text here..."
              minHeight="300px"
            />
            {!templateModal.isEditing && (
              <small>You can add content now or add it later</small>
            )}
          </FormGroup>

          {templateModal.isEditing && editContent !== originalContent && (
            <FormGroup label="Change Summary">
              <Input
                value={editChangeSummary}
                onChange={(e) => setEditChangeSummary(e.target.value)}
                placeholder="Brief description of changes made..."
              />
              <small>Describe what changed in this version</small>
            </FormGroup>
          )}
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Template"
        message={`Are you sure you want to delete "${deleteConfirm?.name}"? This will also delete all versions and pending signatures. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Version Modal */}
      <Modal
        isOpen={showVersionModal}
        onClose={() => setShowVersionModal(false)}
        title={`New Version for "${selectedTemplate?.name}"`}
        size="xl"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => setShowVersionModal(false)}>
              Cancel
            </button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitVersion} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Version'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitVersion}>
          <FormGroup label="Change Summary">
            <Input
              value={versionForm.change_summary}
              onChange={(e) => setVersionForm({ ...versionForm, change_summary: e.target.value })}
              placeholder="Brief description of changes in this version..."
            />
          </FormGroup>

          <FormGroup label="Contract Content" required>
            <RichTextEditor
              value={versionForm.html_content}
              onChange={(value) => setVersionForm({ ...versionForm, html_content: value })}
              placeholder="Enter the full contract text here..."
              minHeight="400px"
            />
          </FormGroup>
        </form>
      </Modal>

      {/* View Version Modal */}
      <Modal
        isOpen={!!viewingVersion}
        onClose={() => setViewingVersion(null)}
        title={`Version ${viewingVersion?.version_number} Content`}
        size="xl"
        footer={
          <button className="ds-btn ds-btn-secondary" onClick={() => setViewingVersion(null)}>
            Close
          </button>
        }
      >
        <div
          className="contract-preview"
          dangerouslySetInnerHTML={{ __html: viewingVersion?.html_content || '' }}
        />
      </Modal>

      {/* Diff Modal */}
      <Modal
        isOpen={showDiffModal}
        onClose={() => setShowDiffModal(false)}
        title="Version Changes"
        size="xl"
        footer={
          <button className="ds-btn ds-btn-secondary" onClick={() => setShowDiffModal(false)}>
            Close
          </button>
        }
      >
        <div
          className="contract-diff-preview"
          dangerouslySetInnerHTML={{ __html: diffHtml }}
        />
        <style>{`
          .contract-diff-preview ins {
            background-color: #d4edda;
            text-decoration: none;
          }
          .contract-diff-preview del {
            background-color: #f8d7da;
            text-decoration: line-through;
          }
        `}</style>
      </Modal>

      <div className="admin-split-layout">
        {/* Templates List */}
        <div className="admin-list-panel">
          <h3>Contract Templates</h3>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Type</th>
                <th>Versions</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => (
                <tr
                  key={template.id}
                  className={selectedTemplate?.id === template.id ? 'selected' : ''}
                  onClick={() => setSelectedTemplate(template)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <strong>{template.name}</strong>
                    {template.description && <div className="small-text">{template.description}</div>}
                  </td>
                  <td>
                    <span className={`badge badge-${template.contract_type}`}>
                      {getContractTypeLabel(template.contract_type)}
                    </span>
                  </td>
                  <td>{template.version_count || 0}</td>
                  <td>
                    <ActiveBadge isActive={template.is_active} />
                  </td>
                  <td className="actions-cell" onClick={(e) => e.stopPropagation()}>
                    <button className="btn-small" onClick={() => handleEditTemplate(template)}>
                      Edit
                    </button>
                    <button
                      className={`btn-small ${template.is_active ? 'btn-warning' : 'btn-success'}`}
                      onClick={() => handleToggleActive(template)}
                    >
                      {template.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn-small btn-danger"
                      onClick={() => setDeleteConfirm(template)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {templates.length === 0 && (
            <div className="ds-empty">
              <p>No contract templates yet. Click "Create Template" to get started.</p>
            </div>
          )}
        </div>

        {/* Versions Panel */}
        <div className="admin-detail-panel">
          {selectedTemplate ? (
            <>
              <div className="panel-header">
                <h3>Versions: {selectedTemplate.name}</h3>
                <button
                  className="ds-btn ds-btn-primary ds-btn-sm"
                  onClick={() => {
                    // Pre-populate with current version content if exists
                    const currentVersion = versions.find(v => v.is_current);
                    setVersionForm({
                      html_content: currentVersion?.html_content || '',
                      change_summary: '',
                    });
                    setShowVersionModal(true);
                  }}
                >
                  + New Version
                </button>
              </div>

              {versions.length > 0 ? (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Created</th>
                      <th>Changes</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((version) => (
                      <tr key={version.id}>
                        <td>
                          <strong>v{version.version_number}</strong>
                        </td>
                        <td>
                          {formatDate(version.created_at)}
                          {version.created_by && (
                            <div className="small-text">by {version.created_by.full_name}</div>
                          )}
                        </td>
                        <td>
                          {version.change_summary || <span className="small-text text-muted">-</span>}
                        </td>
                        <td>
                          {version.is_current ? (
                            <span className="badge badge-success">Current</span>
                          ) : (
                            <span className="badge badge-secondary">Previous</span>
                          )}
                        </td>
                        <td className="actions-cell">
                          <button
                            className="btn-small"
                            onClick={() => setViewingVersion(version)}
                          >
                            View
                          </button>
                          {version.version_number > 1 && (
                            <button
                              className="btn-small"
                              onClick={() => handleViewDiff(version)}
                            >
                              Diff
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="ds-empty">
                  <p>No versions yet. Click "New Version" to add contract content.</p>
                </div>
              )}
            </>
          ) : (
            <div className="ds-empty">
              <p>Select a template to view its versions</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .admin-split-layout {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--space-6);
          margin-top: var(--space-5);
        }
        .admin-list-panel,
        .admin-detail-panel {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
        }
        .admin-list-panel h3,
        .admin-detail-panel h3 {
          margin: 0 0 var(--space-4) 0;
          color: var(--text-primary);
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
        }
        .panel-header h3 {
          margin: 0;
        }
        .admin-table tr.selected {
          background-color: var(--color-primary-bg);
        }
        .badge-livery {
          background: var(--color-info);
          color: var(--text-inverse);
        }
        .badge-employment {
          background: var(--color-purple);
          color: var(--text-inverse);
        }
        .badge-custom {
          background: var(--text-secondary);
          color: var(--text-inverse);
        }
        .contract-preview {
          max-height: 500px;
          overflow-y: auto;
          padding: var(--space-5);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background: var(--bg-secondary);
          color: var(--text-primary);
        }
        .btn-small.btn-primary {
          background: var(--color-primary);
          color: var(--text-inverse);
        }
        .btn-small.btn-primary:hover {
          background: var(--color-primary-hover);
        }
        @media (max-width: 1024px) {
          .admin-split-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
