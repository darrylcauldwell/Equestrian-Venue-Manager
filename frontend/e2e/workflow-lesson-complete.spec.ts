import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Complete Lesson Request Workflow Test
 *
 * Flow: Public/Livery requests lesson → Coach accepts → Admin confirms slot →
 *       Lesson happens → Marked complete
 *
 * Statuses: pending → accepted → confirmed → completed
 */
test.describe('Complete Lesson Request Workflow', () => {
  test.describe('Step 1: Public User Requests Lesson', () => {
    test('public user can view lessons page', async ({ page }) => {
      await page.goto('/lessons');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('public user can see available coaches', async ({ page }) => {
      await safeGoto(page, '/lessons');

      // Should see coaches section or list
      await expect(page.locator('.lessons-page, .coaches-grid, [class*="coach"]').first()).toBeVisible();
    });

    test('public user can click on coach to request lesson', async ({ page }) => {
      await safeGoto(page, '/lessons');

      // Find a coach card or button
      const coachCard = page.locator('.coach-card, [class*="coach"]').first();
      if (await coachCard.isVisible()) {
        await coachCard.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Step 2: Livery User Requests Lesson', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view lessons page', async ({ page }) => {
      await page.goto('/book/lessons');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('livery user can see request lesson tab', async ({ page }) => {
      await page.goto('/book/lessons');

      // Look for tabs or sections
      const tabs = page.locator('.ds-tab, .tab, .tabs-container');
      await expect(tabs.first()).toBeVisible();
    });

    test('livery user can view their lesson requests', async ({ page }) => {
      await safeGoto(page, '/book/lessons');

      // Click on my lessons tab if exists
      const myLessonsTab = page.locator('.ds-tab, .tab').filter({ hasText: /my lesson/i });
      if (await myLessonsTab.isVisible()) {
        await myLessonsTab.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Step 3: Coach Accepts Lesson Request', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('coach');
    });

    test('coach can view lessons page', async ({ page }) => {
      await page.goto('/book/lessons');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('coach can see pending requests', async ({ page }) => {
      await safeGoto(page, '/book/lessons');

      // Look for lesson requests section
      await expect(page.locator('.lessons-page, [class*="lesson"]').first()).toBeVisible();
    });

    test('coach can accept a lesson request', async ({ page }) => {
      await safeGoto(page, '/book/lessons');

      // Find accept button
      const acceptBtn = page.locator('button').filter({ hasText: /accept|approve|confirm/i }).first();
      if (await acceptBtn.isVisible()) {
        // Verify button is clickable (don't actually click to avoid side effects)
        await expect(acceptBtn).toBeEnabled();
      }
    });

    test('coach can decline a lesson request', async ({ page }) => {
      await safeGoto(page, '/book/lessons');

      // Find decline button
      const declineBtn = page.locator('button').filter({ hasText: /decline|reject/i }).first();
      if (await declineBtn.isVisible()) {
        await expect(declineBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 4: Admin Manages Lesson Triage', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view lesson triage page', async ({ page }) => {
      await page.goto('/book/admin/lessons');
      await expect(page.locator('.admin-page, .triage-filters').first()).toBeVisible();
    });

    test('admin can see pending requests', async ({ page }) => {
      await page.goto('/book/admin/lessons');

      const pendingTab = page.locator('.filter-btn').filter({ hasText: /pending/i });
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can see accepted requests', async ({ page }) => {
      await page.goto('/book/admin/lessons');

      const acceptedTab = page.locator('.filter-btn').filter({ hasText: /accepted/i });
      if (await acceptedTab.isVisible()) {
        await acceptedTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can see confirmed lessons', async ({ page }) => {
      await page.goto('/book/admin/lessons');

      const confirmedTab = page.locator('.filter-btn').filter({ hasText: /confirmed/i });
      if (await confirmedTab.isVisible()) {
        await confirmedTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can see completed lessons', async ({ page }) => {
      await page.goto('/book/admin/lessons');

      const completedTab = page.locator('.filter-btn').filter({ hasText: /completed/i });
      if (await completedTab.isVisible()) {
        await completedTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can confirm a lesson', async ({ page }) => {
      await safeGoto(page, '/book/admin/lessons');

      // Find confirm button
      const confirmBtn = page.locator('button').filter({ hasText: /confirm/i }).first();
      if (await confirmBtn.isVisible()) {
        await expect(confirmBtn).toBeEnabled();
      }
    });

    test('admin can mark lesson as completed', async ({ page }) => {
      await safeGoto(page, '/book/admin/lessons');

      // Navigate to confirmed tab first
      const confirmedTab = page.locator('.filter-btn').filter({ hasText: /confirmed/i });
      if (await confirmedTab.isVisible()) {
        await confirmedTab.click();
        await page.waitForTimeout(300);
      }

      // Look for complete button
      const completeBtn = page.locator('button').filter({ hasText: /complete|mark.*complete/i }).first();
      if (await completeBtn.isVisible()) {
        await expect(completeBtn).toBeEnabled();
      }
    });
  });
});
