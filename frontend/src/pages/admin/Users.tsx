import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usersApi, AdminUserCreate } from '../../services/api';
import { useRequestState } from '../../hooks';
import { ConfirmModal } from '../../components/ui';
import type { User, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { validateEmail, validatePhone } from '../../utils/validation';
import { PageActions } from '../../components/admin';
import './Admin.css';

interface EditUserData {
  email: string;
  name: string;
  phone: string;
  address_street: string;
  address_town: string;
  address_county: string;
  address_postcode: string;
}

export function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [formData, setFormData] = useState<AdminUserCreate>({
    username: '',
    email: '',
    name: '',
    phone: '',
    role: 'livery',
  });

  // Request state
  const { loading: isLoading, error, success, setError, setSuccess, setLoading } = useRequestState(true);

  // Confirmation states
  const [resetPasswordTarget, setResetPasswordTarget] = useState<User | null>(null);
  const [toggleActiveTarget, setToggleActiveTarget] = useState<User | null>(null);

  // Edit user state
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editData, setEditData] = useState<EditUserData>({
    email: '',
    name: '',
    phone: '',
    address_street: '',
    address_town: '',
    address_county: '',
    address_postcode: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const data = await usersApi.list();
      setUsers(data);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const [resetPasswordResult, setResetPasswordResult] = useState<{ userId: number; password: string } | null>(null);

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    try {
      await usersApi.updateRole(userId, newRole);
      await loadUsers();
    } catch {
      setError('Failed to update user role');
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordTarget) return;
    try {
      const result = await usersApi.resetPassword(resetPasswordTarget.id);
      setResetPasswordResult({ userId: resetPasswordTarget.id, password: result.temporary_password });
      setResetPasswordTarget(null);
      setError('');
    } catch {
      setError('Failed to reset password');
    }
  };

  const handleToggleActive = async () => {
    if (!toggleActiveTarget) return;
    const action = toggleActiveTarget.is_active ? 'disable' : 'enable';
    try {
      await usersApi.toggleActive(toggleActiveTarget.id);
      setToggleActiveTarget(null);
      await loadUsers();
      setError('');
    } catch {
      setError(`Failed to ${action} user`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTempPassword('');

    // Coach accounts require email and phone for clinic requests
    if (formData.role === 'coach') {
      if (!formData.email) {
        setError('Email is required for coach accounts (used in clinic requests)');
        return;
      }
      if (!formData.phone) {
        setError('Phone is required for coach accounts (used in clinic requests)');
        return;
      }
    }

    // Validate email format if provided
    if (formData.email) {
      const emailResult = validateEmail(formData.email);
      if (!emailResult.isValid) {
        setError(emailResult.message || 'Invalid email');
        return;
      }
    }

    // Validate phone format if provided
    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.isValid) {
        setError(phoneResult.message || 'Invalid phone number');
        return;
      }
    }

    try {
      const result = await usersApi.create(formData);
      setTempPassword(result.temporary_password);
      setSuccess(`User "${result.user.name}" created successfully!`);
      setFormData({ username: '', email: '', name: '', phone: '', role: 'livery' });
      await loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | Array<{ msg: string; loc?: string[] }> } } };
      const detail = error.response?.data?.detail;
      let errorMessage = 'Failed to create user';
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic validation errors come as an array of objects
        errorMessage = detail.map(e => e.msg).join(', ');
      }
      setError(errorMessage);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setFormData({ username: '', email: '', name: '', phone: '', role: 'livery' });
    setTempPassword('');
    setSuccess('');
  };

  // Edit user handlers
  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setEditData({
      email: user.email || '',
      name: user.name,
      phone: user.phone || '',
      address_street: user.address_street || '',
      address_town: user.address_town || '',
      address_county: user.address_county || '',
      address_postcode: user.address_postcode || '',
    });
    setError('');
    setSuccess('');
  };

  const handleEditCancel = () => {
    setEditingUser(null);
    setEditData({
      email: '',
      name: '',
      phone: '',
      address_street: '',
      address_town: '',
      address_county: '',
      address_postcode: '',
    });
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setError('');

    // Validate email format if provided
    if (editData.email) {
      const emailResult = validateEmail(editData.email);
      if (!emailResult.isValid) {
        setError(emailResult.message || 'Invalid email');
        return;
      }
    }

    // Validate phone format if provided
    if (editData.phone) {
      const phoneResult = validatePhone(editData.phone);
      if (!phoneResult.isValid) {
        setError(phoneResult.message || 'Invalid phone number');
        return;
      }
    }

    setIsSaving(true);

    try {
      await usersApi.update(editingUser.id, {
        email: editData.email || undefined,
        name: editData.name,
        phone: editData.phone || undefined,
        address_street: editData.address_street || undefined,
        address_town: editData.address_town || undefined,
        address_county: editData.address_county || undefined,
        address_postcode: editData.address_postcode || undefined,
      });
      setSuccess(`User "${editData.name}" updated successfully!`);
      setEditingUser(null);
      await loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string | Array<{ msg: string; loc?: string[] }> } } };
      const detail = error.response?.data?.detail;
      let errorMessage = 'Failed to update user';
      if (typeof detail === 'string') {
        errorMessage = detail;
      } else if (Array.isArray(detail) && detail.length > 0) {
        // Pydantic validation errors come as an array of objects
        errorMessage = detail.map(e => e.msg).join(', ');
      }
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="admin-page">
      <PageActions>
        <div className="action-buttons">
          <button className="ds-btn ds-btn-primary" onClick={() => setShowForm(true)}>
            + Add User
          </button>
          <Link to="/book/admin/staff-profiles" className="ds-btn ds-btn-secondary">
            Create Staff Member
          </Link>
        </div>
      </PageActions>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && !showForm && !editingUser && <div className="success-message">{success}</div>}

      {/* Create User Form */}
      {showForm && (
        <div className="admin-form-container">
          <form onSubmit={handleSubmit} className="admin-form">
            <h2>Add New User</h2>
            <p className="form-description">
              Create a new staff or livery user. They will receive a temporary password
              and be required to change it on first login.
            </p>

            {success && (
              <div className="success-message">
                {success}
                {tempPassword && (
                  <div className="temp-password-box">
                    <strong>Temporary Password:</strong>
                    <code>{tempPassword}</code>
                    <small>Please share this securely with the user. They will need to change it on first login.</small>
                  </div>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="username">Username *</label>
                <input
                  id="username"
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g., jsmith"
                  required
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="role">Role *</label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                >
                  <option value="livery">Livery (Livery Client)</option>
                  <option value="coach">Coach (Can propose clinics)</option>
                  <option value="admin">Admin (Full access)</option>
                </select>
                <small className="field-hint">
                  To create staff users, use <Link to="/book/admin/staff-profiles">Staff Profiles</Link>
                </small>
              </div>
            </div>

            <div className="ds-form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., John Smith"
                required
              />
            </div>

            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="email">
                  Email {formData.role === 'coach' && <span className="required">*</span>}
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value || undefined })}
                  placeholder="e.g., john@example.com"
                  required={formData.role === 'coach'}
                />
                {formData.role === 'coach' && (
                  <small className="field-hint">Required for clinic requests</small>
                )}
              </div>

              <div className="ds-form-group">
                <label htmlFor="phone">
                  Phone {formData.role === 'coach' && <span className="required">*</span>}
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value || undefined })}
                  placeholder="e.g., 07700 900000"
                  required={formData.role === 'coach'}
                />
                {formData.role === 'coach' && (
                  <small className="field-hint">Required for clinic requests</small>
                )}
              </div>
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleCancel} className="ds-btn ds-btn-secondary">
                {tempPassword ? 'Done' : 'Cancel'}
              </button>
              {!tempPassword && (
                <button type="submit" className="ds-btn ds-btn-primary">
                  Create User
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Edit User Form */}
      {editingUser && (
        <div className="admin-form-container">
          <form onSubmit={handleEditSave} className="admin-form">
            <h2>Edit User: {editingUser.username}</h2>
            <p className="form-description">
              Update user details. Username and role cannot be changed here.
            </p>

            <div className="ds-form-group">
              <label htmlFor="edit-name">Full Name *</label>
              <input
                id="edit-name"
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                placeholder="e.g., John Smith"
                required
              />
            </div>

            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  placeholder="e.g., john@example.com"
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="edit-phone">Phone</label>
                <input
                  id="edit-phone"
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  placeholder="e.g., 07700 900000"
                />
              </div>
            </div>

            <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem', fontSize: '1rem' }}>Address</h3>

            <div className="ds-form-group">
              <label htmlFor="edit-address-street">Street Address</label>
              <input
                id="edit-address-street"
                type="text"
                value={editData.address_street}
                onChange={(e) => setEditData({ ...editData, address_street: e.target.value })}
                placeholder="e.g., 123 High Street"
              />
            </div>

            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="edit-address-town">Town / City</label>
                <input
                  id="edit-address-town"
                  type="text"
                  value={editData.address_town}
                  onChange={(e) => setEditData({ ...editData, address_town: e.target.value })}
                  placeholder="e.g., Manchester"
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="edit-address-county">County</label>
                <input
                  id="edit-address-county"
                  type="text"
                  value={editData.address_county}
                  onChange={(e) => setEditData({ ...editData, address_county: e.target.value })}
                  placeholder="e.g., Greater Manchester"
                />
              </div>
            </div>

            <div className="ds-form-group" style={{ maxWidth: '200px' }}>
              <label htmlFor="edit-address-postcode">Postcode</label>
              <input
                id="edit-address-postcode"
                type="text"
                value={editData.address_postcode}
                onChange={(e) => setEditData({ ...editData, address_postcode: e.target.value.toUpperCase() })}
                placeholder="e.g., M1 1AA"
              />
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleEditCancel} className="ds-btn ds-btn-secondary">
                Cancel
              </button>
              <button type="submit" className="ds-btn ds-btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {resetPasswordResult && (
        <div className="password-reset-banner">
          <strong>Password Reset Successful</strong>
          <p>New temporary password for user:</p>
          <code>{resetPasswordResult.password}</code>
          <small>Please share this securely. They will need to change it on first login.</small>
          <button onClick={() => setResetPasswordResult(null)} className="btn-small">
            Dismiss
          </button>
        </div>
      )}

      <table className="admin-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className={!user.is_active ? 'disabled-user' : ''}>
              <td><strong>{user.username}</strong></td>
              <td>{user.name}</td>
              <td>{user.email || '-'}</td>
              <td>{user.phone || '-'}</td>
              <td>
                {user.id !== currentUser?.id ? (
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                    className="role-select"
                  >
                    <option value="public">Public</option>
                    <option value="livery">Livery</option>
                    <option value="staff">Staff</option>
                    <option value="coach">Coach</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span className={`badge ${user.role}`}>{user.role}</span>
                )}
              </td>
              <td>
                <span className={`ds-badge ${user.is_active ? 'ds-badge-success' : 'ds-badge-error'}`}>
                  {user.is_active ? 'Active' : 'Disabled'}
                </span>
              </td>
              <td className="actions-cell">
                <button
                  className="btn-small"
                  onClick={() => handleEditClick(user)}
                >
                  Edit
                </button>
                {user.id !== currentUser?.id ? (
                  <>
                    <button
                      className="btn-small"
                      onClick={() => setResetPasswordTarget(user)}
                    >
                      Reset PW
                    </button>
                    <button
                      className={`btn-small ${user.is_active ? 'btn-danger' : 'btn-success'}`}
                      onClick={() => setToggleActiveTarget(user)}
                    >
                      {user.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </>
                ) : (
                  <span className="current-user-badge">You</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Reset Password Confirmation */}
      <ConfirmModal
        isOpen={!!resetPasswordTarget}
        onClose={() => setResetPasswordTarget(null)}
        onConfirm={handleResetPassword}
        title="Reset Password"
        message={`Reset password for "${resetPasswordTarget?.name}"? They will need to change it on next login.`}
        confirmLabel="Reset Password"
        variant="primary"
      />

      {/* Toggle Active Confirmation */}
      <ConfirmModal
        isOpen={!!toggleActiveTarget}
        onClose={() => setToggleActiveTarget(null)}
        onConfirm={handleToggleActive}
        title={toggleActiveTarget?.is_active ? 'Disable Account' : 'Enable Account'}
        message={`Are you sure you want to ${toggleActiveTarget?.is_active ? 'disable' : 'enable'} "${toggleActiveTarget?.name}"'s account?`}
        confirmLabel={toggleActiveTarget?.is_active ? 'Disable' : 'Enable'}
        variant={toggleActiveTarget?.is_active ? 'danger' : 'primary'}
      />
    </div>
  );
}
