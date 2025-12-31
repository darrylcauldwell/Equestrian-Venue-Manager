import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';

// Store original error handler
const originalOnError = global.onerror;

// Suppress jsdom unhandled errors from expected React errors (e.g., testing error boundaries)
beforeAll(() => {
  // Suppress window.onerror for expected React errors
  window.onerror = (message) => {
    // Suppress known expected errors (e.g., testing hooks outside providers)
    if (typeof message === 'string' && message.includes('useAuth must be used within an AuthProvider')) {
      return true;
    }
    return false;
  };
});

afterAll(() => {
  global.onerror = originalOnError;
});

// Clean up after each test to prevent memory leaks
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
