import { useState, useEffect, useCallback } from 'react';
import { staffProfilesApi, contractsApi } from '../../services/api';
import { useModalForm, useRequestState } from '../../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Textarea, Select } from '../../components/ui';
import type {
  StaffProfile,
  StaffProfileCreate,
  StaffProfileUpdate,
  StaffProfileSummary,
  StaffMilestonesResponse,
  StaffMemberCreate,
  ContractTemplateSummary,
  HourlyRateHistory,
} from '../../types';
import {
  PageActions,
} from '../../components/admin';
import './Admin.css';
import './StaffProfiles.css';

const emptyProfileForm: Partial<StaffProfileCreate> = {
  user_id: 0,
  date_of_birth: '',
  bio: '',
  start_date: '',
  job_title: '',
  personal_email: '',
  personal_phone: '',
  address_street: '',
  address_town: '',
  address_county: '',
  address_postcode: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  qualifications: '',
  dbs_check_date: '',
  dbs_certificate_number: '',
};

const emptyStaffMemberForm: StaffMemberCreate = {
  // User account fields
  username: '',
  email: '',
  name: '',
  phone: '',
  // Profile fields
  date_of_birth: '',
  bio: '',
  start_date: '',
  job_title: '',
  personal_email: '',
  personal_phone: '',
  address_street: '',
  address_town: '',
  address_county: '',
  address_postcode: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relationship: '',
  qualifications: '',
  dbs_check_date: '',
  dbs_certificate_number: '',
  notes: '',
  // Employment type and leave
  staff_type: 'regular',
  annual_leave_entitlement: 23,
  // Payroll fields (required)
  national_insurance_number: '',
  bank_account_number: '',
  bank_sort_code: '',
  bank_account_name: '',
  // Payroll fields (optional)
  hourly_rate: undefined,
  tax_code: '',
  student_loan_plan: '',
};

export function AdminStaffProfiles() {
  const [profiles, setProfiles] = useState<StaffProfileSummary[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<StaffProfile | null>(null);
  const [milestones, setMilestones] = useState<StaffMilestonesResponse | null>(null);

  // Request state
  const { loading: isLoading, error, setError, setLoading } = useRequestState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal hooks
  const profileModal = useModalForm<Partial<StaffProfileCreate | StaffProfileUpdate>>(emptyProfileForm);
  const [adminNotes, setAdminNotes] = useState('');

  // Create Staff Member modal
  const [showCreateStaffMember, setShowCreateStaffMember] = useState(false);
  const [staffMemberForm, setStaffMemberForm] = useState<StaffMemberCreate>(emptyStaffMemberForm);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  // Employment contracts
  const [employmentContracts, setEmploymentContracts] = useState<ContractTemplateSummary[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);

  // Rate history
  const [rateHistory, setRateHistory] = useState<HourlyRateHistory[]>([]);
  const [showRateHistory, setShowRateHistory] = useState(false);
  const [rateHistoryLoading, setRateHistoryLoading] = useState(false);
  const [newRateForm, setNewRateForm] = useState({
    hourly_rate: '',
    effective_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<StaffProfileSummary | null>(null);

  const loadProfiles = useCallback(async () => {
    try {
      const data = await staffProfilesApi.getSummaries();
      setProfiles(data);
    } catch {
      setError('Failed to load staff profiles');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  const loadMilestones = useCallback(async () => {
    try {
      const data = await staffProfilesApi.getMilestones(14); // Next 2 weeks
      setMilestones(data);
    } catch {
      // Non-critical
    }
  }, []);

  const loadEmploymentContracts = useCallback(async () => {
    try {
      const templates = await contractsApi.listTemplates();
      // Filter to only active employment contracts
      const employment = templates.filter(
        t => t.contract_type === 'employment' && t.is_active
      );
      setEmploymentContracts(employment);
    } catch {
      // Non-critical - contract linking is optional
    }
  }, []);

  useEffect(() => {
    loadProfiles();
    loadMilestones();
    loadEmploymentContracts();
  }, [loadProfiles, loadMilestones, loadEmploymentContracts]);

  const handleEditProfile = async (summary: StaffProfileSummary) => {
    try {
      const fullProfile = await staffProfilesApi.get(summary.user_id);
      setSelectedProfile(fullProfile);
      profileModal.edit(summary.user_id, {
        date_of_birth: fullProfile.date_of_birth || '',
        bio: fullProfile.bio || '',
        start_date: fullProfile.start_date || '',
        leaving_date: fullProfile.leaving_date || '',
        job_title: fullProfile.job_title || '',
        staff_type: fullProfile.staff_type || 'regular',
        annual_leave_entitlement: fullProfile.annual_leave_entitlement ?? 23,
        personal_email: fullProfile.personal_email || '',
        personal_phone: fullProfile.personal_phone || '',
        address_street: fullProfile.address_street || '',
        address_town: fullProfile.address_town || '',
        address_county: fullProfile.address_county || '',
        address_postcode: fullProfile.address_postcode || '',
        emergency_contact_name: fullProfile.emergency_contact_name || '',
        emergency_contact_phone: fullProfile.emergency_contact_phone || '',
        emergency_contact_relationship: fullProfile.emergency_contact_relationship || '',
        qualifications: fullProfile.qualifications || '',
        dbs_check_date: fullProfile.dbs_check_date || '',
        dbs_certificate_number: fullProfile.dbs_certificate_number || '',
        // Payroll fields
        hourly_rate: fullProfile.hourly_rate,
        national_insurance_number: fullProfile.national_insurance_number || '',
        bank_account_number: fullProfile.bank_account_number || '',
        bank_sort_code: fullProfile.bank_sort_code || '',
        bank_account_name: fullProfile.bank_account_name || '',
        tax_code: fullProfile.tax_code || '',
        student_loan_plan: fullProfile.student_loan_plan || '',
        // P45 fields
        p45_date_left_previous: fullProfile.p45_date_left_previous || '',
        p45_tax_paid_previous: fullProfile.p45_tax_paid_previous,
        p45_pay_to_date_previous: fullProfile.p45_pay_to_date_previous,
      });
      setAdminNotes(fullProfile.notes || '');
      // Reset rate history state when opening edit modal
      setRateHistory([]);
      setShowRateHistory(false);
      setNewRateForm({
        hourly_rate: '',
        effective_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch {
      setError('Failed to load profile details');
    }
  };

  const loadRateHistory = async (userId: number) => {
    setRateHistoryLoading(true);
    try {
      const history = await staffProfilesApi.getRateHistory(userId);
      setRateHistory(history);
      setShowRateHistory(true);
    } catch {
      setError('Failed to load rate history');
    } finally {
      setRateHistoryLoading(false);
    }
  };

  const handleAddRate = async () => {
    if (!profileModal.editingId || !newRateForm.hourly_rate) return;

    setIsSubmitting(true);
    try {
      await staffProfilesApi.addRate(profileModal.editingId, {
        hourly_rate: parseFloat(newRateForm.hourly_rate),
        effective_date: newRateForm.effective_date,
        notes: newRateForm.notes || undefined,
      });
      // Reload rate history
      const history = await staffProfilesApi.getRateHistory(profileModal.editingId);
      setRateHistory(history);
      // Update the current rate in the form if effective date is today or past
      const today = new Date().toISOString().split('T')[0];
      if (newRateForm.effective_date <= today) {
        profileModal.setFormData({
          ...profileModal.formData,
          hourly_rate: parseFloat(newRateForm.hourly_rate),
        });
      }
      // Reset the new rate form
      setNewRateForm({
        hourly_rate: '',
        effective_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch {
      setError('Failed to add rate');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      if (profileModal.editingId) {
        await staffProfilesApi.update(profileModal.editingId, {
          ...profileModal.formData,
          notes: adminNotes,
        } as StaffProfileUpdate);
      }
      profileModal.close();
      setSelectedProfile(null);
      setAdminNotes('');
      await loadProfiles();
      await loadMilestones();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save profile';
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await staffProfilesApi.delete(deleteConfirm.user_id);
      setDeleteConfirm(null);
      await loadProfiles();
    } catch {
      setError('Failed to delete profile');
    }
  };

  const handleCreateStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Validate required fields
      const requiredFields = {
        username: 'Username',
        name: 'Full Name',
        date_of_birth: 'Date of Birth',
        start_date: 'Start Date',
        job_title: 'Job Title',
        emergency_contact_name: 'Emergency Contact Name',
        emergency_contact_phone: 'Emergency Contact Phone',
      };

      const missingFields = Object.entries(requiredFields)
        .filter(([key]) => !staffMemberForm[key as keyof StaffMemberCreate])
        .map(([, label]) => label);

      if (missingFields.length > 0) {
        setError(`Required fields missing: ${missingFields.join(', ')}`);
        setIsSubmitting(false);
        return;
      }

      // Clean empty strings to undefined (Pydantic cannot parse empty strings as dates)
      const cleanedData = Object.fromEntries(
        Object.entries(staffMemberForm).map(([key, value]) => [
          key,
          value === '' ? undefined : value
        ])
      ) as StaffMemberCreate;

      const response = await staffProfilesApi.createWithUser(cleanedData);

      // If a contract was selected, request signature for the new staff member
      if (selectedContractId) {
        try {
          await contractsApi.requestSignature(selectedContractId, {
            user_id: response.profile.user_id,
            notes: 'Employment contract for new staff member',
          });
        } catch {
          // Contract signing is non-critical - don't fail the whole operation
          console.warn('Failed to request contract signature');
        }
      }

      setTempPassword(response.temporary_password);
      setShowCreateStaffMember(false);
      setStaffMemberForm(emptyStaffMemberForm);
      setSelectedContractId(null);
      await loadProfiles();
      await loadMilestones();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | Array<{ msg: string; loc?: string[] }> } } };
      const detail = error.response?.data?.detail;
      let errorMessage = 'Failed to create staff member';
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic validation errors come as an array of objects
        errorMessage = detail.map(e => e.msg).join(', ');
      }
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateStaffMemberField = <K extends keyof StaffMemberCreate>(
    field: K,
    value: StaffMemberCreate[K]
  ) => {
    setStaffMemberForm(prev => ({ ...prev, [field]: value }));
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatServiceYears = (startDate?: string) => {
    if (!startDate) return null;
    const start = new Date(startDate);
    const now = new Date();
    const years = Math.floor((now.getTime() - start.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (years < 1) return 'Less than 1 year';
    return `${years} year${years === 1 ? '' : 's'}`;
  };

  if (isLoading) {
    return (
      <div className="admin-page">
        <div className="ds-loading">
          <div className="ds-spinner"></div>
          <span>Loading staff profiles...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <PageActions>
        <h1>Staff Profiles</h1>
        <button
          className="ds-btn ds-btn-primary"
          onClick={() => setShowCreateStaffMember(true)}
        >
          Create Staff Member
        </button>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Upcoming Milestones */}
      {milestones?.has_upcoming && (
        <div className="milestones-banner">
          <h3>Upcoming Milestones</h3>
          <div className="milestones-list">
            {milestones.birthdays.map(m => (
              <div key={`birthday-${m.user_id}`} className="milestone-item birthday">
                <span className="milestone-icon">🎂</span>
                <span className="milestone-text">
                  <strong>{m.user_name}</strong> birthday
                  {m.days_until === 0 ? ' today!' : m.days_until === 1 ? ' tomorrow' : ` in ${m.days_until} days`}
                </span>
              </div>
            ))}
            {milestones.anniversaries.map(m => (
              <div key={`anniversary-${m.user_id}`} className="milestone-item anniversary">
                <span className="milestone-icon">🎉</span>
                <span className="milestone-text">
                  <strong>{m.user_name}</strong> {m.years} year{m.years === 1 ? '' : 's'} anniversary
                  {m.days_until === 0 ? ' today!' : m.days_until === 1 ? ' tomorrow' : ` in ${m.days_until} days`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Missing Payroll Data Warning */}
      {profiles.some(p => p.missing_payroll_fields.length > 0) && (
        <div className="ds-alert ds-alert-warning" style={{ marginBottom: 'var(--space-4)' }}>
          <strong>Missing Payroll Data:</strong> Some staff members are missing payroll information required for payment.
          <ul style={{ margin: 'var(--space-2) 0 0 var(--space-4)', padding: 0 }}>
            {profiles
              .filter(p => p.missing_payroll_fields.length > 0)
              .map(p => (
                <li key={p.id}>
                  <strong>{p.user_name}</strong>: {p.missing_payroll_fields.join(', ')}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Profiles Table */}
      <div className="ds-table-wrapper">
        <table className="ds-table ds-table-responsive">
          <thead>
            <tr>
              <th>Name</th>
              <th>Job Title</th>
              <th>Start Date</th>
              <th>Service</th>
              <th>DBS Check</th>
              <th>Payroll</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center">No staff profiles found</td>
              </tr>
            ) : (
              profiles.map(profile => (
                <tr key={profile.id}>
                  <td>
                    <strong>{profile.user_name}</strong>
                    {profile.is_yard_staff && (
                      <span className="ds-badge ds-badge-info" style={{ marginLeft: '0.5rem' }}>
                        Yard Staff
                      </span>
                    )}
                  </td>
                  <td>{profile.job_title || '—'}</td>
                  <td>{formatDate(profile.start_date)}</td>
                  <td>{formatServiceYears(profile.start_date) || '—'}</td>
                  <td>
                    {profile.has_dbs_check ? (
                      profile.dbs_expiring_soon ? (
                        <span className="ds-badge ds-badge-warning">Expiring Soon</span>
                      ) : (
                        <span className="ds-badge ds-badge-success">Valid</span>
                      )
                    ) : (
                      <span className="ds-badge ds-badge-secondary">None</span>
                    )}
                  </td>
                  <td>
                    {profile.missing_payroll_fields.length === 0 ? (
                      <span className="ds-badge ds-badge-success">Complete</span>
                    ) : (
                      <span
                        className="ds-badge ds-badge-warning"
                        title={`Missing: ${profile.missing_payroll_fields.join(', ')}`}
                      >
                        Incomplete
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="ds-btn ds-btn-sm ds-btn-secondary"
                        onClick={() => handleEditProfile(profile)}
                      >
                        Edit
                      </button>
                      <button
                        className="ds-btn ds-btn-sm ds-btn-danger"
                        onClick={() => setDeleteConfirm(profile)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={profileModal.isOpen}
        onClose={() => {
          profileModal.close();
          setSelectedProfile(null);
          setAdminNotes('');
        }}
        title={`Edit Profile: ${selectedProfile?.user_name}`}
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <h4 className="form-section-title">Employment Information</h4>
          <FormRow>
            <FormGroup label="Job Title">
              <Input
                value={profileModal.formData.job_title || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  job_title: e.target.value
                })}
                placeholder="e.g., Yard Manager, Groom"
              />
            </FormGroup>
            <FormGroup label="Start Date">
              <Input
                type="date"
                value={profileModal.formData.start_date || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  start_date: e.target.value
                })}
              />
            </FormGroup>
            <FormGroup label="Leaving Date">
              <Input
                type="date"
                value={(profileModal.formData as { leaving_date?: string }).leaving_date || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  leaving_date: e.target.value
                })}
              />
              <small className="form-help">Set when staff member is leaving (for pro-rata leave)</small>
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Employment Type">
              <select
                className="ds-select"
                value={(profileModal.formData as { staff_type?: string }).staff_type || 'regular'}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  staff_type: e.target.value
                })}
              >
                <option value="regular">Regular (contracted hours)</option>
                <option value="casual">Casual (as needed)</option>
                <option value="on_call">On-Call (emergencies only)</option>
              </select>
            </FormGroup>
            <FormGroup label="Annual Leave Entitlement (days)">
              <Input
                type="number"
                min={0}
                max={365}
                value={(profileModal.formData as { annual_leave_entitlement?: number }).annual_leave_entitlement ?? 23}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  annual_leave_entitlement: e.target.value ? parseInt(e.target.value) : undefined
                })}
                disabled={(profileModal.formData as { staff_type?: string }).staff_type !== 'regular'}
              />
              {(profileModal.formData as { staff_type?: string }).staff_type !== 'regular' && (
                <small className="form-help">Leave entitlement only applies to regular staff</small>
              )}
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Personal Information</h4>
          <FormRow>
            <FormGroup label="Date of Birth">
              <Input
                type="date"
                value={profileModal.formData.date_of_birth || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  date_of_birth: e.target.value
                })}
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Bio">
            <Textarea
              value={profileModal.formData.bio || ''}
              onChange={(e) => profileModal.setFormData({
                ...profileModal.formData,
                bio: e.target.value
              })}
              rows={3}
              placeholder="A short bio about this staff member..."
            />
          </FormGroup>

          <h4 className="form-section-title">Contact Details</h4>
          <FormRow>
            <FormGroup label="Personal Email">
              <Input
                type="email"
                value={profileModal.formData.personal_email || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  personal_email: e.target.value
                })}
                placeholder="Personal email address"
              />
            </FormGroup>
            <FormGroup label="Personal Phone">
              <Input
                value={profileModal.formData.personal_phone || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  personal_phone: e.target.value
                })}
                placeholder="Personal phone number"
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Street Address">
            <Input
              value={profileModal.formData.address_street || ''}
              onChange={(e) => profileModal.setFormData({
                ...profileModal.formData,
                address_street: e.target.value
              })}
            />
          </FormGroup>
          <FormRow>
            <FormGroup label="Town/City">
              <Input
                value={profileModal.formData.address_town || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  address_town: e.target.value
                })}
              />
            </FormGroup>
            <FormGroup label="County">
              <Input
                value={profileModal.formData.address_county || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  address_county: e.target.value
                })}
              />
            </FormGroup>
            <FormGroup label="Postcode">
              <Input
                value={profileModal.formData.address_postcode || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  address_postcode: e.target.value
                })}
              />
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Emergency Contact</h4>
          <FormRow>
            <FormGroup label="Name">
              <Input
                value={profileModal.formData.emergency_contact_name || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  emergency_contact_name: e.target.value
                })}
              />
            </FormGroup>
            <FormGroup label="Phone">
              <Input
                value={profileModal.formData.emergency_contact_phone || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  emergency_contact_phone: e.target.value
                })}
              />
            </FormGroup>
            <FormGroup label="Relationship">
              <Input
                value={profileModal.formData.emergency_contact_relationship || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  emergency_contact_relationship: e.target.value
                })}
                placeholder="e.g., Spouse, Parent"
              />
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Qualifications & Compliance</h4>
          <FormGroup label="Qualifications">
            <Textarea
              value={profileModal.formData.qualifications || ''}
              onChange={(e) => profileModal.setFormData({
                ...profileModal.formData,
                qualifications: e.target.value
              })}
              rows={2}
              placeholder="BHS Stage 2, First Aid at Work, Forklift License"
            />
            <small className="form-help">Enter qualifications separated by commas</small>
          </FormGroup>
          <FormRow>
            <FormGroup label="DBS Check Date">
              <Input
                type="date"
                value={profileModal.formData.dbs_check_date || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  dbs_check_date: e.target.value
                })}
              />
            </FormGroup>
            <FormGroup label="DBS Certificate Number">
              <Input
                value={profileModal.formData.dbs_certificate_number || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  dbs_certificate_number: e.target.value
                })}
              />
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Payroll Information</h4>

          {/* Hourly Rate with History */}
          <div className="rate-management-section">
            <FormRow>
              <FormGroup label="Current Hourly Rate (£)">
                <div className="rate-display">
                  <span className="current-rate">
                    £{((profileModal.formData as { hourly_rate?: number }).hourly_rate || 0).toFixed(2)}
                  </span>
                  <button
                    type="button"
                    className="ds-btn ds-btn-secondary ds-btn-sm"
                    onClick={() => profileModal.editingId && loadRateHistory(profileModal.editingId)}
                    disabled={rateHistoryLoading}
                  >
                    {rateHistoryLoading ? 'Loading...' : showRateHistory ? 'Hide History' : 'Manage Rates'}
                  </button>
                </div>
              </FormGroup>
            </FormRow>

            {showRateHistory && (
              <div className="rate-history-panel">
                <h5>Add New Rate</h5>
                <FormRow>
                  <FormGroup label="Hourly Rate (£)">
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={newRateForm.hourly_rate}
                      onChange={(e) => setNewRateForm({ ...newRateForm, hourly_rate: e.target.value })}
                      placeholder="e.g., 12.50"
                    />
                  </FormGroup>
                  <FormGroup label="Effective Date">
                    <Input
                      type="date"
                      value={newRateForm.effective_date}
                      onChange={(e) => setNewRateForm({ ...newRateForm, effective_date: e.target.value })}
                    />
                  </FormGroup>
                </FormRow>
                <FormGroup label="Notes (optional)">
                  <Input
                    value={newRateForm.notes}
                    onChange={(e) => setNewRateForm({ ...newRateForm, notes: e.target.value })}
                    placeholder="e.g., Annual review increase"
                  />
                </FormGroup>
                <button
                  type="button"
                  className="ds-btn ds-btn-primary ds-btn-sm"
                  onClick={handleAddRate}
                  disabled={isSubmitting || !newRateForm.hourly_rate}
                >
                  {isSubmitting ? 'Adding...' : 'Add Rate'}
                </button>

                {rateHistory.length > 0 && (
                  <>
                    <h5 style={{ marginTop: 'var(--space-4)' }}>Rate History</h5>
                    <div className="ds-table-wrapper">
                      <table className="ds-table ds-table-sm">
                        <thead>
                          <tr>
                            <th>Effective Date</th>
                            <th>Hourly Rate</th>
                            <th>Notes</th>
                            <th>Changed By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rateHistory.map((entry) => (
                            <tr key={entry.id}>
                              <td>{new Date(entry.effective_date).toLocaleDateString('en-GB')}</td>
                              <td>£{entry.hourly_rate.toFixed(2)}</td>
                              <td>{entry.notes || '-'}</td>
                              <td>{entry.created_by_name}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {rateHistory.length === 0 && (
                  <p className="empty-state-text">No rate history recorded yet.</p>
                )}
              </div>
            )}
          </div>

          <FormRow>
            <FormGroup label="National Insurance Number">
              <Input
                value={(profileModal.formData as { national_insurance_number?: string }).national_insurance_number || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  national_insurance_number: e.target.value.toUpperCase()
                })}
                placeholder="e.g., AB123456C"
                maxLength={13}
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Bank Account Name">
            <Input
              value={(profileModal.formData as { bank_account_name?: string }).bank_account_name || ''}
              onChange={(e) => profileModal.setFormData({
                ...profileModal.formData,
                bank_account_name: e.target.value
              })}
              placeholder="Name as shown on bank account"
            />
          </FormGroup>
          <FormRow>
            <FormGroup label="Sort Code">
              <Input
                value={(profileModal.formData as { bank_sort_code?: string }).bank_sort_code || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  bank_sort_code: e.target.value
                })}
                placeholder="e.g., 12-34-56"
                maxLength={8}
              />
            </FormGroup>
            <FormGroup label="Account Number">
              <Input
                value={(profileModal.formData as { bank_account_number?: string }).bank_account_number || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  bank_account_number: e.target.value
                })}
                placeholder="8 digit account number"
                maxLength={8}
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Tax Code">
              <Input
                value={(profileModal.formData as { tax_code?: string }).tax_code || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  tax_code: e.target.value.toUpperCase()
                })}
                placeholder="e.g., 1257L, BR, 0T"
              />
              <small className="form-help">Leave blank if unknown</small>
            </FormGroup>
            <FormGroup label="Student Loan Plan">
              <select
                className="ds-select"
                value={(profileModal.formData as { student_loan_plan?: string }).student_loan_plan || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  student_loan_plan: e.target.value
                })}
              >
                <option value="">None / Not applicable</option>
                <option value="plan_1">Plan 1 (pre-2012)</option>
                <option value="plan_2">Plan 2 (post-2012)</option>
                <option value="plan_4">Plan 4 (Scotland)</option>
                <option value="postgrad">Postgraduate Loan</option>
              </select>
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">P45 Information (Previous Employer)</h4>
          <FormRow>
            <FormGroup label="Date Left Previous Employer">
              <Input
                type="date"
                value={(profileModal.formData as { p45_date_left_previous?: string }).p45_date_left_previous || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  p45_date_left_previous: e.target.value
                })}
              />
            </FormGroup>
            <FormGroup label="Tax Paid to Date (£)">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={(profileModal.formData as { p45_tax_paid_previous?: number }).p45_tax_paid_previous || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  p45_tax_paid_previous: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                placeholder="From P45"
              />
            </FormGroup>
            <FormGroup label="Pay to Date (£)">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={(profileModal.formData as { p45_pay_to_date_previous?: number }).p45_pay_to_date_previous || ''}
                onChange={(e) => profileModal.setFormData({
                  ...profileModal.formData,
                  p45_pay_to_date_previous: e.target.value ? parseFloat(e.target.value) : undefined
                })}
                placeholder="From P45"
              />
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Admin Notes</h4>
          <FormGroup label="Notes (Admin Only)">
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes about this staff member..."
            />
          </FormGroup>

          <div className="modal-actions">
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={() => {
                profileModal.close();
                setSelectedProfile(null);
                setAdminNotes('');
              }}
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
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDelete}
        title="Delete Staff Profile"
        message={`Are you sure you want to delete the profile for ${deleteConfirm?.user_name}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />

      {/* Create Staff Member Modal */}
      <Modal
        isOpen={showCreateStaffMember}
        onClose={() => {
          setShowCreateStaffMember(false);
          setStaffMemberForm(emptyStaffMemberForm);
          setSelectedContractId(null);
        }}
        title="Create Staff Member"
        size="lg"
      >
        <form onSubmit={handleCreateStaffMember}>
          <p className="modal-subtitle">
            Create a new user account with staff role and complete their profile in one step.
          </p>

          <h4 className="form-section-title">Account Details</h4>
          <FormRow>
            <FormGroup label="Username" required>
              <Input
                value={staffMemberForm.username}
                onChange={(e) => updateStaffMemberField('username', e.target.value)}
                placeholder="e.g., jsmith"
                required
              />
            </FormGroup>
            <FormGroup label="Full Name" required>
              <Input
                value={staffMemberForm.name}
                onChange={(e) => updateStaffMemberField('name', e.target.value)}
                placeholder="e.g., John Smith"
                required
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Email">
              <Input
                type="email"
                value={staffMemberForm.email || ''}
                onChange={(e) => updateStaffMemberField('email', e.target.value)}
                placeholder="Work email address"
              />
            </FormGroup>
            <FormGroup label="Phone">
              <Input
                value={staffMemberForm.phone || ''}
                onChange={(e) => updateStaffMemberField('phone', e.target.value)}
                placeholder="Work phone number"
              />
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Employment Information</h4>
          <FormRow>
            <FormGroup label="Job Title" required>
              <Input
                value={staffMemberForm.job_title || ''}
                onChange={(e) => updateStaffMemberField('job_title', e.target.value)}
                placeholder="e.g., Yard Manager, Groom"
                required
              />
            </FormGroup>
            <FormGroup label="Start Date" required>
              <Input
                type="date"
                value={staffMemberForm.start_date || ''}
                onChange={(e) => updateStaffMemberField('start_date', e.target.value)}
                required
              />
            </FormGroup>
          </FormRow>
          <FormRow>
            <FormGroup label="Employment Type">
              <select
                className="ds-select"
                value={staffMemberForm.staff_type || 'regular'}
                onChange={(e) => updateStaffMemberField('staff_type', e.target.value)}
              >
                <option value="regular">Regular (contracted hours)</option>
                <option value="casual">Casual (as needed)</option>
                <option value="on_call">On-Call (emergencies only)</option>
              </select>
            </FormGroup>
            <FormGroup label="Annual Leave Entitlement (days)">
              <Input
                type="number"
                min={0}
                max={365}
                value={staffMemberForm.annual_leave_entitlement ?? 23}
                onChange={(e) => updateStaffMemberField('annual_leave_entitlement', e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={staffMemberForm.staff_type !== 'regular'}
              />
              {staffMemberForm.staff_type !== 'regular' && (
                <small className="form-help">Leave entitlement only applies to regular staff</small>
              )}
            </FormGroup>
          </FormRow>

          {employmentContracts.length > 0 && (
            <FormGroup label="Employment Contract">
              <Select
                value={selectedContractId?.toString() || ''}
                onChange={(e) => setSelectedContractId(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">-- No contract (assign later) --</option>
                {employmentContracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.name}
                  </option>
                ))}
              </Select>
              <small className="form-help">
                If selected, a contract will be sent to this staff member for signature
              </small>
            </FormGroup>
          )}

          <h4 className="form-section-title">Personal Information</h4>
          <FormRow>
            <FormGroup label="Date of Birth" required>
              <Input
                type="date"
                value={staffMemberForm.date_of_birth || ''}
                onChange={(e) => updateStaffMemberField('date_of_birth', e.target.value)}
                required
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Bio">
            <Textarea
              value={staffMemberForm.bio || ''}
              onChange={(e) => updateStaffMemberField('bio', e.target.value)}
              rows={3}
              placeholder="A short bio about this staff member..."
            />
          </FormGroup>

          <h4 className="form-section-title">Personal Contact Details</h4>
          <FormRow>
            <FormGroup label="Personal Email">
              <Input
                type="email"
                value={staffMemberForm.personal_email || ''}
                onChange={(e) => updateStaffMemberField('personal_email', e.target.value)}
                placeholder="Personal email address"
              />
            </FormGroup>
            <FormGroup label="Personal Phone">
              <Input
                value={staffMemberForm.personal_phone || ''}
                onChange={(e) => updateStaffMemberField('personal_phone', e.target.value)}
                placeholder="Personal phone number"
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Street Address">
            <Input
              value={staffMemberForm.address_street || ''}
              onChange={(e) => updateStaffMemberField('address_street', e.target.value)}
            />
          </FormGroup>
          <FormRow>
            <FormGroup label="Town/City">
              <Input
                value={staffMemberForm.address_town || ''}
                onChange={(e) => updateStaffMemberField('address_town', e.target.value)}
              />
            </FormGroup>
            <FormGroup label="County">
              <Input
                value={staffMemberForm.address_county || ''}
                onChange={(e) => updateStaffMemberField('address_county', e.target.value)}
              />
            </FormGroup>
            <FormGroup label="Postcode">
              <Input
                value={staffMemberForm.address_postcode || ''}
                onChange={(e) => updateStaffMemberField('address_postcode', e.target.value)}
              />
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Emergency Contact</h4>
          <FormRow>
            <FormGroup label="Name" required>
              <Input
                value={staffMemberForm.emergency_contact_name || ''}
                onChange={(e) => updateStaffMemberField('emergency_contact_name', e.target.value)}
                required
              />
            </FormGroup>
            <FormGroup label="Phone" required>
              <Input
                value={staffMemberForm.emergency_contact_phone || ''}
                onChange={(e) => updateStaffMemberField('emergency_contact_phone', e.target.value)}
                required
              />
            </FormGroup>
            <FormGroup label="Relationship">
              <Input
                value={staffMemberForm.emergency_contact_relationship || ''}
                onChange={(e) => updateStaffMemberField('emergency_contact_relationship', e.target.value)}
                placeholder="e.g., Spouse, Parent"
              />
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Payroll Information</h4>
          <FormRow>
            <FormGroup label="National Insurance Number">
              <Input
                value={staffMemberForm.national_insurance_number || ''}
                onChange={(e) => updateStaffMemberField('national_insurance_number', e.target.value.toUpperCase())}
                placeholder="e.g., AB123456C"
                maxLength={13}
              />
            </FormGroup>
            <FormGroup label="Hourly Rate (£)">
              <Input
                type="number"
                min={0}
                step={0.01}
                value={staffMemberForm.hourly_rate || ''}
                onChange={(e) => updateStaffMemberField('hourly_rate', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g., 12.50"
              />
            </FormGroup>
          </FormRow>

          <FormGroup label="Bank Account Name">
            <Input
              value={staffMemberForm.bank_account_name || ''}
              onChange={(e) => updateStaffMemberField('bank_account_name', e.target.value)}
              placeholder="Name as shown on bank account"
            />
          </FormGroup>
          <FormRow>
            <FormGroup label="Sort Code">
              <Input
                value={staffMemberForm.bank_sort_code || ''}
                onChange={(e) => updateStaffMemberField('bank_sort_code', e.target.value)}
                placeholder="e.g., 12-34-56"
                maxLength={8}
              />
            </FormGroup>
            <FormGroup label="Account Number">
              <Input
                value={staffMemberForm.bank_account_number || ''}
                onChange={(e) => updateStaffMemberField('bank_account_number', e.target.value)}
                placeholder="8 digit account number"
                maxLength={8}
              />
            </FormGroup>
          </FormRow>

          <FormRow>
            <FormGroup label="Tax Code">
              <Input
                value={staffMemberForm.tax_code || ''}
                onChange={(e) => updateStaffMemberField('tax_code', e.target.value.toUpperCase())}
                placeholder="e.g., 1257L, BR, 0T"
              />
              <small className="form-help">Leave blank if unknown - accountant will use emergency tax code</small>
            </FormGroup>
            <FormGroup label="Student Loan Plan">
              <select
                className="ds-select"
                value={staffMemberForm.student_loan_plan || ''}
                onChange={(e) => updateStaffMemberField('student_loan_plan', e.target.value)}
              >
                <option value="">None / Not applicable</option>
                <option value="plan_1">Plan 1 (pre-2012)</option>
                <option value="plan_2">Plan 2 (post-2012)</option>
                <option value="plan_4">Plan 4 (Scotland)</option>
                <option value="postgrad">Postgraduate Loan</option>
              </select>
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Qualifications & Compliance</h4>
          <FormGroup label="Qualifications">
            <Textarea
              value={staffMemberForm.qualifications || ''}
              onChange={(e) => updateStaffMemberField('qualifications', e.target.value)}
              rows={2}
              placeholder="BHS Stage 2, First Aid at Work, Forklift License"
            />
            <small className="form-help">Enter qualifications separated by commas</small>
          </FormGroup>
          <FormRow>
            <FormGroup label="DBS Check Date">
              <Input
                type="date"
                value={staffMemberForm.dbs_check_date || ''}
                onChange={(e) => updateStaffMemberField('dbs_check_date', e.target.value)}
              />
            </FormGroup>
            <FormGroup label="DBS Certificate Number">
              <Input
                value={staffMemberForm.dbs_certificate_number || ''}
                onChange={(e) => updateStaffMemberField('dbs_certificate_number', e.target.value)}
              />
            </FormGroup>
          </FormRow>

          <h4 className="form-section-title">Admin Notes</h4>
          <FormGroup label="Notes (Admin Only)">
            <Textarea
              value={staffMemberForm.notes || ''}
              onChange={(e) => updateStaffMemberField('notes', e.target.value)}
              rows={3}
              placeholder="Internal notes about this staff member..."
            />
          </FormGroup>

          <div className="modal-actions">
            <button
              type="button"
              className="ds-btn ds-btn-secondary"
              onClick={() => {
                setShowCreateStaffMember(false);
                setStaffMemberForm(emptyStaffMemberForm);
                setSelectedContractId(null);
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ds-btn ds-btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Temporary Password Display Modal */}
      <Modal
        isOpen={!!tempPassword}
        onClose={() => setTempPassword(null)}
        title="Staff Member Created"
        size="sm"
      >
        <div className="ds-alert ds-alert-success" style={{ marginBottom: 'var(--space-4)' }}>
          Staff member created successfully!
        </div>

        <p>Please provide the following temporary password to the new staff member:</p>

        <div className="temp-password-display">
          <code>{tempPassword}</code>
        </div>

        <p className="text-muted" style={{ fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-3)' }}>
          The staff member will be prompted to change this password on their first login.
        </p>

        <div className="modal-actions">
          <button
            className="ds-btn ds-btn-primary"
            onClick={() => setTempPassword(null)}
          >
            Done
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default AdminStaffProfiles;
