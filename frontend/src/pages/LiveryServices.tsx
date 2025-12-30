import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { liveryPackagesApi } from '../services/api';
import type { LiveryPackage } from '../types';
import './ContentPages.css';

export function LiveryServices() {
  const { venueName } = useSettings();
  const { user } = useAuth();
  const isLiveryClient = user?.role === 'livery';
  const [packages, setPackages] = useState<LiveryPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only load packages for non-livery users (prospective clients)
    if (isLiveryClient) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const packagesData = await liveryPackagesApi.list(true);
        setPackages(packagesData);
      } catch (error) {
        console.error('Failed to load livery data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [isLiveryClient]);

  if (isLoading) {
    return (
      <div className="content-page">
        <div className="content-hero">
          <h1>Livery Services</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Livery clients see a different view - quick links to their services
  if (isLiveryClient) {
    return (
      <div className="content-page">
        <div className="content-hero">
          <h1>Livery Services</h1>
          <p>Your livery services at {venueName}</p>
        </div>

        <div className="content-intro">
          <p>
            As a livery client, you have access to the following services. Use the links below
            to manage your horses and requests.
          </p>
        </div>

        <div className="services-grid">
          <Link to="/book/my-horses" className="service-card livery-link">
            <div className="service-header">
              <h2>My Horses</h2>
            </div>
            <div className="service-content">
              <p>View and manage your horses' details, feeding notes, and personality traits.</p>
            </div>
          </Link>

          <Link to="/book/turnout" className="service-card livery-link">
            <div className="service-header">
              <h2>Stay In Requests</h2>
            </div>
            <div className="service-content">
              <p>Request for your horse to stay in their stable instead of being turned out.</p>
            </div>
          </Link>

          <Link to="/book/my-account" className="service-card livery-link">
            <div className="service-header">
              <h2>My Account</h2>
            </div>
            <div className="service-content">
              <p>View your account balance, transaction history, and payment details.</p>
            </div>
          </Link>

          <Link to="/book" className="service-card livery-link">
            <div className="service-header">
              <h2>Book Arena</h2>
            </div>
            <div className="service-content">
              <p>Book arena time for riding, training, or lessons.</p>
            </div>
          </Link>
        </div>

        <section className="cta-section">
          <h2>Need help or have questions?</h2>
          <p>Contact us if you need to discuss your livery package or have any questions.</p>
          <a href="/contact" className="cta-button">Get in Touch</a>
        </section>
      </div>
    );
  }

  // Non-livery users (prospective clients) see packages
  return (
    <div className="content-page">
      <div className="content-hero">
        <h1>Livery Services</h1>
        <p>Comprehensive livery services at {venueName}</p>
      </div>

      <div className="content-intro">
        <p>
          We offer comprehensive livery services in a welcoming environment. Our spacious
          facilities and dedicated team ensure your horse receives the highest standard of care.
        </p>
      </div>

      {packages.length > 0 ? (
        <div className="services-grid">
          {packages.map((pkg) => (
            <div key={pkg.id} className={`service-card ${pkg.is_featured ? 'featured' : ''}`}>
              <div className="service-header">
                <h2>{pkg.name}</h2>
                <span className="price">{pkg.price_display}</span>
              </div>
              <div className="service-content">
                {pkg.description && <p>{pkg.description}</p>}
                {pkg.features && pkg.features.length > 0 && (
                  <ul>
                    {pkg.features.map((feature, idx) => (
                      <li key={idx}>{feature}</li>
                    ))}
                  </ul>
                )}
                {pkg.additional_note && (
                  <p className="additional-note">{pkg.additional_note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="services-grid">
          <div className="empty-state-card">
            <p>Livery packages coming soon. Please contact us for more information.</p>
          </div>
        </div>
      )}

      <section className="cta-section">
        <h2>Interested in our livery services?</h2>
        <p>Contact us to arrange a visit and discuss your requirements.</p>
        <a href="/contact" className="cta-button">Get in Touch</a>
      </section>
    </div>
  );
}
