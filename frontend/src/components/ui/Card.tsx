import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  clickable?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Card({ children, clickable = false, onClick, className = '' }: CardProps) {
  const clickableClass = clickable ? 'ds-card-clickable' : '';

  return (
    <div
      className={`ds-card ${clickableClass} ${className}`.trim()}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                onClick?.();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function CardHeader({ children, className = '' }: CardHeaderProps) {
  return <div className={`ds-card-header ${className}`.trim()}>{children}</div>;
}

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CardBody({ children, className = '' }: CardBodyProps) {
  return <div className={`ds-card-body ${className}`.trim()}>{children}</div>;
}

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CardFooter({ children, className = '' }: CardFooterProps) {
  return <div className={`ds-card-footer ${className}`.trim()}>{children}</div>;
}

// Card Grid for layouts
export interface CardGridProps {
  children: React.ReactNode;
  className?: string;
}

export function CardGrid({ children, className = '' }: CardGridProps) {
  return <div className={`ds-card-grid ${className}`.trim()}>{children}</div>;
}

export default Card;
