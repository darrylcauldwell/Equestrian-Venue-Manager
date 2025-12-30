import { useState, useEffect } from 'react';
import { noticesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import type {
  Notice,
  NoticeListResponse,
  NoticeCategory,
  NoticePriority,
  CreateNotice,
} from '../types';
import SocialShare from '../components/SocialShare';
import './Noticeboard.css';

type CategoryFilter = NoticeCategory | 'all';

export function Noticeboard() {
  const { isAdmin } = useAuth();
  const { venueName } = useSettings();
  const [noticeData, setNoticeData] = useState<NoticeListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateNotice>({
    title: '',
    content: '',
    category: 'general',
    priority: 'normal',
    is_pinned: false,
    expires_at: '',
  });

  const loadNotices = async () => {
    setIsLoading(true);
    try {
      const category = categoryFilter === 'all' ? undefined : categoryFilter;
      const data = await noticesApi.list(category);
      setNoticeData(data);
    } catch {
      setError('Failed to load notices');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotices();
  }, [categoryFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Convert empty string to undefined for expires_at
      const submitData = {
        ...formData,
        expires_at: formData.expires_at || undefined,
      };
      if (editingNotice) {
        await noticesApi.update(editingNotice.id, submitData);
      } else {
        await noticesApi.create(submitData);
      }
      setShowCreateForm(false);
      setEditingNotice(null);
      resetForm();
      await loadNotices();
    } catch {
      setError('Failed to save notice');
    }
  };

  const handleEdit = (notice: Notice) => {
    setEditingNotice(notice);
    setFormData({
      title: notice.title,
      content: notice.content,
      category: notice.category,
      priority: notice.priority,
      is_pinned: notice.is_pinned,
      expires_at: notice.expires_at ? notice.expires_at.split('T')[0] : '',
    });
    setShowCreateForm(true);
  };

  const handleDelete = async (noticeId: number) => {
    if (!confirm('Delete this notice?')) return;
    try {
      await noticesApi.delete(noticeId);
      await loadNotices();
    } catch {
      setError('Failed to delete notice');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      category: 'general',
      priority: 'normal',
      is_pinned: false,
      expires_at: '',
    });
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
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryLabel = (category: NoticeCategory) => {
    const labels: Record<NoticeCategory, string> = {
      general: 'General',
      event: 'Event',
      maintenance: 'Maintenance',
      health: 'Health',
      urgent: 'Urgent',
      social: 'Social',
    };
    return labels[category];
  };

  const renderNotice = (notice: Notice, isPinned: boolean = false) => (
    <div
      key={notice.id}
      className={`notice-card ${notice.category} ${notice.priority} ${isPinned ? 'pinned' : ''}`}
    >
      {isPinned && <div className="pinned-badge">Pinned</div>}
      <div className="notice-header">
        <span className={`category-badge ${notice.category}`}>
          {getCategoryLabel(notice.category)}
        </span>
        {notice.priority === 'high' && (
          <span className="priority-badge high">Important</span>
        )}
      </div>
      <h3>{notice.title}</h3>
      <div className="notice-content">{notice.content}</div>
      <div className="notice-footer">
        <span className="notice-meta">
          Posted by {notice.created_by_name || 'Staff'} on {formatDateTime(notice.created_at)}
        </span>
        {notice.expires_at && (
          <span className="notice-expires">
            Expires: {formatDate(notice.expires_at)}
          </span>
        )}
      </div>
      <div className="notice-actions">
        {/* Share button for events and social notices */}
        {(notice.category === 'event' || notice.category === 'social') && (
          <SocialShare
            title={notice.title}
            description={notice.content.length > 200 ? notice.content.substring(0, 200) + '...' : notice.content}
            date={notice.expires_at ? formatDate(notice.expires_at) : undefined}
            location={venueName}
            type={notice.category === 'event' ? 'event' : 'notice'}
          />
        )}
        {isAdmin && (
          <>
            <button onClick={() => handleEdit(notice)} className="edit-btn">
              Edit
            </button>
            <button onClick={() => handleDelete(notice.id)} className="delete-btn">
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="noticeboard-page">
      <div className="page-header">
        <h1>Noticeboard</h1>
        {isAdmin && (
          <button className="create-btn" onClick={() => setShowCreateForm(true)}>
            + Post Notice
          </button>
        )}
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      <div className="category-filters">
        <button
          className={`filter-btn ${categoryFilter === 'all' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('all')}
        >
          All
        </button>
        <button
          className={`filter-btn ${categoryFilter === 'urgent' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('urgent')}
        >
          Urgent
        </button>
        <button
          className={`filter-btn ${categoryFilter === 'event' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('event')}
        >
          Events
        </button>
        <button
          className={`filter-btn ${categoryFilter === 'maintenance' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('maintenance')}
        >
          Maintenance
        </button>
        <button
          className={`filter-btn ${categoryFilter === 'health' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('health')}
        >
          Health
        </button>
        <button
          className={`filter-btn ${categoryFilter === 'social' ? 'active' : ''}`}
          onClick={() => setCategoryFilter('social')}
        >
          Social
        </button>
      </div>

      <div className="notices-container">
        {/* Pinned Notices */}
        {noticeData && noticeData.pinned.length > 0 && (
          <div className="pinned-section">
            {noticeData.pinned.map((notice) => renderNotice(notice, true))}
          </div>
        )}

        {/* Regular Notices */}
        {noticeData && noticeData.notices.length > 0 ? (
          <div className="notices-list">
            {noticeData.notices.map((notice) => renderNotice(notice))}
          </div>
        ) : (
          noticeData &&
          noticeData.pinned.length === 0 && (
            <p className="no-notices">No notices to display</p>
          )
        )}
      </div>

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="ds-modal-overlay" onClick={() => {
          setShowCreateForm(false);
          setEditingNotice(null);
          resetForm();
        }}>
          <div className="ds-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingNotice ? 'Edit Notice' : 'Post New Notice'}</h2>

            <form onSubmit={handleSubmit}>
              <div className="ds-form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Notice title"
                  required
                />
              </div>

              <div className="ds-form-group">
                <label>Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Notice content..."
                  rows={5}
                  required
                />
              </div>

              <div className="form-row">
                <div className="ds-form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as NoticeCategory })
                    }
                  >
                    <option value="general">General</option>
                    <option value="event">Event</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="health">Health</option>
                    <option value="urgent">Urgent</option>
                    <option value="social">Social</option>
                  </select>
                </div>

                <div className="ds-form-group">
                  <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) =>
                      setFormData({ ...formData, priority: e.target.value as NoticePriority })
                    }
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High (Important)</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="ds-form-group">
                  <label>Expires On (Optional)</label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                  />
                </div>

                <div className="ds-form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_pinned}
                      onChange={(e) => setFormData({ ...formData, is_pinned: e.target.checked })}
                    />
                    Pin to top
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingNotice(null);
                    resetForm();
                  }}
                  className="ds-btn ds-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="ds-btn ds-btn-primary">
                  {editingNotice ? 'Save Changes' : 'Post Notice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
