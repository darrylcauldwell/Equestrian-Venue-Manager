import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { payslipApi } from '../services/api';
import type { PayslipRecord } from '../types';
import './MyPayslips.css';

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MyPayslips() {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState<PayslipRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadPayslips = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const data = await payslipApi.listMine();
      setPayslips(data.payslips);
    } catch {
      setError('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadPayslips();
  }, [loadPayslips]);

  const handleDownload = async (payslip: PayslipRecord) => {
    await payslipApi.download(payslip.id, payslip.original_filename || undefined);
  };

  // Available years from payslip data
  const years = [...new Set(payslips.map((p) => p.year))].sort((a, b) => b - a);

  // Filter by selected year
  const yearPayslips = payslips.filter((p) => p.year === selectedYear);
  const annualSummaries = yearPayslips.filter((p) => p.document_type === 'annual_summary');
  const monthlyPayslips = yearPayslips
    .filter((p) => p.document_type === 'payslip')
    .sort((a, b) => b.month - a.month);

  if (loading) {
    return (
      <div className="my-payslips-page">
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading payslips...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-payslips-page">
      <div className="page-header">
        <h1>My Payslips</h1>
        <p className="page-subtitle">View and download your payslip documents</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {payslips.length === 0 ? (
        <div className="ds-card">
          <div className="ds-card-body">
            <p className="empty-message">No payslips available yet. Your payslips will appear here once uploaded by the administrator.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="year-selector">
            <label>Year:</label>
            <select
              className="ds-input"
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {annualSummaries.length > 0 && (
            <div className="payslip-section">
              <h2>Annual Summary</h2>
              {annualSummaries.map((p) => (
                <div key={p.id} className="ds-card payslip-card">
                  <div className="ds-card-body payslip-card-body">
                    <div className="payslip-info">
                      <div className="payslip-title">Annual Summary (P60) - {p.year}</div>
                      <div className="payslip-meta">
                        Uploaded: {new Date(p.created_at).toLocaleDateString('en-GB')}
                        {p.notes && <span> &middot; {p.notes}</span>}
                      </div>
                    </div>
                    <button className="ds-btn ds-btn-primary" onClick={() => handleDownload(p)}>
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="payslip-section">
            <h2>Monthly Payslips</h2>
            {monthlyPayslips.length > 0 ? (
              monthlyPayslips.map((p) => (
                <div key={p.id} className="ds-card payslip-card">
                  <div className="ds-card-body payslip-card-body">
                    <div className="payslip-info">
                      <div className="payslip-title">{monthNames[p.month - 1]} {p.year}</div>
                      <div className="payslip-meta">
                        Uploaded: {new Date(p.created_at).toLocaleDateString('en-GB')}
                        {p.notes && <span> &middot; {p.notes}</span>}
                      </div>
                    </div>
                    <button className="ds-btn ds-btn-primary" onClick={() => handleDownload(p)}>
                      Download
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="no-payslips">No monthly payslips for {selectedYear}.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
