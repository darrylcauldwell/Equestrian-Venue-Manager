import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

// Mock axios before importing api module
vi.mock('axios', async () => {
  const actualAxios = await vi.importActual<typeof import('axios')>('axios');
  return {
    ...actualAxios,
    default: {
      create: vi.fn(() => ({
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        interceptors: {
          request: { use: vi.fn() },
          response: { use: vi.fn() },
        },
      })),
      post: vi.fn(),
    },
  };
});

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('creates axios instance with correct baseURL', async () => {
    await import('../../services/api');
    expect(axios.create).toHaveBeenCalledWith({
      baseURL: expect.stringContaining('/api'),
    });
  });

  it('sets up request interceptor', async () => {
    const mockInterceptorUse = vi.fn();
    vi.mocked(axios.create).mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: mockInterceptorUse },
        response: { use: vi.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);

    await import('../../services/api');
    expect(mockInterceptorUse).toHaveBeenCalled();
  });

  it('sets up response interceptor', async () => {
    const mockResponseInterceptorUse = vi.fn();
    vi.mocked(axios.create).mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: mockResponseInterceptorUse },
      },
    } as unknown as ReturnType<typeof axios.create>);

    await import('../../services/api');
    expect(mockResponseInterceptorUse).toHaveBeenCalled();
  });
});

describe('Request Interceptor', () => {
  let requestInterceptor: (config: { headers: Record<string, string> }) => { headers: Record<string, string> };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    const mockRequestUse = vi.fn((handler) => {
      requestInterceptor = handler;
    });

    vi.mocked(axios.create).mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: mockRequestUse },
        response: { use: vi.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);

    vi.resetModules();
    await import('../../services/api');
  });

  it('adds Authorization header when token exists', () => {
    localStorage.setItem('access_token', 'test-token');
    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptor(config);
    expect(result.headers.Authorization).toBe('Bearer test-token');
  });

  it('does not add Authorization header when no token', () => {
    const config = { headers: {} as Record<string, string> };
    const result = requestInterceptor(config);
    expect(result.headers.Authorization).toBeUndefined();
  });
});

describe('authApi', () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let mockPost: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    mockGet = vi.fn();
    mockPost = vi.fn();

    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);

    vi.resetModules();
  });

  it('register calls POST /auth/register', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockPost.mockResolvedValue({ data: mockUser });

    const { authApi } = await import('../../services/api');
    const result = await authApi.register('testuser', 'Test User', 'password123');

    expect(mockPost).toHaveBeenCalledWith('/auth/register', {
      username: 'testuser',
      name: 'Test User',
      password: 'password123',
      email: undefined,
    });
    expect(result).toEqual(mockUser);
  });

  it('login calls POST /auth/login with FormData', async () => {
    const mockTokens = { access_token: 'token', refresh_token: 'refresh', token_type: 'bearer' };
    mockPost.mockResolvedValue({ data: mockTokens });

    const { authApi } = await import('../../services/api');
    const result = await authApi.login('testuser', 'password123');

    expect(mockPost).toHaveBeenCalledWith('/auth/login', expect.any(FormData));
    expect(result).toEqual(mockTokens);
  });

  it('getCurrentUser calls GET /users/me', async () => {
    const mockUser = { id: 1, username: 'testuser' };
    mockGet.mockResolvedValue({ data: mockUser });

    const { authApi } = await import('../../services/api');
    const result = await authApi.getCurrentUser();

    expect(mockGet).toHaveBeenCalledWith('/users/me');
    expect(result).toEqual(mockUser);
  });

  it('changePassword calls POST /auth/change-password', async () => {
    const mockUser = { id: 1, username: 'testuser', must_change_password: false };
    mockPost.mockResolvedValue({ data: mockUser });

    const { authApi } = await import('../../services/api');
    const result = await authApi.changePassword('oldpass', 'newpass');

    expect(mockPost).toHaveBeenCalledWith('/auth/change-password', {
      current_password: 'oldpass',
      new_password: 'newpass',
    });
    expect(result).toEqual(mockUser);
  });
});

describe('arenasApi', () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let mockPost: ReturnType<typeof vi.fn>;
  let mockPut: ReturnType<typeof vi.fn>;
  let mockDelete: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    mockGet = vi.fn();
    mockPost = vi.fn();
    mockPut = vi.fn();
    mockDelete = vi.fn();

    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: mockPut,
      delete: mockDelete,
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);

    vi.resetModules();
  });

  it('list calls GET /arenas/', async () => {
    const mockArenas = [{ id: 1, name: 'Main Arena' }];
    mockGet.mockResolvedValue({ data: mockArenas });

    const { arenasApi } = await import('../../services/api');
    const result = await arenasApi.list();

    expect(mockGet).toHaveBeenCalledWith('/arenas/');
    expect(result).toEqual(mockArenas);
  });

  it('create calls POST /arenas/', async () => {
    const mockArena = { id: 1, name: 'New Arena', description: 'Test', is_active: true };
    mockPost.mockResolvedValue({ data: mockArena });

    const { arenasApi } = await import('../../services/api');
    const result = await arenasApi.create({ name: 'New Arena', description: 'Test' });

    expect(mockPost).toHaveBeenCalledWith('/arenas/', { name: 'New Arena', description: 'Test' });
    expect(result).toEqual(mockArena);
  });

  it('delete calls DELETE /arenas/{id}', async () => {
    mockDelete.mockResolvedValue({ data: {} });

    const { arenasApi } = await import('../../services/api');
    await arenasApi.delete(1);

    expect(mockDelete).toHaveBeenCalledWith('/arenas/1');
  });
});

describe('bookingsApi', () => {
  let mockGet: ReturnType<typeof vi.fn>;
  let mockPost: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    mockGet = vi.fn();
    mockPost = vi.fn();

    vi.mocked(axios.create).mockReturnValue({
      get: mockGet,
      post: mockPost,
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    } as unknown as ReturnType<typeof axios.create>);

    vi.resetModules();
  });

  it('list calls GET /bookings/ with arena_id filter', async () => {
    const mockBookings = [{ id: 1, title: 'Test Booking' }];
    mockGet.mockResolvedValue({ data: mockBookings });

    const { bookingsApi } = await import('../../services/api');
    const result = await bookingsApi.list(1);

    expect(mockGet).toHaveBeenCalledWith('/bookings/', { params: { arena_id: '1' } });
    expect(result).toEqual(mockBookings);
  });

  it('list calls GET /bookings/ without params when no filters', async () => {
    const mockBookings = [{ id: 1, title: 'Test Booking' }];
    mockGet.mockResolvedValue({ data: mockBookings });

    const { bookingsApi } = await import('../../services/api');
    const result = await bookingsApi.list();

    expect(mockGet).toHaveBeenCalledWith('/bookings/', { params: {} });
    expect(result).toEqual(mockBookings);
  });

  it('create calls POST /bookings/', async () => {
    const mockBooking = { id: 1, title: 'New Booking' };
    mockPost.mockResolvedValue({ data: mockBooking });

    const { bookingsApi } = await import('../../services/api');
    const bookingData = {
      arena_id: 1,
      title: 'New Booking',
      start_time: '2024-01-01T10:00:00',
      end_time: '2024-01-01T11:00:00',
    };
    const result = await bookingsApi.create(bookingData);

    expect(mockPost).toHaveBeenCalledWith('/bookings/', bookingData);
    expect(result).toEqual(mockBooking);
  });

  it('createGuest calls POST /bookings/guest with correct parameters', async () => {
    const mockBooking = { id: 1, title: 'Guest Booking' };
    mockPost.mockResolvedValue({ data: mockBooking });

    const { bookingsApi } = await import('../../services/api');
    const guestData = {
      arena_id: 1,
      start_time: '2024-01-01T10:00:00',
      end_time: '2024-01-01T11:00:00',
      guest_name: 'John Doe',
      guest_email: 'john@example.co.uk',
      guest_phone: '07700 900123',
      title: 'Guest Booking',
    };
    const result = await bookingsApi.createGuest(guestData);

    expect(mockPost).toHaveBeenCalledWith('/bookings/guest', guestData);
    expect(result).toEqual(mockBooking);
  });
});
