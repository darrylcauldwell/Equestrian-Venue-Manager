import './AdminComponents.css';

type AlertVariant = 'error' | 'success' | 'warning' | 'info';

interface AlertMessageProps {
  variant: AlertVariant;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

export function AlertMessage({ variant, message, onDismiss, className = '' }: AlertMessageProps) {
  if (!message) return null;

  return (
    <div className={`alert-message ${variant} ${className}`} role="alert">
      <span className="alert-icon">
        {variant === 'error' && '⚠️'}
        {variant === 'success' && '✓'}
        {variant === 'warning' && '⚡'}
        {variant === 'info' && 'ℹ'}
      </span>
      <span className="alert-content">{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="alert-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          ✕
        </button>
      )}
    </div>
  );
}

// Convenience components
export function ErrorMessage({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return <AlertMessage variant="error" message={message} onDismiss={onDismiss} />;
}

export function SuccessMessage({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return <AlertMessage variant="success" message={message} onDismiss={onDismiss} />;
}
