import { useState, useEffect } from 'react';
import { healthRecordsApi } from '../../services/api';
import { useRequestState } from '../../hooks';
import type {
  HorseWormCountStatus,
  BulkWormCountEntry,
  WormingReportResponse,
  WormingYearSummary,
} from '../../types';
import './Admin.css';

// EPG category labels and colors
const CATEGORY_INFO: Record<string, { label: string; color: string; description: string }> = {
  low: { label: 'Low', color: '#22c55e', description: '0-200 EPG - No treatment needed' },
  moderate: { label: 'Moderate', color: '#f59e0b', description: '201-500 EPG - Monitor closely' },
  high: { label: 'High', color: '#ef4444', description: '501-1000 EPG - Treatment recommended' },
  very_high: { label: 'Very High', color: '#991b1b', description: '>1000 EPG - Urgent treatment' },
};

export function AdminWorming() {
  const [activeTab, setActiveTab] = useState<'entry' | 'reports'>('entry');
  const [horses, setHorses] = useState<HorseWormCountStatus[]>([]);
  const [report, setReport] = useState<WormingReportResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Request state
  const { loading, error, success, setError, setSuccess, setLoading } = useRequestState(true);

  // Bulk entry form state
  const [countDate, setCountDate] = useState(new Date().toISOString().split('T')[0]);
  const [entries, setEntries] = useState<Record<number, { epg: string; cost: string; notes: string }>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [horsesData, reportData] = await Promise.all([
        healthRecordsApi.getWormingHorses(),
        healthRecordsApi.getWormingReport(3),
      ]);
      setHorses(horsesData);
      setReport(reportData);

      // Initialize entries for each horse
      const initialEntries: Record<number, { epg: string; cost: string; notes: string }> = {};
      horsesData.forEach(h => {
        initialEntries[h.horse_id] = { epg: '', cost: '', notes: '' };
      });
      setEntries(initialEntries);
    } catch {
      setError('Failed to load worming data');
    } finally {
      setLoading(false);
    }
  };

  const handleEntryChange = (horseId: number, field: 'epg' | 'cost' | 'notes', value: string) => {
    setEntries(prev => ({
      ...prev,
      [horseId]: { ...prev[horseId], [field]: value },
    }));
  };

  const handleBulkSubmit = async () => {
    setSubmitting(true);
    setError('');

    const bulkEntries: BulkWormCountEntry[] = [];
    Object.entries(entries).forEach(([horseId, data]) => {
      if (data.epg) {
        bulkEntries.push({
          horse_id: parseInt(horseId),
          worm_count_result: parseInt(data.epg),
          cost: data.cost ? parseFloat(data.cost) : undefined,
          notes: data.notes || undefined,
        });
      }
    });

    if (bulkEntries.length === 0) {
      setError('Please enter at least one worm count result');
      setSubmitting(false);
      return;
    }

    try {
      const result = await healthRecordsApi.bulkCreateWormCounts({
        worm_count_date: countDate,
        entries: bulkEntries,
      });
      setSuccess(`Successfully saved ${result.created} new records, updated ${result.updated} existing records`);

      // Reset form and reload data
      const resetEntries: Record<number, { epg: string; cost: string; notes: string }> = {};
      horses.forEach(h => {
        resetEntries[h.horse_id] = { epg: '', cost: '', notes: '' };
      });
      setEntries(resetEntries);
      await loadData();
    } catch {
      setError('Failed to save worm counts');
    } finally {
      setSubmitting(false);
    }
  };

  const getEpgCategory = (epg: number | undefined): string => {
    if (epg === undefined) return 'not_tested';
    if (epg <= 200) return 'low';
    if (epg <= 500) return 'moderate';
    if (epg <= 1000) return 'high';
    return 'very_high';
  };

  const renderCategoryBadge = (epg: number | undefined) => {
    if (epg === undefined) return <span className="badge badge-secondary">Not tested</span>;
    const cat = getEpgCategory(epg);
    const info = CATEGORY_INFO[cat];
    return (
      <span className="badge" style={{ backgroundColor: info.color, color: 'white' }}>
        {epg} EPG ({info.label})
      </span>
    );
  };

  const renderYearSummary = (summary: WormingYearSummary) => {
    if (summary.total_counts === 0) {
      return <p className="text-muted">No worm counts recorded for {summary.year}</p>;
    }

    return (
      <div className="year-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-value">{summary.total_counts}</span>
            <span className="stat-label">Total Counts</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{summary.horses_tested}</span>
            <span className="stat-label">Horses Tested</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{summary.average_epg?.toFixed(0) || '-'}</span>
            <span className="stat-label">Average EPG</span>
          </div>
        </div>

        <div className="category-breakdown">
          {summary.categories.map(cat => {
            const info = CATEGORY_INFO[cat.category];
            if (!info) return null;
            return (
              <div key={cat.category} className="category-bar-row">
                <span className="category-label">{info.label}</span>
                <div className="category-bar-container">
                  <div
                    className="category-bar"
                    style={{
                      width: `${cat.percentage}%`,
                      backgroundColor: info.color,
                    }}
                  />
                </div>
                <span className="category-count">{cat.count} ({cat.percentage}%)</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div className="ds-loading">Loading worming data...</div>;
  }

  return (
    <div className="admin-page admin-worming">
      <header className="page-header">
        <h1>Worm Count Management</h1>
        <p>Enter bulk worm count results and view yard-wide statistics</p>
      </header>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="ds-alert ds-alert-success">{success}</div>}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'entry' ? 'active' : ''}`}
          onClick={() => setActiveTab('entry')}
        >
          Bulk Entry
        </button>
        <button
          className={`tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports & Trends
        </button>
      </div>

      {activeTab === 'entry' && (
        <div className="bulk-entry-section">
          <div className="form-section">
            <h2>Enter Worm Count Results</h2>
            <p className="text-muted">
              Enter EPG (eggs per gram) results for each horse. Leave blank for horses not tested.
            </p>

            <div className="ds-form-group" style={{ maxWidth: '200px', marginBottom: '1.5rem' }}>
              <label htmlFor="count-date">Test Date</label>
              <input
                id="count-date"
                type="date"
                value={countDate}
                onChange={(e) => setCountDate(e.target.value)}
              />
            </div>

            <div className="epg-legend">
              {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                <div key={key} className="legend-item">
                  <span className="legend-color" style={{ backgroundColor: info.color }} />
                  <span className="legend-text">{info.description}</span>
                </div>
              ))}
            </div>

            <div className="bulk-entry-table">
              <table>
                <thead>
                  <tr>
                    <th>Horse</th>
                    <th>Owner</th>
                    <th>Last Count</th>
                    <th>EPG Result</th>
                    <th>Cost (£)</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {horses.map(horse => (
                    <tr key={horse.horse_id}>
                      <td>
                        <strong>{horse.horse_name}</strong>
                        {horse.stable_name && <small className="stable-name"> ({horse.stable_name})</small>}
                      </td>
                      <td>{horse.owner_name}</td>
                      <td>
                        {horse.last_count_date ? (
                          <>
                            {renderCategoryBadge(horse.last_count_result)}
                            <small className="date-text">
                              {new Date(horse.last_count_date).toLocaleDateString()}
                            </small>
                          </>
                        ) : (
                          <span className="text-muted">Never tested</span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          placeholder="EPG"
                          value={entries[horse.horse_id]?.epg || ''}
                          onChange={(e) => handleEntryChange(horse.horse_id, 'epg', e.target.value)}
                          className="epg-input"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={entries[horse.horse_id]?.cost || ''}
                          onChange={(e) => handleEntryChange(horse.horse_id, 'cost', e.target.value)}
                          className="cost-input"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          placeholder="Notes"
                          value={entries[horse.horse_id]?.notes || ''}
                          onChange={(e) => handleEntryChange(horse.horse_id, 'notes', e.target.value)}
                          className="notes-input"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="form-actions">
              <button
                className="ds-btn ds-btn-primary"
                onClick={handleBulkSubmit}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save All Results'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reports' && report && (
        <div className="reports-section">
          {/* Current Year Summary */}
          <div className="report-card">
            <h2>{report.current_year.year} Summary</h2>
            {renderYearSummary(report.current_year)}
          </div>

          {/* Trends Chart */}
          {report.trends.length > 0 && (
            <div className="report-card">
              <h2>Half-Yearly Trends</h2>
              <div className="trends-chart">
                <div className="chart-container">
                  {report.trends.map((point, idx) => {
                    const maxEpg = Math.max(...report.trends.map(t => t.average_epg || 0), 500);
                    const height = point.average_epg ? (point.average_epg / maxEpg) * 100 : 0;
                    return (
                      <div key={idx} className="chart-bar-group">
                        <div className="chart-bar-wrapper">
                          <div
                            className="chart-bar"
                            style={{
                              height: `${height}%`,
                              backgroundColor: point.average_epg && point.average_epg > 500 ? '#ef4444' :
                                point.average_epg && point.average_epg > 200 ? '#f59e0b' : '#22c55e',
                            }}
                          >
                            <span className="bar-value">{point.average_epg?.toFixed(0) || '-'}</span>
                          </div>
                        </div>
                        <span className="chart-label">{point.period}</span>
                        <span className="chart-count">{point.count} tests</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="trends-table">
                <table>
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Tests</th>
                      <th>Avg EPG</th>
                      <th>Low</th>
                      <th>Moderate</th>
                      <th>High</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.trends.map((point, idx) => (
                      <tr key={idx}>
                        <td>{point.period}</td>
                        <td>{point.count}</td>
                        <td>{point.average_epg?.toFixed(0) || '-'}</td>
                        <td style={{ color: '#22c55e' }}>{point.low_count}</td>
                        <td style={{ color: '#f59e0b' }}>{point.moderate_count}</td>
                        <td style={{ color: '#ef4444' }}>{point.high_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Previous Years */}
          {report.previous_years.length > 0 && (
            <div className="report-card">
              <h2>Previous Years</h2>
              <div className="previous-years-grid">
                {report.previous_years.map(year => (
                  <div key={year.year} className="year-card">
                    <h3>{year.year}</h3>
                    {renderYearSummary(year)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Horses Needing Treatment */}
          {report.horses_needing_treatment.length > 0 && (
            <div className="report-card alert-card">
              <h2>Horses Needing Treatment</h2>
              <p className="text-muted">
                These horses have high worm counts ({'>'}500 EPG) and may need treatment.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Horse</th>
                    <th>Owner</th>
                    <th>Last Count</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {report.horses_needing_treatment.map(horse => (
                    <tr key={horse.horse_id}>
                      <td><strong>{horse.horse_name}</strong></td>
                      <td>{horse.owner_name}</td>
                      <td>{horse.last_count_date ? new Date(horse.last_count_date).toLocaleDateString() : '-'}</td>
                      <td>{renderCategoryBadge(horse.last_count_result)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminWorming;
