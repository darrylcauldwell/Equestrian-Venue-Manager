import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { staffApi } from '../services/api';
import { useRequestState } from '../hooks';
import type { StaffThanks } from '../types';
import './SendThanks.css';

interface StaffMember {
  id: number;
  name: string;
}

export function SendThanks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [sentThanks, setSentThanks] = useState<StaffThanks[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<number | ''>('');
  const [message, setMessage] = useState('');
  const [tipAmount, setTipAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [payingTipId, setPayingTipId] = useState<number | null>(null);

  const { loading, error, setError, setLoading } = useRequestState(true);

  const loadData = useCallback(async () => {
    try {
      const [staff, sent] = await Promise.all([
        staffApi.getStaffForThanks(),
        staffApi.getMySentThanks(),
      ]);
      setStaffList(staff);
      setSentThanks(sent.thanks);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle return from Stripe checkout
  useEffect(() => {
    const tipSuccess = searchParams.get('tip_success');
    const tipCancelled = searchParams.get('tip_cancelled');
    const thanksId = searchParams.get('thanks_id');

    if (tipSuccess === 'true' && thanksId) {
      // Verify the payment
      const verifyPayment = async () => {
        try {
          const result = await staffApi.verifyTipPayment(parseInt(thanksId));
          if (result.status === 'paid') {
            setSuccessMessage('Tip payment successful! Thank you for your generosity.');
            loadData();
          }
        } catch (err) {
          console.error('Failed to verify payment:', err);
        }
      };
      verifyPayment();
      // Clear URL params
      setSearchParams({});
    } else if (tipCancelled === 'true') {
      setError('Tip payment was cancelled. You can pay the tip later from your sent thanks.');
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, loadData, setError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff || !message.trim()) return;

    setIsSubmitting(true);
    setError('');

    try {
      const tip = tipAmount ? parseFloat(tipAmount) : undefined;
      const thanks = await staffApi.sendThanks({
        staff_id: selectedStaff,
        message: message.trim(),
        tip_amount: tip && tip > 0 ? tip : undefined,
      });

      // If there's a tip, redirect to Stripe checkout
      if (tip && tip > 0) {
        try {
          const checkout = await staffApi.createTipCheckout(thanks.id);
          window.location.href = checkout.checkout_url;
          return; // Don't continue, we're redirecting
        } catch {
          // Payment setup failed, but thanks was created
          setError('Thank you sent, but payment setup failed. You can pay the tip later.');
        }
      }

      setSuccessMessage('Thank you sent successfully!');
      setShowModal(false);
      setSelectedStaff('');
      setMessage('');
      setTipAmount('');
      loadData();

      setTimeout(() => setSuccessMessage(''), 3000);
    } catch {
      setError('Failed to send thank you');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayTip = async (thanksId: number) => {
    setPayingTipId(thanksId);
    setError('');

    try {
      const checkout = await staffApi.createTipCheckout(thanksId);
      window.location.href = checkout.checkout_url;
    } catch {
      setError('Failed to start payment. Please try again.');
      setPayingTipId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Separate paid and unpaid thanks
  const paidThanks = sentThanks.filter((t) => !t.tip_amount || t.tip_paid);
  const unpaidTips = sentThanks.filter((t) => t.tip_amount && t.tip_amount > 0 && !t.tip_paid);

  if (loading) {
    return (
      <div className="send-thanks-page">
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="send-thanks-page">
      <div className="page-header">
        <div className="header-content">
          <h1>Say Thank You</h1>
          <p>Show your appreciation to our yard staff</p>
        </div>
        <button
          className="ds-btn ds-btn-primary"
          onClick={() => setShowModal(true)}
        >
          Send Thanks
        </button>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {successMessage && <div className="ds-alert ds-alert-success">{successMessage}</div>}

      {/* Unpaid Tips Section */}
      {unpaidTips.length > 0 && (
        <div className="unpaid-tips-section">
          <h2>Pending Tip Payments</h2>
          <p className="section-description">
            These tips haven't been paid yet. Click to complete payment.
          </p>
          <div className="thanks-list">
            {unpaidTips.map((thanks) => (
              <div key={thanks.id} className="thanks-card unpaid">
                <div className="thanks-header">
                  <span className="recipient">To: {thanks.staff_name}</span>
                  <span className="date">{formatDate(thanks.created_at)}</span>
                </div>
                <p className="thanks-message">{thanks.message}</p>
                <div className="unpaid-footer">
                  <div className="tip-badge unpaid">
                    Tip: £{thanks.tip_amount?.toFixed(2)} (unpaid)
                  </div>
                  <button
                    className="ds-btn ds-btn-primary ds-btn-sm"
                    onClick={() => handlePayTip(thanks.id)}
                    disabled={payingTipId === thanks.id}
                  >
                    {payingTipId === thanks.id ? 'Processing...' : 'Pay Now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Send Cards */}
      <div className="quick-send-section">
        <h2>Quick Thank You</h2>
        <p className="section-description">
          Select a staff member to send them a thank you message
        </p>
        <div className="staff-cards">
          {staffList.map((staff) => (
            <button
              key={staff.id}
              className="staff-card"
              onClick={() => {
                setSelectedStaff(staff.id);
                setShowModal(true);
              }}
            >
              <div className="staff-avatar">
                {staff.name.charAt(0).toUpperCase()}
              </div>
              <span className="staff-name">{staff.name}</span>
            </button>
          ))}
          {staffList.length === 0 && (
            <div className="empty-state">
              <p>No staff members available</p>
            </div>
          )}
        </div>
      </div>

      {/* Sent Thanks History */}
      <div className="thanks-history">
        <h2>Your Sent Thanks</h2>
        {paidThanks.length === 0 ? (
          <div className="empty-state">
            <p>You haven't sent any thanks yet</p>
            <button
              className="ds-btn ds-btn-primary"
              onClick={() => setShowModal(true)}
            >
              Send Your First Thank You
            </button>
          </div>
        ) : (
          <div className="thanks-list">
            {paidThanks.map((thanks) => (
              <div key={thanks.id} className="thanks-card sent">
                <div className="thanks-header">
                  <span className="recipient">To: {thanks.staff_name}</span>
                  <span className="date">{formatDate(thanks.created_at)}</span>
                </div>
                <p className="thanks-message">{thanks.message}</p>
                {thanks.tip_amount && thanks.tip_amount > 0 && (
                  <div className="tip-badge paid">
                    Tip: £{thanks.tip_amount.toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Thanks Modal */}
      {showModal && (
        <div className="ds-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="ds-modal ds-modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Send Thank You</h2>
              <button
                className="ds-modal-close"
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="ds-modal-body">
                <div className="ds-form-group">
                  <label className="required">Staff Member</label>
                  <select
                    className="ds-select"
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(Number(e.target.value) || '')}
                    required
                  >
                    <option value="">Select a staff member...</option>
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="ds-form-group">
                  <label className="required">Your Message</label>
                  <textarea
                    className="ds-input"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your thank you message..."
                    rows={4}
                    required
                  />
                </div>

                <div className="ds-form-group">
                  <label>Add a Tip (Optional)</label>
                  <div className="tip-input-wrapper">
                    <span className="currency-symbol">£</span>
                    <input
                      type="number"
                      className="ds-input tip-input"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.50"
                    />
                  </div>
                  <small className="ds-form-help">
                    Tips are paid via card and go directly to the staff member
                  </small>
                </div>

                {tipAmount && parseFloat(tipAmount) > 0 && (
                  <div className="ds-alert ds-alert-info">
                    You'll be redirected to our secure payment page to complete the £{parseFloat(tipAmount).toFixed(2)} tip.
                  </div>
                )}
              </div>
              <div className="ds-modal-footer">
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ds-btn ds-btn-primary"
                  disabled={isSubmitting || !selectedStaff || !message.trim()}
                >
                  {isSubmitting
                    ? 'Processing...'
                    : tipAmount && parseFloat(tipAmount) > 0
                    ? 'Send & Pay Tip'
                    : 'Send Thank You'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SendThanks;
