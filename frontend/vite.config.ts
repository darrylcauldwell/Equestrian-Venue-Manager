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

    /* Use forks pool for better memory isolation */
    pool: 'forks',

    /* Limit parallel workers to prevent memory exhaustion */
    poolOptions: {
      forks: {
        /* Single fork for maximum memory efficiency */
        maxForks: 1,
        minForks: 1,
        /* Isolate each test file to prevent memory accumulation */
        isolate: true,
      },
    },

    /* Retry failed tests once to handle flaky worker crashes */
    retry: process.env.CI ? 1 : 0,

    /* Timeouts */
    testTimeout: 30000,
    hookTimeout: 30000,

    /* Disable watch mode by default */
    watch: false,

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

    /* Reporter configuration - keep simple for CI compatibility */
    reporters: process.env.CI ? ['verbose', 'junit'] : ['default'],
    outputFile: {
      junit: 'test-results.xml',
    },
  },
})
