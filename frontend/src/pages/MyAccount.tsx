import { useState, useEffect } from 'react';
import { accountApi } from '../services/api';
import { AccountSummary, LedgerEntry, TransactionType } from '../types';
import '../styles/MyAccount.css';

const transactionTypeLabels: Record<TransactionType, string> = {
  package_charge: 'Livery Package',
  service_charge: 'Service Charge',
  payment: 'Payment',
  credit: 'Credit/Refund',
  adjustment: 'Adjustment',
};

export default function MyAccount() {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [allTransactions, setAllTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    loadAccount();
  }, []);

  const loadAccount = async () => {
    try {
      setLoading(true);
      const data = await accountApi.getMyAccount();
      setSummary(data);
      setError('');
    } catch (err) {
      setError('Failed to load account information');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllTransactions = async (includeHistorical: boolean = false) => {
    try {
      setLoadingMore(true);
      const data = await accountApi.getMyTransactions(
        undefined,
        undefined,
        filterType || undefined,
        200,
        undefined,
        !includeHistorical  // sinceLastInvoice = false when showing historical
      );
      setAllTransactions(data);
      setShowAllTransactions(true);
      setShowHistorical(includeHistorical);
    } catch (err) {
      setError('Failed to load transactions');
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFilterChange = async (type: TransactionType | '') => {
    setFilterType(type);
    if (showAllTransactions) {
      try {
        setLoadingMore(true);
        const data = await accountApi.getMyTransactions(
          undefined,
          undefined,
          type || undefined,
          200,
          undefined,
          !showHistorical
        );
        setAllTransactions(data);
      } catch (err) {
        setError('Failed to filter transactions');
        console.error(err);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatAmountWithSign = (amount: number) => {
    const formatted = formatCurrency(amount);
    return amount >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  const displayedTransactions = showAllTransactions
    ? allTransactions
    : summary?.recent_transactions || [];

  if (loading) {
    return <div className="my-account-page"><div className="loading">Loading account...</div></div>;
  }

  if (error && !summary) {
    return <div className="my-account-page"><div className="error-message">{error}</div></div>;
  }

  return (
    <div className="my-account-page">
      <h1>My Account</h1>

      {error && <div className="error-message">{error}</div>}

      {summary && (
        <>
          {/* Balance Card */}
          <div className="balance-card">
            <div className="balance-header">
              <h2>Current Period Balance</h2>
              <span className="balance-amount">
                {formatCurrency(summary.balance.balance)}
              </span>
            </div>

            {summary.pending_service_charges > 0 && (
              <div className="pending-notice">
                {summary.pending_service_charges} completed service{summary.pending_service_charges > 1 ? 's' : ''} pending billing
              </div>
            )}
          </div>

          {/* Transaction History */}
          <div className="transactions-section">
            <div className="transactions-header">
              <h2>
                {showHistorical ? 'All Transaction History' : 'Current Billing Period'}
              </h2>
              {summary.current_period_start && !showHistorical && (
                <div className="billing-period-info">
                  Showing transactions since {formatDate(summary.current_period_start)}
                  {summary.last_invoice_date && (
                    <span className="last-invoice-note">
                      (Last invoice: {formatDate(summary.last_invoice_date)})
                    </span>
                  )}
                </div>
              )}
              <div className="transactions-controls">
                <select
                  value={filterType}
                  onChange={(e) => handleFilterChange(e.target.value as TransactionType | '')}
                  className="filter-select"
                >
                  <option value="">All Types</option>
                  {Object.entries(transactionTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
                {summary.last_invoice_date && (
                  <button
                    className={`toggle-historical-btn ${showHistorical ? 'active' : ''}`}
                    onClick={() => loadAllTransactions(!showHistorical)}
                    disabled={loadingMore}
                  >
                    {showHistorical ? 'Current Period Only' : 'Show All History'}
                  </button>
                )}
              </div>
            </div>

            {displayedTransactions.length === 0 ? (
              <div className="no-transactions">
                No transactions found
              </div>
            ) : (
              <div className="transactions-list">
                {displayedTransactions.map((entry) => (
                  <div key={entry.id} className="transaction-item">
                    <div className="transaction-details">
                      <div className="transaction-description">{entry.description}</div>
                      <div className="transaction-meta">
                        <span className="transaction-type">
                          {transactionTypeLabels[entry.transaction_type]}
                        </span>
                        <span className="transaction-date">{formatDate(entry.transaction_date)}</span>
                      </div>
                      {entry.service_description && (
                        <div className="transaction-service">{entry.service_description}</div>
                      )}
                      {entry.package_name && (
                        <div className="transaction-package">Package: {entry.package_name}</div>
                      )}
                      {entry.period_start && entry.period_end && (
                        <div className="transaction-period">
                          Period: {formatDate(entry.period_start)} - {formatDate(entry.period_end)}
                        </div>
                      )}
                      {entry.notes && (
                        <div className="transaction-notes">{entry.notes}</div>
                      )}
                    </div>
                    <div className="transaction-amount">
                      {formatAmountWithSign(entry.amount)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showAllTransactions && summary.recent_transactions.length >= 20 && (
              <button
                className="load-more-btn"
                onClick={() => loadAllTransactions(false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'View More'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
