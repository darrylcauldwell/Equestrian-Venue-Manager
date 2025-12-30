import { useState, useEffect } from 'react';
import { invoicesApi, accountApi } from '../services/api';
import { MyInvoiceSummary, Invoice, InvoiceStatus } from '../types';
import '../styles/MyInvoices.css';

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

export default function MyInvoices() {
  const [invoices, setInvoices] = useState<MyInvoiceSummary[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const data = await invoicesApi.getMyInvoices();
      setInvoices(data);
      setError('');
    } catch (err) {
      setError('Failed to load invoices');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceDetail = async (invoiceId: number) => {
    try {
      setLoadingDetail(true);
      const data = await invoicesApi.getMyInvoice(invoiceId);
      setSelectedInvoice(data);
    } catch (err) {
      setError('Failed to load invoice details');
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDownloadPdf = async (invoiceId: number, invoiceNumber: string) => {
    try {
      setDownloading(invoiceId);
      const blob = await invoicesApi.downloadMyPdf(invoiceId);
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

  const handlePayInvoice = async (invoiceId: number, amount: number) => {
    try {
      setPayingInvoice(invoiceId);
      setError('');
      const result = await accountApi.createPaymentCheckout(amount);
      window.location.href = result.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start payment');
      console.error(err);
      setPayingInvoice(null);
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

  if (loading) {
    return (
      <div className="my-invoices-page">
        <div className="ds-loading">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="my-invoices-page">
      <header className="page-header">
        <h1>My Invoices</h1>
        <p className="subtitle">View and download your invoices</p>
      </header>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {invoices.length === 0 ? (
        <div className="ds-empty">
          <p>No invoices found</p>
        </div>
      ) : (
        <div className="invoices-container">
          <div className="invoices-list">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className={`invoice-card ${selectedInvoice?.id === invoice.id ? 'selected' : ''}`}
                onClick={() => loadInvoiceDetail(invoice.id)}
              >
                <div className="invoice-header">
                  <span className="invoice-number">{invoice.invoice_number}</span>
                  <span className={`invoice-status ${statusColors[invoice.status]}`}>
                    {statusLabels[invoice.status]}
                  </span>
                </div>
                <div className="invoice-period">
                  {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
                </div>
                <div className="invoice-amounts">
                  <div className="amount-row">
                    <span>Total:</span>
                    <span className="amount">{formatCurrency(invoice.subtotal)}</span>
                  </div>
                  {invoice.balance_due > 0 && (
                    <div className="amount-row balance-due">
                      <span>Balance Due:</span>
                      <span className="amount">{formatCurrency(invoice.balance_due)}</span>
                    </div>
                  )}
                </div>
                <div className="invoice-dates">
                  {invoice.issue_date && (
                    <span>Issued: {formatDate(invoice.issue_date)}</span>
                  )}
                  {invoice.due_date && (
                    <span>Due: {formatDate(invoice.due_date)}</span>
                  )}
                </div>
                <div className="invoice-actions">
                  <button
                    className="btn-download"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadPdf(invoice.id, invoice.invoice_number);
                    }}
                    disabled={downloading === invoice.id}
                  >
                    {downloading === invoice.id ? 'Downloading...' : 'Download PDF'}
                  </button>
                  {invoice.balance_due > 0 && (invoice.status === 'issued' || invoice.status === 'overdue') && (
                    <button
                      className="btn-pay"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePayInvoice(invoice.id, invoice.balance_due);
                      }}
                      disabled={payingInvoice === invoice.id}
                    >
                      {payingInvoice === invoice.id ? 'Processing...' : 'Pay Now'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {selectedInvoice && (
            <div className="invoice-detail">
              {loadingDetail ? (
                <div className="ds-loading">Loading details...</div>
              ) : (
                <>
                  <div className="detail-header">
                    <h2>{selectedInvoice.invoice_number}</h2>
                    <span className={`invoice-status ${statusColors[selectedInvoice.status]}`}>
                      {statusLabels[selectedInvoice.status]}
                    </span>
                  </div>

                  <div className="detail-info">
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
                  </div>

                  <div className="line-items">
                    <h3>Items</h3>
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
                    <button
                      className="ds-btn ds-btn-secondary"
                      onClick={() => handleDownloadPdf(selectedInvoice.id, selectedInvoice.invoice_number)}
                      disabled={downloading === selectedInvoice.id}
                    >
                      {downloading === selectedInvoice.id ? 'Downloading...' : 'Download PDF'}
                    </button>
                    {selectedInvoice.balance_due > 0 && (selectedInvoice.status === 'issued' || selectedInvoice.status === 'overdue') && (
                      <button
                        className="ds-btn ds-btn-primary"
                        onClick={() => handlePayInvoice(selectedInvoice.id, selectedInvoice.balance_due)}
                        disabled={payingInvoice === selectedInvoice.id}
                      >
                        {payingInvoice === selectedInvoice.id ? 'Processing...' : `Pay ${formatCurrency(selectedInvoice.balance_due)}`}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
