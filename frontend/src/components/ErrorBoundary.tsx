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

  private handleGoHome = () => {
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      // Use site's CSS custom properties for consistent theming
      return (
        <div style={{
          padding: '2rem',
          maxWidth: '800px',
          margin: '2rem auto',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          color: 'var(--text-primary)',
          backgroundColor: 'var(--bg-body)',
          minHeight: '100vh',
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '12px',
            padding: '2rem',
            boxShadow: 'var(--shadow-lg)',
          }}>
            <h1 style={{
              color: 'var(--color-error)',
              marginBottom: '1rem',
              fontSize: '1.5rem',
              fontWeight: 600,
            }}>
              Something went wrong
            </h1>
            <p style={{
              marginBottom: '1.5rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}>
              An error occurred while rendering this page. You can try again, reload the page, or return to the home page.
            </p>

            <div style={{
              background: 'var(--color-error-bg)',
              border: '1px solid var(--color-error)',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1.5rem',
              overflow: 'auto',
            }}>
              <h3 style={{
                color: 'var(--color-error)',
                margin: '0 0 0.5rem 0',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}>
                Error Details:
              </h3>
              <pre style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'var(--color-error-text)',
                fontSize: '0.875rem',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
              }}>
                {this.state.error?.message}
              </pre>
            </div>

            {this.state.errorInfo && (
              <details style={{ marginBottom: '1.5rem' }}>
                <summary style={{
                  cursor: 'pointer',
                  marginBottom: '0.5rem',
                  color: 'var(--text-secondary)',
                  fontWeight: 500,
                  padding: '0.5rem 0',
                }}>
                  Stack Trace (click to expand)
                </summary>
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '1rem',
                  overflow: 'auto',
                  maxHeight: '300px',
                }}>
                  <pre style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-secondary)',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  }}>
                    {this.state.error?.stack}
                  </pre>
                  <hr style={{
                    margin: '1rem 0',
                    border: 'none',
                    borderTop: '1px solid var(--border-light)',
                  }} />
                  <pre style={{
                    margin: 0,
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    color: 'var(--text-secondary)',
                    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </div>
              </details>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={this.handleGoHome}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--color-primary)',
                  color: 'var(--text-inverse)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  transition: 'background 0.2s',
                }}
              >
                Go to Home
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  transition: 'all 0.2s',
                }}
              >
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  transition: 'all 0.2s',
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
