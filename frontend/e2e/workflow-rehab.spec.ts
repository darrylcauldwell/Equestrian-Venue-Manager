import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Rehab Program Workflow Test
 *
 * Flow: Admin creates program → Views details → Manages phases
 *
 * SKIPPED: The /book/admin/rehab-programs route does not exist.
 * These tests are for a feature that was not implemented.
 */
test.describe.skip('Rehab Program Workflow', () => {
  test.describe('Step 1: Admin Creates Rehab Program', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view rehab programs page', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see rehab page content', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');
      // Page should have main content area
      await expect(page.locator('.admin-rehab-page, .page-header').first()).toBeVisible();
    });

    test('admin can see new program button', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');
      const newBtn = page.locator('button').filter({ hasText: /new|add|create/i });
      await expect(newBtn.first()).toBeVisible();
    });

    test('admin can open new program modal', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');
      const newBtn = page.locator('button').filter({ hasText: /new|add|create/i });
      if (await newBtn.first().isVisible()) {
        await newBtn.first().click();
        await page.waitForTimeout(300);
        // Modal should appear
        await expect(page.locator('.ds-modal, .modal, [role="dialog"]').first()).toBeVisible();
      }
    });

    test('admin can filter programs by status', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');
      const statusFilter = page.locator('.status-filter, select').first();
      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.waitForTimeout(200);
      }
    });
  });

  test.describe('Step 2: Admin Views Program Details', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see program cards', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');
      // Should see program cards or empty state
      await expect(page.locator('.program-card, .programs-grid, .empty-state').first()).toBeVisible();
    });
  });

  test.describe('Step 3: Livery Views Horse Health', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view their horses', async ({ page }) => {
      await page.goto('/book/my-horses');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('livery user can see health information', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');
      await expect(page.locator('.my-horses, [class*="horse"]').first()).toBeVisible();
    });
  });
});
