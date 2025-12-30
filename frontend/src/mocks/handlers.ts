import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:8000/api';

export const handlers = [
  http.post(`${API_URL}/auth/login`, () => {
    return HttpResponse.json({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      token_type: 'bearer',
    });
  }),

  http.get(`${API_URL}/users/me`, () => {
    return HttpResponse.json({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'public',
      created_at: new Date().toISOString(),
    });
  }),

  http.get(`${API_URL}/arenas/`, () => {
    return HttpResponse.json([
      { id: 1, name: 'Indoor Arena', description: 'Indoor riding arena', is_active: true },
      { id: 2, name: 'Outdoor Arena', description: 'All-weather outdoor arena', is_active: true },
    ]);
  }),

  http.get(`${API_URL}/bookings/`, () => {
    return HttpResponse.json([]);
  }),

  http.get(`${API_URL}/horses/`, () => {
    return HttpResponse.json([]);
  }),
];
