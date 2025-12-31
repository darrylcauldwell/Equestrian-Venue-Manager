import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { servicesApi, horsesApi, liveryPackagesApi, rehabApi } from '../services/api';
import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import { useModalForm } from '../hooks';
import { Modal, ConfirmModal, FormGroup, FormRow, Input, Select, Textarea } from '../components/ui';
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

const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  exercise: 'Exercise',
  schooling: 'Schooling',
  grooming: 'Grooming',
  third_party: 'Other Services',
  rehab: 'Rehab Assistance',
};

const TIME_OPTIONS: { value: PreferredTime; label: string }[] = [
  { value: 'any', label: 'Any Time' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

const RECURRING_LABELS: Record<RecurringPattern, string> = {
  none: 'One-time',
  daily: 'Daily',
  weekdays: 'Weekdays (Mon-Fri)',
  custom: 'Custom Days',
};

export function ServiceRequests() {
  const { settings } = useSettings();
  const { user } = useAuth();
  const isLivery = user?.role === 'livery';

  // Data state - default to 'extra-services' for logged-in users since they don't see packages tab
  const [activeTab, setActiveTab] = useState<ViewTab>(user ? 'extra-services' : 'packages');
  const [packages, setPackages] = useState<LiveryPackage[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [horses, setHorses] = useState<Horse[]>([]);
  const [myRequests, setMyRequests] = useState<MyServiceRequestsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  // Rehab state
  const [rehabPrograms, setRehabPrograms] = useState<RehabProgram[]>([]);

  // Insurance claims state
  const [insuranceClaims, setInsuranceClaims] = useState<ServiceRequest[]>([]);
  const getCurrentMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };
  const [insuranceFilters, setInsuranceFilters] = useState<{
    horseId?: number;
    month: string;
  }>({ horseId: undefined, month: getCurrentMonth() });

  // Modal hooks - replaces showRequestForm, selectedService, requestForm, showRehabForm, etc.
  const requestModal = useModalForm<CreateServiceRequest & { service?: Service }>({
    service_id: '',
    horse_id: 0,
    requested_date: '',
    preferred_time: 'any',
    special_instructions: '',
  });

  const rehabModal = useModalForm<RehabAssistanceRequest & { program?: RehabProgram }>({
    horse_id: 0,
    rehab_program_id: 0,
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    special_instructions: '',
  });

  // Confirm modals
  const [cancelTarget, setCancelTarget] = useState<{ id: number; seriesId?: number } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);

  // Helper functions
  const getMonthDateRange = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
    };
  };

  const formatMonthDisplay = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-GB');

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });

  const formatPrice = (price: number | string) => {
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return `£${numPrice.toFixed(2)}`;
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

  // Data loading
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const packagesData = await liveryPackagesApi.list(true);
      setPackages(packagesData);

      const servicesData = await servicesApi.list();
      setServices(servicesData);

      try {
        const [horsesData, requestsData] = await Promise.all([
          horsesApi.list(),
          servicesApi.getMyRequests(),
        ]);
        setHorses(horsesData);
        setMyRequests(requestsData);

        const activePrograms: RehabProgram[] = [];
        for (const horse of horsesData) {
          try {
            const programs = await rehabApi.getHorsePrograms(horse.id);
            activePrograms.push(...programs.filter(p => p.status === 'active'));
          } catch { /* ignore */ }
        }
        setRehabPrograms(activePrograms);
      } catch {
        setHorses([]);
        setMyRequests(null);
        setRehabPrograms([]);
      }
    } catch {
      setError('Failed to load livery services');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadInsuranceClaims = async () => {
    try {
      const { startDate, endDate } = getMonthDateRange(insuranceFilters.month);
      const claims = await servicesApi.getMyInsuranceClaims(insuranceFilters.horseId, startDate, endDate);
      setInsuranceClaims(claims);
    } catch {
      setError('Failed to load insurance claims');
    }
  };

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (activeTab === 'insurance-claims' && user) {
      loadInsuranceClaims();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, insuranceFilters.horseId, insuranceFilters.month, user]);

  // Redirect non-livery users
  if (user && !isLivery) {
    return <Navigate to="/book" replace />;
  }

  // Handlers
  const handleRequestService = (service: Service) => {
    const minDate = new Date();
    minDate.setHours(minDate.getHours() + service.advance_notice_hours);
    requestModal.open({
      service_id: service.id,
      horse_id: horses.length > 0 ? horses[0].id : 0,
      requested_date: minDate.toISOString().split('T')[0],
      preferred_time: 'any',
      special_instructions: '',
      service,
    });
  };

  const handleSubmitRequest = async () => {
    if (!requestModal.formData.horse_id) {
      setError('Please select a horse');
      return;
    }
    try {
      const { service: _service, ...data } = requestModal.formData;
      void _service;
      await servicesApi.createRequest(data);
      requestModal.close();
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try {
      if (cancelTarget.seriesId) {
        await servicesApi.cancelRecurringSeries(cancelTarget.seriesId);
      } else {
        await servicesApi.cancelRequest(cancelTarget.id);
      }
      setCancelTarget(null);
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

  const handleRejectConfirm = async () => {
    if (!rejectTarget) return;
    try {
      await servicesApi.rejectQuote(rejectTarget);
      setRejectTarget(null);
      await loadData();
    } catch {
      setError('Failed to decline quote');
    }
  };

  const handleOpenRehabForm = (program: RehabProgram) => {
    rehabModal.open({
      horse_id: program.horse_id,
      rehab_program_id: program.id,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      special_instructions: '',
      program,
    });
  };

  const handleSubmitRehabRequest = async () => {
    try {
      const { program: _program, ...data } = rehabModal.formData;
      void _program;
      await servicesApi.createRehabAssistanceRequest(data);
      rehabModal.close();
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit rehab assistance request');
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
      await servicesApi.downloadInsuranceStatementPdf(insuranceFilters.horseId, startDate, endDate);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to download insurance statement. Make sure you have marked at least one service as claimable.');
      }
    }
  };

  const getRehabRequestState = (programId: number): { status: 'none' | 'pending' | 'quoted' | 'approved'; request?: ServiceRequest } => {
    if (!myRequests) return { status: 'none' };
    const quoted = myRequests.quoted_requests.find(r => r.rehab_program_id === programId);
    if (quoted) return { status: 'quoted', request: quoted };
    const pending = myRequests.pending_requests.find(r => r.rehab_program_id === programId);
    if (pending) return { status: 'pending', request: pending };
    const scheduled = myRequests.scheduled_requests.find(r => r.rehab_program_id === programId);
    if (scheduled) return { status: 'approved', request: scheduled };
    return { status: 'none' };
  };

  // Filtered services
  const filteredServices = services.filter(s => categoryFilter === 'all' || s.category === categoryFilter);
  const groupedServices = filteredServices.reduce((acc, service) => {
    if (!acc[service.category]) acc[service.category] = [];
    acc[service.category].push(service);
    return acc;
  }, {} as Record<ServiceCategory, Service[]>);

  if (isLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  return (
    <div className="service-requests-page">
      <div className="page-header">
        <h1>Livery Services</h1>
        <p className="page-subtitle">View our livery packages and request additional services for your horse</p>
      </div>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Tabs */}
      <div className="ds-tabs">
        {/* Only show Livery Packages tab to non-logged-in users browsing options */}
        {!user && (
          <button className={`ds-tab ${activeTab === 'packages' ? 'active' : ''}`} onClick={() => setActiveTab('packages')}>
            Livery Packages
          </button>
        )}
        <button className={`ds-tab ${activeTab === 'extra-services' ? 'active' : ''}`} onClick={() => setActiveTab('extra-services')}>
          Request Services
        </button>
        {user && (
          <button className={`ds-tab ${activeTab === 'my-requests' ? 'active' : ''}`} onClick={() => setActiveTab('my-requests')}>
            My Requests
            {myRequests && (myRequests.pending_requests.length + (myRequests.quoted_requests?.length || 0)) > 0 && (
              <span className="tab-badge">{myRequests.pending_requests.length + (myRequests.quoted_requests?.length || 0)}</span>
            )}
          </button>
        )}
        {user && rehabPrograms.length > 0 && (
          <button className={`ds-tab ${activeTab === 'rehab-assistance' ? 'active' : ''}`} onClick={() => setActiveTab('rehab-assistance')}>
            Rehab Assistance
          </button>
        )}
        {user && (
          <button className={`ds-tab ${activeTab === 'insurance-claims' ? 'active' : ''}`} onClick={() => setActiveTab('insurance-claims')}>
            Insurance Claims
          </button>
        )}
      </div>

      <div className="tab-content">
        {/* Livery Packages Tab */}
        {activeTab === 'packages' && (
          <PackagesTab packages={packages} settings={settings} user={user} />
        )}

        {/* Extra Services Tab */}
        {activeTab === 'extra-services' && (
          <ExtraServicesTab
            groupedServices={groupedServices}
            horses={horses}
            user={user}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            formatPrice={formatPrice}
            onRequestService={handleRequestService}
          />
        )}

        {/* My Requests Tab */}
        {activeTab === 'my-requests' && (
          <MyRequestsTab
            myRequests={myRequests}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            formatPrice={formatPrice}
            getStatusBadgeClass={getStatusBadgeClass}
            onAcceptQuote={handleAcceptQuote}
            onRejectQuote={setRejectTarget}
            onCancelRequest={(id, seriesId) => setCancelTarget({ id, seriesId })}
          />
        )}

        {/* Rehab Assistance Tab */}
        {activeTab === 'rehab-assistance' && (
          <RehabAssistanceTab
            rehabPrograms={rehabPrograms}
            horses={horses}
            myRequests={myRequests}
            formatDate={formatDate}
            formatPrice={formatPrice}
            getStatusBadgeClass={getStatusBadgeClass}
            getRehabRequestState={getRehabRequestState}
            onOpenRehabForm={handleOpenRehabForm}
            onAcceptQuote={handleAcceptQuote}
            onRejectQuote={setRejectTarget}
            onCancelRequest={(id, seriesId) => setCancelTarget({ id, seriesId })}
          />
        )}

        {/* Insurance Claims Tab */}
        {activeTab === 'insurance-claims' && user && (
          <InsuranceClaimsTab
            insuranceClaims={insuranceClaims}
            horses={horses}
            insuranceFilters={insuranceFilters}
            setInsuranceFilters={setInsuranceFilters}
            getCurrentMonth={getCurrentMonth}
            formatMonthDisplay={formatMonthDisplay}
            formatDate={formatDate}
            formatPrice={formatPrice}
            onToggleInsurance={handleToggleInsurance}
            onDownloadStatement={handleDownloadStatement}
          />
        )}
      </div>

      {/* Service Request Modal */}
      <Modal
        isOpen={requestModal.isOpen}
        onClose={requestModal.close}
        title={`Request: ${requestModal.formData.service?.name || ''}`}
        size="sm"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={requestModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitRequest}>Submit Request</button>
          </>
        }
      >
        {requestModal.formData.service && (
          <p className="modal-price">{formatPrice(requestModal.formData.service.price_gbp)}</p>
        )}

        <FormGroup label="Horse" required>
          <Select
            value={requestModal.formData.horse_id}
            onChange={e => requestModal.updateField('horse_id', parseInt(e.target.value))}
            required
          >
            {horses.map(horse => (
              <option key={horse.id} value={horse.id}>{horse.name}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Requested Date" help={`Minimum ${requestModal.formData.service?.advance_notice_hours || 24} hours notice required`} required>
          <Input
            type="date"
            value={requestModal.formData.requested_date}
            onChange={e => requestModal.updateField('requested_date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </FormGroup>

        <FormGroup label="Preferred Time">
          <Select
            value={requestModal.formData.preferred_time}
            onChange={e => requestModal.updateField('preferred_time', e.target.value as PreferredTime)}
          >
            {TIME_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </FormGroup>

        <FormGroup label="Special Instructions">
          <Textarea
            value={requestModal.formData.special_instructions || ''}
            onChange={e => requestModal.updateField('special_instructions', e.target.value)}
            placeholder="Any special requirements or notes..."
            rows={3}
          />
        </FormGroup>

        {requestModal.formData.service?.requires_approval && (
          <div className="approval-notice">
            This service requires staff approval before scheduling.
            {requestModal.formData.service.approval_reason && <p>{requestModal.formData.service.approval_reason}</p>}
          </div>
        )}
      </Modal>

      {/* Rehab Assistance Request Modal */}
      <Modal
        isOpen={rehabModal.isOpen}
        onClose={rehabModal.close}
        title="Request Quote for Staff Assistance"
        size="sm"
        footer={
          <>
            <button className="ds-btn ds-btn-secondary" onClick={rehabModal.close}>Cancel</button>
            <button className="ds-btn ds-btn-primary" onClick={handleSubmitRehabRequest}>Request Quote</button>
          </>
        }
      >
        {rehabModal.formData.program && (
          <p className="modal-subtitle">
            {rehabModal.formData.program.name} - {horses.find(h => h.id === rehabModal.formData.program?.horse_id)?.name}
          </p>
        )}

        <p className="form-intro">Request a quote for staff to cover rehab tasks during these dates.</p>

        <FormRow>
          <FormGroup label="From" required>
            <Input
              type="date"
              value={rehabModal.formData.start_date}
              onChange={e => {
                const newStart = e.target.value;
                rehabModal.updateField('start_date', newStart);
                if (rehabModal.formData.end_date < newStart) {
                  rehabModal.updateField('end_date', newStart);
                }
              }}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </FormGroup>
          <FormGroup label="Until" required>
            <Input
              type="date"
              value={rehabModal.formData.end_date}
              onChange={e => rehabModal.updateField('end_date', e.target.value)}
              min={rehabModal.formData.start_date}
              required
            />
          </FormGroup>
        </FormRow>
        <span className="form-hint">
          {rehabModal.formData.start_date === rehabModal.formData.end_date
            ? 'Single day'
            : `${Math.ceil((new Date(rehabModal.formData.end_date).getTime() - new Date(rehabModal.formData.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1} days`}
        </span>

        <FormGroup label="Notes (optional)">
          <Textarea
            value={rehabModal.formData.special_instructions || ''}
            onChange={e => rehabModal.updateField('special_instructions', e.target.value)}
            placeholder="Any special notes for staff..."
            rows={2}
          />
        </FormGroup>
      </Modal>

      {/* Confirm Cancel Modal */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelConfirm}
        title="Cancel Request"
        message={cancelTarget?.seriesId ? 'Cancel all future requests in this recurring series?' : 'Cancel this service request?'}
        confirmLabel="Cancel Request"
        variant="danger"
      />

      {/* Confirm Reject Quote Modal */}
      <ConfirmModal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleRejectConfirm}
        title="Decline Quote"
        message="Decline this quote? This will cancel the request."
        confirmLabel="Decline"
        variant="danger"
      />
    </div>
  );
}

// Extracted Tab Components

interface PackagesTabProps {
  packages: LiveryPackage[];
  settings: ReturnType<typeof useSettings>['settings'];
  user: ReturnType<typeof useAuth>['user'];
}

function PackagesTab({ packages, settings, user }: PackagesTabProps) {
  return (
    <div className="packages-section">
      {packages.length === 0 ? (
        <p className="no-packages">No livery packages available at this time.</p>
      ) : (
        <div className="packages-grid">
          {packages.map(pkg => (
            <div key={pkg.id} className={`package-card ${pkg.is_featured ? 'popular' : ''}`}>
              {pkg.is_featured && <div className="popular-badge">Featured</div>}
              <h3 className="package-name">{pkg.name}</h3>
              <div className="package-price">
                <span className="price-amount">{pkg.price_display}</span>
                <span className="price-period">per week</span>
              </div>
              {pkg.description && <p className="package-description">{pkg.description}</p>}
              {pkg.features && pkg.features.length > 0 && (
                <ul className="package-features">
                  {pkg.features.map((feature, idx) => <li key={idx}>{feature}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="enquiry-section">
        <h3>Interested in Our Livery Services?</h3>
        <p>To enquire about availability or to arrange a visit, please contact us:</p>
        <div className="contact-info">
          {settings?.contact_phone && <p><strong>Phone:</strong> {settings.contact_phone}</p>}
          {settings?.contact_email && <p><strong>Email:</strong> <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a></p>}
        </div>
        {user?.role === 'livery' && (
          <div className="current-livery-notice">
            <p>You are currently a livery client. To discuss changes to your package, please contact us directly.</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ExtraServicesTabProps {
  groupedServices: Record<ServiceCategory, Service[]>;
  horses: Horse[];
  user: ReturnType<typeof useAuth>['user'];
  categoryFilter: CategoryFilter;
  setCategoryFilter: (filter: CategoryFilter) => void;
  formatPrice: (price: number | string) => string;
  onRequestService: (service: Service) => void;
}

function ExtraServicesTab({ groupedServices, horses, user, categoryFilter, setCategoryFilter, formatPrice, onRequestService }: ExtraServicesTabProps) {
  const categories: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'exercise', label: 'Exercise' },
    { value: 'schooling', label: 'Schooling' },
    { value: 'grooming', label: 'Grooming' },
    { value: 'third_party', label: 'Other' },
  ];

  return (
    <div className="catalog-section">
      {horses.length === 0 && user && (
        <div className="warning-banner">You need to add a horse before you can request services.</div>
      )}

      <div className="category-filters">
        {categories.map(cat => (
          <button
            key={cat.value}
            className={`filter-btn ${categoryFilter === cat.value ? 'active' : ''}`}
            onClick={() => setCategoryFilter(cat.value)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {Object.entries(groupedServices).length === 0 ? (
        <p className="no-services">No extra services available at this time.</p>
      ) : (
        Object.entries(groupedServices).map(([category, categoryServices]) => (
          <div key={category} className="service-category">
            <h2>{CATEGORY_LABELS[category as ServiceCategory]}</h2>
            <div className="services-grid">
              {categoryServices.map(service => (
                <div key={service.id} className="service-card">
                  <div className="service-header">
                    <h3>{service.name}</h3>
                    <span className="service-price">{formatPrice(service.price_gbp)}</span>
                  </div>
                  {service.description && <p className="service-description">{service.description}</p>}
                  <div className="service-meta">
                    {service.duration_minutes && <span className="duration">{service.duration_minutes} mins</span>}
                    <span className="notice">{service.advance_notice_hours}h notice required</span>
                    {service.requires_approval && <span className="approval-required">Requires approval</span>}
                  </div>
                  <button
                    className="request-btn"
                    onClick={() => onRequestService(service)}
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
  );
}

interface MyRequestsTabProps {
  myRequests: MyServiceRequestsSummary | null;
  formatDate: (s: string) => string;
  formatDateTime: (s: string) => string;
  formatPrice: (p: number | string) => string;
  getStatusBadgeClass: (s: string) => string;
  onAcceptQuote: (id: number) => void;
  onRejectQuote: (id: number) => void;
  onCancelRequest: (id: number, seriesId?: number) => void;
}

function MyRequestsTab({ myRequests, formatDate, formatDateTime, formatPrice, getStatusBadgeClass, onAcceptQuote, onRejectQuote, onCancelRequest }: MyRequestsTabProps) {
  if (!myRequests) {
    return <p className="no-requests">Unable to load your requests. Please try again later.</p>;
  }

  const hasNoRequests = myRequests.pending_requests.length === 0 &&
    (!myRequests.quoted_requests || myRequests.quoted_requests.length === 0) &&
    myRequests.scheduled_requests.length === 0 &&
    myRequests.completed_requests.length === 0;

  return (
    <div className="my-requests-section">
      {/* Quoted Requests */}
      {myRequests.quoted_requests && myRequests.quoted_requests.length > 0 && (
        <div className="requests-group quoted-requests">
          <h2>Quotes Awaiting Your Approval</h2>
          <div className="requests-list">
            {myRequests.quoted_requests.map(request => (
              <div key={request.id} className="request-card quote-card">
                <div className="request-header">
                  <strong>{request.service_name}</strong>
                  <span className="status-badge quoted">Quote Received</span>
                </div>
                <div className="request-details">
                  <p><strong>Horse:</strong> {request.horse_name}</p>
                  <p><strong>Requested for:</strong> {formatDate(request.requested_date)}</p>
                  {request.special_instructions && <p className="instructions"><strong>Details:</strong> {request.special_instructions}</p>}
                </div>
                <div className="quote-details">
                  <div className="quote-amount">
                    <span className="quote-label">Quoted Price:</span>
                    <span className="quote-value">{formatPrice(request.quote_amount || 0)}</span>
                  </div>
                  {request.quote_notes && <p className="quote-notes"><strong>Notes:</strong> {request.quote_notes}</p>}
                  <p className="quote-meta">Quoted by {request.quoted_by_name} on {request.quoted_at ? formatDateTime(request.quoted_at) : 'N/A'}</p>
                </div>
                <div className="request-actions quote-actions">
                  <button onClick={() => onAcceptQuote(request.id)} className="accept-btn">Accept Quote</button>
                  <button onClick={() => onRejectQuote(request.id)} className="decline-btn">Decline</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Requests */}
      {(myRequests.pending_requests.length > 0 || myRequests.scheduled_requests.length > 0) && (
        <div className="requests-group">
          <h2>Active Requests</h2>
          <div className="requests-list">
            {[...myRequests.pending_requests, ...myRequests.scheduled_requests].map(request => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <strong>{request.service_name}</strong>
                  <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>{request.status.replace('_', ' ')}</span>
                </div>
                <div className="request-details">
                  <p><strong>Horse:</strong> {request.horse_name}</p>
                  <p><strong>Requested for:</strong> {formatDate(request.requested_date)} ({TIME_OPTIONS.find(t => t.value === request.preferred_time)?.label})</p>
                  {request.scheduled_datetime && <p><strong>Scheduled:</strong> {formatDateTime(request.scheduled_datetime)}</p>}
                  {request.assigned_to_name && <p><strong>Assigned to:</strong> {request.assigned_to_name}</p>}
                  {request.special_instructions && <p className="instructions"><strong>Instructions:</strong> {request.special_instructions}</p>}
                  <p className="price"><strong>Cost:</strong> {request.charge_amount ? formatPrice(request.charge_amount) : formatPrice(request.service_price || 0)}</p>
                </div>
                {request.status === 'pending' && (
                  <div className="request-actions">
                    <button onClick={() => onCancelRequest(request.id)} className="cancel-btn">Cancel Request</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {myRequests.completed_requests.length > 0 && (
        <div className="requests-group">
          <h2>Recent Completed</h2>
          <div className="requests-list">
            {myRequests.completed_requests.map(request => (
              <div key={request.id} className="request-card completed">
                <div className="request-header">
                  <strong>{request.service_name}</strong>
                  <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>Completed</span>
                </div>
                <div className="request-details">
                  <p><strong>Horse:</strong> {request.horse_name}</p>
                  <p><strong>Completed:</strong> {request.completed_datetime ? formatDateTime(request.completed_datetime) : 'N/A'}</p>
                  {request.notes && <p className="notes"><strong>Notes:</strong> {request.notes}</p>}
                  <p className="price"><strong>Charged:</strong> {request.charge_amount ? formatPrice(request.charge_amount) : 'N/A'} ({request.charge_status})</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasNoRequests && <p className="no-requests">No service requests yet</p>}
    </div>
  );
}

interface RehabAssistanceTabProps {
  rehabPrograms: RehabProgram[];
  horses: Horse[];
  myRequests: MyServiceRequestsSummary | null;
  formatDate: (s: string) => string;
  formatPrice: (p: number | string) => string;
  getStatusBadgeClass: (s: string) => string;
  getRehabRequestState: (programId: number) => { status: 'none' | 'pending' | 'quoted' | 'approved'; request?: ServiceRequest };
  onOpenRehabForm: (program: RehabProgram) => void;
  onAcceptQuote: (id: number) => void;
  onRejectQuote: (id: number) => void;
  onCancelRequest: (id: number, seriesId?: number) => void;
}

function RehabAssistanceTab({ rehabPrograms, horses, myRequests, formatDate, formatPrice, getStatusBadgeClass, getRehabRequestState, onOpenRehabForm, onAcceptQuote, onRejectQuote, onCancelRequest }: RehabAssistanceTabProps) {
  return (
    <div className="rehab-assistance-section">
      <div className="section-intro">
        <h2>Rehab Assistance</h2>
        <p>Request a quote for staff to help with your horse's rehabilitation exercises. Submit your request and admin will provide pricing.</p>
      </div>

      {rehabPrograms.length === 0 ? (
        <p className="no-programs">No active rehab programs for your horses.</p>
      ) : (
        <div className="rehab-programs-list">
          {rehabPrograms.map(program => {
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
                  {program.notes && <p className="vet-notes"><strong>Notes:</strong> {program.notes}</p>}
                </div>
                <div className="program-actions">
                  {requestState.status === 'none' && (
                    <button className="request-assistance-btn" onClick={() => onOpenRehabForm(program)}>Request Quote</button>
                  )}
                  {requestState.status === 'pending' && (
                    <button className="request-assistance-btn pending" disabled>Pending Price</button>
                  )}
                  {requestState.status === 'quoted' && requestState.request && (
                    <div className="quote-actions">
                      <button className="request-assistance-btn accept" onClick={() => onAcceptQuote(requestState.request!.id)}>
                        Accept {formatPrice(requestState.request.quote_amount || 0)}
                      </button>
                      <button className="request-assistance-btn decline" onClick={() => onRejectQuote(requestState.request!.id)}>Decline</button>
                    </div>
                  )}
                  {requestState.status === 'approved' && (
                    <button className="request-assistance-btn approved" disabled>Accepted</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Rehab Requests */}
      {myRequests && myRequests.pending_requests.filter(r => r.service_category === 'rehab').length > 0 && (
        <div className="rehab-requests-section">
          <h3>Your Active Rehab Assistance Requests</h3>
          <div className="requests-list">
            {myRequests.pending_requests.filter(r => r.service_category === 'rehab').map(request => (
              <div key={request.id} className="request-card rehab-request">
                <div className="request-header">
                  <strong>{request.rehab_program_name || 'Rehab Assistance'}</strong>
                  <span className={`status-badge ${getStatusBadgeClass(request.status)}`}>{request.status.replace('_', ' ')}</span>
                </div>
                <div className="request-details">
                  <p><strong>Horse:</strong> {request.horse_name}</p>
                  <p><strong>Date:</strong> {formatDate(request.requested_date)}</p>
                  {request.recurring_pattern && request.recurring_pattern !== 'none' && (
                    <p className="recurring-info">
                      <strong>Recurring:</strong> {RECURRING_LABELS[request.recurring_pattern]}
                      {request.recurring_end_date && <> until {formatDate(request.recurring_end_date)}</>}
                    </p>
                  )}
                </div>
                <div className="request-actions">
                  <button onClick={() => onCancelRequest(request.id, request.recurring_series_id)} className="cancel-btn">
                    {request.recurring_series_id ? 'Cancel All Future' : 'Cancel Request'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface InsuranceClaimsTabProps {
  insuranceClaims: ServiceRequest[];
  horses: Horse[];
  insuranceFilters: { horseId?: number; month: string };
  setInsuranceFilters: (f: { horseId?: number; month: string }) => void;
  getCurrentMonth: () => string;
  formatMonthDisplay: (m: string) => string;
  formatDate: (s: string) => string;
  formatPrice: (p: number | string) => string;
  onToggleInsurance: (id: number, value: boolean) => void;
  onDownloadStatement: () => void;
}

function InsuranceClaimsTab({ insuranceClaims, horses, insuranceFilters, setInsuranceFilters, getCurrentMonth, formatMonthDisplay, formatDate, formatPrice, onToggleInsurance, onDownloadStatement }: InsuranceClaimsTabProps) {
  return (
    <div className="insurance-claims-section">
      <div className="section-intro">
        <h2>Rehab Insurance Claims</h2>
        <p>Mark completed rehab services as insurance claimable and generate statements for your insurer.</p>
      </div>

      <div className="insurance-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>Horse</label>
            <select
              value={insuranceFilters.horseId || ''}
              onChange={e => setInsuranceFilters({ ...insuranceFilters, horseId: e.target.value ? parseInt(e.target.value) : undefined })}
            >
              <option value="">All Horses</option>
              {horses.map(horse => <option key={horse.id} value={horse.id}>{horse.name}</option>)}
            </select>
          </div>
          <div className="filter-group">
            <label>Month</label>
            <input
              type="month"
              value={insuranceFilters.month}
              onChange={e => setInsuranceFilters({ ...insuranceFilters, month: e.target.value })}
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
                {insuranceClaims.map(claim => (
                  <tr key={claim.id} className={claim.insurance_claimable ? 'claimable' : ''}>
                    <td>
                      <label className="claimable-toggle">
                        <input
                          type="checkbox"
                          checked={claim.insurance_claimable}
                          onChange={e => onToggleInsurance(claim.id, e.target.checked)}
                        />
                        <span className="toggle-track"></span>
                      </label>
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
              className="ds-btn ds-btn-primary generate-statement-btn"
              onClick={onDownloadStatement}
              disabled={!insuranceClaims.some(c => c.insurance_claimable)}
            >
              Download Insurance Statement (PDF)
            </button>
            <p className="statement-help">Generates a PDF statement for {formatMonthDisplay(insuranceFilters.month)} that you can email to your insurance company.</p>
          </div>
        </>
      )}
    </div>
  );
}
