import { useState, useEffect, useCallback } from 'react';
import { invoicesApi, usersApi } from '../../services/api';
import {
  InvoiceSummary,
  Invoice,
  InvoiceStatus,
  InvoiceGenerateRequest,
  User,
} from '../../types';
import { useRequestState, useModalForm, useLoadingStates } from '../../hooks';
import '../../styles/AdminInvoices.css';

const statusLabels: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  issued: 'Issued',
  paid: 'Paid',
  cancelled: 'Cancelled',
  overdue: 'Overdue',
};

const statusColors: Record<InvoiceStatus, string> = {
  draft: 'status-draft',
  issued: 'status-issued',
  paid: 'status-paid',
  cancelled: 'status-cancelled',
  overdue: 'status-overdue',
};

interface GenerateForm {
  user_id: number;
  period_start: string;
  period_end: string;
  due_date: string;
  auto_populate: boolean;
  notes: string;
}

const getDefaultDates = () => {
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 14);

  return {
    period_start: firstOfMonth.toISOString().split('T')[0],
    period_end: lastOfMonth.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
  };
};

const emptyForm: GenerateForm = {
  user_id: 0,
  ...getDefaultDates(),
  auto_populate: true,
  notes: '',
};

// Loading state keys
type LoadingKey = 'list' | 'detail' | 'submitting';

export default function Invoices() {
  // Data state
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [downloading, setDownloading] = useState<number | null>(null);

  // Consolidated loading/error state
  const loading = useLoadingStates<LoadingKey>('list');
  const { error, setError } = useRequestState();

  // Filters
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [userFilter, setUserFilter] = useState<number | ''>('');

  // Generate modal
  const generateModal = useModalForm<GenerateForm>(emptyForm);

  const loadInvoices = useCallback(async () => {
    await loading.withLoading('list', async () => {
      try {
        const data = await invoicesApi.list(
          statusFilter || undefined,
          userFilter || undefined
        );
        setInvoices(data);
      } catch (err) {
        setError('Failed to load invoices');
        console.error(err);
      }
    });
  }, [statusFilter, userFilter, loading, setError]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      // Filter to only livery users
      setUsers(data.filter(u => u.role === 'livery'));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
    loadUsers();
  }, [loadInvoices, loadUsers]);

  const loadInvoiceDetail = async (invoiceId: number) => {
    await loading.withLoading('detail', async () => {
      try {
        const data = await invoicesApi.get(invoiceId);
        setSelectedInvoice(data);
      } catch (err) {
        setError('Failed to load invoice details');
        console.error(err);
      }
    });
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generateModal.formData.user_id) {
      setError('Please select a user');
      return;
    }

    await loading.withLoading('submitting', async () => {
      try {
        const data: InvoiceGenerateRequest = {
          user_id: generateModal.formData.user_id,
          period_start: generateModal.formData.period_start,
          period_end: generateModal.formData.period_end,
          due_date: generateModal.formData.due_date || undefined,
          auto_populate: generateModal.formData.auto_populate,
          notes: generateModal.formData.notes || undefined,
        };
        const invoice = await invoicesApi.generate(data);
        generateModal.close();
        await loadInvoices();
        setSelectedInvoice(invoice);
      } catch (err) {
        setError('Failed to generate invoice');
        console.error(err);
      }
    });
  };

  const handleIssue = async (invoiceId: number) => {
    try {
      await invoicesApi.issue(invoiceId);
      await loadInvoices();
      if (selectedInvoice?.id === invoiceId) {
        await loadInvoiceDetail(invoiceId);
      }
    } catch (err) {
      setError('Failed to issue invoice');
      console.error(err);
    }
  };

  const handleMarkPaid = async (invoiceId: number) => {
    try {
      await invoicesApi.markPaid(invoiceId);
      await loadInvoices();
      if (selectedInvoice?.id === invoiceId) {
        await loadInvoiceDetail(invoiceId);
      }
    } catch (err) {
      setError('Failed to mark invoice as paid');
      console.error(err);
    }
  };

  const handleCancel = async (invoiceId: number) => {
    if (!confirm('Are you sure you want to cancel this invoice?')) return;
    try {
      await invoicesApi.cancel(invoiceId);
      await loadInvoices();
      if (selectedInvoice?.id === invoiceId) {
        await loadInvoiceDetail(invoiceId);
      }
    } catch (err) {
      setError('Failed to cancel invoice');
      console.error(err);
    }
  };

  const handleDelete = async (invoiceId: number) => {
    if (!confirm('Are you sure you want to delete this draft invoice?')) return;
    try {
      await invoicesApi.delete(invoiceId);
      await loadInvoices();
      if (selectedInvoice?.id === invoiceId) {
        setSelectedInvoice(null);
      }
    } catch (err) {
      setError('Failed to delete invoice');
      console.error(err);
    }
  };

  const handleDownloadPdf = async (invoiceId: number, invoiceNumber: string) => {
    try {
      setDownloading(invoiceId);
      const blob = await invoicesApi.downloadPdf(invoiceId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError('Failed to download invoice');
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
    }).format(amount);
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="admin-invoices-page">
      <header className="page-header">
        <div className="header-left">
          <h1>Invoices</h1>
          <p className="subtitle">Generate and manage invoices</p>
        </div>
        <button
          className="ds-btn ds-btn-primary"
          onClick={() => generateModal.open({ ...emptyForm, ...getDefaultDates() })}
        >
          Generate Invoice
        </button>
      </header>

      {error && (
        <div className="ds-alert ds-alert-error">
          {error}
          <button onClick={() => setError('')}>&times;</button>
        </div>
      )}

      <div className="filters">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | '')}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="issued">Issued</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value ? parseInt(e.target.value) : '')}
        >
          <option value="">All Users</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </div>

      {loading.isLoading('list') ? (
        <div className="ds-loading">Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="ds-empty">
          <p>No invoices found</p>
          <button
            className="ds-btn ds-btn-secondary"
            onClick={() => generateModal.open({ ...emptyForm, ...getDefaultDates() })}
          >
            Generate First Invoice
          </button>
        </div>
      ) : (
        <div className="invoices-container">
          <div className="invoices-list">
            <table>
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>User</th>
                  <th>Period</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={selectedInvoice?.id === invoice.id ? 'selected' : ''}
                    onClick={() => loadInvoiceDetail(invoice.id)}
                  >
                    <td className="invoice-number">{invoice.invoice_number}</td>
                    <td>{invoice.user_name}</td>
                    <td className="period">
                      {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                    </td>
                    <td className="amount">{formatCurrency(invoice.subtotal)}</td>
                    <td className="amount">{formatCurrency(invoice.balance_due)}</td>
                    <td>
                      <span className={`status-badge ${statusColors[invoice.status]}`}>
                        {statusLabels[invoice.status]}
                      </span>
                    </td>
                    <td className="actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn-icon"
                        onClick={() => handleDownloadPdf(invoice.id, invoice.invoice_number)}
                        title="Download PDF"
                        disabled={downloading === invoice.id}
                      >
                        {downloading === invoice.id ? '...' : '📥'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedInvoice && (
            <div className="invoice-detail">
              {loading.isLoading('detail') ? (
                <div className="ds-loading">Loading details...</div>
              ) : (
                <>
                  <div className="detail-header">
                    <h2>{selectedInvoice.invoice_number}</h2>
                    <span className={`status-badge ${statusColors[selectedInvoice.status]}`}>
                      {statusLabels[selectedInvoice.status]}
                    </span>
                  </div>

                  <div className="detail-info">
                    <div className="info-row">
                      <span className="label">Customer:</span>
                      <span>{selectedInvoice.user_name}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Email:</span>
                      <span>{selectedInvoice.user_email}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">Period:</span>
                      <span>{formatDate(selectedInvoice.period_start)} - {formatDate(selectedInvoice.period_end)}</span>
                    </div>
                    {selectedInvoice.issue_date && (
                      <div className="info-row">
                        <span className="label">Issue Date:</span>
                        <span>{formatDate(selectedInvoice.issue_date)}</span>
                      </div>
                    )}
                    {selectedInvoice.due_date && (
                      <div className="info-row">
                        <span className="label">Due Date:</span>
                        <span>{formatDate(selectedInvoice.due_date)}</span>
                      </div>
                    )}
                    {selectedInvoice.paid_date && (
                      <div className="info-row">
                        <span className="label">Paid Date:</span>
                        <span>{formatDate(selectedInvoice.paid_date)}</span>
                      </div>
                    )}
                    <div className="info-row">
                      <span className="label">Created By:</span>
                      <span>{selectedInvoice.created_by_name}</span>
                    </div>
                  </div>

                  <div className="line-items">
                    <h3>Line Items</h3>
                    <table>
                      <thead>
                        <tr>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit Price</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.line_items.map((item) => (
                          <tr key={item.id}>
                            <td>
                              {item.description}
                              {item.category && <span className="category"> ({item.category})</span>}
                            </td>
                            <td>{item.quantity}</td>
                            <td>{formatCurrency(item.unit_price)}</td>
                            <td>{formatCurrency(item.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="totals">
                    <div className="total-row">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                    </div>
                    {selectedInvoice.payments_received > 0 && (
                      <div className="total-row payments">
                        <span>Payments Received:</span>
                        <span>-{formatCurrency(selectedInvoice.payments_received)}</span>
                      </div>
                    )}
                    <div className="total-row balance">
                      <span>Balance Due:</span>
                      <span>{formatCurrency(selectedInvoice.balance_due)}</span>
                    </div>
                  </div>

                  {selectedInvoice.notes && (
                    <div className="notes">
                      <h3>Notes</h3>
                      <p>{selectedInvoice.notes}</p>
                    </div>
                  )}

                  <div className="detail-actions">
                    {selectedInvoice.status === 'draft' && (
                      <>
                        <button
                          className="ds-btn ds-btn-primary"
                          onClick={() => handleIssue(selectedInvoice.id)}
                        >
                          Issue Invoice
                        </button>
                        <button
                          className="btn-danger"
                          onClick={() => handleDelete(selectedInvoice.id)}
                        >
                          Delete Draft
                        </button>
                      </>
                    )}
                    {selectedInvoice.status === 'issued' && (
                      <>
                        <button
                          className="btn-success"
                          onClick={() => handleMarkPaid(selectedInvoice.id)}
                        >
                          Mark as Paid
                        </button>
                        <button
                          className="ds-btn ds-btn-secondary"
                          onClick={() => handleCancel(selectedInvoice.id)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      className="ds-btn ds-btn-secondary"
                      onClick={() => handleDownloadPdf(selectedInvoice.id, selectedInvoice.invoice_number)}
                      disabled={downloading === selectedInvoice.id}
                    >
                      {downloading === selectedInvoice.id ? 'Downloading...' : 'Download PDF'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Generate Invoice Modal */}
      {generateModal.isOpen && (
        <div className="ds-modal-overlay" onClick={generateModal.close}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Generate Invoice</h2>
              <button className="close-btn" onClick={generateModal.close}>
                &times;
              </button>
            </div>
            <form onSubmit={handleGenerate}>
              <div className="ds-form-group">
                <label>Customer *</label>
                <select
                  value={generateModal.formData.user_id}
                  onChange={(e) => generateModal.updateField('user_id', parseInt(e.target.value))}
                  required
                >
                  <option value={0}>Select a user...</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="ds-form-group">
                  <label>Period Start *</label>
                  <input
                    type="date"
                    value={generateModal.formData.period_start}
                    onChange={(e) => generateModal.updateField('period_start', e.target.value)}
                    required
                  />
                </div>
                <div className="ds-form-group">
                  <label>Period End *</label>
                  <input
                    type="date"
                    value={generateModal.formData.period_end}
                    onChange={(e) => generateModal.updateField('period_end', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="ds-form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={generateModal.formData.due_date}
                  onChange={(e) => generateModal.updateField('due_date', e.target.value)}
                />
              </div>
              <div className="ds-form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={generateModal.formData.auto_populate}
                    onChange={(e) => generateModal.updateField('auto_populate', e.target.checked)}
                  />
                  Auto-populate from ledger entries
                </label>
                <span className="help-text">
                  Automatically include charges and payments from the billing period
                </span>
              </div>
              <div className="ds-form-group">
                <label>Notes</label>
                <textarea
                  value={generateModal.formData.notes}
                  onChange={(e) => generateModal.updateField('notes', e.target.value)}
                  placeholder="Optional notes to include on the invoice..."
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  onClick={generateModal.close}
                >
                  Cancel
                </button>
                <button type="submit" className="ds-btn ds-btn-primary" disabled={loading.isLoading('submitting')}>
                  {loading.isLoading('submitting') ? 'Generating...' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
