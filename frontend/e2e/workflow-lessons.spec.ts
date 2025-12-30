import { test, expect, waitForPageReady, dismissPopups, testUsers } from './fixtures';

/**
 * Lesson Request Workflow Test
 *
 * Flow: Public user views lessons → Admin views triage → Coach views lessons
 */
test.describe('Lesson Request Workflow', () => {
  test.describe('Step 1: Public User Views Lessons', () => {
    test('public user can view lessons page', async ({ page }) => {
      await page.goto('/lessons');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('public user can see coach list', async ({ page }) => {
      await page.goto('/lessons');
      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');
      // Page should have content
      await expect(page.locator('.lessons-page, [class*="lesson"], [class*="coach"]').first()).toBeVisible();
    });
  });

  test.describe('Step 2: Admin Triages Lesson Requests', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view lesson triage page', async ({ page }) => {
      await page.goto('/book/admin/lessons');
      await expect(page.locator('.admin-page, .triage-filters').first()).toBeVisible();
    });

    test('admin can see status filter tabs', async ({ page }) => {
      await page.goto('/book/admin/lessons');
      await expect(page.locator('.filter-btn').first()).toBeVisible();
    });

    test('admin can filter by status', async ({ page }) => {
      await page.goto('/book/admin/lessons');

      const pendingBtn = page.locator('.filter-btn').filter({ hasText: /pending/i });
      if (await pendingBtn.isVisible()) {
        await pendingBtn.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Step 3: Coach Views Lessons', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('coach');
    });

    test('coach can view lessons page', async ({ page }) => {
      await page.goto('/book/lessons');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('coach can see my lessons section', async ({ page }) => {
      await page.goto('/book/lessons');
      // Wait for page to load
      await page.waitForLoadState('domcontentloaded');
      // Coach lessons page should have tabs or sections
      await expect(page.locator('.lessons-page, .tabs, [class*="lesson"]').first()).toBeVisible();
    });
  });
});
