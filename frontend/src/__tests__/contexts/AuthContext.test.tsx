import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';

// Mock the API module
vi.mock('../../services/api', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

import { authApi } from '../../services/api';

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('throws error when useAuth is used outside AuthProvider', () => {
    // Suppress expected console.error from React for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });

  it('initializes with null user', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Wait for initial state to settle
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBe(null);
  });

  it('finishes loading when no token is stored', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBe(null);
  });

  it('loads user from token on mount', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      role: 'public' as const,
      is_yard_staff: false,
      must_change_password: false,
      is_active: true,
      created_at: '2024-01-01',
    };

    localStorage.setItem('access_token', 'mock-token');
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('clears tokens on failed user fetch', async () => {
    localStorage.setItem('access_token', 'invalid-token');
    localStorage.setItem('refresh_token', 'invalid-refresh');
    vi.mocked(authApi.getCurrentUser).mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(localStorage.getItem('access_token')).toBe(null);
    expect(localStorage.getItem('refresh_token')).toBe(null);
  });

  it('handles login successfully', async () => {
    const mockTokens = {
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      token_type: 'bearer',
      must_change_password: false,
      user_role: 'livery' as const,
    };
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      role: 'livery' as const,
      is_yard_staff: false,
      must_change_password: false,
      is_active: true,
      created_at: '2024-01-01',
    };

    vi.mocked(authApi.login).mockResolvedValue(mockTokens);
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.login('testuser', 'password123');
    });

    expect(localStorage.getItem('access_token')).toBe('new-access-token');
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token');
    expect(result.current.user).toEqual(mockUser);
  });

  it('handles logout', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin' as const,
      is_yard_staff: false,
      must_change_password: false,
      is_active: true,
      created_at: '2024-01-01',
    };

    localStorage.setItem('access_token', 'mock-token');
    localStorage.setItem('refresh_token', 'mock-refresh');
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBe(null);
    expect(localStorage.getItem('access_token')).toBe(null);
    expect(localStorage.getItem('refresh_token')).toBe(null);
  });

  it('computes isLivery correctly', async () => {
    const mockUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      role: 'livery' as const,
      is_yard_staff: false,
      must_change_password: false,
      is_active: true,
      created_at: '2024-01-01',
    };

    localStorage.setItem('access_token', 'mock-token');
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isLivery).toBe(true);
    expect(result.current.isMember).toBe(true);
    expect(result.current.isCoach).toBe(false);
    expect(result.current.isAdmin).toBe(false);
  });

  it('computes isCoach correctly', async () => {
    const mockUser = {
      id: 1,
      username: 'coach',
      email: 'coach@example.com',
      name: 'Coach User',
      role: 'coach' as const,
      is_yard_staff: false,
      must_change_password: false,
      is_active: true,
      created_at: '2024-01-01',
    };

    localStorage.setItem('access_token', 'mock-token');
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isLivery).toBe(false);
    expect(result.current.isMember).toBe(true);
    expect(result.current.isCoach).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it('computes isAdmin correctly', async () => {
    const mockUser = {
      id: 1,
      username: 'admin',
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin' as const,
      is_yard_staff: false,
      must_change_password: false,
      is_active: true,
      created_at: '2024-01-01',
    };

    localStorage.setItem('access_token', 'mock-token');
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isLivery).toBe(false);
    expect(result.current.isMember).toBe(true);
    expect(result.current.isCoach).toBe(true);
    expect(result.current.isAdmin).toBe(true);
  });

  it('computes mustChangePassword correctly', async () => {
    const mockUser = {
      id: 1,
      username: 'newuser',
      email: 'new@example.com',
      name: 'New User',
      role: 'public' as const,
      is_yard_staff: false,
      must_change_password: true,
      is_active: true,
      created_at: '2024-01-01',
    };

    localStorage.setItem('access_token', 'mock-token');
    vi.mocked(authApi.getCurrentUser).mockResolvedValue(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.mustChangePassword).toBe(true);
  });

  it('handles refreshUser', async () => {
    const initialUser = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      name: 'Test User',
      role: 'public' as const,
      is_yard_staff: false,
      must_change_password: true,
      is_active: true,
      created_at: '2024-01-01',
    };

    const updatedUser = {
      ...initialUser,
      must_change_password: false,
    };

    localStorage.setItem('access_token', 'mock-token');
    vi.mocked(authApi.getCurrentUser)
      .mockResolvedValueOnce(initialUser)
      .mockResolvedValueOnce(updatedUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.user?.must_change_password).toBe(true);
    });

    await act(async () => {
      await result.current.refreshUser();
    });

    expect(result.current.user?.must_change_password).toBe(false);
  });
});
