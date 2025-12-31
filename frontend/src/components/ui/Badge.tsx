import type {
  BadgeVariant,
  BadgeProps,
  StatusType,
  StatusBadgeProps,
  PriorityType,
  PriorityBadgeProps,
  RoleType,
  RoleBadgeProps,
} from './badge.types';

// Re-export types for consumers
export type {
  BadgeVariant,
  BadgeProps,
  StatusType,
  StatusBadgeProps,
  PriorityType,
  PriorityBadgeProps,
  RoleType,
  RoleBadgeProps,
};

export function Badge({
  variant = 'neutral',
  size = 'md',
  children,
  className = '',
}: BadgeProps) {
  const variantClass = `ds-badge-${variant}`;
  const sizeClass = size !== 'md' ? `ds-badge-${size}` : '';

  return (
    <span className={`ds-badge ${variantClass} ${sizeClass} ${className}`.trim()}>
      {children}
    </span>
  );
}

// Status Badge with predefined mappings
const statusVariantMap: Record<StatusType, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  completed: 'success',
  cancelled: 'neutral',
  active: 'success',
  inactive: 'neutral',
  open: 'info',
  closed: 'neutral',
  in_progress: 'info',
  scheduled: 'info',
  confirmed: 'success',
};

const statusLabelMap: Record<StatusType, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  active: 'Active',
  inactive: 'Inactive',
  open: 'Open',
  closed: 'Closed',
  in_progress: 'In Progress',
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
};

export function StatusBadge({ status, size = 'md', className = '' }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/ /g, '_') as StatusType;
  const variant = statusVariantMap[normalizedStatus] || 'neutral';
  const label = statusLabelMap[normalizedStatus] || status;

  return (
    <Badge variant={variant} size={size} className={className}>
      {label}
    </Badge>
  );
}

// Priority Badge
export function PriorityBadge({ priority, size = 'md', className = '' }: PriorityBadgeProps) {
  const normalizedPriority = priority.toLowerCase() as PriorityType;
  const variant = ['low', 'medium', 'high', 'urgent'].includes(normalizedPriority)
    ? normalizedPriority
    : 'neutral';
  const label = priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <Badge variant={variant as BadgeVariant} size={size} className={className}>
      {label}
    </Badge>
  );
}

// Role Badge
export function RoleBadge({ role, size = 'md', className = '' }: RoleBadgeProps) {
  const normalizedRole = role.toLowerCase() as RoleType;
  const variantMap: Record<string, BadgeVariant> = {
    public: 'public',
    livery: 'livery',
    staff: 'staff',
    admin: 'admin',
    coach: 'staff',
  };
  const variant = variantMap[normalizedRole] || 'neutral';
  const label = role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <Badge variant={variant} size={size} className={className}>
      {label}
    </Badge>
  );
}

export default Badge;
