import { useState, useEffect, ReactNode } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { uploadsApi } from '../services/api';
import { FeedAlertPopup } from './FeedAlertPopup';
import { FeedNotificationPopup } from './FeedNotificationPopup';
import { QuoteAlertPopup } from './QuoteAlertPopup';
import { VaccinationAlertPopup } from './VaccinationAlertPopup';
import { FloodAlertPopup } from './FloodAlertPopup';
import { StaffMilestonesPopup } from './StaffMilestonesPopup';
import { ThanksNotificationPopup } from './ThanksNotificationPopup';
import type { FeatureKey } from '../types';
import './Layout.css';

// Helper component for feature-gated links
interface FeatureLinksProps {
  feature: FeatureKey;
  children: ReactNode;
}

function FeatureLink({ feature, children }: FeatureLinksProps) {
  const { isFeatureEnabled } = useFeatureFlags();
  if (!isFeatureEnabled(feature)) return null;
  return <>{children}</>;
}

// Expandable dropdown component for slide-out menu
interface NavDropdownProps {
  title: string;
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

function NavDropdown({ title, children, isOpen, onToggle }: NavDropdownProps) {
  return (
    <div className={`nav-dropdown ${isOpen ? 'open' : ''}`}>
      <button
        className="nav-dropdown-trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      <div className="nav-dropdown-menu">
        {children}
      </div>
    </div>
  );
}

// Nested sub-dropdown for grouping within a dropdown
interface NavSubDropdownProps {
  title: string;
  children: ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}

function NavSubDropdown({ title, children, isOpen, onToggle }: NavSubDropdownProps) {
  return (
    <div className={`nav-sub-dropdown ${isOpen ? 'open' : ''}`}>
      <button
        className="nav-sub-dropdown-trigger"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      <div className="nav-sub-dropdown-menu">
        {children}
      </div>
    </div>
  );
}

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState<Set<string>>(new Set());
  const location = useLocation();

  const toggleDropdown = (name: string) => {
    setOpenDropdowns(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  // Close mobile menu and dropdowns when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdowns(new Set());
  }, [location.pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (mobileMenuOpen && !target.closest('.header-content')) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [mobileMenuOpen]);
  const isPublicOnly = user?.role === 'public'; // Clinic bookers only
  const isCoachOnly = user?.role === 'coach'; // Coach but not admin
  const isStaff = user?.role === 'staff'; // Staff role
  const isYardStaff = (isStaff || user?.is_yard_staff) && !isAdmin; // Yard staff (simplified view)
  const isLiveryOnly = user?.role === 'livery' && !user?.is_yard_staff; // Livery without staff duties
  const { venueName, settings } = useSettings();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Render navigation based on role
  const renderNavigation = () => {
    // PUBLIC role - arena/clinic bookers
    if (isPublicOnly) {
      return (
        <>
          <FeatureLink feature="arena_bookings">
            <Link to="/book">Book Arena</Link>
          </FeatureLink>
          <FeatureLink feature="arena_bookings">
            <Link to="/book/my-bookings">My Bookings</Link>
          </FeatureLink>
          <FeatureLink feature="events_clinics">
            <Link to="/book/clinics">Events & Clinics</Link>
          </FeatureLink>
          <FeatureLink feature="lessons">
            <Link to="/book/lessons">Lessons</Link>
          </FeatureLink>
          <FeatureLink feature="events_clinics">
            <Link to="/book/my-registrations">My Registrations</Link>
          </FeatureLink>
        </>
      );
    }

    // COACH role - clinic management focused
    if (isCoachOnly) {
      return (
        <>
          <Link to="/book/clinics">My Clinics</Link>
          <Link to="/book/lessons">My Lessons</Link>
          <Link to="/book/noticeboard">My Noticeboard</Link>
          <Link to="/book/professionals">My Directory</Link>
        </>
      );
    }

    // YARD STAFF - simplified view focused on yard work
    if (isYardStaff) {
      return (
        <>
          <FeatureLink feature="yard_tasks">
            <Link to="/book/tasks">My Tasks</Link>
          </FeatureLink>
          <FeatureLink feature="feed_management">
            <Link to="/book/feed-duties">Feed Board</Link>
          </FeatureLink>
          <FeatureLink feature="turnout_management">
            <Link to="/book/turnout-board">Turnout Board</Link>
          </FeatureLink>
          <NavDropdown
            title="My Administration"
            isOpen={openDropdowns.has('staffAdmin')}
            onToggle={() => toggleDropdown('staffAdmin')}
          >
            <Link to="/book/my-profile">My Profile</Link>
            <FeatureLink feature="staff_management">
              <Link to="/book/my-rota">My Rota</Link>
            </FeatureLink>
            <FeatureLink feature="timesheets">
              <Link to="/book/my-timesheet">My Timesheet</Link>
            </FeatureLink>
            <FeatureLink feature="staff_management">
              <Link to="/book/my-leave">My Leave</Link>
            </FeatureLink>
            <FeatureLink feature="staff_management">
              <Link to="/book/my-thanks">My Thanks</Link>
            </FeatureLink>
            <FeatureLink feature="contract_management">
              <Link to="/book/my-contracts">My Contracts</Link>
            </FeatureLink>
            <FeatureLink feature="risk_assessment">
              <Link to="/book/risk-assessments">My Risk Assessments</Link>
            </FeatureLink>
            <FeatureLink feature="noticeboard">
              <Link to="/book/noticeboard">Noticeboard</Link>
            </FeatureLink>
          </NavDropdown>
        </>
      );
    }

    // LIVERY role (without staff duties) - horse care focused
    if (isLiveryOnly) {
      return (
        <>
          <NavDropdown
            title="My Account"
            isOpen={openDropdowns.has('account')}
            onToggle={() => toggleDropdown('account')}
          >
            <Link to="/book/my-account">Account Details</Link>
            <FeatureLink feature="contract_management">
              <Link to="/book/my-contracts">My Contracts</Link>
            </FeatureLink>
            <FeatureLink feature="invoicing">
              <Link to="/book/my-invoices">My Invoices</Link>
            </FeatureLink>
          </NavDropdown>
          <NavDropdown
            title="My Bookings"
            isOpen={openDropdowns.has('bookings')}
            onToggle={() => toggleDropdown('bookings')}
          >
            <FeatureLink feature="arena_bookings">
              <Link to="/book">Book Arena</Link>
            </FeatureLink>
            <FeatureLink feature="events_clinics">
              <Link to="/book/clinics">Events & Clinics</Link>
            </FeatureLink>
            <FeatureLink feature="lessons">
              <Link to="/book/lessons">Lessons</Link>
            </FeatureLink>
          </NavDropdown>
          <NavDropdown
            title="My Horses"
            isOpen={openDropdowns.has('horses')}
            onToggle={() => toggleDropdown('horses')}
          >
            <Link to="/book/my-horses">Horses</Link>
            <FeatureLink feature="livery_services">
              <Link to="/book/services">Livery Service</Link>
            </FeatureLink>
            <FeatureLink feature="turnout_management">
              <Link to="/book/turnout">Turnout Requests</Link>
            </FeatureLink>
          </NavDropdown>
          <NavDropdown
            title="Yard Info"
            isOpen={openDropdowns.has('info')}
            onToggle={() => toggleDropdown('info')}
          >
            <FeatureLink feature="professional_directory">
              <Link to="/book/professionals">Yard Directory</Link>
            </FeatureLink>
            <FeatureLink feature="security_management">
              <Link to="/book/security">Yard Security</Link>
            </FeatureLink>
            <FeatureLink feature="staff_management">
              <Link to="/book/send-thanks">Thank Staff</Link>
            </FeatureLink>
          </NavDropdown>
          <FeatureLink feature="noticeboard">
            <Link to="/book/noticeboard">Yard Noticeboard</Link>
          </FeatureLink>
        </>
      );
    }

    // ADMIN role - full admin navigation with dropdowns
    if (isAdmin) {
      return (
        <>
          {/* My Venue Dropdown with nested categories */}
          <NavDropdown
            title="My Venue"
            isOpen={openDropdowns.has('venue')}
            onToggle={() => toggleDropdown('venue')}
          >
            {/* Operations */}
            <NavSubDropdown
              title="Operations"
              isOpen={openDropdowns.has('venue-operations')}
              onToggle={() => toggleDropdown('venue-operations')}
            >
              <Link to="/book/admin/requests">All Requests</Link>
              <Link to="/book/admin/bookings">Bookings</Link>
              <Link to="/book/admin/tasks">Yard Tasks</Link>
              <Link to="/book/turnout">Turnout Requests</Link>
              <Link to="/book/services">Service Requests</Link>
            </NavSubDropdown>

            {/* My Staff */}
            <NavSubDropdown
              title="My Staff"
              isOpen={openDropdowns.has('venue-staff')}
              onToggle={() => toggleDropdown('venue-staff')}
            >
              <Link to="/book/admin/staff?tab=profiles">Staff Profiles</Link>
              <Link to="/book/admin/staff">Staff Management</Link>
            </NavSubDropdown>

            {/* Facilities */}
            <NavSubDropdown
              title="Facilities"
              isOpen={openDropdowns.has('venue-facilities')}
              onToggle={() => toggleDropdown('venue-facilities')}
            >
              <Link to="/book/admin/arenas">Arenas</Link>
              <Link to="/book/admin/stables">Stables</Link>
              <Link to="/book/admin/land-management">Land Management</Link>
              <Link to="/book/admin/coaches">Coach Profiles</Link>
              <Link to="/book/admin/noticeboard">Noticeboard</Link>
            </NavSubDropdown>

            {/* Horse Care */}
            <NavSubDropdown
              title="Horse Care"
              isOpen={openDropdowns.has('venue-horsecare')}
              onToggle={() => toggleDropdown('venue-horsecare')}
            >
              <Link to="/book/admin/care-plans">Care Plans</Link>
              <Link to="/book/admin/livery-packages">Livery Packages</Link>
              <Link to="/book/admin/feed-schedule">Feed Schedule</Link>
              <Link to="/book/admin/feed-notifications">Feed Change History</Link>
              <Link to="/book/admin/worming">Worm Counts</Link>
              <Link to="/book/admin/services">Service Catalog</Link>
              <Link to="/book/my-horses">My Horses</Link>
            </NavSubDropdown>

            {/* Finance */}
            <NavSubDropdown
              title="Finance"
              isOpen={openDropdowns.has('venue-finance')}
              onToggle={() => toggleDropdown('venue-finance')}
            >
              <Link to="/book/admin/billing">Billing</Link>
              <Link to="/book/admin/invoices">Invoices</Link>
            </NavSubDropdown>

            {/* Document Management */}
            <NavSubDropdown
              title="Document Management"
              isOpen={openDropdowns.has('venue-documents')}
              onToggle={() => toggleDropdown('venue-documents')}
            >
              <Link to="/book/admin/risk-assessments">Risk Assessments</Link>
              <Link to="/book/admin/contracts">Contract Templates</Link>
              <Link to="/book/admin/contract-signatures">Signature Requests</Link>
            </NavSubDropdown>

            {/* Reports */}
            <NavSubDropdown
              title="Reports"
              isOpen={openDropdowns.has('venue-reports')}
              onToggle={() => toggleDropdown('venue-reports')}
            >
              <Link to="/book/admin/reports">Financial Reports</Link>
              <Link to="/book/admin/compliance">Compliance</Link>
              <Link to="/book/admin/security">Security</Link>
            </NavSubDropdown>

          </NavDropdown>

          {/* My System Dropdown */}
          <NavDropdown
            title="My System"
            isOpen={openDropdowns.has('system')}
            onToggle={() => toggleDropdown('system')}
          >
            <Link to="/book/admin/backups">Backups</Link>
            <Link to="/book/admin/settings">Site Settings</Link>
            <Link to="/book/admin/users">User Accounts</Link>
          </NavDropdown>
        </>
      );
    }

    return null;
  };

  return (
    <div className="layout">
      <header className="header">
        <div className="header-content">
          <Link to="/book" className="logo">
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

          {/* User name shown on header */}
          <div className="header-user-info">
            {user && <span className="user-name">{user.name}</span>}
          </div>

          {/* Hamburger menu button - always visible */}
          <button
            className={`hamburger-btn ${mobileMenuOpen ? 'open' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>

          {/* Slide-out navigation menu */}
          {mobileMenuOpen && <div className="nav-overlay" onClick={() => setMobileMenuOpen(false)} />}
          <nav className={`nav ${mobileMenuOpen ? 'nav-open' : ''}`}>
            <div className="nav-header">
              <span className="nav-title">Menu</span>
              <button className="nav-close-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                &times;
              </button>
            </div>
            <div className="nav-content" onClick={(e) => {
              // Close menu when clicking any link or button
              const target = e.target as HTMLElement;
              if (target.tagName === 'A' || target.classList.contains('nav-logout-btn')) {
                setMobileMenuOpen(false);
              }
            }}>
              {renderNavigation()}
              {user && (
                <>
                  <div className="nav-divider"></div>
                  <Link to="/change-password">Change Password</Link>
                  <button onClick={handleLogout} className="nav-logout-btn">Logout</button>
                </>
              )}
            </div>
          </nav>
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} {venueName}</p>
      </footer>

      {/* Feed alert notification popup for livery users */}
      <FeedAlertPopup />

      {/* Feed change notification popup for yard staff */}
      <FeedNotificationPopup />

      {/* Quote notification popup for livery users */}
      <QuoteAlertPopup />

      {/* Vaccination reminder popup */}
      <VaccinationAlertPopup />

      {/* Flood warning popup for admins */}
      <FloodAlertPopup />

      {/* Staff milestones popup for admins */}
      <StaffMilestonesPopup />

      {/* Thanks notification popup for staff */}
      <ThanksNotificationPopup />
    </div>
  );
}
