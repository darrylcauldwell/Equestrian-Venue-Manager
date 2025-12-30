import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration
 * Optimized for CI performance with sharding support
 *
 * Modes:
 * - Local dev: npm run dev starts automatically, tests run against it
 * - Test mode: Set TEST_MODE=true to use CI-like settings against docker-compose.test.yml
 * - CI: Uses CI=true with full CI settings
 */

const isCI = !!process.env.CI;
const isTestMode = isCI || process.env.TEST_MODE === 'true';

export default defineConfig({
  testDir: './e2e',

  /* Global setup - verifies environment before tests run */
  globalSetup: isCI ? './e2e/global-setup.ts' : undefined,

  /* Run tests in parallel within files */
  fullyParallel: true,

  /* Fail the build on CI if test.only is left in code */
  forbidOnly: isCI,

  /* Retry failed tests - more retries in CI/test mode for flaky test resilience */
  retries: isTestMode ? 2 : 1,

  /* Use multiple workers for faster execution */
  workers: isTestMode ? 4 : undefined,

  /* Maximum time for entire test run */
  timeout: 60000,

  /* Maximum time for expect() assertions */
  expect: {
    timeout: 10000,
  },

  /* Reporter configuration
   * CI sharded runs use blob reporter for merge-reports command
   * Local/test mode uses HTML reporter directly */
  reporter: isCI
    ? [
        ['blob', { outputDir: 'blob-report' }],
        ['github'],
        ['list', { printSteps: true }],
      ]
    : isTestMode
      ? [
          ['html', { outputFolder: 'playwright-report', open: 'never' }],
          ['junit', { outputFile: 'test-results/e2e-results.xml' }],
          ['list', { printSteps: true }],
        ]
      : [
          ['html', { outputFolder: 'playwright-report', open: 'on-failure' }],
          ['list', { printSteps: true }],
        ],

  /* Shared settings for all projects */
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',

    /* Collect trace on first retry for debugging */
    trace: 'on-first-retry',

    /* Take screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on retry for debugging flaky tests */
    video: isTestMode ? 'on-first-retry' : 'off',

    /* Timeout for actions like click, fill */
    actionTimeout: 15000,

    /* Timeout for navigation */
    navigationTimeout: 30000,

    /* Viewport size */
    viewport: { width: 1280, height: 720 },

    /* Ignore HTTPS errors for local testing */
    ignoreHTTPSErrors: true,
  },

  /* Test projects - can add more browsers for cross-browser testing */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Use channel: 'chrome' for actual Chrome browser */
      },
    },
    /* Uncomment for cross-browser testing
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    */
  ],

  /* Configure web server for local development
   * In test mode or CI, we expect containers to be running already */
  webServer: isTestMode
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120000,
      },

  /* Output directory for test artifacts */
  outputDir: 'test-results',

  /* Metadata for test reports */
  metadata: {
    'build-id': process.env.GITHUB_RUN_ID || 'local',
    'commit': process.env.GITHUB_SHA || 'local',
  },
});
