import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingSpinner({ size = 'md', className = '' }: LoadingSpinnerProps) {
  const sizeStyles: Record<string, React.CSSProperties> = {
    sm: { width: '1rem', height: '1rem' },
    md: { width: '2rem', height: '2rem' },
    lg: { width: '3rem', height: '3rem' },
  };

  return <div className={`ds-spinner ${className}`.trim()} style={sizeStyles[size]} />;
}

export interface LoadingProps {
  message?: string;
  className?: string;
}

export function Loading({ message = 'Loading...', className = '' }: LoadingProps) {
  return (
    <div className={`ds-loading ${className}`.trim()}>
      <LoadingSpinner />
      <p>{message}</p>
    </div>
  );
}

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = '1rem', className = '' }: SkeletonProps) {
  return (
    <div
      className={`ds-skeleton ${className}`.trim()}
      style={{ width, height }}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className = '' }: SkeletonTextProps) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height="1rem"
          width={i === lines - 1 ? '60%' : '100%'}
          className="ds-mb-2"
        />
      ))}
    </div>
  );
}

export default Loading;
