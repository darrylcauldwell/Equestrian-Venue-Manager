import { Link } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import Weather from '../components/Weather';
import './ContentPages.css';
import './Home.css';

export function Home() {
  const { venueName, settings } = useSettings();

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <h1>Welcome to {venueName}</h1>
          <p>
            {settings?.venue_tagline || 'A premier livery facility offering exceptional care for your horse.'}
          </p>
        </div>
      </section>

      <section className="intro-section">
        <div className="intro-content">
          <h2>Your Horse's Home Away From Home</h2>
          <p>
            We offer full livery packages, arena rentals, and lessons with local trainers.
            Our dedicated team ensures your horse receives the highest standard of care.
          </p>
        </div>
      </section>

      <section className="weather-section">
        <Weather />
      </section>

      <section className="cta-section">
        <h2>Ready to Visit?</h2>
        <p>
          We'd love to show you around. Get in touch to arrange a visit
          or to discuss your livery requirements.
        </p>
        <Link to="/contact" className="cta-button">Contact Us</Link>
      </section>
    </div>
  );
}
