import './AdminComponents.css';

type BadgeVariant = 'active' | 'inactive' | 'success' | 'warning' | 'danger' | 'info' | 'pending' | 'disabled' | 'error' | 'featured';

interface StatusBadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ variant, children, className = '' }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${variant} ${className}`}>
      {children}
    </span>
  );
}

// Convenience components for common status types
export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <StatusBadge variant={isActive ? 'active' : 'inactive'}>
      {isActive ? 'Active' : 'Inactive'}
    </StatusBadge>
  );
}

export function FeaturedBadge() {
  return <StatusBadge variant="featured">Featured</StatusBadge>;
}
