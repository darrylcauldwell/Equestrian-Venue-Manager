import { useState, useEffect, useCallback } from 'react';
import { featureFlagsApi } from '../../services/api';
import { useFeatureFlags } from '../../contexts/FeatureFlagsContext';
import type { FeatureKey, FeatureFlagInfo, FeatureGroupInfo, FeatureGroup } from '../../types';

// Feature group display order
const GROUP_ORDER: FeatureGroup[] = [
  'staff_operations',
  'livery',
  'health',
  'facilities',
  'financial',
  'events',
  'communication',
  'contracts',
  'administration',
  // 'integrations' - handled separately since they have their own config sections
  // 'core' - not shown since it can't be disabled
];

export function FeatureFlagsSettings() {
  const [flags, setFlags] = useState<Record<string, FeatureFlagInfo>>({});
  const [groups, setGroups] = useState<Record<string, FeatureGroupInfo>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { refreshFlags: refreshContextFlags } = useFeatureFlags();

  const loadFlags = useCallback(async () => {
    try {
      setError('');
      const data = await featureFlagsApi.getAll();
      setFlags(data.flags);
      setGroups(data.groups);
    } catch (err) {
      setError('Failed to load feature flags');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  const handleToggle = async (featureKey: FeatureKey, enabled: boolean) => {
    setIsSaving(featureKey);
    setError('');
    setSuccess('');

    try {
      const result = await featureFlagsApi.update(featureKey, enabled);

      if (result.success) {
        // Update local state
        setFlags(prev => ({
          ...prev,
          [featureKey]: { ...prev[featureKey], enabled },
          // Also update any cascaded features
          ...result.updated_features.reduce((acc, key) => {
            if (key !== featureKey && prev[key]) {
              acc[key] = { ...prev[key], enabled: false };
            }
            return acc;
          }, {} as Record<string, FeatureFlagInfo>),
        }));

        // Refresh the context to update navigation
        await refreshContextFlags();

        if (result.warnings.length > 0) {
          setSuccess(`Updated. ${result.warnings.join(' ')}`);
        } else {
          setSuccess(`${flags[featureKey]?.label || featureKey} ${enabled ? 'enabled' : 'disabled'}`);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update feature';
      setError(message);
    } finally {
      setIsSaving(null);
    }
  };

  if (isLoading) {
    return (
      <details className="form-section">
        <summary><h3 style={{ display: 'inline' }}>System Capabilities</h3></summary>
        <p>Loading...</p>
      </details>
    );
  }

  return (
    <details className="form-section">
      <summary><h3 style={{ display: 'inline' }}>System Capabilities</h3></summary>
      <p className="small-text">
        Enable or disable system features. Disabled features are hidden from navigation and inaccessible.
        Some features have dependencies and cannot be enabled without their prerequisites.
      </p>

      {error && <div className="ds-alert ds-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {success && <div className="success-message" style={{ marginBottom: '1rem' }}>{success}</div>}

      {GROUP_ORDER.map(groupKey => {
        const group = groups[groupKey];
        if (!group) return null;

        return (
          <div key={groupKey} className="form-subsection" style={{ marginBottom: '1.5rem' }}>
            <h4>{group.label}</h4>
            <p className="small-text" style={{ marginBottom: '0.75rem' }}>{group.description}</p>

            <div className="feature-toggles">
              {group.features.map(featureKey => {
                const flag = flags[featureKey];
                if (!flag || flag.locked) return null;

                const isDisabled = isSaving === featureKey;
                const hasDependencies = flag.dependencies.length > 0;
                const hasMissingDeps = hasDependencies && flag.dependencies.some(
                  dep => !flags[dep]?.enabled
                );

                return (
                  <div key={featureKey} className="feature-toggle-block">
                    <div className="feature-toggle-row">
                      <div className="feature-toggle-info">
                        <span className="feature-toggle-label">{flag.label}</span>
                        <span className="feature-toggle-description">
                          {flag.description}
                          {hasDependencies && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              Requires: {flag.dependencies.map(d => flags[d]?.label || d).join(', ')}
                            </span>
                          )}
                        </span>
                      </div>
                      <label className={`toggle-switch ${hasMissingDeps && !flag.enabled ? 'toggle-disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={flag.enabled}
                          onChange={(e) => handleToggle(featureKey as FeatureKey, e.target.checked)}
                          disabled={isDisabled || (hasMissingDeps && !flag.enabled)}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="form-subsection" style={{ marginTop: '1rem', padding: '1rem', backgroundColor: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
        <p className="small-text" style={{ margin: 0 }}>
          <strong>Note:</strong> Integration features (Stripe, DocuSign, WhatsApp) are configured in their dedicated sections above.
          Core features like User Management cannot be disabled.
        </p>
      </div>
    </details>
  );
}

export default FeatureFlagsSettings;
