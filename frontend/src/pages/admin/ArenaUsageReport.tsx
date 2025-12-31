import { useState, useEffect, useCallback } from 'react';
import { bookingsApi } from '../../services/api';
import { useRequestState } from '../../hooks';
import type { ArenaUsageReport, PeriodUsageReport } from '../../types';
import './Admin.css';

export function AdminArenaUsageReport() {
  const [report, setReport] = useState<ArenaUsageReport | null>(null);
  const [activePeriod, setActivePeriod] = useState<'month' | 'quarter' | 'year'>('month');

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);

  const loadReport = useCallback(async () => {
    try {
      const data = await bookingsApi.getUsageReport();
      setReport(data);
    } catch {
      setError('Failed to load arena usage report');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

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
      public: '#ef4444',      // Red - paid external
      livery: '#10b981',      // Green - livery (free)
      event: '#8b5cf6',       // Purple - events
      maintenance: '#6b7280', // Gray - maintenance
      training_clinic: '#3b82f6', // Blue - training clinics
    };
    return colors[type] || '#9ca3af';
  };

  if (isLoading) {
    return <div className="ds-loading">Loading report...</div>;
  }

  if (error) {
    return <div className="ds-alert ds-alert-error">{error}</div>;
  }

  const period = getActivePeriod();

  return (
    <div className="admin-page">

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

      <style>{`
        .period-selector {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .period-btn {
          padding: 0.75rem 1.5rem;
          border: 2px solid var(--border-color);
          background: var(--card-background);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
          transition: all 0.2s;
        }

        .period-btn:hover {
          border-color: var(--primary-color);
        }

        .period-btn.active {
          border-color: var(--primary-color);
          background: var(--primary-color);
          color: white;
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
          background: var(--card-background);
          border: 1px solid var(--border-color);
          border-radius: 8px;
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
          color: var(--primary-color);
        }

        .summary-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin-top: 0.25rem;
        }

        .usage-legend {
          background: var(--card-background);
          border: 1px solid var(--border-color);
          border-radius: 8px;
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
          background: var(--card-background);
          border: 1px solid var(--border-color);
          border-radius: 8px;
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
          color: var(--primary-color);
        }

        .usage-bar {
          display: flex;
          height: 24px;
          border-radius: 4px;
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
          background: var(--background-color);
          border-radius: 4px;
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
