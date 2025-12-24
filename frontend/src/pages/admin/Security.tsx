import { useState, useEffect } from 'react';
import { settingsApi } from '../../services/api';
import type { SiteSettingsUpdate } from '../../types';
import './Admin.css';

export function AdminSecurity() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState<Pick<SiteSettingsUpdate, 'gate_code' | 'key_safe_code' | 'security_info' | 'what3words'>>({
    gate_code: '',
    key_safe_code: '',
    security_info: '',
    what3words: '',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.get();
      setFormData({
        gate_code: data.gate_code || '',
        key_safe_code: data.key_safe_code || '',
        security_info: data.security_info || '',
        what3words: data.what3words || '',
      });
    } catch {
      setError('Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      await settingsApi.update(formData);
      setSuccess('Security settings saved successfully');
    } catch {
      setError('Failed to save security settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="admin-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleSubmit} className="admin-form">
        <div className="form-section">
          <h3>Access Codes</h3>
          <p className="section-description">
            These codes are only visible to livery clients in their account area.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gate_code">Gate Padlock Code</label>
              <input
                id="gate_code"
                type="text"
                value={formData.gate_code || ''}
                onChange={(e) => setFormData({ ...formData, gate_code: e.target.value })}
                placeholder="e.g., 1234"
              />
            </div>
            <div className="form-group">
              <label htmlFor="key_safe_code">Key Safe Code</label>
              <input
                id="key_safe_code"
                type="text"
                value={formData.key_safe_code || ''}
                onChange={(e) => setFormData({ ...formData, key_safe_code: e.target.value })}
                placeholder="e.g., 5678"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Location</h3>

          <div className="form-group">
            <label htmlFor="what3words">What3Words</label>
            <input
              id="what3words"
              type="text"
              value={formData.what3words || ''}
              onChange={(e) => setFormData({ ...formData, what3words: e.target.value })}
              placeholder="e.g., filled.count.soap"
            />
            <small>
              Find yours at{' '}
              <a href="https://what3words.com" target="_blank" rel="noopener noreferrer">
                what3words.com
              </a>
            </small>
          </div>
        </div>

        <div className="form-section">
          <h3>Security Information</h3>
          <p className="section-description">
            Include any important information livery clients need to know about accessing the yard.
          </p>

          <div className="form-group">
            <label htmlFor="security_info">Instructions & Procedures</label>
            <textarea
              id="security_info"
              value={formData.security_info || ''}
              onChange={(e) => setFormData({ ...formData, security_info: e.target.value })}
              placeholder="Entry instructions, emergency contacts, procedures, etc."
              rows={8}
            />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Security Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
