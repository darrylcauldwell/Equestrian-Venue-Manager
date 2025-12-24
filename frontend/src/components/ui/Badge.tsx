import React from 'react';

export type BadgeVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'public'
  | 'livery'
  | 'staff'
  | 'admin'
  | 'low'
  | 'medium'
  | 'high'
  | 'urgent';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
}

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
export type StatusType =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled'
  | 'active'
  | 'inactive'
  | 'open'
  | 'closed'
  | 'in_progress'
  | 'scheduled'
  | 'confirmed';

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

export interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

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
export type PriorityType = 'low' | 'medium' | 'high' | 'urgent';

export interface PriorityBadgeProps {
  priority: PriorityType | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

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
export type RoleType = 'public' | 'livery' | 'staff' | 'admin' | 'coach';

export interface RoleBadgeProps {
  role: RoleType | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

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
