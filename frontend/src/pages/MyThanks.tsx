import { useState, useEffect, useCallback } from 'react';
import { staffApi } from '../services/api';
import { useRequestState } from '../hooks';
import type { StaffThanks } from '../types';
import './MyThanks.css';

export function MyThanks() {
  const [thanks, setThanks] = useState<StaffThanks[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [selectedThanks, setSelectedThanks] = useState<StaffThanks | null>(null);

  const { loading, error, setError, setLoading } = useRequestState(true);

  const loadThanks = useCallback(async () => {
    try {
      const response = await staffApi.getMyReceivedThanks();
      setThanks(response.thanks);
      setUnreadCount(response.unread_count);
    } catch {
      setError('Failed to load thanks messages');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadThanks();
  }, [loadThanks]);

  const handleViewThanks = async (thanksItem: StaffThanks) => {
    setSelectedThanks(thanksItem);

    // Mark as read if not already
    if (!thanksItem.read_at) {
      try {
        await staffApi.markThanksAsRead(thanksItem.id);
        setThanks((prev) =>
          prev.map((t) =>
            t.id === thanksItem.id
              ? { ...t, read_at: new Date().toISOString() }
              : t
          )
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Failed to mark as read:', err);
      }
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await staffApi.markAllThanksAsRead();
      setThanks((prev) =>
        prev.map((t) => ({ ...t, read_at: t.read_at || new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      setError('Failed to mark all as read');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate total tips
  const totalTips = thanks.reduce((sum, t) => sum + (t.tip_amount || 0), 0);
  const thanksWithTips = thanks.filter((t) => t.tip_amount && t.tip_amount > 0).length;

  if (loading) {
    return (
      <div className="my-thanks-page">
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading your thanks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="my-thanks-page">
      <div className="page-header">
        <div className="header-content">
          <h1>My Thanks</h1>
          <p>View appreciation messages from livery owners</p>
        </div>
        {unreadCount > 0 && (
          <button className="ds-btn ds-btn-secondary" onClick={handleMarkAllRead}>
            Mark All as Read
          </button>
        )}
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Stats Cards */}
      <div className="thanks-stats">
        <div className="stat-card">
          <span className="stat-value">{thanks.length}</span>
          <span className="stat-label">Total Thanks</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{unreadCount}</span>
          <span className="stat-label">Unread</span>
        </div>
        <div className="stat-card tips">
          <span className="stat-value">£{totalTips.toFixed(2)}</span>
          <span className="stat-label">Total Tips</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{thanksWithTips}</span>
          <span className="stat-label">With Tips</span>
        </div>
      </div>

      {/* Thanks List */}
      {thanks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎉</div>
          <h3>No Thanks Yet</h3>
          <p>When livery owners send you appreciation messages, they'll appear here.</p>
        </div>
      ) : (
        <div className="thanks-list">
          {thanks.map((thanksItem) => (
            <div
              key={thanksItem.id}
              className={`thanks-card ${!thanksItem.read_at ? 'unread' : ''}`}
              onClick={() => handleViewThanks(thanksItem)}
            >
              <div className="thanks-indicator">
                {!thanksItem.read_at && <span className="unread-dot"></span>}
              </div>
              <div className="thanks-content">
                <div className="thanks-header">
                  <span className="sender">From: {thanksItem.sender_name}</span>
                  <span className="date">{formatDate(thanksItem.created_at)}</span>
                </div>
                <p className="thanks-preview">
                  {thanksItem.message.length > 100
                    ? `${thanksItem.message.substring(0, 100)}...`
                    : thanksItem.message}
                </p>
                {thanksItem.tip_amount && thanksItem.tip_amount > 0 && (
                  <div className="tip-badge">
                    +£{thanksItem.tip_amount.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Thanks Modal */}
      {selectedThanks && (
        <div className="ds-modal-overlay" onClick={() => setSelectedThanks(null)}>
          <div className="ds-modal ds-modal-md" onClick={(e) => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>Thank You Message</h2>
              <button
                className="ds-modal-close"
                onClick={() => setSelectedThanks(null)}
              >
                &times;
              </button>
            </div>
            <div className="ds-modal-body">
              <div className="thanks-detail">
                <div className="thanks-meta">
                  <div className="sender-info">
                    <div className="sender-avatar">
                      {selectedThanks.sender_name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <strong>{selectedThanks.sender_name}</strong>
                      <span className="date-time">
                        {formatDateTime(selectedThanks.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="message-content">
                  <p>{selectedThanks.message}</p>
                </div>

                {selectedThanks.tip_amount && selectedThanks.tip_amount > 0 && (
                  <div className="tip-section">
                    <div className="tip-amount">
                      <span className="tip-label">Tip Included</span>
                      <span className="tip-value">
                        £{selectedThanks.tip_amount.toFixed(2)}
                      </span>
                    </div>
                    <p className="tip-note">
                      This tip will be included in your next pay
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="ds-modal-footer">
              <button
                className="ds-btn ds-btn-primary"
                onClick={() => setSelectedThanks(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyThanks;
