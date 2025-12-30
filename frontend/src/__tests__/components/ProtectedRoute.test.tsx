import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ProtectedRoute } from '../../components/ProtectedRoute';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../contexts/FeatureFlagsContext', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: {},
    enabledFeatures: [],
    isLoading: false,
    isFeatureEnabled: () => true,
    refreshFlags: vi.fn(),
  })),
}));

import { useAuth } from '../../contexts/AuthContext';

describe('ProtectedRoute', () => {
  it('shows loading when auth is loading', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      mustChangePassword: false,
      isLivery: false,
      isMember: false,
      isCoach: false,
      isAdmin: false,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 1, username: 'testuser', email: 'test@example.com', name: 'Test', role: 'public', is_yard_staff: false, must_change_password: false, is_active: true, created_at: '' },
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      mustChangePassword: false,
      isLivery: false,
      isMember: false,
      isCoach: false,
      isAdmin: false,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('redirects to home when user is not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      mustChangePassword: false,
      isLivery: false,
      isMember: false,
      isCoach: false,
      isAdmin: false,
    });

    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
