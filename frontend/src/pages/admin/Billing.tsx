import { useState, useEffect, useCallback } from 'react';
import { accountApi, liveryPackagesApi, billingApi } from '../../services/api';
import { useRequestState, useModalForm } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../../components/ui';
import {
  UserAccountSummary,
  AccountSummary,
  LedgerEntry,
  CreateLedgerEntry,
  TransactionType,
  PaymentMethod,
  TransactionEnums,
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

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  cheque: 'Cheque',
  direct_debit: 'Direct Debit',
  other: 'Other',
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
  payment_method: PaymentMethod | '';
  payment_reference: string;
}

interface PaymentForm {
  user_id: number;
  amount: string;
  payment_method: PaymentMethod;
  payment_reference: string;
  description: string;
  notes: string;
}

interface VoidForm {
  reason: string;
}

interface EditForm {
  description: string;
  notes: string;
  payment_method: PaymentMethod | '';
  payment_reference: string;
}

interface StatementForm {
  from_date: string;
  to_date: string;
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
  payment_method: '',
  payment_reference: '',
};

const emptyPaymentForm: PaymentForm = {
  user_id: 0,
  amount: '',
  payment_method: 'bank_transfer',
  payment_reference: '',
  description: '',
  notes: '',
};

const emptyVoidForm: VoidForm = {
  reason: '',
};

const emptyEditForm: EditForm = {
  description: '',
  notes: '',
  payment_method: '',
  payment_reference: '',
};

const emptyStatementForm: StatementForm = {
  from_date: '',
  to_date: '',
};

export default function Billing() {
  // Tab state
  const [activeTab, setActiveTab] = useState<BillingTab>('transactions');

  // Transaction tab state
  const [accounts, setAccounts] = useState<UserAccountSummary[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<AccountSummary | null>(null);
  const [allTransactions, setAllTransactions] = useState<LedgerEntry[]>([]);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [packages, setPackages] = useState<LiveryPackage[]>([]);

  // Request state
  const { loading, error, setError, setLoading } = useRequestState(true);

  // Transaction form modal
  const transactionModal = useModalForm<TransactionForm>(emptyForm);

  // Payment recording modal
  const paymentModal = useModalForm<PaymentForm>(emptyPaymentForm);

  // Void transaction modal
  const [voidTarget, setVoidTarget] = useState<LedgerEntry | null>(null);
  const [voidForm, setVoidForm] = useState<VoidForm>(emptyVoidForm);

  // Edit transaction modal
  const [editTarget, setEditTarget] = useState<LedgerEntry | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEditForm);

  // Statement download modal
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [statementForm, setStatementForm] = useState<StatementForm>(emptyStatementForm);
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  // Show/hide voided transactions
  const [showVoided, setShowVoided] = useState(false);

  // Enums from API (loaded for future use)
  const [, setEnums] = useState<TransactionEnums | null>(null);

  // Delete confirmation (deprecated, kept for compatibility)
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  // Monthly billing state
  const [billingMonths, setBillingMonths] = useState<MonthOption[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<MonthOption | null>(null);
  const [billingPreview, setBillingPreview] = useState<BillingRunResponse | null>(null);
  const [billingResult, setBillingResult] = useState<BillingRunResponse | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [runningBilling, setRunningBilling] = useState(false);
  const [showBillingConfirm, setShowBillingConfirm] = useState(false);

  const loadEnums = useCallback(async () => {
    try {
      const data = await accountApi.getEnums();
      setEnums(data);
    } catch (err) {
      console.error('Failed to load enums:', err);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const data = await accountApi.listUserAccounts();
      setAccounts(data);
    } catch {
      setError('Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  const loadReferenceData = useCallback(async () => {
    try {
      const pkgs = await liveryPackagesApi.list();
      setPackages(pkgs);
    } catch (err) {
      console.error('Failed to load reference data:', err);
    }
  }, []);

  const loadBillingMonths = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadAccounts();
    loadReferenceData();
    loadBillingMonths();
    loadEnums();
  }, [loadAccounts, loadReferenceData, loadBillingMonths, loadEnums]);

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
    transactionModal.open({ ...emptyForm, user_id: userId });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionModal.formData.amount || !transactionModal.formData.description.trim()) return;

    try {
      setSubmitting(true);
      const amount = parseFloat(transactionModal.formData.amount);

      // Payments and credits should be negative (reduce balance)
      const adjustedAmount = ['payment', 'credit'].includes(transactionModal.formData.transaction_type)
        ? -Math.abs(amount)
        : Math.abs(amount);

      const data: CreateLedgerEntry = {
        user_id: transactionModal.formData.user_id,
        transaction_type: transactionModal.formData.transaction_type,
        amount: adjustedAmount,
        description: transactionModal.formData.description.trim(),
        notes: transactionModal.formData.notes.trim() || undefined,
        livery_package_id: transactionModal.formData.livery_package_id || undefined,
        period_start: transactionModal.formData.period_start || undefined,
        period_end: transactionModal.formData.period_end || undefined,
      };

      await accountApi.createTransaction(data);
      transactionModal.close();

      // Refresh data
      await loadAccounts();
      if (selectedUserId === transactionModal.formData.user_id) {
        await loadUserAccount(transactionModal.formData.user_id);
      }
    } catch {
      setError('Failed to create transaction');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await accountApi.deleteTransaction(deleteTarget);
      setDeleteTarget(null);

      // Refresh data
      await loadAccounts();
      if (selectedUserId) {
        await loadUserAccount(selectedUserId);
      }
    } catch {
      setError('Failed to delete transaction');
    }
  };

  // Payment recording
  const handleAddPayment = (userId: number) => {
    paymentModal.open({ ...emptyPaymentForm, user_id: userId });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal.formData.amount) return;

    try {
      setSubmitting(true);
      const result = await accountApi.recordPayment({
        user_id: paymentModal.formData.user_id,
        amount: parseFloat(paymentModal.formData.amount),
        payment_method: paymentModal.formData.payment_method,
        payment_reference: paymentModal.formData.payment_reference || undefined,
        description: paymentModal.formData.description || undefined,
        notes: paymentModal.formData.notes || undefined,
      });

      paymentModal.close();

      // Refresh data
      await loadAccounts();
      if (selectedUserId === paymentModal.formData.user_id) {
        await loadUserAccount(paymentModal.formData.user_id);
      }

      // Offer to download receipt
      if (result.receipt_number && window.confirm(`Payment recorded. Receipt #${result.receipt_number}. Download receipt?`)) {
        await accountApi.downloadReceipt(result.id);
      }
    } catch {
      setError('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Void transaction
  const handleVoidClick = (entry: LedgerEntry) => {
    setVoidTarget(entry);
    setVoidForm(emptyVoidForm);
  };

  const handleVoidSubmit = async () => {
    if (!voidTarget || !voidForm.reason.trim()) return;

    try {
      setSubmitting(true);
      await accountApi.voidTransaction(voidTarget.id, { reason: voidForm.reason.trim() });
      setVoidTarget(null);
      setVoidForm(emptyVoidForm);

      // Refresh data
      await loadAccounts();
      if (selectedUserId) {
        await loadUserAccount(selectedUserId);
      }
    } catch {
      setError('Failed to void transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit transaction
  const handleEditClick = (entry: LedgerEntry) => {
    setEditTarget(entry);
    setEditForm({
      description: entry.description,
      notes: entry.notes || '',
      payment_method: entry.payment_method || '',
      payment_reference: entry.payment_reference || '',
    });
  };

  const handleEditSubmit = async () => {
    if (!editTarget) return;

    try {
      setSubmitting(true);
      await accountApi.updateTransaction(editTarget.id, {
        description: editForm.description.trim() || undefined,
        notes: editForm.notes.trim() || undefined,
        payment_method: editForm.payment_method || undefined,
        payment_reference: editForm.payment_reference.trim() || undefined,
      });
      setEditTarget(null);

      // Refresh data
      await loadAccounts();
      if (selectedUserId) {
        await loadUserAccount(selectedUserId);
      }
    } catch {
      setError('Failed to update transaction');
    } finally {
      setSubmitting(false);
    }
  };

  // Statement download
  const handleOpenStatementModal = () => {
    // Default to last month
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    setStatementForm({
      from_date: lastMonth.toISOString().split('T')[0],
      to_date: lastMonthEnd.toISOString().split('T')[0],
    });
    setShowStatementModal(true);
  };

  const handleDownloadStatement = async () => {
    if (!selectedUserId || !statementForm.from_date || !statementForm.to_date) return;

    try {
      setDownloadingStatement(true);
      await accountApi.downloadUserStatement(selectedUserId, statementForm.from_date, statementForm.to_date);
      setShowStatementModal(false);
    } catch {
      setError('Failed to download statement');
    } finally {
      setDownloadingStatement(false);
    }
  };

  const handleDownloadTransactionsCsv = async () => {
    if (!selectedUserId) return;

    try {
      await accountApi.downloadUserTransactionsCsv(selectedUserId);
    } catch {
      setError('Failed to download CSV');
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

  const getBalanceClass = (balance: number | string | null | undefined) => {
    const numBalance = Number(balance) || 0;
    if (numBalance > 0) return 'balance-owed';
    if (numBalance < 0) return 'balance-credit';
    return 'balance-zero';
  };

  if (loading) {
    return <div className="admin-billing-page"><div className="ds-loading">Loading accounts...</div></div>;
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

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

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
            <div className="ds-loading">Loading account...</div>
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
                <div className="detail-actions">
                  <button
                    className="record-payment-btn"
                    onClick={() => handleAddPayment(selectedUserId)}
                  >
                    💳 Record Payment
                  </button>
                  <button
                    className="add-btn"
                    onClick={() => handleAddTransaction(selectedUserId)}
                  >
                    + Add Transaction
                  </button>
                  <button
                    className="ds-btn ds-btn-secondary"
                    onClick={handleOpenStatementModal}
                    title="Download Statement PDF"
                  >
                    📄 Statement
                  </button>
                  <button
                    className="ds-btn ds-btn-secondary"
                    onClick={handleDownloadTransactionsCsv}
                    title="Download Transactions CSV"
                  >
                    📊 CSV
                  </button>
                </div>
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

              <div className="transactions-header">
                <h3>Transaction History</h3>
                <label className="show-voided-toggle">
                  <input
                    type="checkbox"
                    checked={showVoided}
                    onChange={(e) => setShowVoided(e.target.checked)}
                  />
                  Show voided
                </label>
              </div>
              {allTransactions.length === 0 ? (
                <div className="no-transactions">No transactions yet</div>
              ) : (
                <div className="transactions-list">
                  {allTransactions
                    .filter(entry => showVoided || !entry.voided)
                    .map((entry) => (
                    <div
                      key={entry.id}
                      className={`transaction-item ${entry.voided ? 'voided' : ''}`}
                    >
                      <div className="transaction-icon">
                        {entry.voided ? '🚫' : transactionTypeIcons[entry.transaction_type]}
                      </div>
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
                          {entry.created_by_name && (
                            <span className="transaction-creator">by {entry.created_by_name}</span>
                          )}
                        </div>
                        {entry.payment_reference && (
                          <div className="payment-reference">Ref: {entry.payment_reference}</div>
                        )}
                        {entry.notes && (
                          <div className="transaction-notes">{entry.notes}</div>
                        )}
                        {entry.voided && (
                          <div className="void-info">
                            <span className="void-badge">VOIDED</span>
                            {entry.void_reason && <span className="void-reason">{entry.void_reason}</span>}
                            {entry.voided_by_name && <span className="voided-by">by {entry.voided_by_name}</span>}
                          </div>
                        )}
                      </div>
                      <div className="transaction-actions">
                        <span className={`transaction-amount ${getAmountClass(entry.amount)} ${entry.voided ? 'strikethrough' : ''}`}>
                          {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                        </span>
                        {!entry.voided && (
                          <>
                            <button
                              className="edit-btn"
                              onClick={() => handleEditClick(entry)}
                              title="Edit transaction"
                            >
                              ✏️
                            </button>
                            <button
                              className="void-btn"
                              onClick={() => handleVoidClick(entry)}
                              title="Void transaction"
                            >
                              🚫
                            </button>
                            {entry.receipt_number && (
                              <button
                                className="receipt-btn"
                                onClick={() => accountApi.downloadReceipt(entry.id)}
                                title="Download receipt"
                              >
                                🧾
                              </button>
                            )}
                          </>
                        )}
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
      <Modal
        isOpen={transactionModal.isOpen}
        onClose={() => transactionModal.close()}
        title="Add Transaction"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => transactionModal.close()}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Adding...' : 'Add Transaction'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <FormGroup label="Transaction Type" required>
            <Select
              value={transactionModal.formData.transaction_type}
              onChange={(e) => transactionModal.updateField('transaction_type', e.target.value as TransactionType)}
              required
            >
              {Object.entries(transactionTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Amount (£)" required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={transactionModal.formData.amount}
              onChange={(e) => transactionModal.updateField('amount', e.target.value)}
              placeholder="0.00"
              required
            />
            <small className="form-hint">
              {['payment', 'credit'].includes(transactionModal.formData.transaction_type)
                ? 'This will reduce the balance (shown as negative)'
                : 'This will increase the balance (shown as positive)'}
            </small>
          </FormGroup>

          <FormGroup label="Description" required>
            <Input
              type="text"
              value={transactionModal.formData.description}
              onChange={(e) => transactionModal.updateField('description', e.target.value)}
              placeholder="e.g., Monthly livery fee - December 2024"
              required
            />
          </FormGroup>

          {transactionModal.formData.transaction_type === 'package_charge' && (
            <>
              <FormGroup label="Livery Package">
                <Select
                  value={transactionModal.formData.livery_package_id || ''}
                  onChange={(e) => transactionModal.updateField('livery_package_id', e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Select package...</option>
                  {packages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} - {pkg.price_display}
                    </option>
                  ))}
                </Select>
              </FormGroup>

              <FormRow>
                <FormGroup label="Period Start">
                  <Input
                    type="date"
                    value={transactionModal.formData.period_start}
                    onChange={(e) => transactionModal.updateField('period_start', e.target.value)}
                  />
                </FormGroup>
                <FormGroup label="Period End">
                  <Input
                    type="date"
                    value={transactionModal.formData.period_end}
                    onChange={(e) => transactionModal.updateField('period_end', e.target.value)}
                  />
                </FormGroup>
              </FormRow>
            </>
          )}

          <FormGroup label="Notes">
            <Textarea
              value={transactionModal.formData.notes}
              onChange={(e) => transactionModal.updateField('notes', e.target.value)}
              placeholder="Optional additional notes..."
              rows={2}
            />
          </FormGroup>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Transaction?"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Billing Confirmation Modal */}
      <ConfirmModal
        isOpen={showBillingConfirm && !!billingPreview}
        onClose={() => setShowBillingConfirm(false)}
        onConfirm={handleRunBilling}
        title="Run Monthly Billing?"
        message={billingPreview ? `This will create ${billingPreview.total_horses} ledger ${billingPreview.total_horses === 1 ? 'entry' : 'entries'} totalling ${formatCurrency(billingPreview.total_amount)} for ${billingPreview.billing_month_display}. This action cannot be undone.` : ''}
        confirmLabel={runningBilling ? 'Running...' : 'Run Billing'}
        variant="primary"
      />

      {/* Record Payment Modal */}
      <Modal
        isOpen={paymentModal.isOpen}
        onClose={() => paymentModal.close()}
        title="Record Payment"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => paymentModal.close()}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handlePaymentSubmit}
              disabled={submitting}
            >
              {submitting ? 'Recording...' : 'Record Payment'}
            </button>
          </>
        }
      >
        <form onSubmit={handlePaymentSubmit}>
          <FormGroup label="Amount (£)" required>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={paymentModal.formData.amount}
              onChange={(e) => paymentModal.updateField('amount', e.target.value)}
              placeholder="0.00"
              required
            />
          </FormGroup>

          <FormGroup label="Payment Method" required>
            <Select
              value={paymentModal.formData.payment_method}
              onChange={(e) => paymentModal.updateField('payment_method', e.target.value as PaymentMethod)}
              required
            >
              {Object.entries(paymentMethodLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </FormGroup>

          <FormGroup label="Reference">
            <Input
              type="text"
              value={paymentModal.formData.payment_reference}
              onChange={(e) => paymentModal.updateField('payment_reference', e.target.value)}
              placeholder="e.g., Bank transfer reference, cheque number..."
            />
          </FormGroup>

          <FormGroup label="Description">
            <Input
              type="text"
              value={paymentModal.formData.description}
              onChange={(e) => paymentModal.updateField('description', e.target.value)}
              placeholder="Optional description (defaults to 'Payment received')"
            />
          </FormGroup>

          <FormGroup label="Notes">
            <Textarea
              value={paymentModal.formData.notes}
              onChange={(e) => paymentModal.updateField('notes', e.target.value)}
              placeholder="Optional internal notes..."
              rows={2}
            />
          </FormGroup>
        </form>
      </Modal>

      {/* Void Transaction Modal */}
      <Modal
        isOpen={voidTarget !== null}
        onClose={() => setVoidTarget(null)}
        title="Void Transaction"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => setVoidTarget(null)}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-danger"
              onClick={handleVoidSubmit}
              disabled={submitting || !voidForm.reason.trim()}
            >
              {submitting ? 'Voiding...' : 'Void Transaction'}
            </button>
          </>
        }
      >
        {voidTarget && (
          <div className="void-form">
            <div className="void-transaction-summary">
              <p><strong>Transaction:</strong> {voidTarget.description}</p>
              <p><strong>Amount:</strong> {formatCurrency(voidTarget.amount)}</p>
              <p><strong>Date:</strong> {formatDate(voidTarget.transaction_date)}</p>
            </div>
            <p className="void-warning">
              This will mark the transaction as voided and create a reversal entry.
              The account balance will be adjusted accordingly.
            </p>
            <FormGroup label="Void Reason" required>
              <Textarea
                value={voidForm.reason}
                onChange={(e) => setVoidForm({ reason: e.target.value })}
                placeholder="Enter the reason for voiding this transaction..."
                rows={3}
                required
              />
            </FormGroup>
          </div>
        )}
      </Modal>

      {/* Edit Transaction Modal */}
      <Modal
        isOpen={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title="Edit Transaction"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => setEditTarget(null)}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleEditSubmit}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        }
      >
        {editTarget && (
          <form>
            <FormGroup label="Description">
              <Input
                type="text"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Transaction description"
              />
            </FormGroup>

            {['payment', 'credit'].includes(editTarget.transaction_type) && (
              <>
                <FormGroup label="Payment Method">
                  <Select
                    value={editForm.payment_method}
                    onChange={(e) => setEditForm({ ...editForm, payment_method: e.target.value as PaymentMethod | '' })}
                  >
                    <option value="">Not specified</option>
                    {Object.entries(paymentMethodLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </Select>
                </FormGroup>

                <FormGroup label="Payment Reference">
                  <Input
                    type="text"
                    value={editForm.payment_reference}
                    onChange={(e) => setEditForm({ ...editForm, payment_reference: e.target.value })}
                    placeholder="e.g., Bank transfer reference, cheque number..."
                  />
                </FormGroup>
              </>
            )}

            <FormGroup label="Notes">
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Optional internal notes..."
                rows={2}
              />
            </FormGroup>
          </form>
        )}
      </Modal>

      {/* Statement Download Modal */}
      <Modal
        isOpen={showStatementModal}
        onClose={() => setShowStatementModal(false)}
        title="Download Statement"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={() => setShowStatementModal(false)}>
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleDownloadStatement}
              disabled={downloadingStatement || !statementForm.from_date || !statementForm.to_date}
            >
              {downloadingStatement ? 'Downloading...' : 'Download PDF'}
            </button>
          </>
        }
      >
        <form>
          <p className="statement-info">
            Generate a PDF statement showing all transactions for the selected period.
          </p>
          <FormRow>
            <FormGroup label="From Date" required>
              <Input
                type="date"
                value={statementForm.from_date}
                onChange={(e) => setStatementForm({ ...statementForm, from_date: e.target.value })}
                required
              />
            </FormGroup>
            <FormGroup label="To Date" required>
              <Input
                type="date"
                value={statementForm.to_date}
                onChange={(e) => setStatementForm({ ...statementForm, to_date: e.target.value })}
                required
              />
            </FormGroup>
          </FormRow>
          <div className="statement-presets">
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                const today = new Date();
                const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
                setStatementForm({
                  from_date: lastMonth.toISOString().split('T')[0],
                  to_date: lastMonthEnd.toISOString().split('T')[0],
                });
              }}
            >
              Last Month
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                const today = new Date();
                const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
                setStatementForm({
                  from_date: threeMonthsAgo.toISOString().split('T')[0],
                  to_date: today.toISOString().split('T')[0],
                });
              }}
            >
              Last 3 Months
            </button>
            <button
              type="button"
              className="preset-btn"
              onClick={() => {
                const today = new Date();
                const yearStart = new Date(today.getFullYear(), 0, 1);
                setStatementForm({
                  from_date: yearStart.toISOString().split('T')[0],
                  to_date: today.toISOString().split('T')[0],
                });
              }}
            >
              Year to Date
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
