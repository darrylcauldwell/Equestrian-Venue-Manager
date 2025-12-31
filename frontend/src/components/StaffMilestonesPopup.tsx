import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { staffProfilesApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { StaffMilestonesResponse, StaffMilestone } from '../types';
import './StaffMilestonesPopup.css';

const DISMISSAL_KEY = 'staff-milestones-dismissed';
const DISMISSAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours (daily check)

export function StaffMilestonesPopup() {
  const { user, isAdmin } = useAuth();
  const [milestones, setMilestones] = useState<StaffMilestonesResponse | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    const stored = sessionStorage.getItem(DISMISSAL_KEY);
    if (stored) {
      const { timestamp, date } = JSON.parse(stored);
      const today = new Date().toDateString();
      // Reset if it's a new day or if expiry passed
      if (date !== today || Date.now() - timestamp > DISMISSAL_EXPIRY_MS) {
        sessionStorage.removeItem(DISMISSAL_KEY);
        return false;
      }
      return true;
    }
    return false;
  });

  useEffect(() => {
    // Only check for milestones for admins
    if (user && isAdmin && !dismissed) {
      loadMilestones();
    }
  }, [user, isAdmin, dismissed]);

  const loadMilestones = async () => {
    try {
      const data = await staffProfilesApi.getMilestones(7); // Next 7 days
      if (data.has_upcoming) {
        setMilestones(data);
      }
    } catch (error) {
      console.error('Failed to load staff milestones:', error);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISSAL_KEY, JSON.stringify({
      timestamp: Date.now(),
      date: new Date().toDateString()
    }));
    setDismissed(true);
  };

  // Don't show if no milestones or dismissed
  if (dismissed || !milestones?.has_upcoming) {
    return null;
  }

  const formatMilestoneDate = (milestone: StaffMilestone) => {
    if (milestone.days_until === 0) return 'Today!';
    if (milestone.days_until === 1) return 'Tomorrow';
    return `In ${milestone.days_until} days`;
  };

  const allMilestones = [
    ...milestones.birthdays.map(m => ({ ...m, type: 'birthday' as const })),
    ...milestones.anniversaries.map(m => ({ ...m, type: 'anniversary' as const }))
  ].sort((a, b) => a.days_until - b.days_until);

  return (
    <div className="milestones-popup-overlay">
      <div className="milestones-popup">
        <div className="popup-header">
          <div className="popup-icon">🎉</div>
          <h2>Staff Milestones</h2>
          <button className="close-btn" onClick={handleDismiss} title="Dismiss">
            &times;
          </button>
        </div>

        <p className="popup-intro">
          Don't forget to celebrate your team! Here are upcoming milestones:
        </p>

        <div className="milestones-list">
          {allMilestones.map((milestone, index) => (
            <div
              key={`${milestone.type}-${milestone.user_id}-${index}`}
              className={`milestone-item ${milestone.type} ${milestone.days_until === 0 ? 'today' : ''}`}
            >
              <span className="milestone-icon">
                {milestone.type === 'birthday' ? '🎂' : '🏆'}
              </span>
              <div className="milestone-content">
                <strong>{milestone.user_name}</strong>
                <span className="milestone-type">
                  {milestone.type === 'birthday'
                    ? 'Birthday'
                    : `${milestone.years} year${milestone.years === 1 ? '' : 's'} anniversary`}
                </span>
              </div>
              <span className={`milestone-when ${milestone.days_until === 0 ? 'today' : ''}`}>
                {formatMilestoneDate(milestone)}
              </span>
            </div>
          ))}
        </div>

        <div className="popup-footer">
          <Link
            to="/book/admin/staff-profiles"
            className="view-profiles-btn"
            onClick={handleDismiss}
          >
            View Staff Profiles
          </Link>
          <button className="dismiss-btn" onClick={handleDismiss}>
            Remind me tomorrow
          </button>
        </div>
      </div>
    </div>
  );
}
