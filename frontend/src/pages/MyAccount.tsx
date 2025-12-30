import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { accountApi } from '../services/api';
import { AccountSummary, LedgerEntry, TransactionType, PaymentMethod } from '../types';
import '../styles/MyAccount.css';

const transactionTypeLabels: Record<TransactionType, string> = {
  package_charge: 'Livery Package',
  service_charge: 'Service Charge',
  payment: 'Payment',
  credit: 'Credit/Refund',
  adjustment: 'Adjustment',
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  cheque: 'Cheque',
  direct_debit: 'Direct Debit',
  other: 'Other',
};

export default function MyAccount() {
  const [searchParams] = useSearchParams();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [allTransactions, setAllTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [filterType, setFilterType] = useState<TransactionType | ''>('');
  const [loadingMore, setLoadingMore] = useState(false);

  // Statement download state
  const [showStatementSection, setShowStatementSection] = useState(false);
  const [statementFromDate, setStatementFromDate] = useState('');
  const [statementToDate, setStatementToDate] = useState('');
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  // Payment state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  useEffect(() => {
    loadAccount();

    // Check for payment status in URL
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      setSuccessMessage('Payment successful! Your balance will be updated shortly.');
    } else if (paymentStatus === 'cancelled') {
      setError('Payment was cancelled.');
    }
  }, [searchParams]);

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

  const handleDownloadStatement = async () => {
    if (!statementFromDate || !statementToDate) return;

    try {
      setDownloadingStatement(true);
      setError('');
      await accountApi.downloadMyStatement(statementFromDate, statementToDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download statement');
      console.error(err);
    } finally {
      setDownloadingStatement(false);
    }
  };

  const handleMakePayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid payment amount');
      return;
    }

    try {
      setProcessingPayment(true);
      setError('');
      const result = await accountApi.createPaymentCheckout(amount);
      // Redirect to Stripe checkout
      window.location.href = result.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment process');
      console.error(err);
      setProcessingPayment(false);
    }
  };

  // Set default payment amount when balance loads
  useEffect(() => {
    if (summary && summary.balance?.balance != null && !paymentAmount) {
      const balance = Number(summary.balance.balance);
      if (balance > 0) {
        setPaymentAmount(balance.toFixed(2));
      }
    }
  }, [summary, paymentAmount]);

  const getBalanceClass = () => {
    if (!summary?.balance?.balance) return 'balance-zero';
    const balance = Number(summary.balance.balance);
    if (balance > 0) return 'balance-owing';
    if (balance < 0) return 'balance-credit';
    return 'balance-zero';
  };

  const setStatementPreset = (preset: 'lastMonth' | 'last3Months' | 'yearToDate') => {
    const today = new Date();

    switch (preset) {
      case 'lastMonth': {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        setStatementFromDate(lastMonth.toISOString().split('T')[0]);
        setStatementToDate(lastMonthEnd.toISOString().split('T')[0]);
        break;
      }
      case 'last3Months': {
        const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
        setStatementFromDate(threeMonthsAgo.toISOString().split('T')[0]);
        setStatementToDate(today.toISOString().split('T')[0]);
        break;
      }
      case 'yearToDate': {
        const yearStart = new Date(today.getFullYear(), 0, 1);
        setStatementFromDate(yearStart.toISOString().split('T')[0]);
        setStatementToDate(today.toISOString().split('T')[0]);
        break;
      }
    }
  };

  const displayedTransactions = showAllTransactions
    ? allTransactions
    : summary?.recent_transactions || [];

  if (loading) {
    return <div className="my-account-page"><div className="ds-loading">Loading account...</div></div>;
  }

  if (error && !summary) {
    return <div className="my-account-page"><div className="ds-alert ds-alert-error">{error}</div></div>;
  }

  return (
    <div className="my-account-page">
      <h1>My Account</h1>

      {successMessage && <div className="ds-alert ds-alert-success">{successMessage}</div>}
      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {summary && (
        <>
          {/* Balance Card */}
          <div className={`balance-card ${getBalanceClass()}`}>
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

            {summary.balance.balance > 0 && (
              <div className="payment-section">
                <div className="payment-form">
                  <div className="payment-amount-field">
                    <label htmlFor="payment-amount">Payment Amount (£)</label>
                    <input
                      id="payment-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <button
                    className="make-payment-btn"
                    onClick={handleMakePayment}
                    disabled={processingPayment || !paymentAmount}
                  >
                    {processingPayment ? 'Processing...' : 'Make Payment'}
                  </button>
                </div>
                <p className="stripe-notice">Secure payment powered by Stripe</p>
              </div>
            )}
          </div>

          {/* Statement Download Section */}
          <div className="statement-section">
            <button
              className="statement-toggle-btn"
              onClick={() => setShowStatementSection(!showStatementSection)}
            >
              {showStatementSection ? 'Hide Statement Download' : 'Download Account Statement'}
            </button>

            {showStatementSection && (
              <div className="statement-form">
                <p className="statement-description">
                  Download a PDF statement of your account activity for a selected period.
                </p>

                <div className="statement-presets">
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => setStatementPreset('lastMonth')}
                  >
                    Last Month
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => setStatementPreset('last3Months')}
                  >
                    Last 3 Months
                  </button>
                  <button
                    type="button"
                    className="preset-btn"
                    onClick={() => setStatementPreset('yearToDate')}
                  >
                    Year to Date
                  </button>
                </div>

                <div className="statement-dates">
                  <div className="date-field">
                    <label>From Date</label>
                    <input
                      type="date"
                      value={statementFromDate}
                      onChange={(e) => setStatementFromDate(e.target.value)}
                    />
                  </div>
                  <div className="date-field">
                    <label>To Date</label>
                    <input
                      type="date"
                      value={statementToDate}
                      onChange={(e) => setStatementToDate(e.target.value)}
                    />
                  </div>
                </div>

                <button
                  className="download-statement-btn"
                  onClick={handleDownloadStatement}
                  disabled={downloadingStatement || !statementFromDate || !statementToDate}
                >
                  {downloadingStatement ? 'Downloading...' : 'Download PDF Statement'}
                </button>
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
                {displayedTransactions
                  .filter(entry => !entry.voided)
                  .map((entry) => (
                  <div key={entry.id} className="transaction-item">
                    <div className="transaction-details">
                      <div className="transaction-description">
                        {entry.description}
                        {entry.receipt_number && (
                          <span className="receipt-badge">#{entry.receipt_number}</span>
                        )}
                      </div>
                      <div className="transaction-meta">
                        <span className="transaction-type">
                          {transactionTypeLabels[entry.transaction_type]}
                        </span>
                        {entry.payment_method && (
                          <span className="payment-method">
                            {paymentMethodLabels[entry.payment_method]}
                          </span>
                        )}
                        <span className="transaction-date">{formatDate(entry.transaction_date)}</span>
                      </div>
                      {entry.payment_reference && (
                        <div className="payment-reference">Ref: {entry.payment_reference}</div>
                      )}
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
