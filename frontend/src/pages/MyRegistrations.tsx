import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { clinicsApi } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import type { MyClinicRegistration } from '../types';
import './MyRegistrations.css';

export function MyRegistrations() {
  const [registrations, setRegistrations] = useState<MyClinicRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { venueName } = useSettings();

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    try {
      const data = await clinicsApi.getMyRegistrations();
      setRegistrations(data);
    } catch {
      setError('Failed to load registrations');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    return timeStr.substring(0, 5);
  };

  const upcomingRegistrations = registrations.filter(
    r => r.status === 'approved' && new Date(r.clinic_date) >= new Date()
  );

  const pastRegistrations = registrations.filter(
    r => r.status !== 'approved' || new Date(r.clinic_date) < new Date()
  );

  if (isLoading) {
    return <div className="ds-loading">Loading your registrations...</div>;
  }

  return (
    <div className="my-registrations-page">
      <div className="page-header">
        <h1>My Clinic Registrations</h1>
        <p>Your clinic bookings at {venueName}</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {registrations.length === 0 ? (
        <div className="ds-empty">
          <h2>No registrations yet</h2>
          <p>You haven't registered for any clinics yet.</p>
          <Link to="/book/clinics" className="btn btn-primary">
            Browse Upcoming Clinics
          </Link>
        </div>
      ) : (
        <>
          {upcomingRegistrations.length > 0 && (
            <section className="registrations-section">
              <h2>Upcoming Clinics</h2>
              <div className="registrations-grid">
                {upcomingRegistrations.map(reg => (
                  <div key={reg.id} className="registration-card">
                    <div className="card-header">
                      <h3>{reg.clinic_title}</h3>
                      <span className={`status-badge ${reg.is_confirmed ? 'confirmed' : 'pending'}`}>
                        {reg.is_confirmed ? 'Confirmed' : 'Awaiting Confirmation'}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="info-row">
                        <span className="label">Date:</span>
                        <span>{formatDate(reg.clinic_date)}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Coach:</span>
                        <span>{reg.coach_name}</span>
                      </div>
                      <div className="info-row">
                        <span className="label">Discipline:</span>
                        <span className="capitalize">{reg.discipline?.replace('_', ' ')}</span>
                      </div>
                      {reg.horse_name && (
                        <div className="info-row">
                          <span className="label">Horse:</span>
                          <span>{reg.horse_name}</span>
                        </div>
                      )}

                      {/* Slot assignment info */}
                      {reg.slot_id ? (
                        <div className="slot-info">
                          <h4>Your Slot</h4>
                          <div className="info-row">
                            <span className="label">Time:</span>
                            <span>{formatTime(reg.slot_start_time!)} - {formatTime(reg.slot_end_time!)}</span>
                          </div>
                          {reg.slot_group_name && (
                            <div className="info-row">
                              <span className="label">Group:</span>
                              <span>{reg.slot_group_name}</span>
                            </div>
                          )}
                          {reg.slot_arena_name && (
                            <div className="info-row">
                              <span className="label">Arena:</span>
                              <span>{reg.slot_arena_name}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="awaiting-slot">
                          Slot times will be assigned closer to the date
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {pastRegistrations.length > 0 && (
            <section className="registrations-section past">
              <h2>Past Registrations</h2>
              <div className="registrations-list">
                {pastRegistrations.map(reg => (
                  <div key={reg.id} className="registration-row">
                    <span className="title">{reg.clinic_title}</span>
                    <span className="date">{formatDate(reg.clinic_date)}</span>
                    <span className="coach">{reg.coach_name}</span>
                    <span className={`status ${reg.status}`}>{reg.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="browse-more">
            <Link to="/book/clinics" className="btn btn-secondary">
              Browse More Clinics
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
