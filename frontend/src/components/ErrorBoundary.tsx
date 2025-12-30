import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      // Use CSS custom properties to respect theme (light/dark mode)
      return (
        <div style={{
          padding: '2rem',
          maxWidth: '800px',
          margin: '2rem auto',
          fontFamily: 'system-ui, sans-serif',
          color: 'var(--text-color, inherit)',
          backgroundColor: 'var(--background-color, inherit)',
        }}>
          <h1 style={{ color: 'var(--danger-color, #dc3545)', marginBottom: '1rem' }}>
            Something went wrong
          </h1>
          <p style={{ marginBottom: '1rem', color: 'var(--text-muted, #666)' }}>
            An error occurred while rendering this page. The error details are shown below.
          </p>

          <div style={{
            background: 'var(--card-bg, #f8f9fa)',
            border: '1px solid var(--border-color, #dee2e6)',
            borderRadius: '4px',
            padding: '1rem',
            marginBottom: '1rem',
            overflow: 'auto',
          }}>
            <h3 style={{ color: 'var(--danger-color, #dc3545)', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>
              Error:
            </h3>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--text-color, inherit)' }}>
              {this.state.error?.message}
            </pre>
          </div>

          {this.state.errorInfo && (
            <details style={{ marginBottom: '1rem' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '0.5rem', color: 'var(--text-color, inherit)' }}>
                Stack Trace (click to expand)
              </summary>
              <div style={{
                background: 'var(--card-bg, #f8f9fa)',
                border: '1px solid var(--border-color, #dee2e6)',
                borderRadius: '4px',
                padding: '1rem',
                overflow: 'auto',
                maxHeight: '300px',
              }}>
                <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-color, inherit)' }}>
                  {this.state.error?.stack}
                </pre>
                <hr style={{ margin: '1rem 0', borderColor: 'var(--border-color, #dee2e6)' }} />
                <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-color, inherit)' }}>
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            </details>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--primary-color, #007bff)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.5rem 1rem',
                background: 'var(--secondary-color, #6c757d)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
