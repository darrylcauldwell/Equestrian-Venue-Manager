import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import type { FeatureKey } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireLivery?: boolean;
  requireStaff?: boolean;
  allowPasswordChange?: boolean;
  requireFeature?: FeatureKey;
}

export function ProtectedRoute({
  children,
  requireAdmin,
  requireLivery,
  requireStaff,
  allowPasswordChange,
  requireFeature
}: ProtectedRouteProps) {
  const { user, isLoading, mustChangePassword } = useAuth();
  const { isFeatureEnabled, isLoading: featuresLoading } = useFeatureFlags();
  const location = useLocation();

  if (isLoading || featuresLoading) {
    return <div className="ds-loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // Redirect to change password if required (unless we're already on that page)
  if (mustChangePassword && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (requireAdmin && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  // Livery-only routes - staff without livery role cannot access
  if (requireLivery && user.role !== 'livery' && user.role !== 'admin') {
    return <Navigate to="/book" replace />;
  }

  // Staff-only routes - requires is_yard_staff flag or admin
  if (requireStaff && !user.is_yard_staff && user.role !== 'admin') {
    return <Navigate to="/book" replace />;
  }

  // Feature flag check - redirect if feature is disabled
  // Admin users can always access (to configure the system)
  if (requireFeature && user.role !== 'admin' && !isFeatureEnabled(requireFeature)) {
    return <Navigate to="/book" state={{ featureDisabled: requireFeature }} replace />;
  }

  return <>{children}</>;
}
