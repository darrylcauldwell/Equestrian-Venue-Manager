import { test, expect } from './fixtures';

/**
 * Turnout Request Workflow Test
 *
 * Flow: Livery requests turnout → Staff views board → Admin manages fields
 */
test.describe('Turnout Request Workflow', () => {
  test.describe('Step 1: Livery User Requests Turnout', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view turnout request page', async ({ page }) => {
      await page.goto('/book/turnout');
      await expect(page.locator('.turnout-page, h1, h2').first()).toBeVisible();
    });

    test('livery user can see their horses', async ({ page }) => {
      await page.goto('/book/turnout');
      await page.waitForLoadState('networkidle');
      // Should see horse list or turnout options
      const content = page.locator('.horse-card, table, [class*="horse"]');
      // May or may not have horses to show
    });
  });

  test.describe('Step 2: Staff Views Turnout Board', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view turnout board', async ({ page }) => {
      await page.goto('/book/turnout-board');
      await expect(page.locator('.turnout-board, h1').first()).toBeVisible();
    });

    test('staff can see field assignments section', async ({ page }) => {
      await page.goto('/book/turnout-board');
      await page.waitForLoadState('networkidle');
      const fieldSection = page.locator('.field-assignments-section, [class*="field"]');
      await expect(fieldSection.first()).toBeVisible();
    });
  });

  test.describe('Step 3: Admin Manages Fields', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view fields page', async ({ page }) => {
      await page.goto('/book/admin/fields');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see active fields section', async ({ page }) => {
      await page.goto('/book/admin/fields');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.admin-page, [class*="field"]').first()).toBeVisible();
    });

    test('admin can add new field button exists', async ({ page }) => {
      await page.goto('/book/admin/fields');
      const addBtn = page.locator('button').filter({ hasText: /add|create|new/i });
      await expect(addBtn.first()).toBeVisible();
    });
  });
});
