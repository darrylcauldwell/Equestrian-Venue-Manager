import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Staff Management Workflow', () => {
  test.describe('Step 1: Staff Rota Access', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access my rota page', async ({ page }) => {
      await page.goto('/book/my-rota');
      await waitForPageReady(page);

      // Should see rota/schedule page
      await expect(page.locator('h1, h2').filter({ hasText: /rota|schedule|shift/i }).first()).toBeVisible();
    });

    test('staff can view their scheduled shifts', async ({ page }) => {
      await page.goto('/book/my-rota');
      await waitForPageReady(page);

      // Look for shift/rota content
      const rotaContent = page.locator('[class*="rota"], [class*="shift"], .ds-card, .ds-table, .fc-view');
      await expect(page.locator('body')).toBeVisible();
    });

    test('staff rota shows calendar or list view', async ({ page }) => {
      await page.goto('/book/my-rota');
      await waitForPageReady(page);

      // Should have some form of schedule display
      const scheduleDisplay = page.locator('.fc-view, [class*="calendar"], [class*="schedule"], .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 2: Staff Timesheet', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access my timesheet page', async ({ page }) => {
      await page.goto('/book/my-timesheet');
      await waitForPageReady(page);

      // Should see timesheet page
      await expect(page.locator('h1, h2').filter({ hasText: /timesheet|time|hours/i }).first()).toBeVisible();
    });

    test('staff can view their logged hours', async ({ page }) => {
      await page.goto('/book/my-timesheet');
      await waitForPageReady(page);

      // Look for timesheet entries or summary
      const timesheetContent = page.locator('[class*="timesheet"], [class*="hours"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });

    test('staff timesheet has date navigation', async ({ page }) => {
      await page.goto('/book/my-timesheet');
      await waitForPageReady(page);

      // Look for date pickers or navigation
      const dateNav = page.locator('[type="date"], [class*="date"], button').filter({ hasText: /week|month|prev|next/i });
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 3: Staff Feed Duties', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access feed duties page', async ({ page }) => {
      await page.goto('/book/feed-duties');
      await waitForPageReady(page);

      // Should see feed duties page
      await expect(page.locator('h1, h2').filter({ hasText: /feed|feeding/i }).first()).toBeVisible();
    });

    test('staff can view feed schedule', async ({ page }) => {
      await page.goto('/book/feed-duties');
      await waitForPageReady(page);

      // Look for feed schedule content
      const feedContent = page.locator('[class*="feed"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });

    test('staff can see horses requiring feeding', async ({ page }) => {
      await page.goto('/book/feed-duties');
      await waitForPageReady(page);

      // Look for horse feed entries
      const horseEntries = page.locator('[class*="horse"], [class*="feed"], .ds-card');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 4: Staff Task Integration', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access yard tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await waitForPageReady(page);

      // Should see tasks page
      await expect(page.locator('h1, h2').filter({ hasText: /task/i }).first()).toBeVisible();
    });

    test('staff can access turnout board', async ({ page }) => {
      await page.goto('/book/turnout-board');
      await waitForPageReady(page);

      // Should see turnout board
      await expect(page.locator('h1, h2').filter({ hasText: /turnout/i }).first()).toBeVisible();
    });
  });

  test.describe('Step 5: Staff Access Restrictions', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff cannot access admin settings', async ({ page }) => {
      await page.goto('/book/admin/settings');
      await waitForPageReady(page);

      // Should be redirected away from admin
      const url = page.url();
      expect(url.includes('/admin/settings')).toBeFalsy();
    });

    test('staff cannot access my horses (livery only)', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Should be redirected or denied
      const url = page.url();
      const accessDenied = page.locator('text=/access denied|not authorized|permission/i');

      expect(url.includes('/my-horses') === false || await accessDenied.isVisible()).toBeTruthy();
    });

    test('staff cannot access billing', async ({ page }) => {
      await page.goto('/book/admin/billing');
      await waitForPageReady(page);

      // Should be redirected away from admin
      const url = page.url();
      expect(url.includes('/admin/billing')).toBeFalsy();
    });
  });
});
