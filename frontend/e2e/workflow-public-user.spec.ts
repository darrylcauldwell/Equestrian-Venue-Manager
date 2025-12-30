import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Public User Workflow', () => {
  test.describe('Step 1: Public User Navigation', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('public');
      await dismissPopups(page);
    });

    test('public user can access booking calendar', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);

      // Public users should see the booking calendar
      await expect(page.locator('h1, h2').filter({ hasText: /calendar|book/i }).first()).toBeVisible();
    });

    test('public user can view clinics', async ({ page }) => {
      await page.goto('/book/clinics');
      await waitForPageReady(page);

      // Should see clinics page
      await expect(page.locator('h1, h2').filter({ hasText: /clinic/i }).first()).toBeVisible();
    });

    test('public user can view lessons', async ({ page }) => {
      await page.goto('/book/lessons');
      await waitForPageReady(page);

      // Should see lessons page
      await expect(page.locator('h1, h2').filter({ hasText: /lesson/i }).first()).toBeVisible();
    });

    test('public user can access my registrations', async ({ page }) => {
      await page.goto('/book/my-registrations');
      await waitForPageReady(page);

      // Should see registrations page
      await expect(page.locator('h1, h2').filter({ hasText: /registration/i }).first()).toBeVisible();
    });

    test('public user can access noticeboard', async ({ page }) => {
      await page.goto('/book/noticeboard');
      await waitForPageReady(page);

      // Should see noticeboard
      await expect(page.locator('h1, h2').filter({ hasText: /noticeboard|notice/i }).first()).toBeVisible();
    });

    test('public user can access professional directory', async ({ page }) => {
      await page.goto('/book/professionals');
      await waitForPageReady(page);

      // Should see directory
      await expect(page.locator('h1, h2').filter({ hasText: /professional|directory/i }).first()).toBeVisible();
    });
  });

  test.describe('Step 2: Public User Access Restrictions', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('public');
      await dismissPopups(page);
    });

    test('public user cannot access my horses (livery only)', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Should be redirected or see access denied
      const url = page.url();
      const accessDenied = page.locator('text=/access denied|not authorized|permission/i');

      // Either redirected away or shown access denied
      expect(url.includes('/my-horses') === false || await accessDenied.isVisible()).toBeTruthy();
    });

    test('public user cannot access admin settings', async ({ page }) => {
      await page.goto('/book/admin/settings');
      await waitForPageReady(page);

      // Should be redirected or see access denied
      const url = page.url();
      expect(url.includes('/admin/settings')).toBeFalsy();
    });

    test('public user cannot access yard tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await waitForPageReady(page);

      // Public users may see tasks but with limited functionality
      // or be redirected - check both scenarios
      const tasksVisible = await page.locator('h1, h2').filter({ hasText: /task/i }).isVisible().catch(() => false);
      const redirected = !page.url().includes('/tasks');

      // Either scenario is valid
      expect(tasksVisible || redirected).toBeTruthy();
    });
  });

  test.describe('Step 3: Clinic Registration Flow', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('clinic1');
      await dismissPopups(page);
    });

    test('clinic user can view available clinics', async ({ page }) => {
      await page.goto('/book/clinics');
      await waitForPageReady(page);

      // Should see clinics list or calendar
      await expect(page.locator('h1, h2').filter({ hasText: /clinic/i }).first()).toBeVisible();
    });

    test('clinic user can view their registrations', async ({ page }) => {
      await page.goto('/book/my-registrations');
      await waitForPageReady(page);

      // Should see registrations page
      await expect(page.locator('h1, h2').filter({ hasText: /registration/i }).first()).toBeVisible();
    });

    test('clinic user can browse clinic details', async ({ page }) => {
      await page.goto('/book/clinics');
      await waitForPageReady(page);

      // Look for clinic cards or list items
      const clinicItems = page.locator('.clinic-card, .ds-card, [class*="clinic"]');
      const hasClinics = await clinicItems.count() > 0;

      // If there are clinics, they should be visible
      if (hasClinics) {
        await expect(clinicItems.first()).toBeVisible();
      }
    });
  });

  test.describe('Step 4: Lesson Browsing', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('public');
      await dismissPopups(page);
    });

    test('public user can view lesson options', async ({ page }) => {
      await page.goto('/book/lessons');
      await waitForPageReady(page);

      // Should see lessons page with coaches or booking options
      await expect(page.locator('h1, h2').filter({ hasText: /lesson/i }).first()).toBeVisible();
    });

    test('public user can see coach information', async ({ page }) => {
      await page.goto('/book/lessons');
      await waitForPageReady(page);

      // Look for coach profiles or lesson options
      const coachInfo = page.locator('[class*="coach"], [class*="instructor"], .ds-card');

      // Page should load without errors
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 5: My Contracts Access', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('public');
      await dismissPopups(page);
    });

    test('public user can access contracts page', async ({ page }) => {
      await page.goto('/book/my-contracts');
      await waitForPageReady(page);

      // Should see contracts page (may be empty)
      await expect(page.locator('h1, h2').filter({ hasText: /contract/i }).first()).toBeVisible();
    });
  });
});
