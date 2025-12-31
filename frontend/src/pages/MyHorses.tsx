import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { horsesApi, feedApi, usersApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Modal, FormGroup, Input, Select } from '../components/ui';
import type { Horse, FeedSupplyAlert, User, CreateHorseData } from '../types';
import './MyHorses.css';

interface HorseAlerts {
  [horseId: number]: FeedSupplyAlert[];
}

export function MyHorses() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [horses, setHorses] = useState<Horse[]>([]);
  const [horseAlerts, setHorseAlerts] = useState<HorseAlerts>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Add horse modal state (admin only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newHorse, setNewHorse] = useState<CreateHorseData>({
    name: '',
    owner_id: undefined,
    passport_name: '',
    colour: '',
    birth_year: undefined,
    feed_notes: '',
  });

  const loadHorses = async () => {
    try {
      const data = await horsesApi.list();
      setHorses(data || []);

      // Load alerts for each horse
      if (data && data.length > 0) {
        const alertsMap: HorseAlerts = {};
        await Promise.all(
          data.map(async (horse) => {
            try {
              const alerts = await feedApi.listAlerts(horse.id, true);
              if (alerts.length > 0) {
                alertsMap[horse.id] = alerts;
              }
            } catch {
              // Silently ignore alert loading errors
            }
          })
        );
        setHorseAlerts(alertsMap);
      }
    } catch (err) {
      console.error('Failed to load horses:', err);
      setError('Failed to load horses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Get all alerts across all horses
  const getAllAlerts = (): (FeedSupplyAlert & { horseName: string })[] => {
    const alerts: (FeedSupplyAlert & { horseName: string })[] = [];
    horses.forEach((horse) => {
      const horseAlertList = horseAlerts[horse.id] || [];
      horseAlertList.forEach((alert) => {
        alerts.push({ ...alert, horseName: horse.name });
      });
    });
    return alerts;
  };

  const handleResolveAlert = async (horseId: number, alertId: number) => {
    try {
      await feedApi.resolveAlert(horseId, alertId);
      // Update local state
      setHorseAlerts((prev) => ({
        ...prev,
        [horseId]: (prev[horseId] || []).filter((a) => a.id !== alertId),
      }));
    } catch {
      setError('Failed to resolve alert');
    }
  };

  // Load users for owner dropdown (admin only)
  const loadUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch {
      console.error('Failed to load users');
    }
  };

  const openAddModal = () => {
    setNewHorse({ name: '', owner_id: undefined, passport_name: '', colour: '', birth_year: undefined, feed_notes: '' });
    setShowAddModal(true);
    if (users.length === 0) {
      loadUsers();
    }
  };

  const handleAddHorse = async () => {
    if (!newHorse.name.trim()) {
      setError('Horse name is required');
      return;
    }
    setIsSubmitting(true);
    setError('');
    try {
      await horsesApi.create(newHorse);
      setShowAddModal(false);
      await loadHorses();
    } catch {
      setError('Failed to create horse');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    loadHorses();
  }, []);

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="my-horses-page">
      <div className="page-header">
        <h1>My Horses</h1>
        {isAdmin && (
          <button className="ds-btn ds-btn-primary" onClick={openAddModal}>
            Add Horse
          </button>
        )}
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Low Feed Alerts Banner - only shown to livery owners, not admins */}
      {!isAdmin && getAllAlerts().length > 0 && (
        <div className="feed-alerts-banner">
          <h2>Low Feed Alerts</h2>
          <p className="alerts-intro">Yard staff have flagged the following items as running low:</p>
          <div className="alerts-list">
            {getAllAlerts().map((alert) => (
              <div key={alert.id} className="alert-item">
                <div className="alert-details">
                  <strong>{alert.horseName}</strong>
                  <span className="alert-item-name">{alert.item}</span>
                  {alert.notes && <span className="alert-notes">{alert.notes}</span>}
                  {alert.created_by_name && (
                    <span className="alert-reporter">Reported by {alert.created_by_name}</span>
                  )}
                </div>
                <button
                  className="resolve-btn"
                  onClick={() => handleResolveAlert(alert.horse_id, alert.id)}
                >
                  Mark Resolved
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {horses.length === 0 ? (
        <p className="no-horses">No horses registered yet. Please contact the yard to add your horses.</p>
      ) : (
        <div className="horses-grid">
          {horses.map((horse) => (
            <div key={horse.id} className={`horse-card ${!isAdmin && (horseAlerts[horse.id]?.length ?? 0) > 0 ? 'has-alerts' : ''}`}>
              <div className="horse-icon">🐴</div>
              <h3>
                {horse.name}
                {!isAdmin && (horseAlerts[horse.id]?.length ?? 0) > 0 && (
                  <span className="alert-badge" title="Low feed alert">!</span>
                )}
              </h3>
              {horse.colour && <p className="horse-colour">{horse.colour}</p>}
              {horse.birth_year && (
                <p className="horse-age">
                  Born {horse.birth_year} ({new Date().getFullYear() - horse.birth_year} years old)
                </p>
              )}
              {horse.stable_name && (
                <p className="horse-stable">Stable: {horse.stable_name}</p>
              )}
              {horse.livery_package_name && (
                <p className="horse-package">{horse.livery_package_name}</p>
              )}
              {horse.feed_notes && (
                <p className="horse-feed-notes">{horse.feed_notes}</p>
              )}
              <div className="horse-actions">
                <button className="ds-btn ds-btn-primary" onClick={() => navigate(`/book/my-horses/${horse.id}`)}>
                  Details
                </button>
                <button className="ds-btn ds-btn-secondary" onClick={() => navigate(`/book/my-horses/${horse.id}/health`)}>
                  Health Records
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Horse Modal (Admin only) */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Horse"
        footer={
          <>
            <button
              className="ds-btn ds-btn-secondary"
              onClick={() => setShowAddModal(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              className="ds-btn ds-btn-primary"
              onClick={handleAddHorse}
              disabled={isSubmitting || !newHorse.name.trim()}
            >
              {isSubmitting ? 'Adding...' : 'Add Horse'}
            </button>
          </>
        }
      >
        <FormGroup label="Horse Name" required>
          <Input
            value={newHorse.name}
            onChange={(e) => setNewHorse({ ...newHorse, name: e.target.value })}
            placeholder="Enter horse name"
          />
        </FormGroup>

        <FormGroup label="Passport Name">
          <Input
            value={newHorse.passport_name || ''}
            onChange={(e) => setNewHorse({ ...newHorse, passport_name: e.target.value })}
            placeholder="Name as shown on passport"
          />
        </FormGroup>

        <FormGroup label="Owner">
          <Select
            value={newHorse.owner_id || ''}
            onChange={(e) => setNewHorse({ ...newHorse, owner_id: e.target.value ? Number(e.target.value) : undefined })}
          >
            <option value="">Select owner (optional)</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.username})
              </option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Colour">
          <Input
            value={newHorse.colour || ''}
            onChange={(e) => setNewHorse({ ...newHorse, colour: e.target.value })}
            placeholder="e.g., Bay, Chestnut, Grey"
          />
        </FormGroup>

        <FormGroup label="Birth Year">
          <Input
            type="number"
            value={newHorse.birth_year || ''}
            onChange={(e) => setNewHorse({ ...newHorse, birth_year: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="e.g., 2018"
            min={1990}
            max={new Date().getFullYear()}
          />
        </FormGroup>

        <FormGroup label="Feed Notes">
          <Input
            value={newHorse.feed_notes || ''}
            onChange={(e) => setNewHorse({ ...newHorse, feed_notes: e.target.value })}
            placeholder="Any special feeding requirements"
          />
        </FormGroup>
      </Modal>
    </div>
  );
}
