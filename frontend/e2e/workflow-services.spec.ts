import { test, expect } from './fixtures';

/**
 * Service Request Workflow Test
 *
 * Flow: Livery requests service → Admin triages → Admin manages catalog
 */
test.describe('Service Request Workflow', () => {
  test.describe('Step 1: Livery User Requests Services', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view services page', async ({ page }) => {
      await page.goto('/book/services');
      await expect(page.locator('h1, .services-page').first()).toBeVisible();
    });

    test('livery user can see service categories', async ({ page }) => {
      await page.goto('/book/services');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.services-page, [class*="service"]').first()).toBeVisible();
    });
  });

  test.describe('Step 2: Admin Triages Service Requests', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view service requests page', async ({ page }) => {
      await page.goto('/book/admin/service-requests');
      await expect(page.locator('.admin-page, h1').first()).toBeVisible();
    });

    test('admin can see request list or filters', async ({ page }) => {
      await page.goto('/book/admin/service-requests');
      await page.waitForLoadState('networkidle');
      // Page should have table or filters
      await expect(page.locator('table, .filter-btn, [class*="request"]').first()).toBeVisible();
    });
  });

  test.describe('Step 3: Admin Manages Service Catalog', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view service catalog', async ({ page }) => {
      await page.goto('/book/admin/services');
      await expect(page.locator('.admin-page, h1').first()).toBeVisible();
    });

    test('admin can see add service button', async ({ page }) => {
      await page.goto('/book/admin/services');
      const addBtn = page.locator('button').filter({ hasText: /add|create|new/i });
      await expect(addBtn.first()).toBeVisible();
    });
  });
});
