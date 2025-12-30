/**
 * Global E2E Setup - Runs once before all tests
 *
 * Verifies the environment is ready:
 * 1. Frontend is serving pages
 * 2. Backend API is responding
 * 3. Login works correctly
 */

import { chromium, FullConfig } from '@playwright/test';
import { mkdir } from 'fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const MAX_RETRIES = 30;
const RETRY_DELAY = 2000;

async function waitForService(url: string, name: string): Promise<void> {
  console.log(`Waiting for ${name} at ${url}...`);

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });

      if (response.ok) {
        console.log(`${name} is ready (status: ${response.status})`);
        return;
      }
      console.log(`${name} returned status ${response.status}, retrying...`);
    } catch (error) {
      console.log(`${name} not ready yet (attempt ${i + 1}/${MAX_RETRIES}): ${error}`);
    }

    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }

  throw new Error(`${name} failed to become ready after ${MAX_RETRIES} attempts`);
}

async function verifyLogin(): Promise<void> {
  console.log('Verifying login functionality...');

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to login page
    console.log('  Navigating to login page...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    // Verify login form exists
    const usernameField = page.locator('#username');
    const passwordField = page.locator('#password');
    const submitButton = page.locator('button[type="submit"]');

    console.log('  Waiting for login form...');
    if (!await usernameField.isVisible({ timeout: 10000 })) {
      throw new Error('Login form not visible - username field not found');
    }

    // Attempt login with admin credentials
    console.log('  Filling login credentials...');
    await usernameField.fill('admin');
    await passwordField.fill('password');
    await submitButton.click();

    // Wait for redirect - should eventually go to /book (via PublicLayout redirect)
    console.log('  Waiting for post-login redirect...');
    await page.waitForURL(/\/book/, { timeout: 20000 });
    console.log(`  Redirected to: ${page.url()}`);

    // Wait for loading indicators to disappear (feature flags, auth validation)
    console.log('  Waiting for loading to complete...');
    const loadingIndicator = page.locator('.ds-loading');
    try {
      // Give it more time - feature flags might be slow
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 30000 });
      console.log('  Loading complete');
    } catch (e) {
      const loadingCount = await loadingIndicator.count();
      console.warn(`  Warning: Loading indicator still present (count: ${loadingCount})`);
      // Continue anyway - might still work
    }

    // Verify the app loaded properly by checking for hamburger button
    console.log('  Verifying hamburger button...');
    const hamburgerBtn = page.locator('.hamburger-btn');
    await hamburgerBtn.waitFor({ state: 'visible', timeout: 15000 });

    console.log('Login verification successful!');

  } catch (error) {
    // Capture diagnostic info
    const url = page.url();
    const content = await page.content();
    const hasHamburger = await page.locator('.hamburger-btn').count();
    const hasLoading = await page.locator('.ds-loading').count();
    const loadingText = await page.locator('.ds-loading').textContent().catch(() => '');
    const bodyText = await page.locator('body').textContent().catch(() => '');

    console.error('Login verification failed!');
    console.error(`  Current URL: ${url}`);
    console.error(`  Hamburger buttons found: ${hasHamburger}`);
    console.error(`  Loading indicators found: ${hasLoading}`);
    console.error(`  Loading indicator text: ${loadingText}`);
    console.error(`  Page content length: ${content.length}`);
    console.error(`  Body text preview: ${bodyText?.substring(0, 500)}`);

    // Check for error messages
    const errors = await page.locator('.error, .ds-alert-error, [class*="error"]').allTextContents();
    if (errors.length > 0) {
      console.error(`  Error messages found: ${errors.join(', ')}`);
    }

    // Check what's in the DOM
    const htmlPreview = content.substring(0, 2000);
    console.error(`  HTML preview: ${htmlPreview}`);

    // Save screenshot for debugging
    await mkdir('test-results', { recursive: true }).catch(() => {});
    await page.screenshot({ path: 'test-results/global-setup-failure.png', fullPage: true });

    throw error;
  } finally {
    await browser.close();
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('='.repeat(60));
  console.log('E2E Global Setup - Environment Verification');
  console.log('='.repeat(60));
  console.log(`Base URL: ${BASE_URL}`);

  // Step 1: Wait for health endpoint
  await waitForService(`${BASE_URL}/health`, 'Health endpoint');

  // Step 2: Wait for API
  await waitForService(`${BASE_URL}/api/health`, 'Backend API');

  // Step 3: Verify login works
  await verifyLogin();

  console.log('='.repeat(60));
  console.log('Environment verification complete - ready for tests');
  console.log('='.repeat(60));
}

export default globalSetup;
