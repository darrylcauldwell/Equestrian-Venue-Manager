import { useState, useEffect, useCallback } from 'react';
import { staffProfilesApi } from '../services/api';
import { useRequestState } from '../hooks';
import { FormGroup, FormRow, Input, Textarea } from '../components/ui';
import type { StaffProfile, StaffProfileSelfUpdate } from '../types';
import './MyProfile.css';

export function MyProfile() {
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<StaffProfileSelfUpdate>({});

  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const resetForm = (data: StaffProfile) => {
    setFormData({
      bio: data.bio || '',
      personal_email: data.personal_email || '',
      personal_phone: data.personal_phone || '',
      address_street: data.address_street || '',
      address_town: data.address_town || '',
      address_county: data.address_county || '',
      address_postcode: data.address_postcode || '',
      emergency_contact_name: data.emergency_contact_name || '',
      emergency_contact_phone: data.emergency_contact_phone || '',
      emergency_contact_relationship: data.emergency_contact_relationship || '',
    });
  };

  const loadProfile = useCallback(async () => {
    try {
      const data = await staffProfilesApi.getMyProfile();
      setProfile(data);
      resetForm(data);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error && err.message.includes('404')
        ? 'You don\'t have a staff profile yet. Please contact your administrator.'
        : 'Failed to load profile';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const updated = await staffProfilesApi.updateMyProfile(formData);
      setProfile(updated);
      setIsEditing(false);
      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      resetForm(profile);
    }
    setIsEditing(false);
    setError('');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const formatServiceYears = (startDate?: string) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const now = new Date();
    const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    const months = Math.floor(((now.getTime() - start.getTime()) % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
    if (years < 1) return `${months} month${months === 1 ? '' : 's'}`;
    return `${years} year${years === 1 ? '' : 's'}${months > 0 ? `, ${months} month${months === 1 ? '' : 's'}` : ''}`;
  };

  const parseQualifications = (qualStr?: string): string[] => {
    if (!qualStr) return [];
    try {
      return JSON.parse(qualStr);
    } catch {
      return [];
    }
  };

  const formatStaffType = (staffType?: string): string => {
    switch (staffType) {
      case 'regular': return 'Regular (Full/Part-time)';
      case 'casual': return 'Casual (As needed)';
      case 'on_call': return 'On-Call (Emergencies)';
      default: return staffType || '—';
    }
  };

  const getDbsStatus = (dbsDate?: string): { status: string; variant: 'success' | 'warning' | 'error' } => {
    if (!dbsDate) return { status: 'Not recorded', variant: 'warning' };
    const dbs = new Date(dbsDate);
    const now = new Date();
    const threeYearsAgo = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
    const twoYearsNineMonths = new Date(now.getFullYear() - 2, now.getMonth() - 9, now.getDate());

    if (dbs < threeYearsAgo) {
      return { status: 'Expired', variant: 'error' };
    } else if (dbs < twoYearsNineMonths) {
      return { status: 'Expiring soon', variant: 'warning' };
    }
    return { status: 'Valid', variant: 'success' };
  };

  if (isLoading) {
    return (
      <div className="my-profile-page">
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading your profile...</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="my-profile-page">
        <h1>My Profile</h1>
        {error && <div className="ds-alert ds-alert-error">{error}</div>}
        <div className="ds-alert ds-alert-info">
          Your staff profile hasn't been set up yet. Please contact your administrator.
        </div>
      </div>
    );
  }

  const qualifications = parseQualifications(profile.qualifications);

  return (
    <div className="my-profile-page">
      <div className="profile-header">
        <h1>My Profile</h1>
        {!isEditing && (
          <button
            className="ds-btn ds-btn-primary"
            onClick={() => setIsEditing(true)}
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {successMessage && <div className="ds-alert ds-alert-success">{successMessage}</div>}

      {isEditing ? (
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="ds-card">
            <div className="ds-card-header">
              <h2>Personal Information</h2>
            </div>
            <div className="ds-card-body">
              <FormGroup label="Bio">
                <Textarea
                  value={formData.bio || ''}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  rows={3}
                  placeholder="Tell us a bit about yourself..."
                />
              </FormGroup>
            </div>
          </div>

          <div className="ds-card">
            <div className="ds-card-header">
              <h2>Contact Details</h2>
            </div>
            <div className="ds-card-body">
              <FormRow>
                <FormGroup label="Personal Email">
                  <Input
                    type="email"
                    value={formData.personal_email || ''}
                    onChange={(e) => setFormData({ ...formData, personal_email: e.target.value })}
                  />
                </FormGroup>
                <FormGroup label="Personal Phone">
                  <Input
                    value={formData.personal_phone || ''}
                    onChange={(e) => setFormData({ ...formData, personal_phone: e.target.value })}
                  />
                </FormGroup>
              </FormRow>

              <FormGroup label="Street Address">
                <Input
                  value={formData.address_street || ''}
                  onChange={(e) => setFormData({ ...formData, address_street: e.target.value })}
                />
              </FormGroup>
              <FormRow>
                <FormGroup label="Town/City">
                  <Input
                    value={formData.address_town || ''}
                    onChange={(e) => setFormData({ ...formData, address_town: e.target.value })}
                  />
                </FormGroup>
                <FormGroup label="County">
                  <Input
                    value={formData.address_county || ''}
                    onChange={(e) => setFormData({ ...formData, address_county: e.target.value })}
                  />
                </FormGroup>
                <FormGroup label="Postcode">
                  <Input
                    value={formData.address_postcode || ''}
                    onChange={(e) => setFormData({ ...formData, address_postcode: e.target.value })}
                  />
                </FormGroup>
              </FormRow>
            </div>
          </div>

          <div className="ds-card">
            <div className="ds-card-header">
              <h2>Emergency Contact</h2>
            </div>
            <div className="ds-card-body">
              <FormRow>
                <FormGroup label="Name">
                  <Input
                    value={formData.emergency_contact_name || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })}
                  />
                </FormGroup>
                <FormGroup label="Phone">
                  <Input
                    value={formData.emergency_contact_phone || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })}
                  />
                </FormGroup>
                <FormGroup label="Relationship">
                  <Input
                    value={formData.emergency_contact_relationship || ''}
                    onChange={(e) => setFormData({ ...formData, emergency_contact_relationship: e.target.value })}
                    placeholder="e.g., Spouse, Parent"
                  />
                </FormGroup>
              </FormRow>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ds-btn ds-btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="profile-view">
          {/* Employment Info Card */}
          <div className="ds-card">
            <div className="ds-card-header">
              <h2>Employment Information</h2>
            </div>
            <div className="ds-card-body">
              <div className="profile-grid">
                <div className="profile-field">
                  <span className="profile-label">Job Title</span>
                  <span className="profile-value">{profile.job_title || '—'}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Employment Type</span>
                  <span className="profile-value">{formatStaffType(profile.staff_type)}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Start Date</span>
                  <span className="profile-value">{formatDate(profile.start_date)}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Length of Service</span>
                  <span className="profile-value">{formatServiceYears(profile.start_date) || '—'}</span>
                </div>
                {profile.staff_type === 'regular' && (
                  <div className="profile-field">
                    <span className="profile-label">Annual Leave Entitlement</span>
                    <span className="profile-value">{profile.annual_leave_entitlement ?? 28} days</span>
                  </div>
                )}
                {profile.leaving_date && (
                  <div className="profile-field">
                    <span className="profile-label">Leaving Date</span>
                    <span className="profile-value" style={{ color: 'var(--color-warning)' }}>
                      {formatDate(profile.leaving_date)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Work Contact Card */}
          <div className="ds-card">
            <div className="ds-card-header">
              <h2>Work Contact</h2>
            </div>
            <div className="ds-card-body">
              <div className="profile-grid">
                <div className="profile-field">
                  <span className="profile-label">Work Email</span>
                  <span className="profile-value">{profile.user_email || '—'}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Username</span>
                  <span className="profile-value">{profile.user_name || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Personal Info Card */}
          <div className="ds-card">
            <div className="ds-card-header">
              <h2>Personal Information</h2>
            </div>
            <div className="ds-card-body">
              {profile.bio && (
                <div className="profile-bio">
                  <p>{profile.bio}</p>
                </div>
              )}
              <div className="profile-grid">
                <div className="profile-field">
                  <span className="profile-label">Date of Birth</span>
                  <span className="profile-value">{formatDate(profile.date_of_birth)}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Personal Email</span>
                  <span className="profile-value">{profile.personal_email || '—'}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Personal Phone</span>
                  <span className="profile-value">{profile.personal_phone || '—'}</span>
                </div>
                <div className="profile-field full-width">
                  <span className="profile-label">Address</span>
                  <span className="profile-value">
                    {[
                      profile.address_street,
                      profile.address_town,
                      profile.address_county,
                      profile.address_postcode
                    ].filter(Boolean).join(', ') || '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact Card */}
          <div className="ds-card">
            <div className="ds-card-header">
              <h2>Emergency Contact</h2>
            </div>
            <div className="ds-card-body">
              <div className="profile-grid">
                <div className="profile-field">
                  <span className="profile-label">Name</span>
                  <span className="profile-value">{profile.emergency_contact_name || '—'}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Phone</span>
                  <span className="profile-value">{profile.emergency_contact_phone || '—'}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Relationship</span>
                  <span className="profile-value">{profile.emergency_contact_relationship || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Qualifications & DBS Card */}
          <div className="ds-card">
            <div className="ds-card-header">
              <h2>Qualifications & Compliance</h2>
            </div>
            <div className="ds-card-body">
              {qualifications.length > 0 && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <span className="profile-label" style={{ display: 'block', marginBottom: 'var(--space-2)' }}>Qualifications</span>
                  <div className="qualifications-list">
                    {qualifications.map((qual, index) => (
                      <span key={index} className="ds-badge ds-badge-info">
                        {qual}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="profile-grid">
                <div className="profile-field">
                  <span className="profile-label">DBS Check Date</span>
                  <span className="profile-value">{formatDate(profile.dbs_check_date)}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">DBS Status</span>
                  <span className="profile-value">
                    {(() => {
                      const dbsStatus = getDbsStatus(profile.dbs_check_date);
                      return (
                        <span className={`ds-badge ds-badge-${dbsStatus.variant}`}>
                          {dbsStatus.status}
                        </span>
                      );
                    })()}
                  </span>
                </div>
                {profile.dbs_certificate_number && (
                  <div className="profile-field">
                    <span className="profile-label">DBS Certificate Number</span>
                    <span className="profile-value">{profile.dbs_certificate_number}</span>
                  </div>
                )}
              </div>
              {!profile.dbs_check_date && (
                <p style={{ marginTop: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                  If you have a valid DBS certificate, please provide it to your administrator to update your records.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyProfile;
