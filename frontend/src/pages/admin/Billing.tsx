import { useState, useEffect } from 'react';
import { accountApi, liveryPackagesApi, billingApi } from '../../services/api';
import {
  UserAccountSummary,
  AccountSummary,
  LedgerEntry,
  CreateLedgerEntry,
  TransactionType,
  LiveryPackage,
  MonthOption,
  BillingRunResponse,
} from '../../types';
import '../../styles/AdminBilling.css';

type BillingTab = 'transactions' | 'monthly';

const transactionTypeLabels: Record<TransactionType, string> = {
  package_charge: 'Livery Package',
  service_charge: 'Service Charge',
  payment: 'Payment Received',
  credit: 'Credit/Refund',
  adjustment: 'Adjustment',
};

const transactionTypeIcons: Record<TransactionType, string> = {
  package_charge: '📦',
  service_charge: '🔧',
  payment: '💳',
  credit: '💰',
  adjustment: '📝',
};

interface TransactionForm {
  user_id: number;
  transaction_type: TransactionType;
  amount: string;
  description: string;
  notes: string;
  livery_package_id: number | null;
  period_start: string;
  period_end: string;
}

const emptyForm: TransactionForm = {
  user_id: 0,
  transaction_type: 'service_charge',
  amount: '',
  description: '',
  notes: '',
  livery_package_id: null,
  period_start: '',
  period_end: '',
};

export default function Billing() {
  // Tab state
  const [activeTab, setActiveTab] = useState<BillingTab>('transactions');

  // Transaction tab state
  const [accounts, setAccounts] = useState<UserAccountSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const [allTransactions, setAllTransactions] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<TransactionForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [packages, setPackages] = useState<LiveryPackage[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  // Monthly billing state
  const [billingMonths, setBillingMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<MonthOption | null>(null);
  const [billingPreview, setBillingPreview] = useState<BillingRunResponse | null>(null);
  const [billingResult, setBillingResult] = useState<BillingRunResponse | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [runningBilling, setRunningBilling] = useState(false);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);

  useEffect(() => {
    loadAccounts();
    loadReferenceData();
    loadBillingMonths();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await accountApi.listUserAccounts();
      setAccounts(data);
      setError('');
    } catch (err) {
      setError('Failed to load accounts');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadReferenceData = async () => {
    try {
      const pkgs = await liveryPackagesApi.list();
      setPackages(pkgs);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  };

  const loadBillingMonths = async () => {
    try {
      const months = await billingApi.getMonths();
      setBillingMonths(months);
      // Default to current month
      const current = months.find(m => m.is_current);
      if (current) {
        setSelectedMonth(current);
      }
    } catch (err) {
      console.error('Failed to load billing months:', err);
    }
  };

  const handlePreviewBilling = async () => {
    if (!selectedMonth) return;

    try {
      setLoadingBilling(true);
      setBillingPreview(null);
      setBillingResult(null);
      setError('');
      const preview = await billingApi.preview(selectedMonth.year, selectedMonth.month);
      setBillingPreview(preview);
    } catch (err) {
      setError('Failed to preview billing');
      console.error(err);
    } finally {
      setLoadingBilling(false);
    }
  };

  const handleRunBilling = async () => {
    if (!selectedMonth) return;

    try {
      setRunningBilling(true);
      setError('');
      const result = await billingApi.run(selectedMonth.year, selectedMonth.month);
      setBillingResult(result);
      setBillingPreview(null);
      setShowBillingConfirm(false);
      // Refresh accounts to show updated balances
      await loadAccounts();
    } catch (err) {
      setError('Failed to run billing');
      console.error(err);
    } finally {
      setRunningBilling(false);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      setSelectedMonth(null);
      return;
    }
    const [year, month] = value.split('-').map(Number);
    const selected = billingMonths.find(m => m.year === year && m.month === month);
    setSelectedMonth(selected || null);
    setBillingPreview(null);
    setBillingResult(null);
  };

  const loadUserAccount = async (userId: number) => {
    try {
      setLoadingAccount(true);
      setSelectedUserId(userId);
      const [accountData, transactionsData] = await Promise.all([
        accountApi.getUserAccount(userId),
        accountApi.getUserTransactions(userId, undefined, undefined, undefined, 200),
      ]);
      setSelectedAccount(accountData);
      setAllTransactions(transactionsData);
    } catch (err) {
      setError('Failed to load user account');
      console.error(err);
    } finally {
      setLoadingAccount(false);
    }
  };

  const handleAddTransaction = (userId: number) => {
    setForm({ ...emptyForm, user_id: userId });
    setShowAddModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || !form.description.trim()) return;

    try {
      setSubmitting(true);
      const amount = parseFloat(form.amount);

      // Payments and credits should be negative (reduce balance)
      const adjustedAmount = ['payment', 'credit'].includes(form.transaction_type)
        ? -Math.abs(amount)
        : Math.abs(amount);

      const data: CreateLedgerEntry = {
        user_id: form.user_id,
        transaction_type: form.transaction_type,
        amount: adjustedAmount,
        description: form.description.trim(),
        notes: form.notes.trim() || undefined,
        livery_package_id: form.livery_package_id || undefined,
        period_start: form.period_start || undefined,
        period_end: form.period_end || undefined,
      };

      await accountApi.createTransaction(data);
      setShowAddModal(false);
      setForm(emptyForm);

      // Refresh data
      await loadAccounts();
      if (selectedUserId === form.user_id) {
        await loadUserAccount(form.user_id);
      }
    } catch (err) {
      setError('Failed to create transaction');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entryId: number) => {
    try {
      await accountApi.deleteTransaction(entryId);
      setShowDeleteConfirm(null);

      // Refresh data
      await loadAccounts();
      if (selectedUserId) {
        await loadUserAccount(selectedUserId);
      }
    } catch (err) {
      setError('Failed to delete transaction');
      console.error(err);
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

  const getAmountClass = (amount: number) => {
    if (amount > 0) return 'amount-charge';
    if (amount < 0) return 'amount-payment';
    return '';
  };

  const getBalanceClass = (balance: number) => {
    if (balance > 0) return 'balance-owed';
    if (balance < 0) return 'balance-credit';
    return 'balance-zero';
  };

  if (loading) {
    return <div className="admin-billing-page"><div className="loading">Loading accounts...</div></div>;
  }

  // Monthly billing preview/result display
  const renderBillingResult = (data: BillingRunResponse, isPreview: boolean) => (
    <div className="billing-result">
      <div className="billing-result-header">
        <h3>{isPreview ? 'Preview:' : 'Completed:'} {data.billing_month_display}</h3>
        <div className="billing-summary-stats">
          <span className="stat">{data.total_owners} owner{data.total_owners !== 1 ? 's' : ''}</span>
          <span className="stat">{data.total_horses} horse{data.total_horses !== 1 ? 's' : ''}</span>
          <span className="stat total">{formatCurrency(data.total_amount)}</span>
        </div>
      </div>

      {data.owner_summaries.length === 0 ? (
        <div className="no-billing-items">
          <p>No billable horses found for this period.</p>
          <p className="hint">Horses must have a livery package with a monthly price assigned.</p>
        </div>
      ) : (
        <div className="owner-summaries">
          {data.owner_summaries.map((owner) => (
            <div key={owner.owner_id} className="owner-billing-card">
              <div className="owner-header">
                <div className="owner-info">
                  <span className="owner-name">{owner.owner_name}</span>
                  <span className="owner-email">{owner.owner_email}</span>
                </div>
                <span className="owner-total">{formatCurrency(owner.total_amount)}</span>
              </div>
              <div className="horse-charges">
                {owner.horses.map((horse) => (
                  <div key={horse.horse_id} className="horse-charge-item">
                    <div className="horse-charge-info">
                      <span className="horse-name">{horse.horse_name}</span>
                      <span className="package-name">{horse.package_name}</span>
                      {horse.is_partial && (
                        <span className="partial-tag">
                          {horse.billable_days}/{horse.days_in_month} days
                        </span>
                      )}
                      <span className="charge-notes">{horse.notes}</span>
                    </div>
                    <span className="horse-charge-amount">{formatCurrency(horse.charge_amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isPreview && data.owner_summaries.length > 0 && (
        <div className="billing-actions">
          <button
            className="run-billing-btn"
            onClick={() => setShowBillingConfirm(true)}
            disabled={runningBilling}
          >
            {runningBilling ? 'Running...' : `Run Billing (${formatCurrency(data.total_amount)})`}
          </button>
        </div>
      )}

      {!isPreview && data.ledger_entries_created > 0 && (
        <div className="billing-success">
          Created {data.ledger_entries_created} ledger {data.ledger_entries_created === 1 ? 'entry' : 'entries'}.
          Accounts have been updated.
        </div>
      )}
    </div>
  );

  return (
    <div className="admin-billing-page">
      <div className="page-header">
        <h1>Billing & Transactions</h1>
      </div>

      {/* Tabs */}
      <div className="billing-tabs">
        <button
          className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          Account Transactions
        </button>
        <button
          className={`tab-btn ${activeTab === 'monthly' ? 'active' : ''}`}
          onClick={() => setActiveTab('monthly')}
        >
          Monthly Billing
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Monthly Billing Tab */}
      {activeTab === 'monthly' && (
        <div className="monthly-billing-section">
          <div className="billing-controls">
            <div className="month-selector">
              <label>Billing Month:</label>
              <select
                value={selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : ''}
                onChange={handleMonthChange}
              >
                <option value="">Select month...</option>
                {billingMonths.map((m) => (
                  <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>
                    {m.display}
                    {m.is_current ? ' (Current)' : ''}
                    {m.is_future ? ' (Future)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="preview-btn"
              onClick={handlePreviewBilling}
              disabled={!selectedMonth || loadingBilling}
            >
              {loadingBilling ? 'Loading...' : 'Preview Billing'}
            </button>
          </div>

          <div className="billing-info">
            <p>
              Monthly billing calculates livery package charges for all horses.
              Pro-rata billing is applied for horses that arrived or departed during the month.
            </p>
            <p className="auto-note">
              Automated billing runs on the 1st of each month at 6:00 AM for the previous month.
            </p>
          </div>

          {billingPreview && renderBillingResult(billingPreview, true)}
          {billingResult && renderBillingResult(billingResult, false)}
        </div>
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
      <div className="billing-layout">
        {/* Accounts List */}
        <div className="accounts-panel">
          <h2>Livery Accounts</h2>

          {accounts.length === 0 ? (
            <div className="no-accounts">No livery accounts found</div>
          ) : (
            <div className="accounts-list">
              {accounts.map((account) => (
                <div
                  key={account.user_id}
                  className={`account-item ${selectedUserId === account.user_id ? 'selected' : ''}`}
                  onClick={() => loadUserAccount(account.user_id)}
                >
                  <div className="account-info">
                    <span className="account-name">{account.user_name}</span>
                    <span className="account-transactions">
                      {account.transaction_count} transaction{account.transaction_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="account-actions">
                    <span className={`account-balance ${getBalanceClass(account.balance)}`}>
                      {account.balance > 0 ? '' : account.balance < 0 ? '-' : ''}
                      {formatCurrency(account.balance)}
                    </span>
                    <button
                      className="quick-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddTransaction(account.user_id);
                      }}
                      title="Add transaction"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="accounts-summary">
            <div className="summary-row">
              <span>Total Outstanding</span>
              <span className="summary-value">
                {formatCurrency(accounts.reduce((sum, a) => sum + Math.max(0, a.balance), 0))}
              </span>
            </div>
          </div>
        </div>

        {/* Account Detail */}
        <div className="detail-panel">
          {!selectedUserId ? (
            <div className="select-prompt">
              <div className="prompt-icon">👈</div>
              <h3>Select an Account</h3>
              <p>Click on a livery account from the list to view their transactions and add new entries.</p>
              <div className="quick-actions-hint">
                <p>You can add:</p>
                <ul>
                  <li><strong>Charges</strong> - Livery fees, service charges</li>
                  <li><strong>Payments</strong> - Record payments received</li>
                  <li><strong>Credits</strong> - Refunds or adjustments</li>
                </ul>
              </div>
            </div>
          ) : loadingAccount ? (
            <div className="loading">Loading account...</div>
          ) : selectedAccount ? (
            <>
              <div className="detail-header">
                <div>
                  <h2>{selectedAccount.balance.user_name}</h2>
                  <div className={`detail-balance ${getBalanceClass(selectedAccount.balance.balance)}`}>
                    Balance: {selectedAccount.balance.balance > 0 ? '' : selectedAccount.balance.balance < 0 ? '-' : ''}
                    {formatCurrency(selectedAccount.balance.balance)}
                  </div>
                </div>
                <button
                  className="add-btn"
                  onClick={() => handleAddTransaction(selectedUserId)}
                >
                  + Add Transaction
                </button>
              </div>

              <div className="detail-stats">
                <div className="stat-item">
                  <span className="stat-label">Total Charges</span>
                  <span className="stat-value charges">{formatCurrency(selectedAccount.balance.total_charges)}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Total Payments</span>
                  <span className="stat-value payments">{formatCurrency(selectedAccount.balance.total_payments)}</span>
                </div>
                {selectedAccount.pending_service_charges > 0 && (
                  <div className="stat-item pending">
                    <span className="stat-label">Pending Services</span>
                    <span className="stat-value">{selectedAccount.pending_service_charges}</span>
                  </div>
                )}
              </div>

              <h3>Transaction History</h3>
              {allTransactions.length === 0 ? (
                <div className="no-transactions">No transactions yet</div>
              ) : (
                <div className="transactions-list">
                  {allTransactions.map((entry) => (
                    <div key={entry.id} className="transaction-item">
                      <div className="transaction-icon">
                        {transactionTypeIcons[entry.transaction_type]}
                      </div>
                      <div className="transaction-details">
                        <div className="transaction-description">{entry.description}</div>
                        <div className="transaction-meta">
                          <span className="transaction-type">
                            {transactionTypeLabels[entry.transaction_type]}
                          </span>
                          <span className="transaction-date">{formatDate(entry.transaction_date)}</span>
                          {entry.created_by_name && (
                            <span className="transaction-creator">by {entry.created_by_name}</span>
                          )}
                        </div>
                        {entry.notes && (
                          <div className="transaction-notes">{entry.notes}</div>
                        )}
                      </div>
                      <div className="transaction-actions">
                        <span className={`transaction-amount ${getAmountClass(entry.amount)}`}>
                          {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                        </span>
                        <button
                          className="delete-btn"
                          onClick={() => setShowDeleteConfirm(entry.id)}
                          title="Delete transaction"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
      )}

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Transaction</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Transaction Type *</label>
                <select
                  value={form.transaction_type}
                  onChange={(e) => setForm({ ...form, transaction_type: e.target.value as TransactionType })}
                  required
                >
                  {Object.entries(transactionTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Amount (£) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
                <small className="form-hint">
                  {['payment', 'credit'].includes(form.transaction_type)
                    ? 'This will reduce the balance (shown as negative)'
                    : 'This will increase the balance (shown as positive)'}
                </small>
              </div>

              <div className="form-group">
                <label>Description *</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g., Monthly livery fee - December 2024"
                  required
                />
              </div>

              {form.transaction_type === 'package_charge' && (
                <>
                  <div className="form-group">
                    <label>Livery Package</label>
                    <select
                      value={form.livery_package_id || ''}
                      onChange={(e) => setForm({ ...form, livery_package_id: e.target.value ? parseInt(e.target.value) : null })}
                    >
                      <option value="">Select package...</option>
                      {packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>
                          {pkg.name} - {pkg.price_display}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Period Start</label>
                      <input
                        type="date"
                        value={form.period_start}
                        onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Period End</label>
                      <input
                        type="date"
                        value={form.period_end}
                        onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional additional notes..."
                  rows={2}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm !== null && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete Transaction?</h2>
            <p>Are you sure you want to delete this transaction? This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="delete-confirm-btn" onClick={() => handleDelete(showDeleteConfirm)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing Confirmation Modal */}
      {showBillingConfirm && billingPreview && (
        <div className="modal-overlay" onClick={() => setShowBillingConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Run Monthly Billing?</h2>
            <p>
              This will create {billingPreview.total_horses} ledger {billingPreview.total_horses === 1 ? 'entry' : 'entries'}{' '}
              totalling {formatCurrency(billingPreview.total_amount)} for {billingPreview.billing_month_display}.
            </p>
            <p className="warning">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowBillingConfirm(false)}>
                Cancel
              </button>
              <button
                className="submit-btn"
                onClick={handleRunBilling}
                disabled={runningBilling}
              >
                {runningBilling ? 'Running...' : 'Run Billing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
