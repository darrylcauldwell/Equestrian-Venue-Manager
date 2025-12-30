import React, { useEffect, useRef } from 'react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  size = 'md',
  children,
  footer,
  showCloseButton = true,
  closeOnOverlayClick = true,
  className = '',
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = {
    sm: 'ds-modal-sm',
    md: '',
    lg: 'ds-modal-lg',
    xl: 'ds-modal-xl',
    full: 'ds-modal-full',
  }[size];

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="ds-modal-overlay" onClick={handleOverlayClick}>
      <div
        ref={modalRef}
        className={`ds-modal ${sizeClass} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        tabIndex={-1}
      >
        {(title || showCloseButton) && (
          <div className="ds-modal-header">
            {title && <h2 id="modal-title">{title}</h2>}
            {showCloseButton && (
              <button
                className="ds-modal-close"
                onClick={onClose}
                aria-label="Close modal"
              >
                &times;
              </button>
            )}
          </div>
        )}
        <div className="ds-modal-body">{children}</div>
        {footer && <div className="ds-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

// Modal with tabs support
export interface ModalTab {
  id: string;
  label: string;
  count?: number;
}

export interface TabbedModalProps extends Omit<ModalProps, 'children'> {
  tabs: ModalTab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  children: React.ReactNode;
}

export function TabbedModal({
  tabs,
  activeTab,
  onTabChange,
  children,
  ...modalProps
}: TabbedModalProps) {
  return (
    <Modal {...modalProps}>
      <div className="ds-modal-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`ds-modal-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ds-tab-count">{tab.count}</span>
            )}
          </button>
        ))}
      </div>
      <div className="ds-modal-body">{children}</div>
    </Modal>
  );
}

// Confirm Modal
export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  const buttonClass = {
    danger: 'ds-btn-danger',
    warning: 'ds-btn-warning',
    primary: 'ds-btn-primary',
  }[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button className="ds-btn ds-btn-secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            className={`ds-btn ${buttonClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}

export default Modal;
