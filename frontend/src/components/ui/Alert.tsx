import React from 'react';

export type AlertVariant = 'success' | 'warning' | 'error' | 'info';

export interface AlertProps {
  variant?: AlertVariant;
  children: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({
  variant = 'info',
  children,
  onDismiss,
  className = '',
}: AlertProps) {
  return (
    <div className={`ds-alert ds-alert-${variant} ${className}`.trim()} role="alert">
      <div style={{ flex: 1 }}>{children}</div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="ds-btn ds-btn-ghost ds-btn-sm"
          aria-label="Dismiss"
          style={{ marginLeft: '0.5rem', padding: '0.25rem' }}
        >
          &times;
        </button>
      )}
    </div>
  );
}

export default Alert;
