import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Role-Based Access Control', () => {
  test.describe('Public User Access', () => {
    test('can view homepage without login', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      // Wait for the page to stabilize
      await page.waitForTimeout(500);

      // Check URL - might redirect to /book or stay at /
      const url = page.url();
      expect(url.endsWith('/') || url.includes('/book')).toBeTruthy();

      // Check that page doesn't show a JavaScript error
      await expect(page.locator('body')).not.toContainText(/Error.*undefined|Cannot read/i);
    });

    test('can view public booking page', async ({ page }) => {
      await page.goto('/public-booking');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    });

    test('cannot access admin pages without login', async ({ page }) => {
      await page.goto('/book/admin/users');
      // Should redirect to login or home page (not stay on admin page)
      await expect(page).not.toHaveURL(/\/book\/admin\/users/);
    });
  });

  test.describe('Livery Access', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('can access booking page', async ({ page }) => {
      await page.goto('/book');
      await expect(page).toHaveURL(/\/book/);
    });

    test('can access my horses page', async ({ page }) => {
      await page.goto('/book/my-horses');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('can access my bookings page', async ({ page }) => {
      await page.goto('/book/my-bookings');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('cannot access admin users page', async ({ page }) => {
      await page.goto('/book/admin/users');
      await page.waitForTimeout(1000);
      // Should be redirected away from admin
      await expect(page).not.toHaveURL(/\/admin\/users/);
    });
  });

  test.describe('Admin Access', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('can access admin settings', async ({ page }) => {
      await page.goto('/book/admin/settings');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('can access user management', async ({ page }) => {
      await page.goto('/book/admin/users');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('can access arena management', async ({ page }) => {
      await page.goto('/book/admin/arenas');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('can access booking management', async ({ page }) => {
      await page.goto('/book/admin/bookings');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('can access services management', async ({ page }) => {
      await page.goto('/book/admin/services');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  });

  test.describe('Coach Access', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('coach');
    });

    test('can access clinics page', async ({ page }) => {
      await page.goto('/book/clinics');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('cannot access admin users page', async ({ page }) => {
      await page.goto('/book/admin/users');
      await page.waitForTimeout(1000);
      // Should not have access
      await expect(page).not.toHaveURL(/\/admin\/users/);
    });
  });
});
