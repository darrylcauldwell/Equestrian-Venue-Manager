import { Link } from 'react-router-dom';
import { useSettings } from '../contexts/SettingsContext';
import './NotFound.css';

export function NotFound() {
  const { venueName } = useSettings();

  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <div className="horse-illustration">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
            {/* Horse head silhouette */}
            <path
              d="M140 60
                 Q160 40 170 50
                 Q175 55 172 65
                 Q168 75 160 80
                 L155 85
                 Q165 90 168 100
                 Q170 110 165 120
                 L158 130
                 Q155 140 145 145
                 L130 150
                 Q120 155 110 150
                 L100 145
                 Q90 140 85 130
                 L80 115
                 Q78 105 80 95
                 Q85 80 100 70
                 Q110 62 125 58
                 Q132 56 140 60Z"
              fill="currentColor"
              opacity="0.9"
            />
            {/* Eye */}
            <circle cx="135" cy="85" r="5" fill="var(--bg-card)" />
            {/* Mane */}
            <path
              d="M120 55 Q115 45 125 40 Q135 38 140 48 Q138 55 130 58"
              fill="currentColor"
              opacity="0.7"
            />
          </svg>
        </div>

        <h1>404</h1>
        <h2>Whoa there!</h2>
        <p>This isn't the page you're looking for.</p>
        <p className="subtext">
          Looks like this horse has bolted from the stable.
        </p>

        <div className="not-found-actions">
          <Link to="/" className="ds-btn ds-btn-primary">
            Back to {venueName}
          </Link>
          <Link to="/book" className="ds-btn ds-btn-secondary">
            Book an Arena
          </Link>
        </div>
      </div>
    </div>
  );
}
