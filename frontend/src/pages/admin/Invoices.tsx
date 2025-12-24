import { useState, useEffect } from 'react';
import { invoicesApi, usersApi } from '../../services/api';
import {
  InvoiceSummary,
  Invoice,
  InvoiceStatus,
  InvoiceGenerateRequest,
  User,
} from '../../types';
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

export default function Invoices() {
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | ''>('');
  const [userFilter, setUserFilter] = useState<number | ''>('');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [form, setForm] = useState<GenerateForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    loadInvoices();
    loadUsers();
  }, [statusFilter, userFilter]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await invoicesApi.list(
        statusFilter || undefined,
        userFilter || undefined
      );
      setInvoices(data);
      setError('');
    } catch (err) {
      setError('Failed to load invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await usersApi.list();
      // Filter to only livery users
      setUsers(data.filter(u => u.role === 'livery'));
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const loadInvoiceDetail = async (invoiceId: number) => {
    try {
      setLoadingDetail(true);
      const data = await invoicesApi.get(invoiceId);
      setSelectedInvoice(data);
    } catch (err) {
      setError('Failed to load invoice details');
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id) {
      setError('Please select a user');
      return;
    }

    try {
      setSubmitting(true);
      const data: InvoiceGenerateRequest = {
        user_id: form.user_id,
        period_start: form.period_start,
        period_end: form.period_end,
        due_date: form.due_date || undefined,
        auto_populate: form.auto_populate,
        notes: form.notes || undefined,
      };
      const invoice = await invoicesApi.generate(data);
      setShowGenerateModal(false);
      setForm({ ...emptyForm, ...getDefaultDates() });
      await loadInvoices();
      setSelectedInvoice(invoice);
    } catch (err) {
      setError('Failed to generate invoice');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
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
          className="btn-primary"
          onClick={() => {
            setForm({ ...emptyForm, ...getDefaultDates() });
            setShowGenerateModal(true);
          }}
        >
          Generate Invoice
        </button>
      </header>

      {error && (
        <div className="error-message">
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

      {loading ? (
        <div className="loading">Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="empty-state">
          <p>No invoices found</p>
          <button
            className="btn-secondary"
            onClick={() => {
              setForm({ ...emptyForm, ...getDefaultDates() });
              setShowGenerateModal(true);
            }}
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
              {loadingDetail ? (
                <div className="loading">Loading details...</div>
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
                          className="btn-primary"
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
                          className="btn-secondary"
                          onClick={() => handleCancel(selectedInvoice.id)}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                    <button
                      className="btn-secondary"
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
      {showGenerateModal && (
        <div className="modal-overlay" onClick={() => setShowGenerateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Generate Invoice</h2>
              <button className="close-btn" onClick={() => setShowGenerateModal(false)}>
                &times;
              </button>
            </div>
            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label>Customer *</label>
                <select
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: parseInt(e.target.value) })}
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
                <div className="form-group">
                  <label>Period Start *</label>
                  <input
                    type="date"
                    value={form.period_start}
                    onChange={(e) => setForm({ ...form, period_start: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Period End *</label>
                  <input
                    type="date"
                    value={form.period_end}
                    onChange={(e) => setForm({ ...form, period_end: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Due Date</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={form.auto_populate}
                    onChange={(e) => setForm({ ...form, auto_populate: e.target.checked })}
                  />
                  Auto-populate from ledger entries
                </label>
                <span className="help-text">
                  Automatically include charges and payments from the billing period
                </span>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional notes to include on the invoice..."
                  rows={3}
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowGenerateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Generating...' : 'Generate Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
