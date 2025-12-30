import { useEffect, useRef, ReactNode } from 'react';
import './AdminComponents.css';

interface FormModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitText?: string;
  cancelText?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
}

export function FormModal({
  isOpen,
  title,
  subtitle,
  children,
  onClose,
  onSubmit,
  submitText = 'Save',
  cancelText = 'Cancel',
  isSubmitting = false,
  submitDisabled = false,
  size = 'md',
  footer,
}: FormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const sizeClass = {
    sm: 'max-width: 400px',
    md: 'max-width: 500px',
    lg: 'max-width: 700px',
  }[size];

  return (
    <div className="ds-modal-overlay" onClick={!isSubmitting ? onClose : undefined}>
      <div
        className="modal-content form-modal"
        ref={modalRef}
        style={{ [sizeClass.split(':')[0]]: sizeClass.split(':')[1].trim() }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-modal-title"
      >
        <form onSubmit={onSubmit}>
          <div className="ds-modal-header">
            <h2 id="form-modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>

          <div className="ds-modal-body">
            {children}
          </div>

          <div className="ds-modal-footer">
            {footer || (
              <>
                <button
                  type="button"
                  className="ds-btn ds-btn-secondary"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  {cancelText}
                </button>
                <button
                  type="submit"
                  className="ds-btn ds-btn-primary"
                  disabled={isSubmitting || submitDisabled}
                >
                  {isSubmitting ? 'Saving...' : submitText}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
