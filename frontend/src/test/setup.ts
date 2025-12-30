import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Clean up after each test to prevent memory leaks
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
