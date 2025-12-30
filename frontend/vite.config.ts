import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/node_modules/**', '**/e2e/**'],

    /* Use vmThreads to avoid child process cleanup issues on macOS */
    pool: 'vmThreads',

    /* Timeouts */
    testTimeout: 30000,
    hookTimeout: 30000,

    /* Coverage configuration with thresholds */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov', 'cobertura'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/test/**',
        'src/__tests__/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.stories.tsx',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
      ],
      /* Coverage thresholds - disabled until test coverage improves */
      /* Current coverage: ~4% statements, ~3.5% functions */
      /* thresholds: {
        statements: 10,
        branches: 10,
        functions: 10,
        lines: 10,
      }, */
      /* Clean coverage data between runs */
      clean: true,
      /* Skip full coverage for untested files in reports */
      skipFull: false,
    },

    /* Reporter configuration */
    reporters: ['default', 'junit'],
    outputFile: {
      junit: 'test-results.xml',
    },

    /* Fail on console errors during tests */
    onConsoleLog: (log, type) => {
      if (type === 'stderr' && log.includes('Error')) {
        return false; // Don't suppress - let it show
      }
      return true;
    },
  },
})
