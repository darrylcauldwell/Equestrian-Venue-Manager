import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';

// Create mock login function
const mockLogin = vi.fn();

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
    mustChangePassword: false,
  }),
}));

// Mock SettingsContext
vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    venueName: 'Test Venue',
    settings: null,
    isLoading: false,
    refreshSettings: vi.fn(),
    applyThemePreview: vi.fn(),
  }),
}));

import { Login } from '../../pages/Login';

// Helper wrapper
function TestWrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogin.mockReset();
  });

  it('renders login form', () => {
    render(<Login />, { wrapper: TestWrapper });

    expect(screen.getByText('Test Venue')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('handles successful login', async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    render(<Login />, { wrapper: TestWrapper });

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('testuser', 'password123');
    });
  });

  it('shows error on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));

    render(<Login />, { wrapper: TestWrapper });

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'testuser' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrongpassword' },
    });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
    });
  });

  it('has link to register page', () => {
    render(<Login />, { wrapper: TestWrapper });

    expect(screen.getByText(/register here/i)).toBeInTheDocument();
  });
});
