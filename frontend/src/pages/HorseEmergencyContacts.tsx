import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { horsesApi, healthRecordsApi } from '../services/api';
import type { Horse, EmergencyContact, EmergencyContactCreate, ContactType } from '../types';
import '../styles/HorseEmergencyContacts.css';

const contactTypeLabels: Record<ContactType, string> = {
  vet: 'Veterinarian',
  vet_backup: 'Backup Vet',
  farrier: 'Farrier',
  farrier_backup: 'Backup Farrier',
  owner_backup: 'Backup Owner Contact',
  insurance: 'Insurance',
  other: 'Other',
};

const contactTypeOrder: ContactType[] = ['vet', 'vet_backup', 'farrier', 'farrier_backup', 'owner_backup', 'insurance', 'other'];

export default function HorseEmergencyContacts() {
  const { horseId } = useParams<{ horseId: string }>();
  const navigate = useNavigate();
  const [horse, setHorse] = useState<Horse | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<EmergencyContactCreate>({
    contact_type: 'vet',
    name: '',
    phone: '',
    is_primary: false,
  });

  useEffect(() => {
    if (horseId) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [horseId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [horseData, contactsData] = await Promise.all([
        horsesApi.get(Number(horseId)),
        healthRecordsApi.listEmergencyContacts(Number(horseId)),
      ]);
      setHorse(horseData);
      setContacts(contactsData);
      setError('');
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;

    try {
      setSaving(true);
      if (editingContact) {
        await healthRecordsApi.updateEmergencyContact(Number(horseId), editingContact.id, formData);
      } else {
        await healthRecordsApi.createEmergencyContact(Number(horseId), formData);
      }
      await loadData();
      closeModal();
    } catch (err) {
      setError('Failed to save contact');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contactId: number) => {
    if (!horseId || !confirm('Are you sure you want to delete this contact?')) return;

    try {
      await healthRecordsApi.deleteEmergencyContact(Number(horseId), contactId);
      await loadData();
    } catch (err) {
      setError('Failed to delete contact');
      console.error(err);
    }
  };

  const handleSetPrimary = async (contactId: number) => {
    if (!horseId) return;

    try {
      await healthRecordsApi.setEmergencyContactPrimary(Number(horseId), contactId);
      await loadData();
    } catch (err) {
      setError('Failed to set primary contact');
      console.error(err);
    }
  };

  const openAddModal = () => {
    setEditingContact(null);
    setFormData({
      contact_type: 'vet',
      name: '',
      phone: '',
      is_primary: false,
    });
    setShowModal(true);
  };

  const openEditModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setFormData({
      contact_type: contact.contact_type,
      name: contact.name,
      phone: contact.phone,
      phone_alt: contact.phone_alt,
      email: contact.email,
      practice_name: contact.practice_name,
      address: contact.address,
      available_24h: contact.available_24h,
      availability_notes: contact.availability_notes,
      is_primary: contact.is_primary,
      notes: contact.notes,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingContact(null);
    setFormData({
      contact_type: 'vet',
      name: '',
      phone: '',
      is_primary: false,
    });
  };

  // Group contacts by type
  const groupedContacts = contactTypeOrder.reduce((acc, type) => {
    const typeContacts = contacts.filter(c => c.contact_type === type);
    if (typeContacts.length > 0) {
      acc[type] = typeContacts;
    }
    return acc;
  }, {} as Record<ContactType, EmergencyContact[]>);

  if (loading) {
    return (
      <div className="emergency-contacts-page">
        <div className="ds-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="emergency-contacts-page">
      <header className="page-header">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate(-1)}>
            &larr; Back
          </button>
          <div>
            <h1>Emergency Contacts</h1>
            {horse && <p className="subtitle">For {horse.name}</p>}
          </div>
        </div>
        <button className="btn-add" onClick={openAddModal}>
          + Add Contact
        </button>
      </header>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {contacts.length === 0 ? (
        <div className="ds-empty">
          <p>No emergency contacts added yet.</p>
          <p>Add vet, farrier, and other important contacts for quick access in emergencies.</p>
          <button className="ds-btn ds-btn-primary" onClick={openAddModal}>
            Add First Contact
          </button>
        </div>
      ) : (
        <div className="contacts-grid">
          {Object.entries(groupedContacts).map(([type, typeContacts]) => (
            <div key={type} className="contact-group">
              <h2 className="group-title">{contactTypeLabels[type as ContactType]}</h2>
              {typeContacts.map(contact => (
                <div key={contact.id} className={`contact-card ${contact.is_primary ? 'primary' : ''}`}>
                  {contact.is_primary && <span className="primary-badge">Primary</span>}

                  <div className="contact-name">{contact.name}</div>
                  {contact.practice_name && (
                    <div className="practice-name">{contact.practice_name}</div>
                  )}

                  <div className="contact-details">
                    <div className="detail-row">
                      <span className="icon">📞</span>
                      <a href={`tel:${contact.phone}`} className="phone-link">{contact.phone}</a>
                    </div>
                    {contact.phone_alt && (
                      <div className="detail-row">
                        <span className="icon">📞</span>
                        <a href={`tel:${contact.phone_alt}`} className="phone-link">{contact.phone_alt}</a>
                      </div>
                    )}
                    {contact.email && (
                      <div className="detail-row">
                        <span className="icon">✉️</span>
                        <a href={`mailto:${contact.email}`}>{contact.email}</a>
                      </div>
                    )}
                    {contact.address && (
                      <div className="detail-row address">
                        <span className="icon">📍</span>
                        <span>{contact.address}</span>
                      </div>
                    )}
                  </div>

                  {contact.available_24h && (
                    <div className="availability available-24h">24/7 Available</div>
                  )}
                  {contact.availability_notes && (
                    <div className="availability-notes">{contact.availability_notes}</div>
                  )}
                  {contact.notes && (
                    <div className="contact-notes">{contact.notes}</div>
                  )}

                  <div className="contact-actions">
                    {!contact.is_primary && (
                      <button
                        className="btn-small"
                        onClick={() => handleSetPrimary(contact.id)}
                        title="Set as primary contact for this type"
                      >
                        Set Primary
                      </button>
                    )}
                    <button className="btn-small" onClick={() => openEditModal(contact)}>
                      Edit
                    </button>
                    <button className="btn-small danger" onClick={() => handleDelete(contact.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="ds-modal-overlay" onClick={closeModal}>
          <div className="ds-modal" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>{editingContact ? 'Edit Contact' : 'Add Emergency Contact'}</h2>
              <button className="ds-modal-close" onClick={closeModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="ds-modal-body">
                <div className="ds-form-group">
                  <label>Contact Type *</label>
                  <select
                    value={formData.contact_type}
                    onChange={e => setFormData({ ...formData, contact_type: e.target.value as ContactType })}
                    required
                  >
                    {contactTypeOrder.map(type => (
                      <option key={type} value={type}>{contactTypeLabels[type]}</option>
                    ))}
                  </select>
                </div>

                <div className="ds-form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    required
                    placeholder="Contact name"
                  />
                </div>

                {(formData.contact_type === 'vet' || formData.contact_type === 'vet_backup' || formData.contact_type === 'farrier') && (
                  <div className="ds-form-group">
                    <label>Practice/Business Name</label>
                    <input
                      type="text"
                      value={formData.practice_name || ''}
                      onChange={e => setFormData({ ...formData, practice_name: e.target.value })}
                      placeholder="e.g., XYZ Veterinary Clinic"
                    />
                  </div>
                )}

                <div className="form-row">
                  <div className="ds-form-group">
                    <label>Phone *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                      required
                      placeholder="Primary phone"
                    />
                  </div>
                  <div className="ds-form-group">
                    <label>Alt Phone</label>
                    <input
                      type="tel"
                      value={formData.phone_alt || ''}
                      onChange={e => setFormData({ ...formData, phone_alt: e.target.value })}
                      placeholder="Alternative phone"
                    />
                  </div>
                </div>

                <div className="ds-form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={formData.email || ''}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>

                <div className="ds-form-group">
                  <label>Address</label>
                  <textarea
                    value={formData.address || ''}
                    onChange={e => setFormData({ ...formData, address: e.target.value })}
                    placeholder="Full address"
                    rows={2}
                  />
                </div>

                <div className="form-row">
                  <div className="ds-form-group checkbox-group">
                    <input
                      type="checkbox"
                      id="available24h"
                      checked={formData.available_24h || false}
                      onChange={e => setFormData({ ...formData, available_24h: e.target.checked })}
                    />
                    <label htmlFor="available24h">Available 24/7</label>
                  </div>
                  <div className="ds-form-group checkbox-group">
                    <input
                      type="checkbox"
                      id="isPrimary"
                      checked={formData.is_primary}
                      onChange={e => setFormData({ ...formData, is_primary: e.target.checked })}
                    />
                    <label htmlFor="isPrimary">Primary for this type</label>
                  </div>
                </div>

                <div className="ds-form-group">
                  <label>Availability Notes</label>
                  <input
                    type="text"
                    value={formData.availability_notes || ''}
                    onChange={e => setFormData({ ...formData, availability_notes: e.target.value })}
                    placeholder="e.g., Mon-Fri 9am-5pm"
                  />
                </div>

                <div className="ds-form-group">
                  <label>Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Additional notes"
                    rows={2}
                  />
                </div>
              </div>

              <div className="ds-modal-footer">
                <button type="button" className="btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit" disabled={saving}>
                  {saving ? 'Saving...' : editingContact ? 'Update' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
