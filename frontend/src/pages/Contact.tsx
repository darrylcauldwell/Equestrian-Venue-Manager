import { useSettings } from '../contexts/SettingsContext';
import './ContentPages.css';

// Check if address is configured
function hasAddress(settings: { address_street?: string; address_town?: string; address_county?: string; address_postcode?: string } | null): boolean {
  if (!settings) return false;
  return !!(settings.address_street || settings.address_town || settings.address_county || settings.address_postcode);
}

export function Contact() {
  const { venueName, settings } = useSettings();
  const addressConfigured = hasAddress(settings);

  return (
    <div className="content-page">
      <div className="content-hero">
        <h1>Contact Us</h1>
        <p>Get in touch with {venueName}</p>
      </div>

      <div className="contact-container contact-simple">
        <div className="contact-details">
          {addressConfigured && (
            <div className="contact-card">
              <div className="contact-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
              </div>
              <h3>Address</h3>
              <address>
                {settings?.address_street && <>{settings.address_street}<br /></>}
                {settings?.address_town && <>{settings.address_town}<br /></>}
                {settings?.address_county && <>{settings.address_county}<br /></>}
                {settings?.address_postcode && <>{settings.address_postcode}</>}
              </address>
            </div>
          )}

          {settings?.what3words && (
            <div className="contact-card">
              <div className="contact-icon what3words-icon">
                <span>///</span>
              </div>
              <h3>what3words</h3>
              <p>
                <a
                  href={`https://what3words.com/${settings.what3words}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="what3words-link"
                >
                  ///{settings.what3words}
                </a>
              </p>
            </div>
          )}

          {settings?.contact_phone && (
            <div className="contact-card">
              <div className="contact-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                </svg>
              </div>
              <h3>Phone</h3>
              <p>
                <a href={`tel:${settings.contact_phone.replace(/\s/g, '')}`}>{settings.contact_phone}</a>
              </p>
            </div>
          )}

          {settings?.contact_email && (
            <div className="contact-card">
              <div className="contact-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
                  <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
                </svg>
              </div>
              <h3>Email</h3>
              <p>
                <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
              </p>
            </div>
          )}

          {!addressConfigured && !settings?.contact_phone && !settings?.contact_email && (
            <div className="contact-card">
              <p className="no-contact-info">
                Contact information has not been configured yet. Please check back later.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
