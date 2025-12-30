import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost' | 'link';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon = false,
  className = '',
  disabled,
  children,
  ...props
}: ButtonProps) {
  const variantClass = `ds-btn-${variant}`;
  const sizeClass = size !== 'md' ? `ds-btn-${size}` : '';
  const iconClass = icon ? 'ds-btn-icon' : '';

  return (
    <button
      className={`ds-btn ${variantClass} ${sizeClass} ${iconClass} ${className}`.trim()}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <span className="ds-spinner" style={{ width: '1rem', height: '1rem' }} />
          <span>Loading...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Button Group
export interface ButtonGroupProps {
  children: React.ReactNode;
  vertical?: boolean;
  className?: string;
}

export function ButtonGroup({ children, vertical = false, className = '' }: ButtonGroupProps) {
  const directionClass = vertical ? 'ds-btn-group-vertical' : '';
  return (
    <div className={`ds-btn-group ${directionClass} ${className}`.trim()}>
      {children}
    </div>
  );
}

export default Button;
