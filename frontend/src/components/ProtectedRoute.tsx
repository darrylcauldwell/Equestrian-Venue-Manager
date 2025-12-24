import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireLivery?: boolean;
  requireStaff?: boolean;
  allowPasswordChange?: boolean;
}

export function ProtectedRoute({
  children,
  requireAdmin,
  requireLivery,
  requireStaff,
  allowPasswordChange
}: ProtectedRouteProps) {
  const { user, isLoading, mustChangePassword } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="loading">Loading...</div>;
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

  return <>{children}</>;
}
