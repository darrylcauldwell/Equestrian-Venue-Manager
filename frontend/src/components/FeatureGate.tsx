import { ReactNode } from 'react';
import { useFeatureFlag } from '../contexts/FeatureFlagsContext';
import type { FeatureKey } from '../types';

interface FeatureGateProps {
  /**
   * The feature key to check
   */
  feature: FeatureKey;
  /**
   * Content to render when feature is enabled
   */
  children: ReactNode;
  /**
   * Optional fallback content when feature is disabled
   * Defaults to null (render nothing)
   */
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on feature flag status.
 *
 * Usage:
 * ```tsx
 * <FeatureGate feature="timesheets">
 *   <Link to="/book/my-timesheet">My Timesheet</Link>
 * </FeatureGate>
 * ```
 *
 * With fallback:
 * ```tsx
 * <FeatureGate feature="invoicing" fallback={<span>Invoicing unavailable</span>}>
 *   <InvoiceList />
 * </FeatureGate>
 * ```
 */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const isEnabled = useFeatureFlag(feature);

  if (!isEnabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

/**
 * Higher-order component version of FeatureGate.
 * Wraps a component to only render when feature is enabled.
 *
 * Usage:
 * ```tsx
 * const TimesheetPage = withFeatureGate('timesheets', TimesheetPageComponent);
 * ```
 */
export function withFeatureGate<P extends object>(
  feature: FeatureKey,
  Component: React.ComponentType<P>,
  FallbackComponent?: React.ComponentType<P>
) {
  return function WrappedComponent(props: P) {
    const isEnabled = useFeatureFlag(feature);

    if (!isEnabled) {
      if (FallbackComponent) {
        return <FallbackComponent {...props} />;
      }
      return null;
    }

    return <Component {...props} />;
  };
}

export default FeatureGate;
