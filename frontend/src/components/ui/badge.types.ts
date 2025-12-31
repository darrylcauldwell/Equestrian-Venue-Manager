// Badge type definitions - separated for Fast Refresh compatibility

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

export interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export type PriorityType = 'low' | 'medium' | 'high' | 'urgent';

export interface PriorityBadgeProps {
  priority: PriorityType | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export type RoleType = 'public' | 'livery' | 'staff' | 'admin' | 'coach';

export interface RoleBadgeProps {
  role: RoleType | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}
