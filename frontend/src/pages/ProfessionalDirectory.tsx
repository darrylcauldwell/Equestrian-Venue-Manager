import { useState, useEffect, useCallback } from 'react';
import { professionalsApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { validateEmail, validatePhone } from '../utils/validation';
import type { Professional, ProfessionalCategoryInfo, ProfessionalCategory, CreateProfessional } from '../types';
import './ProfessionalDirectory.css';

const CATEGORY_LABELS: Record<string, string> = {
  farrier: 'Farrier',
  vet: 'Veterinarian',
  dentist: 'Equine Dentist',
  physio: 'Physiotherapist',
  chiropractor: 'Chiropractor',
  saddler: 'Saddler',
  nutritionist: 'Nutritionist',
  instructor: 'Instructor/Trainer',
  transporter: 'Horse Transport',
  feed_store: 'Feed Store',
  other: 'Other',
};

const ALL_CATEGORIES: ProfessionalCategory[] = [
  'farrier', 'vet', 'dentist', 'physio', 'chiropractor',
  'saddler', 'nutritionist', 'instructor', 'transporter', 'feed_store', 'other'
];

export default function ProfessionalDirectory() {
  const { isAdmin } = useAuth();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [categories, setCategories] = useState<ProfessionalCategoryInfo[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ProfessionalCategory | null>(null);
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfessional, setSelectedProfessional] = useState<Professional | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);
  const [formData, setFormData] = useState<Partial<CreateProfessional>>({});

  const loadDirectory = useCallback(async () => {
    try {
      setLoading(true);
      const response = await professionalsApi.list(selectedCategory || undefined, recommendedOnly);
      setProfessionals(response.professionals);
      setCategories(response.categories);
    } catch (err) {
      setError('Failed to load professionals directory');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, recommendedOnly]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const handleAddProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category || !formData.business_name) return;

    // Validate email if provided
    if (formData.email) {
      const emailResult = validateEmail(formData.email);
      if (!emailResult.isValid) {
        setError(emailResult.message || 'Invalid email');
        return;
      }
    }

    // Validate phone numbers if provided
    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.isValid) {
        setError(phoneResult.message || 'Invalid phone number');
        return;
      }
    }
    if (formData.mobile) {
      const mobileResult = validatePhone(formData.mobile);
      if (!mobileResult.isValid) {
        setError(mobileResult.message || 'Invalid mobile number');
        return;
      }
    }

    try {
      await professionalsApi.create(formData as CreateProfessional);
      setShowAddForm(false);
      setFormData({});
      loadDirectory();
    } catch (err) {
      console.error('Failed to add professional:', err);
      setError('Failed to add professional');
    }
  };

  const handleUpdateProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfessional) return;

    // Validate email if provided
    if (formData.email) {
      const emailResult = validateEmail(formData.email);
      if (!emailResult.isValid) {
        setError(emailResult.message || 'Invalid email');
        return;
      }
    }

    // Validate phone numbers if provided
    if (formData.phone) {
      const phoneResult = validatePhone(formData.phone);
      if (!phoneResult.isValid) {
        setError(phoneResult.message || 'Invalid phone number');
        return;
      }
    }
    if (formData.mobile) {
      const mobileResult = validatePhone(formData.mobile);
      if (!mobileResult.isValid) {
        setError(mobileResult.message || 'Invalid mobile number');
        return;
      }
    }

    try {
      await professionalsApi.update(editingProfessional.id, formData);
      setEditingProfessional(null);
      setFormData({});
      loadDirectory();
    } catch (err) {
      console.error('Failed to update professional:', err);
      setError('Failed to update professional');
    }
  };

  const handleDeleteProfessional = async (id: number) => {
    if (!confirm('Are you sure you want to remove this professional from the directory?')) return;

    try {
      await professionalsApi.delete(id);
      setSelectedProfessional(null);
      loadDirectory();
    } catch (err) {
      console.error('Failed to delete professional:', err);
      setError('Failed to delete professional');
    }
  };

  const openEditForm = (professional: Professional) => {
    setFormData({
      category: professional.category,
      business_name: professional.business_name,
      contact_name: professional.contact_name || undefined,
      phone: professional.phone || undefined,
      mobile: professional.mobile || undefined,
      email: professional.email || undefined,
      website: professional.website || undefined,
      address: professional.address || undefined,
      coverage_area: professional.coverage_area || undefined,
      services: professional.services || undefined,
      specialties: professional.specialties || undefined,
      qualifications: professional.qualifications || undefined,
      typical_rates: professional.typical_rates || undefined,
      booking_notes: professional.booking_notes || undefined,
      yard_recommended: professional.yard_recommended,
      yard_notes: professional.yard_notes || undefined,
    });
    setEditingProfessional(professional);
  };

  const renderForm = (isEdit: boolean) => (
    <form onSubmit={isEdit ? handleUpdateProfessional : handleAddProfessional} className="professional-form">
      <h3>{isEdit ? 'Edit Professional' : 'Add New Professional'}</h3>

      <div className="form-row">
        <div className="ds-form-group">
          <label>Category *</label>
          <select
            value={formData.category || ''}
            onChange={(e) => setFormData({ ...formData, category: e.target.value as ProfessionalCategory })}
            required
          >
            <option value="">Select category...</option>
            {ALL_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </div>
        <div className="ds-form-group">
          <label>Business Name *</label>
          <input
            type="text"
            value={formData.business_name || ''}
            onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="ds-form-group">
          <label>Contact Name</label>
          <input
            type="text"
            value={formData.contact_name || ''}
            onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
          />
        </div>
        <div className="ds-form-group">
          <label>Phone</label>
          <input
            type="tel"
            value={formData.phone || ''}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>
        <div className="ds-form-group">
          <label>Mobile</label>
          <input
            type="tel"
            value={formData.mobile || ''}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="ds-form-group">
          <label>Email</label>
          <input
            type="email"
            value={formData.email || ''}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
        </div>
        <div className="ds-form-group">
          <label>Website</label>
          <input
            type="url"
            value={formData.website || ''}
            onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            placeholder="https://"
          />
        </div>
      </div>

      <div className="ds-form-group">
        <label>Address</label>
        <textarea
          value={formData.address || ''}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          rows={2}
        />
      </div>

      <div className="form-row">
        <div className="ds-form-group">
          <label>Coverage Area</label>
          <input
            type="text"
            value={formData.coverage_area || ''}
            onChange={(e) => setFormData({ ...formData, coverage_area: e.target.value })}
            placeholder="e.g., Within 25 miles"
          />
        </div>
        <div className="ds-form-group">
          <label>Typical Rates</label>
          <input
            type="text"
            value={formData.typical_rates || ''}
            onChange={(e) => setFormData({ ...formData, typical_rates: e.target.value })}
            placeholder="e.g., From £45"
          />
        </div>
      </div>

      <div className="ds-form-group">
        <label>Services Offered</label>
        <textarea
          value={formData.services || ''}
          onChange={(e) => setFormData({ ...formData, services: e.target.value })}
          rows={2}
          placeholder="List of services provided..."
        />
      </div>

      <div className="form-row">
        <div className="ds-form-group">
          <label>Specialties</label>
          <textarea
            value={formData.specialties || ''}
            onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
            rows={2}
          />
        </div>
        <div className="ds-form-group">
          <label>Qualifications</label>
          <textarea
            value={formData.qualifications || ''}
            onChange={(e) => setFormData({ ...formData, qualifications: e.target.value })}
            rows={2}
          />
        </div>
      </div>

      <div className="ds-form-group">
        <label>Booking Notes</label>
        <textarea
          value={formData.booking_notes || ''}
          onChange={(e) => setFormData({ ...formData, booking_notes: e.target.value })}
          rows={2}
          placeholder="How to book, visit schedule, etc."
        />
      </div>

      <div className="form-row">
        <div className="ds-form-group checkbox-group">
          <label>
            <input
              type="checkbox"
              checked={formData.yard_recommended || false}
              onChange={(e) => setFormData({ ...formData, yard_recommended: e.target.checked })}
            />
            Yard Recommended
          </label>
        </div>
      </div>

      {formData.yard_recommended && (
        <div className="ds-form-group">
          <label>Yard Notes</label>
          <textarea
            value={formData.yard_notes || ''}
            onChange={(e) => setFormData({ ...formData, yard_notes: e.target.value })}
            rows={2}
            placeholder="Why the yard recommends this professional..."
          />
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="ds-btn ds-btn-secondary" onClick={() => {
          setShowAddForm(false);
          setEditingProfessional(null);
          setFormData({});
        }}>
          Cancel
        </button>
        <button type="submit" className="ds-btn ds-btn-primary">
          {isEdit ? 'Update' : 'Add'} Professional
        </button>
      </div>
    </form>
  );

  if (loading && professionals.length === 0) {
    return <div className="ds-loading">Loading directory...</div>;
  }

  return (
    <div className="professional-directory">
      <header className="directory-header">
        <h1>Professional Directory</h1>
        <p>Find trusted equine professionals recommended by the yard and fellow liveries.</p>
        {isAdmin && (
          <button className="ds-btn ds-btn-primary" onClick={() => {
            setFormData({});
            setShowAddForm(true);
          }}>
            Add Professional
          </button>
        )}
      </header>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {showAddForm && (
        <div className="form-overlay">
          <div className="form-container">
            {renderForm(false)}
          </div>
        </div>
      )}

      {editingProfessional && (
        <div className="form-overlay">
          <div className="form-container">
            {renderForm(true)}
          </div>
        </div>
      )}

      <div className="directory-filters">
        <div className="category-tabs">
          <button
            className={`category-tab ${!selectedCategory ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
          >
            All ({professionals.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat.value}
              className={`category-tab ${selectedCategory === cat.value ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.value as ProfessionalCategory)}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>
        <label className="recommended-filter">
          <input
            type="checkbox"
            checked={recommendedOnly}
            onChange={(e) => setRecommendedOnly(e.target.checked)}
          />
          Show yard recommended only
        </label>
      </div>

      {professionals.length === 0 ? (
        <div className="ds-empty">
          <p>No professionals found matching your criteria.</p>
        </div>
      ) : (
        <div className="professionals-grid">
          {professionals.map(professional => (
            <div
              key={professional.id}
              className={`professional-card ${professional.yard_recommended ? 'recommended' : ''}`}
              onClick={() => setSelectedProfessional(professional)}
            >
              {professional.yard_recommended && (
                <span className="recommended-badge">Yard Recommended</span>
              )}
              <div className="card-category">{CATEGORY_LABELS[professional.category]}</div>
              <h3>{professional.business_name}</h3>
              {professional.contact_name && (
                <p className="contact-name">{professional.contact_name}</p>
              )}
              {professional.services && (
                <p className="services-preview">{professional.services.slice(0, 100)}...</p>
              )}
              <div className="contact-info">
                {professional.phone && <span>{professional.phone}</span>}
                {professional.mobile && <span>{professional.mobile}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProfessional && (
        <div className="professional-modal-overlay" onClick={() => setSelectedProfessional(null)}>
          <div className="professional-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedProfessional(null)}>&times;</button>

            {selectedProfessional.yard_recommended && (
              <div className="modal-recommended">Yard Recommended</div>
            )}

            <div className="modal-category">{CATEGORY_LABELS[selectedProfessional.category]}</div>
            <h2>{selectedProfessional.business_name}</h2>

            {selectedProfessional.contact_name && (
              <p className="modal-contact">{selectedProfessional.contact_name}</p>
            )}

            <div className="modal-section">
              <h4>Contact Information</h4>
              <div className="contact-details">
                {selectedProfessional.phone && (
                  <a href={`tel:${selectedProfessional.phone}`} className="contact-link">
                    <span className="contact-icon">📞</span> {selectedProfessional.phone}
                  </a>
                )}
                {selectedProfessional.mobile && (
                  <a href={`tel:${selectedProfessional.mobile}`} className="contact-link">
                    <span className="contact-icon">📱</span> {selectedProfessional.mobile}
                  </a>
                )}
                {selectedProfessional.email && (
                  <a href={`mailto:${selectedProfessional.email}`} className="contact-link">
                    <span className="contact-icon">✉️</span> {selectedProfessional.email}
                  </a>
                )}
                {selectedProfessional.website && (
                  <a href={selectedProfessional.website} target="_blank" rel="noopener noreferrer" className="contact-link">
                    <span className="contact-icon">🌐</span> Website
                  </a>
                )}
              </div>
            </div>

            {selectedProfessional.address && (
              <div className="modal-section">
                <h4>Address</h4>
                <p>{selectedProfessional.address}</p>
              </div>
            )}

            {selectedProfessional.coverage_area && (
              <div className="modal-section">
                <h4>Coverage Area</h4>
                <p>{selectedProfessional.coverage_area}</p>
              </div>
            )}

            {selectedProfessional.services && (
              <div className="modal-section">
                <h4>Services</h4>
                <p>{selectedProfessional.services}</p>
              </div>
            )}

            {selectedProfessional.specialties && (
              <div className="modal-section">
                <h4>Specialties</h4>
                <p>{selectedProfessional.specialties}</p>
              </div>
            )}

            {selectedProfessional.qualifications && (
              <div className="modal-section">
                <h4>Qualifications</h4>
                <p>{selectedProfessional.qualifications}</p>
              </div>
            )}

            {selectedProfessional.typical_rates && (
              <div className="modal-section">
                <h4>Typical Rates</h4>
                <p>{selectedProfessional.typical_rates}</p>
              </div>
            )}

            {selectedProfessional.booking_notes && (
              <div className="modal-section highlight">
                <h4>Booking Information</h4>
                <p>{selectedProfessional.booking_notes}</p>
              </div>
            )}

            {selectedProfessional.yard_recommended && selectedProfessional.yard_notes && (
              <div className="modal-section yard-notes">
                <h4>Yard Notes</h4>
                <p>{selectedProfessional.yard_notes}</p>
              </div>
            )}

            {isAdmin && (
              <div className="modal-actions">
                <button className="ds-btn ds-btn-secondary" onClick={() => {
                  openEditForm(selectedProfessional);
                  setSelectedProfessional(null);
                }}>
                  Edit
                </button>
                <button className="btn-danger" onClick={() => handleDeleteProfessional(selectedProfessional.id)}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
