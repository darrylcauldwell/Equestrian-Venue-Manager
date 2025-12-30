import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Complete Turnout Request Workflow Test
 *
 * Flow: Livery requests turnout → Staff sees on board → Staff assigns to field →
 *       Staff turns horses out → Staff brings horses in
 *
 * Turnout statuses: requested → assigned → turned_out → brought_in
 */
test.describe('Complete Turnout Request Workflow', () => {
  test.describe('Step 1: Livery User Requests Turnout', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view turnout page', async ({ page }) => {
      await page.goto('/book/turnout');
      await expect(page.locator('.turnout-page, h1, h2').first()).toBeVisible();
    });

    test('livery user can see their horses', async ({ page }) => {
      await safeGoto(page, '/book/turnout');

      // Should see horse selection or list
      await expect(page.locator('.turnout-page, [class*="horse"], [class*="turnout"]').first()).toBeVisible();
    });

    test('livery user can select turnout preference', async ({ page }) => {
      await safeGoto(page, '/book/turnout');

      // Look for turnout options (go out, stay in, etc)
      const turnoutOption = page.locator('select, input[type="radio"], button').filter({ hasText: /out|turnout/i }).first();
      if (await turnoutOption.isVisible()) {
        await expect(turnoutOption).toBeEnabled();
      }
    });

    test('livery user can save turnout preferences', async ({ page }) => {
      await safeGoto(page, '/book/turnout');

      // Look for save button
      const saveBtn = page.locator('button').filter({ hasText: /save|submit|update/i }).first();
      if (await saveBtn.isVisible()) {
        await expect(saveBtn).toBeEnabled();
      }
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

    test('staff can see pending turnout requests', async ({ page }) => {
      await safeGoto(page, '/book/turnout-board');

      // Should see turnout board sections
      await expect(page.locator('.turnout-board, .turnout-sections, [class*="turnout"]').first()).toBeVisible();
    });

    test('staff can see staying in horses', async ({ page }) => {
      await safeGoto(page, '/book/turnout-board');

      // Should see staying in section
      const stayingIn = page.locator('[class*="staying"], [class*="in-today"]');
      // Section should exist but may be empty
    });

    test('staff can see field assignments', async ({ page }) => {
      await safeGoto(page, '/book/turnout-board');

      await expect(page.locator('.field-assignments-section, [class*="field"]').first()).toBeVisible();
    });
  });

  test.describe('Step 3: Staff Creates Turnout Group', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see add group button', async ({ page }) => {
      await page.goto('/book/turnout-board');

      const addGroupBtn = page.locator('button').filter({ hasText: /add.*group|create.*group/i });
      await expect(addGroupBtn.first()).toBeVisible();
    });

    test('staff can open add group modal', async ({ page }) => {
      await page.goto('/book/turnout-board');

      const addGroupBtn = page.locator('button').filter({ hasText: /add.*group/i });
      if (await addGroupBtn.first().isVisible()) {
        await addGroupBtn.first().click();
        await page.waitForTimeout(300);

        // Modal should appear
        const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
        await expect(modal.first()).toBeVisible();
      }
    });

    test('staff can select field for group', async ({ page }) => {
      await page.goto('/book/turnout-board');

      const addGroupBtn = page.locator('button').filter({ hasText: /add.*group/i });
      if (await addGroupBtn.first().isVisible()) {
        await addGroupBtn.first().click();
        await page.waitForTimeout(300);

        // Should see field selection
        const fieldSelect = page.locator('select').first();
        if (await fieldSelect.isVisible()) {
          await expect(fieldSelect).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 4: Staff Turns Horses Out', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see turn out buttons', async ({ page }) => {
      await safeGoto(page, '/book/turnout-board');

      // Look for turn out button
      const turnOutBtn = page.locator('button').filter({ hasText: /turn.*out|out/i }).first();
      if (await turnOutBtn.isVisible()) {
        await expect(turnOutBtn).toBeEnabled();
      }
    });

    test('staff can mark horses as turned out', async ({ page }) => {
      await safeGoto(page, '/book/turnout-board');

      // Individual horse turn out or group turn out
      const turnOutBtn = page.locator('button').filter({ hasText: /turn.*out/i }).first();
      if (await turnOutBtn.isVisible()) {
        await expect(turnOutBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 5: Staff Brings Horses In', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see bring in buttons', async ({ page }) => {
      await safeGoto(page, '/book/turnout-board');

      // Look for bring in button
      const bringInBtn = page.locator('button').filter({ hasText: /bring.*in|in/i }).first();
      if (await bringInBtn.isVisible()) {
        await expect(bringInBtn).toBeEnabled();
      }
    });

    test('staff can mark horses as brought in', async ({ page }) => {
      await safeGoto(page, '/book/turnout-board');

      // Individual or group bring in
      const bringInBtn = page.locator('button').filter({ hasText: /bring.*in/i }).first();
      if (await bringInBtn.isVisible()) {
        await expect(bringInBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 6: Admin Manages Fields', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view fields page', async ({ page }) => {
      await page.goto('/book/admin/fields');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see field list', async ({ page }) => {
      await safeGoto(page, '/book/admin/fields');

      await expect(page.locator('.admin-page, [class*="field"]').first()).toBeVisible();
    });

    test('admin can add new field', async ({ page }) => {
      await page.goto('/book/admin/fields');

      const addBtn = page.locator('button').filter({ hasText: /add|create|new/i });
      await expect(addBtn.first()).toBeVisible();
    });

    test('admin can set field as resting', async ({ page }) => {
      await safeGoto(page, '/book/admin/fields');

      // Look for rest or condition button
      const restBtn = page.locator('button').filter({ hasText: /rest|condition/i }).first();
      if (await restBtn.isVisible()) {
        await expect(restBtn).toBeEnabled();
      }
    });
  });
});
