import { ReactNode } from 'react';
import './AdminComponents.css';

interface PageActionsProps {
  children: ReactNode;
}

export function PageActions({ children }: PageActionsProps) {
  return (
    <div className="page-actions">
      {children}
    </div>
  );
}
