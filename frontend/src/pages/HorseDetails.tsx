import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { horsesApi, feedApi, healthRecordsApi } from '../services/api';
import {
  FormGroup,
  Input,
  Select,
  Textarea,
  Card,
  CardHeader,
  CardBody,
} from '../components/ui';
import type {
  Horse,
  FeedSummary,
  UpdateFeedRequirement,
  EmergencyContact,
  EmergencyContactCreate,
  ContactType,
} from '../types';
import './HorseDetails.css';

type TabType = 'details' | 'feed' | 'contacts';

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

export function HorseDetails() {
  const { horseId } = useParams<{ horseId: string }>();
  const navigate = useNavigate();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('details');

  // Horse state
  const [horse, setHorse] = useState<Horse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Feed state
  const [summary, setSummary] = useState<FeedSummary | null>(null);
  const [isEditingFeed, setIsEditingFeed] = useState(false);
  const [feedForm, setFeedForm] = useState<UpdateFeedRequirement>({
    morning_feed: '',
    evening_feed: '',
  });

  // Emergency contacts state
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<EmergencyContact | null>(null);
  const [savingContact, setSavingContact] = useState(false);
  const [contactForm, setContactForm] = useState<EmergencyContactCreate>({
    contact_type: 'vet',
    name: '',
    phone: '',
    is_primary: false,
  });

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      if (!horseId) return;
      setIsLoading(true);
      try {
        const [horseData, summaryData, contactsData] = await Promise.all([
          horsesApi.get(Number(horseId)),
          feedApi.getSummary(Number(horseId)),
          healthRecordsApi.listEmergencyContacts(Number(horseId)),
        ]);
        setHorse(horseData);
        setSummary(summaryData);
        setContacts(contactsData);

        // Populate feed form
        if (summaryData.feed_requirement) {
          setFeedForm({
            morning_feed: summaryData.feed_requirement.morning_feed || '',
            evening_feed: summaryData.feed_requirement.evening_feed || '',
          });
        }
      } catch {
        setError('Failed to load horse details');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [horseId]);

  // Details handlers
  const handleChange = (field: keyof Horse, value: string | number | boolean | null) => {
    if (!horse) return;
    setHorse({ ...horse, [field]: value });
  };

  const handleSaveDetails = async () => {
    if (!horse || !horseId) return;
    setIsSaving(true);
    setError('');
    setSuccess('');
    try {
      await horsesApi.update(Number(horseId), horse);
      setSuccess('Horse details saved successfully');
    } catch {
      setError('Failed to save horse details');
    } finally {
      setIsSaving(false);
    }
  };

  // Feed handlers
  const handleSaveFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;
    setError('');
    setSuccess('');
    try {
      await feedApi.updateRequirement(Number(horseId), feedForm);
      setIsEditingFeed(false);
      const newSummary = await feedApi.getSummary(Number(horseId));
      setSummary(newSummary);
      setSuccess('Feed requirements saved successfully');
    } catch {
      setError('Failed to save feed requirements');
    }
  };

  // Emergency contacts handlers
  const openAddContactModal = () => {
    setEditingContact(null);
    setContactForm({
      contact_type: 'vet',
      name: '',
      phone: '',
      is_primary: false,
    });
    setShowContactModal(true);
  };

  const openEditContactModal = (contact: EmergencyContact) => {
    setEditingContact(contact);
    setContactForm({
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
    setShowContactModal(true);
  };

  const closeContactModal = () => {
    setShowContactModal(false);
    setEditingContact(null);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horseId) return;
    setSavingContact(true);
    setError('');
    try {
      if (editingContact) {
        await healthRecordsApi.updateEmergencyContact(Number(horseId), editingContact.id, contactForm);
      } else {
        await healthRecordsApi.createEmergencyContact(Number(horseId), contactForm);
      }
      const newContacts = await healthRecordsApi.listEmergencyContacts(Number(horseId));
      setContacts(newContacts);
      closeContactModal();
      setSuccess('Contact saved successfully');
    } catch {
      setError('Failed to save contact');
    } finally {
      setSavingContact(false);
    }
  };

  const handleDeleteContact = async (contactId: number) => {
    if (!horseId || !confirm('Are you sure you want to delete this contact?')) return;
    setError('');
    try {
      await healthRecordsApi.deleteEmergencyContact(Number(horseId), contactId);
      const newContacts = await healthRecordsApi.listEmergencyContacts(Number(horseId));
      setContacts(newContacts);
      setSuccess('Contact deleted');
    } catch {
      setError('Failed to delete contact');
    }
  };

  const handleSetPrimary = async (contactId: number) => {
    if (!horseId) return;
    setError('');
    try {
      await healthRecordsApi.setEmergencyContactPrimary(Number(horseId), contactId);
      const newContacts = await healthRecordsApi.listEmergencyContacts(Number(horseId));
      setContacts(newContacts);
    } catch {
      setError('Failed to set primary contact');
    }
  };

  // Group contacts by type
  const groupedContacts = contactTypeOrder.reduce((acc, type) => {
    const typeContacts = contacts.filter(c => c.contact_type === type);
    if (typeContacts.length > 0) {
      acc[type] = typeContacts;
    }
    return acc;
  }, {} as Record<ContactType, EmergencyContact[]>);

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  if (!horse) {
    return <div className="ds-alert ds-alert-error">Horse not found</div>;
  }

  return (
    <div className="horse-details-page">
      <div className="page-header">
        <div className="header-left">
          <button className="ds-btn ds-btn-secondary" onClick={() => navigate('/book/my-horses')}>
            ← Back
          </button>
          <h1>{horse.name}</h1>
        </div>
        {activeTab === 'details' && (
          <button
            className="ds-btn ds-btn-primary"
            onClick={handleSaveDetails}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}
      {success && <div className="ds-alert ds-alert-success">{success}</div>}

      {/* Tab Navigation */}
      <div className="ds-tabs">
        <button
          className={`ds-tab ${activeTab === 'details' ? 'active' : ''}`}
          onClick={() => setActiveTab('details')}
        >
          Details
        </button>
        <button
          className={`ds-tab ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          Feed
        </button>
        <button
          className={`ds-tab ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          Emergency Contacts
          {contacts.length > 0 && <span className="ds-tab-count">{contacts.length}</span>}
        </button>
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="details-grid">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <h2>Basic Information</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Name">
                <Input
                  value={horse.name || ''}
                  onChange={(e) => handleChange('name', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="Passport Name">
                <Input
                  value={horse.passport_name || ''}
                  onChange={(e) => handleChange('passport_name', e.target.value)}
                  placeholder="Name as shown on passport"
                />
              </FormGroup>
              <FormGroup label="Colour">
                <Input
                  value={horse.colour || ''}
                  onChange={(e) => handleChange('colour', e.target.value)}
                />
              </FormGroup>
              <FormGroup label="Birth Year">
                <Input
                  type="number"
                  value={horse.birth_year || ''}
                  onChange={(e) => handleChange('birth_year', e.target.value ? Number(e.target.value) : null)}
                  min={1990}
                  max={new Date().getFullYear()}
                />
              </FormGroup>
              <FormGroup label="Feed Notes">
                <Textarea
                  value={horse.feed_notes || ''}
                  onChange={(e) => handleChange('feed_notes', e.target.value)}
                  rows={3}
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* Farrier */}
          <Card>
            <CardHeader>
              <h2>Farrier</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Farrier Friendly">
                <Select
                  value={horse.farrier_friendly === null ? '' : horse.farrier_friendly ? 'yes' : 'no'}
                  onChange={(e) => handleChange('farrier_friendly', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Farrier Notes">
                <Textarea
                  value={horse.farrier_notes || ''}
                  onChange={(e) => handleChange('farrier_notes', e.target.value)}
                  rows={2}
                  placeholder="Any notes for the farrier"
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* Dentist */}
          <Card>
            <CardHeader>
              <h2>Dentist</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Dentist Friendly">
                <Select
                  value={horse.dentist_friendly === null ? '' : horse.dentist_friendly ? 'yes' : 'no'}
                  onChange={(e) => handleChange('dentist_friendly', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Needs Sedation">
                <Select
                  value={horse.needs_sedation_dentist === null ? '' : horse.needs_sedation_dentist ? 'yes' : 'no'}
                  onChange={(e) => handleChange('needs_sedation_dentist', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Dentist Notes">
                <Textarea
                  value={horse.dentist_notes || ''}
                  onChange={(e) => handleChange('dentist_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* Clipping */}
          <Card>
            <CardHeader>
              <h2>Clipping</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Clipping Friendly">
                <Select
                  value={horse.clipping_friendly === null ? '' : horse.clipping_friendly ? 'yes' : 'no'}
                  onChange={(e) => handleChange('clipping_friendly', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Needs Sedation">
                <Select
                  value={horse.needs_sedation_clipping === null ? '' : horse.needs_sedation_clipping ? 'yes' : 'no'}
                  onChange={(e) => handleChange('needs_sedation_clipping', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Clipping Notes">
                <Textarea
                  value={horse.clipping_notes || ''}
                  onChange={(e) => handleChange('clipping_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* General Handling */}
          <Card>
            <CardHeader>
              <h2>General Handling</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Kicks">
                <Select
                  value={horse.kicks === null ? '' : horse.kicks ? 'yes' : 'no'}
                  onChange={(e) => handleChange('kicks', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes - Caution</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Bites">
                <Select
                  value={horse.bites === null ? '' : horse.bites ? 'yes' : 'no'}
                  onChange={(e) => handleChange('bites', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes - Caution</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Handling Notes">
                <Textarea
                  value={horse.handling_notes || ''}
                  onChange={(e) => handleChange('handling_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* Vet */}
          <Card>
            <CardHeader>
              <h2>Vet</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Vet Friendly">
                <Select
                  value={horse.vet_friendly === null ? '' : horse.vet_friendly ? 'yes' : 'no'}
                  onChange={(e) => handleChange('vet_friendly', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Needle Shy">
                <Select
                  value={horse.needle_shy === null ? '' : horse.needle_shy ? 'yes' : 'no'}
                  onChange={(e) => handleChange('needle_shy', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Vet Notes">
                <Textarea
                  value={horse.vet_notes || ''}
                  onChange={(e) => handleChange('vet_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* Loading & Catching */}
          <Card>
            <CardHeader>
              <h2>Loading & Catching</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Loads Well">
                <Select
                  value={horse.loads_well === null ? '' : horse.loads_well ? 'yes' : 'no'}
                  onChange={(e) => handleChange('loads_well', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Loading Notes">
                <Textarea
                  value={horse.loading_notes || ''}
                  onChange={(e) => handleChange('loading_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
              <FormGroup label="Difficult to Catch">
                <Select
                  value={horse.difficult_to_catch === null ? '' : horse.difficult_to_catch ? 'yes' : 'no'}
                  onChange={(e) => handleChange('difficult_to_catch', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Catching Notes">
                <Textarea
                  value={horse.catching_notes || ''}
                  onChange={(e) => handleChange('catching_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* Tying & Sedation */}
          <Card>
            <CardHeader>
              <h2>Tying & Sedation</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Can Be Tied">
                <Select
                  value={horse.can_be_tied === null ? '' : horse.can_be_tied ? 'yes' : 'no'}
                  onChange={(e) => handleChange('can_be_tied', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Tying Notes">
                <Textarea
                  value={horse.tying_notes || ''}
                  onChange={(e) => handleChange('tying_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
              <FormGroup label="Has Sedation Risk">
                <Select
                  value={horse.has_sedation_risk === null ? '' : horse.has_sedation_risk ? 'yes' : 'no'}
                  onChange={(e) => handleChange('has_sedation_risk', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes - Caution</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Sedation Notes">
                <Textarea
                  value={horse.sedation_notes || ''}
                  onChange={(e) => handleChange('sedation_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
            </CardBody>
          </Card>

          {/* Headshy */}
          <Card>
            <CardHeader>
              <h2>Headshyness</h2>
            </CardHeader>
            <CardBody>
              <FormGroup label="Headshy">
                <Select
                  value={horse.headshy === null ? '' : horse.headshy ? 'yes' : 'no'}
                  onChange={(e) => handleChange('headshy', e.target.value === '' ? null : e.target.value === 'yes')}
                >
                  <option value="">Not specified</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </Select>
              </FormGroup>
              <FormGroup label="Headshy Notes">
                <Textarea
                  value={horse.headshy_notes || ''}
                  onChange={(e) => handleChange('headshy_notes', e.target.value)}
                  rows={2}
                />
              </FormGroup>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Feed Tab */}
      {activeTab === 'feed' && (
        <div className="feed-tab-content">
          {isEditingFeed ? (
            <form onSubmit={handleSaveFeed} className="feed-form">
              <Card>
                <CardHeader>
                  <h2>Edit Feed Requirements</h2>
                </CardHeader>
                <CardBody>
                  <FormGroup label="Morning Feed">
                    <Textarea
                      value={feedForm.morning_feed}
                      onChange={(e) => setFeedForm({ ...feedForm, morning_feed: e.target.value })}
                      placeholder="List each item and quantity, e.g.:&#10;1 scoop Happy Hoof&#10;1 scoop Baileys Lo-Cal&#10;1 tbsp salt"
                      rows={5}
                    />
                  </FormGroup>
                  <FormGroup label="Evening Feed">
                    <Textarea
                      value={feedForm.evening_feed}
                      onChange={(e) => setFeedForm({ ...feedForm, evening_feed: e.target.value })}
                      placeholder="List each item and quantity, e.g.:&#10;2 scoops Happy Hoof&#10;1 scoop Baileys Lo-Cal"
                      rows={5}
                    />
                  </FormGroup>
                  <div className="form-actions">
                    <button type="button" onClick={() => setIsEditingFeed(false)} className="ds-btn ds-btn-secondary">
                      Cancel
                    </button>
                    <button type="submit" className="ds-btn ds-btn-primary">
                      Save
                    </button>
                  </div>
                </CardBody>
              </Card>
            </form>
          ) : (
            <div className="feed-display">
              <div className="feed-header">
                <h2>Daily Feed Chart</h2>
                <button onClick={() => setIsEditingFeed(true)} className="ds-btn ds-btn-secondary">
                  Edit
                </button>
              </div>
              <div className="feed-cards">
                <Card>
                  <CardHeader>
                    <h3>Morning Feed</h3>
                  </CardHeader>
                  <CardBody>
                    <pre className="feed-content">{summary?.feed_requirement?.morning_feed || 'Not specified'}</pre>
                  </CardBody>
                </Card>
                <Card>
                  <CardHeader>
                    <h3>Evening Feed</h3>
                  </CardHeader>
                  <CardBody>
                    <pre className="feed-content">{summary?.feed_requirement?.evening_feed || 'Not specified'}</pre>
                  </CardBody>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Emergency Contacts Tab */}
      {activeTab === 'contacts' && (
        <div className="contacts-tab-content">
          <div className="contacts-header">
            <h2>Emergency Contacts</h2>
            <button className="ds-btn ds-btn-primary" onClick={openAddContactModal}>
              + Add Contact
            </button>
          </div>

          {contacts.length === 0 ? (
            <div className="ds-empty">
              <p>No emergency contacts added yet.</p>
              <p>Add vet, farrier, and other important contacts for quick access in emergencies.</p>
              <button className="ds-btn ds-btn-primary" onClick={openAddContactModal}>
                Add First Contact
              </button>
            </div>
          ) : (
            <div className="contacts-grid">
              {Object.entries(groupedContacts).map(([type, typeContacts]) => (
                <div key={type} className="contact-group">
                  <h3 className="group-title">{contactTypeLabels[type as ContactType]}</h3>
                  {typeContacts.map(contact => (
                    <Card key={contact.id} className={contact.is_primary ? 'primary-contact' : ''}>
                      <CardBody>
                        {contact.is_primary && <span className="ds-badge ds-badge-success">Primary</span>}
                        <div className="contact-name">{contact.name}</div>
                        {contact.practice_name && (
                          <div className="practice-name">{contact.practice_name}</div>
                        )}
                        <div className="contact-details">
                          <div className="detail-row">
                            <span className="icon">📞</span>
                            <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                          </div>
                          {contact.phone_alt && (
                            <div className="detail-row">
                              <span className="icon">📞</span>
                              <a href={`tel:${contact.phone_alt}`}>{contact.phone_alt}</a>
                            </div>
                          )}
                          {contact.email && (
                            <div className="detail-row">
                              <span className="icon">✉️</span>
                              <a href={`mailto:${contact.email}`}>{contact.email}</a>
                            </div>
                          )}
                          {contact.address && (
                            <div className="detail-row">
                              <span className="icon">📍</span>
                              <span>{contact.address}</span>
                            </div>
                          )}
                        </div>
                        {contact.available_24h && (
                          <div className="availability-badge">24/7 Available</div>
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
                              className="ds-btn ds-btn-secondary ds-btn-sm"
                              onClick={() => handleSetPrimary(contact.id)}
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            className="ds-btn ds-btn-secondary ds-btn-sm"
                            onClick={() => openEditContactModal(contact)}
                          >
                            Edit
                          </button>
                          <button
                            className="ds-btn ds-btn-danger ds-btn-sm"
                            onClick={() => handleDeleteContact(contact.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && (
        <div className="ds-modal-overlay" onClick={closeContactModal}>
          <div className="ds-modal ds-modal-md" onClick={e => e.stopPropagation()}>
            <div className="ds-modal-header">
              <h2>{editingContact ? 'Edit Contact' : 'Add Emergency Contact'}</h2>
              <button className="ds-modal-close" onClick={closeContactModal}>&times;</button>
            </div>
            <form onSubmit={handleContactSubmit}>
              <div className="ds-modal-body">
                <FormGroup label="Contact Type" required>
                  <Select
                    value={contactForm.contact_type}
                    onChange={e => setContactForm({ ...contactForm, contact_type: e.target.value as ContactType })}
                    required
                  >
                    {contactTypeOrder.map(type => (
                      <option key={type} value={type}>{contactTypeLabels[type]}</option>
                    ))}
                  </Select>
                </FormGroup>

                <FormGroup label="Name" required>
                  <Input
                    value={contactForm.name}
                    onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                    required
                    placeholder="Contact name"
                  />
                </FormGroup>

                {(contactForm.contact_type === 'vet' || contactForm.contact_type === 'vet_backup' || contactForm.contact_type === 'farrier') && (
                  <FormGroup label="Practice/Business Name">
                    <Input
                      value={contactForm.practice_name || ''}
                      onChange={e => setContactForm({ ...contactForm, practice_name: e.target.value })}
                      placeholder="e.g., XYZ Veterinary Clinic"
                    />
                  </FormGroup>
                )}

                <div className="form-row">
                  <FormGroup label="Phone" required>
                    <Input
                      type="tel"
                      value={contactForm.phone}
                      onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                      required
                      placeholder="Primary phone"
                    />
                  </FormGroup>
                  <FormGroup label="Alt Phone">
                    <Input
                      type="tel"
                      value={contactForm.phone_alt || ''}
                      onChange={e => setContactForm({ ...contactForm, phone_alt: e.target.value })}
                      placeholder="Alternative phone"
                    />
                  </FormGroup>
                </div>

                <FormGroup label="Email">
                  <Input
                    type="email"
                    value={contactForm.email || ''}
                    onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </FormGroup>

                <FormGroup label="Address">
                  <Textarea
                    value={contactForm.address || ''}
                    onChange={e => setContactForm({ ...contactForm, address: e.target.value })}
                    placeholder="Full address"
                    rows={2}
                  />
                </FormGroup>

                <div className="form-row checkbox-row">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={contactForm.available_24h || false}
                      onChange={e => setContactForm({ ...contactForm, available_24h: e.target.checked })}
                    />
                    Available 24/7
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={contactForm.is_primary}
                      onChange={e => setContactForm({ ...contactForm, is_primary: e.target.checked })}
                    />
                    Primary for this type
                  </label>
                </div>

                <FormGroup label="Availability Notes">
                  <Input
                    value={contactForm.availability_notes || ''}
                    onChange={e => setContactForm({ ...contactForm, availability_notes: e.target.value })}
                    placeholder="e.g., Mon-Fri 9am-5pm"
                  />
                </FormGroup>

                <FormGroup label="Notes">
                  <Textarea
                    value={contactForm.notes || ''}
                    onChange={e => setContactForm({ ...contactForm, notes: e.target.value })}
                    placeholder="Additional notes"
                    rows={2}
                  />
                </FormGroup>
              </div>

              <div className="ds-modal-footer">
                <button type="button" className="ds-btn ds-btn-secondary" onClick={closeContactModal}>
                  Cancel
                </button>
                <button type="submit" className="ds-btn ds-btn-primary" disabled={savingContact}>
                  {savingContact ? 'Saving...' : editingContact ? 'Update' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default HorseDetails;
