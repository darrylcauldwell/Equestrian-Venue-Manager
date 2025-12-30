import { useState, useEffect } from 'react';
import { Link, Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { uploadsApi } from '../services/api';
import './PublicLayout.css';

export function PublicLayout() {
  const { user } = useAuth();
  const { venueName, settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Redirect logged-in users to their dashboard
  if (user) {
    return <Navigate to="/book" replace />;
  }

  return (
    <div className="public-layout">
      <header className="public-header">
        <div className="header-content">
          <Link to="/" className="logo">
            {settings?.logo_url ? (
              <img
                src={uploadsApi.getFileUrl(settings.logo_url)}
                alt={venueName}
                className="logo-image"
              />
            ) : (
              <h1>{venueName}</h1>
            )}
          </Link>

          {/* Hamburger menu button */}
          <button
            className={`hamburger-btn ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>

          {/* Slide-out navigation menu */}
          {menuOpen && <div className="nav-overlay" onClick={() => setMenuOpen(false)} />}
          <nav className={`public-nav ${menuOpen ? 'nav-open' : ''}`}>
            <div className="nav-header">
              <span className="nav-title">Menu</span>
              <button className="nav-close-btn" onClick={() => setMenuOpen(false)} aria-label="Close menu">
                &times;
              </button>
            </div>
            <div className="nav-content" onClick={(e) => {
              // Close menu when clicking any link (including current page)
              if ((e.target as HTMLElement).tagName === 'A') {
                setMenuOpen(false);
              }
            }}>
              <Link to="/">Home</Link>
              <Link to="/public-booking">Book Arena</Link>
              <Link to="/contact">Contact</Link>
              <Link to="/clinics">Events & Clinics</Link>
              <Link to="/holiday-livery">Holiday Livery</Link>
              <Link to="/lessons">Lessons</Link>
              <Link to="/livery">Livery Services</Link>
              <Link to="/login">Login / Register</Link>
            </div>
          </nav>
        </div>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-footer">
        <p>&copy; {new Date().getFullYear()} {venueName}</p>
      </footer>
    </div>
  );
}
