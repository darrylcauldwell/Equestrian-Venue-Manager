import { useState, useEffect } from 'react';
import { accountApi } from '../../services/api';
import { AgedDebtReport, IncomeSummaryReport } from '../../types';
import '../../styles/FinancialReports.css';

type ReportTab = 'aged-debt' | 'income';

export default function FinancialReports() {
  const [activeTab, setActiveTab] = useState<ReportTab>('aged-debt');

  // Aged debt state
  const [agedDebtReport, setAgedDebtReport] = useState<AgedDebtReport | null>(null);
  const [loadingAgedDebt, setLoadingAgedDebt] = useState(false);

  // Income summary state
  const [incomeSummary, setIncomeSummary] = useState<IncomeSummaryReport | null>(null);
  const [incomeFromDate, setIncomeFromDate] = useState('');
  const [incomeToDate, setIncomeToDate] = useState('');
  const [loadingIncome, setLoadingIncome] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    // Set default date range for income: current calendar year
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    setIncomeFromDate(yearStart.toISOString().split('T')[0]);
    setIncomeToDate(today.toISOString().split('T')[0]);

    // Load aged debt by default
    loadAgedDebt();
  }, []);

  const loadAgedDebt = async () => {
    try {
      setLoadingAgedDebt(true);
      setError('');
      const data = await accountApi.getAgedDebtReport();
      setAgedDebtReport(data);
    } catch (err) {
      setError('Failed to load aged debt report');
      console.error(err);
    } finally {
      setLoadingAgedDebt(false);
    }
  };

  const loadIncomeSummary = async () => {
    if (!incomeFromDate || !incomeToDate) return;

    try {
      setLoadingIncome(true);
      setError('');
      const data = await accountApi.getIncomeSummaryReport(incomeFromDate, incomeToDate);
      setIncomeSummary(data);
    } catch (err) {
      setError('Failed to load income summary');
      console.error(err);
    } finally {
      setLoadingIncome(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const setIncomePreset = (preset: 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear') => {
    const today = new Date();

    switch (preset) {
      case 'thisMonth': {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        setIncomeFromDate(monthStart.toISOString().split('T')[0]);
        setIncomeToDate(today.toISOString().split('T')[0]);
        break;
      }
      case 'lastMonth': {
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        setIncomeFromDate(lastMonthStart.toISOString().split('T')[0]);
        setIncomeToDate(lastMonthEnd.toISOString().split('T')[0]);
        break;
      }
      case 'thisQuarter': {
        const quarter = Math.floor(today.getMonth() / 3);
        const quarterStart = new Date(today.getFullYear(), quarter * 3, 1);
        setIncomeFromDate(quarterStart.toISOString().split('T')[0]);
        setIncomeToDate(today.toISOString().split('T')[0]);
        break;
      }
      case 'thisYear': {
        const yearStart = new Date(today.getFullYear(), 0, 1);
        setIncomeFromDate(yearStart.toISOString().split('T')[0]);
        setIncomeToDate(today.toISOString().split('T')[0]);
        break;
      }
    }
  };

  return (
    <div className="financial-reports-page">
      <div className="page-header">
        <h1>Financial Reports</h1>
      </div>

      {/* Tabs */}
      <div className="report-tabs">
        <button
          className={`tab-btn ${activeTab === 'aged-debt' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('aged-debt');
            if (!agedDebtReport) loadAgedDebt();
          }}
        >
          Aged Debt
        </button>
        <button
          className={`tab-btn ${activeTab === 'income' ? 'active' : ''}`}
          onClick={() => setActiveTab('income')}
        >
          Income Summary
        </button>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Aged Debt Report */}
      {activeTab === 'aged-debt' && (
        <div className="report-section">
          <div className="report-actions">
            <button
              className="refresh-btn"
              onClick={loadAgedDebt}
              disabled={loadingAgedDebt}
            >
              {loadingAgedDebt ? 'Loading...' : 'Refresh'}
            </button>
            <button
              className="export-btn"
              onClick={() => accountApi.downloadAgedDebtCsv()}
            >
              Export CSV
            </button>
          </div>

          {loadingAgedDebt ? (
            <div className="ds-loading">Loading aged debt report...</div>
          ) : agedDebtReport ? (
            <div className="aged-debt-report">
              <div className="report-info">
                As of {formatDate(agedDebtReport.as_of_date)}
              </div>

              {agedDebtReport.accounts.length === 0 ? (
                <div className="no-data">No outstanding balances</div>
              ) : (
                <>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Account</th>
                        <th className="amount">Current</th>
                        <th className="amount">1 Month</th>
                        <th className="amount">2 Months</th>
                        <th className="amount">3+ Months</th>
                        <th className="amount">Total</th>
                        <th>Last Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agedDebtReport.accounts.map((account) => (
                        <tr key={account.user_id}>
                          <td>
                            <div className="account-name">{account.user_name}</div>
                            {account.user_email && (
                              <div className="account-email">{account.user_email}</div>
                            )}
                          </td>
                          <td className="amount">{formatCurrency(account.current)}</td>
                          <td className="amount warning">{formatCurrency(account.month_1)}</td>
                          <td className="amount danger">{formatCurrency(account.month_2)}</td>
                          <td className="amount severe">{formatCurrency(account.month_3_plus)}</td>
                          <td className="amount total">{formatCurrency(account.total)}</td>
                          <td className="date">
                            {account.last_payment_date
                              ? formatDate(account.last_payment_date)
                              : 'No payments'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td><strong>Totals</strong></td>
                        <td className="amount"><strong>{formatCurrency(agedDebtReport.totals.current)}</strong></td>
                        <td className="amount warning"><strong>{formatCurrency(agedDebtReport.totals.month_1)}</strong></td>
                        <td className="amount danger"><strong>{formatCurrency(agedDebtReport.totals.month_2)}</strong></td>
                        <td className="amount severe"><strong>{formatCurrency(agedDebtReport.totals.month_3_plus)}</strong></td>
                        <td className="amount total"><strong>{formatCurrency(agedDebtReport.totals.total)}</strong></td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>

                  <div className="report-summary-cards">
                    <div className="summary-card">
                      <span className="label">Total Outstanding</span>
                      <span className="value">{formatCurrency(agedDebtReport.totals.total)}</span>
                    </div>
                    <div className="summary-card warning">
                      <span className="label">Overdue (1+ months)</span>
                      <span className="value">
                        {formatCurrency(
                          agedDebtReport.totals.month_1 +
                          agedDebtReport.totals.month_2 +
                          agedDebtReport.totals.month_3_plus
                        )}
                      </span>
                    </div>
                    <div className="summary-card">
                      <span className="label">Accounts with Balance</span>
                      <span className="value">{agedDebtReport.accounts.length}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Income Summary Report */}
      {activeTab === 'income' && (
        <div className="report-section">
          <div className="income-controls">
            <div className="date-range">
              <div className="date-field">
                <label>From</label>
                <input
                  type="date"
                  value={incomeFromDate}
                  onChange={(e) => setIncomeFromDate(e.target.value)}
                />
              </div>
              <div className="date-field">
                <label>To</label>
                <input
                  type="date"
                  value={incomeToDate}
                  onChange={(e) => setIncomeToDate(e.target.value)}
                />
              </div>
              <button
                className="load-btn"
                onClick={loadIncomeSummary}
                disabled={loadingIncome || !incomeFromDate || !incomeToDate}
              >
                {loadingIncome ? 'Loading...' : 'Load Report'}
              </button>
            </div>

            <div className="date-presets">
              <button onClick={() => setIncomePreset('thisMonth')}>This Month</button>
              <button onClick={() => setIncomePreset('lastMonth')}>Last Month</button>
              <button onClick={() => setIncomePreset('thisQuarter')}>This Quarter</button>
              <button onClick={() => setIncomePreset('thisYear')}>This Year</button>
            </div>

            {incomeSummary && (
              <button
                className="export-btn"
                onClick={() => accountApi.downloadIncomeSummaryCsv(incomeFromDate, incomeToDate)}
              >
                Export CSV
              </button>
            )}
          </div>

          {loadingIncome ? (
            <div className="ds-loading">Loading income summary...</div>
          ) : incomeSummary ? (
            <div className="income-report">
              <div className="report-info">
                Period: {formatDate(incomeSummary.from_date)} to {formatDate(incomeSummary.to_date)}
              </div>

              {/* Summary Cards */}
              <div className="income-summary-cards">
                <div className="summary-card primary">
                  <span className="label">Total Income</span>
                  <span className="value">{formatCurrency(incomeSummary.total_income)}</span>
                </div>
                <div className="summary-card">
                  <span className="label">Charges Raised</span>
                  <span className="value">{formatCurrency(incomeSummary.total_charges)}</span>
                </div>
                <div className="summary-card success">
                  <span className="label">Payments Received</span>
                  <span className="value">{formatCurrency(Math.abs(incomeSummary.total_payments))}</span>
                </div>
              </div>

              {/* Income by Type */}
              <div className="income-by-type">
                <h3>Income by Type</h3>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="amount">Count</th>
                      <th className="amount">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeSummary.by_type.map((item) => (
                      <tr key={item.transaction_type}>
                        <td>{item.type_label}</td>
                        <td className="amount">{item.count}</td>
                        <td className="amount">{formatCurrency(item.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Monthly Breakdown */}
              {incomeSummary.by_month.length > 0 && (
                <div className="monthly-breakdown">
                  <h3>Monthly Breakdown</h3>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th className="amount">Total</th>
                        {incomeSummary.by_type.map((t) => (
                          <th key={t.transaction_type} className="amount">
                            {t.type_label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {incomeSummary.by_month.map((month) => (
                        <tr key={`${month.year}-${month.month}`}>
                          <td>{month.month_label}</td>
                          <td className="amount total">{formatCurrency(month.total)}</td>
                          {incomeSummary.by_type.map((t) => {
                            const typeData = month.by_type.find(
                              (bt) => bt.transaction_type === t.transaction_type
                            );
                            return (
                              <td key={t.transaction_type} className="amount">
                                {typeData ? formatCurrency(typeData.amount) : '-'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="no-data">
              Select a date range and click "Load Report" to view income summary.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
