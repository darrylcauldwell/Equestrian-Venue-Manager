import React from 'react';

export interface EmptyProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function Empty({
  icon = '📭',
  title,
  description,
  action,
  className = '',
}: EmptyProps) {
  return (
    <div className={`ds-empty ${className}`.trim()}>
      <div className="ds-empty-icon">{icon}</div>
      <div className="ds-empty-title">{title}</div>
      {description && <p className="ds-empty-description">{description}</p>}
      {action && <div className="ds-mt-4">{action}</div>}
    </div>
  );
}

export default Empty;
