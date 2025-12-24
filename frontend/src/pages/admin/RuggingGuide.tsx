import { useState, useEffect } from 'react';
import { settingsApi } from '../../services/api';
import type { RuggingGuide } from '../../types';
import './Admin.css';

const DEFAULT_RUGGING_GUIDE: RuggingGuide = {
  '15+': { unclipped: 'None', partial: '0g', fully_clipped: '50g' },
  '10-15': { unclipped: 'None', partial: '50g', fully_clipped: '100-200g' },
  '5-10': { unclipped: '0-50g', partial: '100-200g', fully_clipped: '300g' },
  '0-5': { unclipped: '50-100g', partial: '300g', fully_clipped: '300g + neck' },
  '-5-0': { unclipped: '200g', partial: '300g + neck', fully_clipped: '400g + neck' },
  'below-5': { unclipped: '300g', partial: '400g + neck', fully_clipped: '400g + neck + liner' },
};

const TEMP_RANGES = ['15+', '10-15', '5-10', '0-5', '-5-0', 'below-5'] as const;
const TEMP_RANGE_LABELS: Record<string, string> = {
  '15+': '15°C+',
  '10-15': '10-15°C',
  '5-10': '5-10°C',
  '0-5': '0-5°C',
  '-5-0': '-5 to 0°C',
  'below-5': 'Below -5°C',
};

export function AdminRuggingGuide() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ruggingGuide, setRuggingGuide] = useState<RuggingGuide>(DEFAULT_RUGGING_GUIDE);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingsApi.get();
      setRuggingGuide(data.rugging_guide || DEFAULT_RUGGING_GUIDE);
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
      await settingsApi.update({ rugging_guide: ruggingGuide });
      setSuccess('Rugging guide saved successfully');
    } catch {
      setError('Failed to save rugging guide');
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
          <p className="section-description">
            Customize the rug weight suggestions shown on the homepage weather widget.
            Based on{' '}
            <a href="https://www.bhs.org.uk/horse-care-and-welfare/health-care-management/seasonal-care/rugging/" target="_blank" rel="noopener noreferrer">
              BHS rugging guidance
            </a>.
          </p>

          <table className="rugging-guide-table">
            <thead>
              <tr>
                <th>Temperature</th>
                <th>Unclipped</th>
                <th>Partial Clip</th>
                <th>Fully Clipped</th>
              </tr>
            </thead>
            <tbody>
              {TEMP_RANGES.map((range) => (
                <tr key={range}>
                  <td className="temp-label">{TEMP_RANGE_LABELS[range]}</td>
                  <td>
                    <input
                      type="text"
                      value={ruggingGuide?.[range]?.unclipped || ''}
                      onChange={(e) => {
                        const newGuide = { ...ruggingGuide } as RuggingGuide;
                        newGuide[range] = { ...newGuide[range], unclipped: e.target.value };
                        setRuggingGuide(newGuide);
                      }}
                      placeholder="e.g., None, 0g, 50g"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={ruggingGuide?.[range]?.partial || ''}
                      onChange={(e) => {
                        const newGuide = { ...ruggingGuide } as RuggingGuide;
                        newGuide[range] = { ...newGuide[range], partial: e.target.value };
                        setRuggingGuide(newGuide);
                      }}
                      placeholder="e.g., 100g, 200g"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={ruggingGuide?.[range]?.fully_clipped || ''}
                      onChange={(e) => {
                        const newGuide = { ...ruggingGuide } as RuggingGuide;
                        newGuide[range] = { ...newGuide[range], fully_clipped: e.target.value };
                        setRuggingGuide(newGuide);
                      }}
                      placeholder="e.g., 300g, 400g + neck"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button
            type="button"
            className="btn-secondary"
            onClick={() => setRuggingGuide(DEFAULT_RUGGING_GUIDE)}
            style={{ marginTop: '1rem' }}
          >
            Reset to Defaults
          </button>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Rugging Guide'}
          </button>
        </div>
      </form>
    </div>
  );
}
