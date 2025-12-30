import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  servicesApi,
  clinicsApi,
  lessonsApi,
  holidayLiveryApi,
  rehabApi,
} from '../../services/api';
import { useRequestState } from '../../hooks';
import type {
  ServiceRequest,
  ClinicRequest,
  LessonRequest,
  HolidayLiveryRequestSummary,
  RehabProgram,
} from '../../types';
import '../../styles/AdminRequests.css';

type RequestType = 'all' | 'service' | 'clinic' | 'lesson' | 'holiday_livery' | 'care_plan';

interface UnifiedRequest {
  id: number;
  type: RequestType;
  typeLabel: string;
  subject: string;
  requester: string;
  date: string;
  status: string;
  statusLabel: string;
  priority: 'high' | 'medium' | 'low';
  actionRequired: string;
  createdAt: string;
  rawData: ServiceRequest | ClinicRequest | LessonRequest | HolidayLiveryRequestSummary | RehabProgram;
}

const typeLabels: Record<Exclude<RequestType, 'all'>, string> = {
  service: 'Service',
  clinic: 'Clinic',
  lesson: 'Lesson',
  holiday_livery: 'Holiday Livery',
  care_plan: 'Care Plan Quote',
};

const typeColors: Record<Exclude<RequestType, 'all'>, string> = {
  service: 'type-service',
  clinic: 'type-clinic',
  lesson: 'type-lesson',
  holiday_livery: 'type-holiday',
  care_plan: 'type-care-plan',
};

export default function AdminRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<UnifiedRequest[]>([]);
  const [typeFilter, setTypeFilter] = useState<RequestType>('all');
  const [counts, setCounts] = useState<Record<Exclude<RequestType, 'all'>, number>>({
    service: 0,
    clinic: 0,
    lesson: 0,
    holiday_livery: 0,
    care_plan: 0,
  });

  // Request state
  const { loading, error, setError, setLoading } = useRequestState(true);

  const loadRequests = useCallback(async () => {
    try {

      // Fetch all request types in parallel
      const [
        serviceData,
        clinicData,
        lessonData,
        holidayData,
        carePlanData,
      ] = await Promise.all([
        servicesApi.getStaffRequests(),
        clinicsApi.listAll(),
        lessonsApi.listAllRequests('pending'),
        holidayLiveryApi.list('pending'),
        rehabApi.list('draft'),
      ]);

      const unified: UnifiedRequest[] = [];

      // Process service requests - pending_approval need quote
      serviceData.pending_approval.forEach((req) => {
        unified.push({
          id: req.id,
          type: 'service',
          typeLabel: typeLabels.service,
          subject: req.service_name || 'Service Request',
          requester: req.requested_by_name || 'Unknown',
          date: req.requested_date,
          status: 'pending',
          statusLabel: 'Needs Quote',
          priority: 'high',
          actionRequired: 'Set quote and send to client',
          createdAt: req.created_at,
          rawData: req,
        });
      });

      // Service requests pending scheduling
      serviceData.pending_scheduling.forEach((req) => {
        unified.push({
          id: req.id,
          type: 'service',
          typeLabel: typeLabels.service,
          subject: req.service_name || 'Service Request',
          requester: req.requested_by_name || 'Unknown',
          date: req.requested_date,
          status: 'scheduling',
          statusLabel: 'Needs Scheduling',
          priority: 'medium',
          actionRequired: 'Assign staff and schedule',
          createdAt: req.created_at,
          rawData: req,
        });
      });

      // Process clinic requests
      clinicData.pending.forEach((req) => {
        unified.push({
          id: req.id,
          type: 'clinic',
          typeLabel: typeLabels.clinic,
          subject: req.title || `${req.discipline} Clinic`,
          requester: req.coach_name,
          date: req.proposed_date,
          status: 'pending',
          statusLabel: 'Pending Approval',
          priority: 'medium',
          actionRequired: 'Review and approve/reject',
          createdAt: req.created_at,
          rawData: req,
        });
      });

      // Process lesson requests
      lessonData.forEach((req) => {
        unified.push({
          id: req.id,
          type: 'lesson',
          typeLabel: typeLabels.lesson,
          subject: `${req.discipline || 'Lesson'} with ${req.coach_name}`,
          requester: req.user_name || req.guest_name || 'Unknown',
          date: req.requested_date,
          status: req.status,
          statusLabel: 'Pending Confirmation',
          priority: 'medium',
          actionRequired: 'Confirm date/time and arena',
          createdAt: req.created_at,
          rawData: req,
        });
      });

      // Process holiday livery requests
      holidayData.forEach((req) => {
        unified.push({
          id: req.id,
          type: 'holiday_livery',
          typeLabel: typeLabels.holiday_livery,
          subject: `${req.horse_name} - ${req.requested_nights} nights`,
          requester: req.guest_name,
          date: req.requested_arrival,
          status: 'pending',
          statusLabel: 'Pending Approval',
          priority: 'medium',
          actionRequired: 'Assign stable and approve',
          createdAt: req.created_at,
          rawData: req,
        });
      });

      // Process care plan quote requests (draft + staff_managed + no price)
      carePlanData
        .filter((p) => p.staff_managed && !p.weekly_care_price)
        .forEach((program) => {
          unified.push({
            id: program.id,
            type: 'care_plan',
            typeLabel: typeLabels.care_plan,
            subject: `${program.name} for ${program.horse_name}`,
            requester: program.created_by_name || 'Unknown',
            date: program.start_date,
            status: 'needs_quote',
            statusLabel: 'Needs Quote',
            priority: 'high',
            actionRequired: 'Review tasks and set weekly price',
            createdAt: program.created_at,
            rawData: program,
          });
        });

      // Sort by created date (newest first)
      unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Calculate counts by type
      const newCounts = {
        service: unified.filter((r) => r.type === 'service').length,
        clinic: unified.filter((r) => r.type === 'clinic').length,
        lesson: unified.filter((r) => r.type === 'lesson').length,
        holiday_livery: unified.filter((r) => r.type === 'holiday_livery').length,
        care_plan: unified.filter((r) => r.type === 'care_plan').length,
      };

      setCounts(newCounts);
      setRequests(unified);
    } catch {
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [setError, setLoading]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleRequestClick = (request: UnifiedRequest) => {
    // Navigate to the appropriate page for the request type
    switch (request.type) {
      case 'service':
        navigate('/book/admin/service-requests');
        break;
      case 'clinic':
        navigate('/book/admin/events');
        break;
      case 'lesson':
        navigate('/book/admin/lessons');
        break;
      case 'holiday_livery':
        navigate('/book/admin/holiday-livery');
        break;
      case 'care_plan':
        navigate('/book/admin/care-plans');
        break;
    }
  };

  const filteredRequests =
    typeFilter === 'all'
      ? requests
      : requests.filter((r) => r.type === typeFilter);

  const totalCount = requests.length;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else {
      return 'Just now';
    }
  };

  if (loading) {
    return (
      <div className="admin-requests-page">
        <div className="ds-loading">Loading requests...</div>
      </div>
    );
  }

  return (
    <div className="admin-requests-page">
      <header className="page-header">
        <div className="header-content">
          <h1>Requests</h1>
          <p className="subtitle">All pending requests requiring action</p>
        </div>
      </header>

      {error && <div className="ds-alert ds-alert-error">{error}</div>}

      {/* Filter Dropdown */}
      <div className="filter-row">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as RequestType)}
          className="filter-select"
        >
          <option value="all">All Pending ({totalCount})</option>
          {(Object.keys(typeLabels) as Exclude<RequestType, 'all'>[]).map((type) => (
            <option key={type} value={type}>
              {typeLabels[type]} ({counts[type]})
            </option>
          ))}
        </select>
      </div>

      {/* Desktop Summary Cards */}
      <div className="summary-cards">
        <div
          className={`summary-card ${typeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setTypeFilter('all')}
        >
          <span className="card-count">{totalCount}</span>
          <span className="card-label">All Pending</span>
        </div>
        {(Object.keys(typeLabels) as Exclude<RequestType, 'all'>[]).map((type) => (
          <div
            key={type}
            className={`summary-card ${typeColors[type]} ${typeFilter === type ? 'active' : ''}`}
            onClick={() => setTypeFilter(type)}
          >
            <span className="card-count">{counts[type]}</span>
            <span className="card-label">{typeLabels[type]}</span>
          </div>
        ))}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="ds-empty">
          <div className="empty-icon">&#10003;</div>
          <h3>All caught up!</h3>
          <p>No pending requests requiring action.</p>
        </div>
      ) : (
        <div className="requests-list">
          {filteredRequests.map((request) => (
            <div
              key={`${request.type}-${request.id}`}
              className={`request-card ${request.priority}`}
              onClick={() => handleRequestClick(request)}
            >
              <div className="request-header">
                <span className={`type-badge ${typeColors[request.type as Exclude<RequestType, 'all'>]}`}>
                  {request.typeLabel}
                </span>
                <span className="request-time">{getTimeAgo(request.createdAt)}</span>
              </div>

              <div className="request-body">
                <h3 className="request-subject">{request.subject}</h3>
                <div className="request-meta">
                  <span className="requester">
                    <strong>From:</strong> {request.requester}
                  </span>
                  <span className="request-date">
                    <strong>Date:</strong> {formatDate(request.date)}
                  </span>
                </div>
              </div>

              <div className="request-footer">
                <span className={`status-badge status-${request.status}`}>
                  {request.statusLabel}
                </span>
                <span className="action-hint">{request.actionRequired}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
