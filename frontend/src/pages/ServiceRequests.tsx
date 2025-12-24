import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { servicesApi, horsesApi, liveryPackagesApi, rehabApi } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import type {
  Service,
  MyServiceRequestsSummary,
  Horse,
  ServiceCategory,
  PreferredTime,
  CreateServiceRequest,
  LiveryPackage,
  RehabProgram,
  RecurringPattern,
  RehabAssistanceRequest,
  ServiceRequest,
} from '../types';
import './ServiceRequests.css';

type ViewTab = 'packages' | 'extra-services' | 'my-requests' | 'rehab-assistance' | 'insurance-claims';
type CategoryFilter = ServiceCategory | 'all';

export function ServiceRequests() {
  const { settings } = useSettings();
  const { user } = useAuth();

  // Only livery users can access this page
  const isLivery = user?.role === 'livery';

  const [activeTab, setActiveTab] = useState<ViewTab>('packages');
  const [packages, setPackages] = useState<LiveryPackage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [myRequests, setMyRequests] = useState<MyServiceRequestsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  // Rehab assistance state
  const [rehabPrograms, setRehabPrograms] = useState<RehabProgram[]>([]);
  const [selectedRehabProgram, setSelectedRehabProgram] = useState<RehabProgram | null>(null);
  const [showRehabForm, setShowRehabForm] = useState(false);

  // Insurance claims state
  const [insuranceClaims, setInsuranceClaims] = useState<ServiceRequest[]>([]);
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  const [insuranceFilters, setInsuranceFilters] = useState<{
    horseId?: number;
    month: string; // YYYY-MM format
  }>({
    horseId: undefined,
    month: getCurrentMonth(),
  });

  // Get date range from month
  const getMonthDateRange = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const [rehabForm, setRehabForm] = useState<RehabAssistanceRequest>({
    horse_id: 0,
    rehab_program_id: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    special_instructions: '',
  });

  // Redirect non-livery users
  if (user && !isLivery) {
    return <Navigate to="/book" replace />;
  }

  // Request form state
  const [requestForm, setRequestForm] = useState<CreateServiceRequest>({
    service_id: '',
    horse_id: 0,
    requested_date: '',
    preferred_time: 'any',
    special_instructions: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Load packages first (public endpoint, always works)
      const packagesData = await liveryPackagesApi.list(true);
      setPackages(packagesData);

      // Load services (public endpoint)
      const servicesData = await servicesApi.list();
      setServices(servicesData);

      // Load user-specific data (may fail if not authenticated)
      try {
        const [horsesData, requestsData] = await Promise.all([
          horsesApi.list(),
          servicesApi.getMyRequests(),
        ]);
        setHorses(horsesData);
        setMyRequests(requestsData);

        // Load active rehab programs for user's horses
        const activePrograms: RehabProgram[] = [];
        for (const horse of horsesData) {
          try {
            const programs = await rehabApi.getHorsePrograms(horse.id);
            const active = programs.filter(p => p.status === 'active');
            activePrograms.push(...active);
          } catch {
            // Ignore errors for individual horses
          }
        }
        setRehabPrograms(activePrograms);
      } catch {
        // User data failed to load - that's ok, we can still show packages
        setHorses([]);
        setMyRequests(null);
        setRehabPrograms([]);
      }
    } catch {
      setError('Failed to load livery services');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRequestService = (service: Service) => {
    setSelectedService(service);
    const minDate = new Date();
    minDate.setHours(minDate.getHours() + service.advance_notice_hours);
    setRequestForm({
      service_id: service.id,
      horse_id: horses.length > 0 ? horses[0].id : 0,
      requested_date: minDate.toISOString().split('T')[0],
      preferred_time: 'any',
      special_instructions: '',
    });
    setShowRequestForm(true);
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestForm.horse_id) {
      setError('Please select a horse');
      return;
    }
    try {
      await servicesApi.createRequest(requestForm);
      setShowRequestForm(false);
      setSelectedService(null);
      await loadData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit request';
      setError(errorMessage);
    }
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm('Cancel this service request?')) return;
    try {
      await servicesApi.cancelRequest(requestId);
      await loadData();
    } catch {
      setError('Failed to cancel request');
    }
  };

  const handleAcceptQuote = async (requestId: number) => {
    try {
      await servicesApi.acceptQuote(requestId);
      await loadData();
    } catch {
      setError('Failed to accept quote');
    }
  };

  const handleRejectQuote = async (requestId: number) => {
    if (!confirm('Decline this quote? This will cancel the request.')) return;
    try {
      await servicesApi.rejectQuote(requestId);
      await loadData();
    } catch {
      setError('Failed to decline quote');
    }
  };

  const handleOpenRehabForm = (program: RehabProgram) => {
    setSelectedRehabProgram(program);
    setRehabForm({
      horse_id: program.horse_id,
      rehab_program_id: program.id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      special_instructions: '',
    });
    setShowRehabForm(true);
  };

  const handleSubmitRehabRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await servicesApi.createRehabAssistanceRequest(rehabForm);
      setShowRehabForm(false);
      setSelectedRehabProgram(null);
      await loadData();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to submit rehab assistance request';
      setError(errorMessage);
    }
  };

  const handleCancelRecurringSeries = async (seriesId: number) => {
    if (!confirm('Cancel all future requests in this recurring series?')) return;
    try {
      await servicesApi.cancelRecurringSeries(seriesId);
      await loadData();
    } catch {
      setError('Failed to cancel recurring series');
    }
  };

  const loadInsuranceClaims = async () => {
    try {
      const { startDate, endDate } = getMonthDateRange(insuranceFilters.month);
      const claims = await servicesApi.getMyInsuranceClaims(
        insuranceFilters.horseId,
        startDate,
        endDate
      );
      setInsuranceClaims(claims);
    } catch {
      setError('Failed to load insurance claims');
    }
  };

  const handleToggleInsurance = async (requestId: number, value: boolean) => {
    try {
      await servicesApi.toggleInsuranceClaimable(requestId, value);
      await loadInsuranceClaims();
    } catch {
      setError('Failed to update insurance status');
    }
  };

  const handleDownloadStatement = async () => {
    try {
      const { startDate, endDate } = getMonthDateRange(insuranceFilters.month);
      await servicesApi.downloadInsuranceStatementPdf(
        insuranceFilters.horseId,
        startDate,
        endDate
      );
    } catch {
      setError('Failed to download insurance statement. Make sure you have marked at least one service as claimable.');
    }
  };

  // Load insurance claims when tab is switched or filters change
  useEffect(() => {
    if (activeTab === 'insurance-claims' && user) {
      loadInsuranceClaims();
    }
  }, [activeTab, insuranceFilters.horseId, insuranceFilters.month]);

  const getRecurringPatternLabel = (pattern: RecurringPattern) => {
    const labels: Record<RecurringPattern, string> = {
      none: 'One-time',
      daily: 'Daily',
      weekdays: 'Weekdays (Mon-Fri)',
      custom: 'Custom Days',
    };
    return labels[pattern];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  };

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `£${numPrice.toFixed(2)}`;
  };

  // Get the most recent request for a rehab program to determine button state
  const getRehabRequestState = (programId: number): {
    status: 'none' | 'pending' | 'quoted' | 'approved';
    request?: ServiceRequest;
  } => {
    if (!myRequests) return { status: 'none' };

    // Check quoted requests first (most actionable)
    const quotedRequest = myRequests.quoted_requests.find(
      r => r.rehab_program_id === programId
    );
    if (quotedRequest) return { status: 'quoted', request: quotedRequest };

    // Check pending requests (awaiting quote)
    const pendingRequest = myRequests.pending_requests.find(
      r => r.rehab_program_id === programId
    );
    if (pendingRequest) return { status: 'pending', request: pendingRequest };

    // Check scheduled requests (already approved)
    const scheduledRequest = myRequests.scheduled_requests.find(
      r => r.rehab_program_id === programId
    );
    if (scheduledRequest) return { status: 'approved', request: scheduledRequest };

    return { status: 'none' };
  };

  const getCategoryLabel = (category: ServiceCategory) => {
    const labels: Record<ServiceCategory, string> = {
      exercise: 'Exercise',
      schooling: 'Schooling',
      grooming: 'Grooming',
      third_party: 'Other Services',
      rehab: 'Rehab Assistance',
    };
    return labels[category];
  };

  const getStatusBadgeClass = (status: string) => {
    const classes: Record<string, string> = {
      pending: 'status-pending',
      approved: 'status-approved',
      scheduled: 'status-scheduled',
      in_progress: 'status-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
    };
    return classes[status] || '';
  };

  const getPreferredTimeLabel = (time: PreferredTime) => {
    const labels: Record<PreferredTime, string> = {
      morning: 'Morning',
      afternoon: 'Afternoon',
      evening: 'Evening',
      any: 'Any Time',
    };
    return labels[time];
  };

  const filteredServices = services.filter(
    (s) => categoryFilter === 'all' || s.category === categoryFilter
  );

  const groupedServices = filteredServices.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<ServiceCategory, Service[]>);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="service-requests-page">
      <div className="page-header">
        <h1>Livery Services</h1>
        <p className="page-subtitle">View our livery packages and request additional services for your horse</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'packages' ? 'active' : ''}`}
          onClick={() => setActiveTab('packages')}
        >
          Livery Packages
        </button>
        <button
          className={`tab ${activeTab === 'extra-services' ? 'active' : ''}`}
          onClick={() => setActiveTab('extra-services')}
        >
          Extra Services
        </button>
        {user && (
          <button
            className={`tab ${activeTab === 'my-requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('my-requests')}
          >
            My Requests
            {myRequests && (myRequests.pending_requests.length + (myRequests.quoted_requests?.length || 0)) > 0 && (
              <span className="badge">{myRequests.pending_requests.length + (myRequests.quoted_requests?.length || 0)}</span>
            )}
          </button>
        )}
        {user && rehabPrograms.length > 0 && (
          <button
            className={`tab ${activeTab === 'rehab-assistance' ? 'active' : ''}`}
            onClick={() => setActiveTab('rehab-assistance')}
          >
            Rehab Assistance
            <span className="badge rehab">{rehabPrograms.length}</span>
          </button>
        )}
        {user && (
          <button
            className={`tab ${activeTab === 'insurance-claims' ? 'active' : ''}`}
            onClick={() => setActiveTab('insurance-claims')}
          >
            Insurance Claims
          </button>
        )}
      </div>

      <div className="tab-content">
        {/* Livery Packages */}
        {activeTab === 'packages' && (
          <div className="packages-section">
            {packages.length === 0 ? (
              <p className="no-packages">No livery packages available at this time.</p>
            ) : (
              <div className="packages-grid">
                {packages.map((pkg) => (
                  <div key={pkg.id} className={`package-card ${pkg.is_featured ? 'popular' : ''}`}>
                    {pkg.is_featured && <div className="popular-badge">Featured</div>}
                    <h3 className="package-name">{pkg.name}</h3>
                    <div className="package-price">
                      <span className="price-amount">{pkg.price_display}</span>
                      <span className="price-period">per week</span>
                    </div>
                    {pkg.description && (
                      <p className="package-description">{pkg.description}</p>
                    )}
                    {pkg.features && pkg.features.length > 0 && (
                      <ul className="package-features">
                        {pkg.features.map((feature, idx) => (
                          <li key={idx}>{feature}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="enquiry-section">
              <h3>Interested in Our Livery Services?</h3>
              <p>
                To enquire about availability or to arrange a visit, please contact us:
              </p>
              <div className="contact-info">
                {settings?.contact_phone && (
                  <p><strong>Phone:</strong> {settings.contact_phone}</p>
                )}
                {settings?.contact_email && (
                  <p><strong>Email:</strong> <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></p>
                )}
              </div>
              {user?.role === 'livery' && (
                <div className="current-livery-notice">
                  <p>You are currently a livery client. To discuss changes to your package, please contact us directly.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Extra Services */}
        {activeTab === 'extra-services' && (
          <div className="catalog-section">
            {horses.length === 0 && user && (
              <div className="warning-banner">
                You need to add a horse before you can request services.
              </div>
            )}

            <div className="category-filters">
              <button
                className={`filter-btn ${categoryFilter === 'all' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${categoryFilter === 'exercise' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('exercise')}
              >
                Exercise
              </button>
              <button
                className={`filter-btn ${categoryFilter === 'schooling' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('schooling')}
              >
                Schooling
              </button>
              <button
                className={`filter-btn ${categoryFilter === 'grooming' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('grooming')}
              >
                Grooming
              </button>
              <button
                className={`filter-btn ${categoryFilter === 'third_party' ? 'active' : ''}`}
                onClick={() => setCategoryFilter('third_party')}
              >
                Other
              </button>
            </div>

            {Object.entries(groupedServices).length === 0 ? (
              <p className="no-services">No extra services available at this time.</p>
            ) : (
              Object.entries(groupedServices).map(([category, categoryServices]) => (
                <div key={category} className="service-category">
                  <h2>{getCategoryLabel(category as ServiceCategory)}</h2>
                  <div className="services-grid">
                    {categoryServices.map((service) => (
                      <div key={service.id} className="service-card">
                        <div className="service-header">
                          <h3>{service.name}</h3>
                          <span className="service-price">{formatPrice(service.price_gbp)}</span>
                        </div>
                        {service.description && (
                          <p className="service-description">{service.description}</p>
                        )}
                        <div className="service-meta">
                          {service.duration_minutes && (
                            <span className="duration">{service.duration_minutes} mins</span>
                          )}
                          <span className="notice">
                            {service.advance_notice_hours}h notice required
                          </span>
                          {service.requires_approval && (
                            <span className="approval-required">Requires approval</span>
                          )}
                        </div>
                        <button
                          className="request-btn"
                          onClick={() => handleRequestService(service)}
                          disabled={horses.length === 0 || !user}
                        >
                          {user ? 'Request Service' : 'Login to Request'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* My Requests */}
        {activeTab === 'my-requests' && myRequests && (
          <div className="my-requests-section">
            {/* Quoted - Awaiting User Approval */}
            {myRequests.quoted_requests && myRequests.quoted_requests.length > 0 && (
              <div className="requests-group quoted-requests">
                <h2>Quotes Awaiting Your Approval</h2>
                <div className="requests-list">
                  {myRequests.quoted_requests.map((request) => (
                    <div key={request.id} className="request-card quote-card">
                      <div className="request-header">
                        <strong>{request.service_name}</strong>
                        <span className="status-badge quoted">Quote Received</span>
                      </div>
                      <div className="request-details">
                        <p>
                          <strong>Horse:</strong> {request.horse_name}
                        </p>
                        <p>
                          <strong>Requested for:</strong> {formatDate(request.requested_date)}
                        </p>
                        {request.special_instructions && (
                          <p className="instructions">
                            <strong>Details:</strong> {request.special_instructions}
                          </p>
                        )}
                      </div>
                      <div className="quote-details">
                        <div className="quote-amount">
                          <span className="quote-label">Quoted Price:</span>
                          <span className="quote-value">{formatPrice(request.quote_amount || 0)}</span>
                        </div>
                        {request.quote_notes && (
                          <p className="quote-notes">
                            <strong>Notes:</strong> {request.quote_notes}
                          </p>
                        )}
                        <p className="quote-meta">
                          Quoted by {request.quoted_by_name} on{' '}
                          {request.quoted_at ? formatDateTime(request.quoted_at) : 'N/A'}
                        </p>
                      </div>
                      <div className="request-actions quote-actions">
                        <button
                          onClick={() => handleAcceptQuote(request.id)}
                          className="accept-btn"
                        >
                          Accept Quote
                        </button>
                        <button
                          onClick={() => handleRejectQuote(request.id)}
                          className="decline-btn"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending & Scheduled */}
            {(myRequests.pending_requests.length > 0 ||
              myRequests.scheduled_requests.length > 0) && (
              <div className="requests-group">
                <h2>Active Requests</h2>
                <div className="requests-list">
                  {[...myRequests.pending_requests, ...myRequests.scheduled_requests].map(
                    (request) => (
                      <div key={request.id} className="request-card">
                        <div className="request-header">
                          <strong>{request.service_name}</strong>
                          <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                            {request.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="request-details">
                          <p>
                            <strong>Horse:</strong> {request.horse_name}
                          </p>
                          <p>
                            <strong>Requested for:</strong> {formatDate(request.requested_date)} (
                            {getPreferredTimeLabel(request.preferred_time)})
                          </p>
                          {request.scheduled_datetime && (
                            <p>
                              <strong>Scheduled:</strong>{' '}
                              {formatDateTime(request.scheduled_datetime)}
                            </p>
                          )}
                          {request.assigned_to_name && (
                            <p>
                              <strong>Assigned to:</strong> {request.assigned_to_name}
                            </p>
                          )}
                          {request.special_instructions && (
                            <p className="instructions">
                              <strong>Instructions:</strong> {request.special_instructions}
                            </p>
                          )}
                          <p className="price">
                            <strong>Cost:</strong>{' '}
                            {request.charge_amount
                              ? formatPrice(request.charge_amount)
                              : formatPrice(request.service_price || 0)}
                          </p>
                        </div>
                        {request.status === 'pending' && (
                          <div className="request-actions">
                            <button
                              onClick={() => handleCancelRequest(request.id)}
                              className="cancel-btn"
                            >
                              Cancel Request
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Completed */}
            {myRequests.completed_requests.length > 0 && (
              <div className="requests-group">
                <h2>Recent Completed</h2>
                <div className="requests-list">
                  {myRequests.completed_requests.map((request) => (
                    <div key={request.id} className="request-card completed">
                      <div className="request-header">
                        <strong>{request.service_name}</strong>
                        <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                          Completed
                        </span>
                      </div>
                      <div className="request-details">
                        <p>
                          <strong>Horse:</strong> {request.horse_name}
                        </p>
                        <p>
                          <strong>Completed:</strong>{' '}
                          {request.completed_datetime
                            ? formatDateTime(request.completed_datetime)
                            : 'N/A'}
                        </p>
                        {request.notes && (
                          <p className="notes">
                            <strong>Notes:</strong> {request.notes}
                          </p>
                        )}
                        <p className="price">
                          <strong>Charged:</strong>{' '}
                          {request.charge_amount ? formatPrice(request.charge_amount) : 'N/A'} (
                          {request.charge_status})
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myRequests.pending_requests.length === 0 &&
              (!myRequests.quoted_requests || myRequests.quoted_requests.length === 0) &&
              myRequests.scheduled_requests.length === 0 &&
              myRequests.completed_requests.length === 0 && (
                <p className="no-requests">No service requests yet</p>
              )}
          </div>
        )}

        {activeTab === 'my-requests' && !myRequests && (
          <p className="no-requests">Unable to load your requests. Please try again later.</p>
        )}

        {/* Rehab Assistance */}
        {activeTab === 'rehab-assistance' && (
          <div className="rehab-assistance-section">
            <div className="section-intro">
              <h2>Rehab Assistance</h2>
              <p>
                Request a quote for staff to help with your horse's rehabilitation exercises.
                Submit your request and admin will provide pricing.
              </p>
            </div>

            {rehabPrograms.length === 0 ? (
              <p className="no-programs">No active rehab programs for your horses.</p>
            ) : (
              <div className="rehab-programs-list">
                {rehabPrograms.map((program) => {
                  const horse = horses.find(h => h.id === program.horse_id);
                  const requestState = getRehabRequestState(program.id);
                  return (
                    <div key={program.id} className="rehab-program-card">
                      <div className="program-header">
                        <h3>{program.name}</h3>
                        <span className="horse-name">{horse?.name || 'Unknown Horse'}</span>
                      </div>
                      <div className="program-info">
                        {program.reason && <p><strong>Condition:</strong> {program.reason}</p>}
                        <p><strong>Phase:</strong> {program.current_phase}</p>
                        {program.notes && (
                          <p className="vet-notes"><strong>Notes:</strong> {program.notes}</p>
                        )}
                      </div>
                      <div className="program-actions">
                        {requestState.status === 'none' && (
                          <button
                            className="request-assistance-btn"
                            onClick={() => handleOpenRehabForm(program)}
                          >
                            Request Quote
                          </button>
                        )}
                        {requestState.status === 'pending' && (
                          <button
                            className="request-assistance-btn pending"
                            disabled
                          >
                            Pending Price
                          </button>
                        )}
                        {requestState.status === 'quoted' && requestState.request && (
                          <div className="quote-actions">
                            <button
                              className="request-assistance-btn accept"
                              onClick={() => handleAcceptQuote(requestState.request!.id)}
                            >
                              Accept {formatPrice(requestState.request.quote_amount || 0)}
                            </button>
                            <button
                              className="request-assistance-btn decline"
                              onClick={() => handleRejectQuote(requestState.request!.id)}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        {requestState.status === 'approved' && (
                          <button
                            className="request-assistance-btn approved"
                            disabled
                          >
                            Accepted
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Rehab Service Requests */}
            {myRequests && myRequests.pending_requests.filter(r => r.service_category === 'rehab').length > 0 && (
              <div className="rehab-requests-section">
                <h3>Your Active Rehab Assistance Requests</h3>
                <div className="requests-list">
                  {myRequests.pending_requests
                    .filter(r => r.service_category === 'rehab')
                    .map((request) => (
                      <div key={request.id} className="request-card rehab-request">
                        <div className="request-header">
                          <strong>{request.rehab_program_name || 'Rehab Assistance'}</strong>
                          <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>
                            {request.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className="request-details">
                          <p><strong>Horse:</strong> {request.horse_name}</p>
                          <p><strong>Date:</strong> {formatDate(request.requested_date)}</p>
                          {request.recurring_pattern && request.recurring_pattern !== 'none' && (
                            <p className="recurring-info">
                              <strong>Recurring:</strong> {getRecurringPatternLabel(request.recurring_pattern)}
                              {request.recurring_end_date && (
                                <> until {formatDate(request.recurring_end_date)}</>
                              )}
                            </p>
                          )}
                        </div>
                        <div className="request-actions">
                          {request.recurring_series_id ? (
                            <button
                              onClick={() => handleCancelRecurringSeries(request.recurring_series_id!)}
                              className="cancel-btn"
                            >
                              Cancel All Future
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCancelRequest(request.id)}
                              className="cancel-btn"
                            >
                              Cancel Request
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Insurance Claims */}
        {activeTab === 'insurance-claims' && user && (
          <div className="insurance-claims-section">
            <div className="section-intro">
              <h2>Rehab Insurance Claims</h2>
              <p>
                Mark completed rehab services as insurance claimable and generate statements for your insurer.
              </p>
            </div>

            <div className="insurance-filters">
              <div className="filter-row">
                <div className="filter-group">
                  <label>Horse</label>
                  <select
                    value={insuranceFilters.horseId || ''}
                    onChange={(e) =>
                      setInsuranceFilters({
                        ...insuranceFilters,
                        horseId: e.target.value ? parseInt(e.target.value) : undefined,
                      })
                    }
                  >
                    <option value="">All Horses</option>
                    {horses.map((horse) => (
                      <option key={horse.id} value={horse.id}>
                        {horse.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Month</label>
                  <input
                    type="month"
                    value={insuranceFilters.month}
                    onChange={(e) =>
                      setInsuranceFilters({ ...insuranceFilters, month: e.target.value })
                    }
                    max={getCurrentMonth()}
                  />
                </div>
              </div>
              <div className="month-display">
                <strong>Showing claims for: {formatMonthDisplay(insuranceFilters.month)}</strong>
              </div>
            </div>

            {insuranceClaims.length === 0 ? (
              <p className="no-claims">No completed rehab services found for the selected period.</p>
            ) : (
              <>
                <div className="claims-list">
                  <h3>Completed Rehab Services</h3>
                  <p className="list-info">Check the box to mark services for your insurance claim:</p>
                  <table className="claims-table">
                    <thead>
                      <tr>
                        <th>Claim?</th>
                        <th>Date</th>
                        <th>Service</th>
                        <th>Horse</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insuranceClaims.map((claim) => (
                        <tr key={claim.id} className={claim.insurance_claimable ? 'claimable' : ''}>
                          <td>
                            <input
                              type="checkbox"
                              checked={claim.insurance_claimable}
                              onChange={(e) => handleToggleInsurance(claim.id, e.target.checked)}
                            />
                          </td>
                          <td>{formatDate(claim.completed_datetime || claim.requested_date)}</td>
                          <td>{claim.service_name}</td>
                          <td>{claim.horse_name}</td>
                          <td>{formatPrice(claim.charge_amount || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="statement-actions">
                  <button
                    className="btn-primary generate-statement-btn"
                    onClick={handleDownloadStatement}
                    disabled={!insuranceClaims.some(c => c.insurance_claimable)}
                  >
                    Download Insurance Statement (PDF)
                  </button>
                  <p className="statement-help">
                    Generates a PDF statement for {formatMonthDisplay(insuranceFilters.month)} that you can email to your insurance company.
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Request Form Modal */}
      {showRequestForm && selectedService && (
        <div className="modal-overlay" onClick={() => setShowRequestForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Request: {selectedService.name}</h2>
            <p className="modal-price">{formatPrice(selectedService.price_gbp)}</p>

            <form onSubmit={handleSubmitRequest}>
              <div className="form-group">
                <label>Horse</label>
                <select
                  value={requestForm.horse_id}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, horse_id: parseInt(e.target.value) })
                  }
                  required
                >
                  {horses.map((horse) => (
                    <option key={horse.id} value={horse.id}>
                      {horse.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Requested Date</label>
                <input
                  type="date"
                  value={requestForm.requested_date}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, requested_date: e.target.value })
                  }
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
                <small>
                  Minimum {selectedService.advance_notice_hours} hours notice required
                </small>
              </div>

              <div className="form-group">
                <label>Preferred Time</label>
                <select
                  value={requestForm.preferred_time}
                  onChange={(e) =>
                    setRequestForm({
                      ...requestForm,
                      preferred_time: e.target.value as PreferredTime,
                    })
                  }
                >
                  <option value="any">Any Time</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="evening">Evening</option>
                </select>
              </div>

              <div className="form-group">
                <label>Special Instructions</label>
                <textarea
                  value={requestForm.special_instructions}
                  onChange={(e) =>
                    setRequestForm({ ...requestForm, special_instructions: e.target.value })
                  }
                  placeholder="Any special requirements or notes..."
                  rows={3}
                />
              </div>

              {selectedService.requires_approval && (
                <div className="approval-notice">
                  This service requires staff approval before scheduling.
                  {selectedService.approval_reason && (
                    <p>{selectedService.approval_reason}</p>
                  )}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowRequestForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rehab Assistance Request Form Modal */}
      {showRehabForm && selectedRehabProgram && (
        <div className="modal-overlay" onClick={() => setShowRehabForm(false)}>
          <div className="modal rehab-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Request Quote for Staff Assistance</h2>
            <p className="modal-subtitle">
              {selectedRehabProgram.name} - {horses.find(h => h.id === selectedRehabProgram.horse_id)?.name}
            </p>

            <form onSubmit={handleSubmitRehabRequest}>
              <p className="form-intro">
                Request a quote for staff to cover rehab tasks during these dates.
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label>From</label>
                  <input
                    type="date"
                    value={rehabForm.start_date}
                    onChange={(e) => {
                      const newStart = e.target.value;
                      setRehabForm({
                        ...rehabForm,
                        start_date: newStart,
                        end_date: rehabForm.end_date < newStart ? newStart : rehabForm.end_date,
                      });
                    }}
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Until</label>
                  <input
                    type="date"
                    value={rehabForm.end_date}
                    onChange={(e) =>
                      setRehabForm({ ...rehabForm, end_date: e.target.value })
                    }
                    min={rehabForm.start_date}
                    required
                  />
                </div>
              </div>
              <span className="form-hint">
                {rehabForm.start_date === rehabForm.end_date
                  ? 'Single day'
                  : `${Math.ceil((new Date(rehabForm.end_date).getTime() - new Date(rehabForm.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} days`}
              </span>

              <div className="form-group">
                <label>Notes (optional)</label>
                <textarea
                  value={rehabForm.special_instructions}
                  onChange={(e) =>
                    setRehabForm({ ...rehabForm, special_instructions: e.target.value })
                  }
                  placeholder="Any special notes for staff..."
                  rows={2}
                />
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowRehabForm(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Request Quote
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
