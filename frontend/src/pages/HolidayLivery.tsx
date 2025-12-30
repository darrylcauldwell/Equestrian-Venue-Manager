import { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { liveryPackagesApi, holidayLiveryApi } from '../services/api';
import type { LiveryPackage, HolidayLiveryRequestCreate } from '../types';
import './ContentPages.css';
import './HolidayLivery.css';

export function HolidayLivery() {
  const { venueName } = useSettings();
  const [holidayPackage, setHolidayPackage] = useState<LiveryPackage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<HolidayLiveryRequestCreate>({
    guest_name: '',
    guest_email: '',
    guest_phone: '',
    horse_name: '',
    horse_breed: '',
    horse_age: undefined,
    horse_colour: '',
    horse_gender: '',
    special_requirements: '',
    requested_arrival: '',
    requested_departure: '',
    message: '',
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const packages = await liveryPackagesApi.list(true);
        // Find holiday/weekly package
        const holiday = packages.find(p => p.billing_type === 'weekly');
        setHolidayPackage(holiday || null);
      } catch (error) {
        console.error('Failed to load holiday livery data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'horse_age' ? (value ? parseInt(value, 10) : undefined) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      await holidayLiveryApi.submitRequest(formData);
      setSubmitSuccess(true);
      // Reset form
      setFormData({
        guest_name: '',
        guest_email: '',
        guest_phone: '',
        horse_name: '',
        horse_breed: '',
        horse_age: undefined,
        horse_colour: '',
        horse_gender: '',
        special_requirements: '',
        requested_arrival: '',
        requested_departure: '',
        message: '',
      });
    } catch (error: unknown) {
      console.error('Failed to submit request:', error);
      const err = error as { response?: { data?: { detail?: string } } };
      setSubmitError(err.response?.data?.detail || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate minimum dates
  const today = new Date();
  const minArrival = new Date(today);
  minArrival.setDate(today.getDate() + 1); // At least 1 day in advance
  const minArrivalStr = minArrival.toISOString().split('T')[0];

  const minDeparture = formData.requested_arrival || minArrivalStr;

  if (isLoading) {
    return (
      <div className="content-page">
        <div className="content-hero">
          <h1>Holiday Livery</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="content-page">
        <div className="content-hero">
          <h1>Request Submitted</h1>
          <p>Thank you for your holiday livery enquiry</p>
        </div>

        <div className="success-message">
          <div className="success-icon">&#10003;</div>
          <h2>We've received your request!</h2>
          <p>
            Thank you for your interest in holiday livery at {venueName}. We will review your
            request and get back to you shortly to confirm availability and arrangements.
          </p>
          <p>
            Please check your email at <strong>{formData.guest_email || 'the address you provided'}</strong> for updates.
          </p>
          <button
            onClick={() => setSubmitSuccess(false)}
            className="cta-button"
          >
            Submit Another Request
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="content-hero">
        <h1>Holiday Livery</h1>
        <p>Short-term livery at {venueName}</p>
      </div>

      <div className="content-intro">
        <p>
          Need temporary accommodation for your horse? Whether you're going on holiday,
          between yards, or just need short-term care, our holiday livery service provides
          full care for your horse in our welcoming facilities.
        </p>
      </div>

      {holidayPackage && (
        <div className="holiday-package-info">
          <div className="package-card">
            <h2>{holidayPackage.name}</h2>
            <div className="package-price">{holidayPackage.price_display}</div>
            {holidayPackage.description && <p>{holidayPackage.description}</p>}
            {holidayPackage.features && holidayPackage.features.length > 0 && (
              <ul className="package-features">
                {holidayPackage.features.map((feature, idx) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <div className="request-form-section">
        <h2>Request Holiday Livery</h2>
        <p>Fill in the form below and we'll get back to you to confirm availability.</p>

        {submitError && (
          <div className="ds-alert ds-alert-error">
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="holiday-request-form">
          <fieldset>
            <legend>Your Details</legend>

            <div className="ds-form-group">
              <label htmlFor="guest_name">Your Name *</label>
              <input
                type="text"
                id="guest_name"
                name="guest_name"
                value={formData.guest_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="guest_email">Email Address *</label>
                <input
                  type="email"
                  id="guest_email"
                  name="guest_email"
                  value={formData.guest_email}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="guest_phone">Phone Number</label>
                <input
                  type="tel"
                  id="guest_phone"
                  name="guest_phone"
                  value={formData.guest_phone || ''}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          </fieldset>

          <fieldset>
            <legend>Horse Details</legend>

            <div className="ds-form-group">
              <label htmlFor="horse_name">Horse Name *</label>
              <input
                type="text"
                id="horse_name"
                name="horse_name"
                value={formData.horse_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="horse_breed">Breed</label>
                <input
                  type="text"
                  id="horse_breed"
                  name="horse_breed"
                  value={formData.horse_breed || ''}
                  onChange={handleInputChange}
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="horse_age">Age (years)</label>
                <input
                  type="number"
                  id="horse_age"
                  name="horse_age"
                  min="0"
                  max="40"
                  value={formData.horse_age || ''}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="horse_colour">Colour</label>
                <input
                  type="text"
                  id="horse_colour"
                  name="horse_colour"
                  value={formData.horse_colour || ''}
                  onChange={handleInputChange}
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="horse_gender">Gender</label>
                <select
                  id="horse_gender"
                  name="horse_gender"
                  value={formData.horse_gender || ''}
                  onChange={handleInputChange}
                >
                  <option value="">Select...</option>
                  <option value="mare">Mare</option>
                  <option value="gelding">Gelding</option>
                  <option value="stallion">Stallion</option>
                </select>
              </div>
            </div>

            <div className="ds-form-group">
              <label htmlFor="special_requirements">Special Requirements</label>
              <textarea
                id="special_requirements"
                name="special_requirements"
                rows={3}
                placeholder="Any dietary needs, medications, handling notes, etc."
                value={formData.special_requirements || ''}
                onChange={handleInputChange}
              />
            </div>
          </fieldset>

          <fieldset>
            <legend>Requested Dates</legend>

            <div className="form-row">
              <div className="ds-form-group">
                <label htmlFor="requested_arrival">Arrival Date *</label>
                <input
                  type="date"
                  id="requested_arrival"
                  name="requested_arrival"
                  min={minArrivalStr}
                  value={formData.requested_arrival}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="ds-form-group">
                <label htmlFor="requested_departure">Departure Date *</label>
                <input
                  type="date"
                  id="requested_departure"
                  name="requested_departure"
                  min={minDeparture}
                  value={formData.requested_departure}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            {formData.requested_arrival && formData.requested_departure && (
              <div className="stay-summary">
                {(() => {
                  const arrival = new Date(formData.requested_arrival);
                  const departure = new Date(formData.requested_departure);
                  const nights = Math.ceil((departure.getTime() - arrival.getTime()) / (1000 * 60 * 60 * 24));
                  return nights > 0 ? `${nights} night${nights !== 1 ? 's' : ''}` : '';
                })()}
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>Additional Information</legend>

            <div className="ds-form-group">
              <label htmlFor="message">Message (Optional)</label>
              <textarea
                id="message"
                name="message"
                rows={4}
                placeholder="Any additional information or questions..."
                value={formData.message || ''}
                onChange={handleInputChange}
              />
            </div>
          </fieldset>

          <div className="form-actions">
            <button
              type="submit"
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>

      <section className="cta-section">
        <h2>Have questions?</h2>
        <p>Contact us directly if you'd like to discuss your requirements first.</p>
        <a href="/contact" className="cta-button">Get in Touch</a>
      </section>
    </div>
  );
}
