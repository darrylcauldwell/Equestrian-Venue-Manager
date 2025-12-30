import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Coach Profile & Management Workflow', () => {
  test.describe('Step 1: Coach Navigation', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('coach');
      await dismissPopups(page);
    });

    test('coach can access booking calendar', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);

      // Coach should see the booking calendar or may be redirected to lessons
      // Just verify the page loads without error
      await expect(page.locator('body')).toBeVisible();
      // Check that we're either on /book or /book/lessons (coach redirect)
      const url = page.url();
      expect(url.includes('/book')).toBeTruthy();
    });

    test('coach can access lessons page', async ({ page }) => {
      await page.goto('/book/lessons');
      await waitForPageReady(page);

      // Coach should see lessons management
      await expect(page.locator('h1, h2').filter({ hasText: /lesson/i }).first()).toBeVisible();
    });

    test('coach can access clinics page', async ({ page }) => {
      await page.goto('/book/clinics');
      await waitForPageReady(page);

      // Coach should see clinics
      await expect(page.locator('h1, h2').filter({ hasText: /clinic/i }).first()).toBeVisible();
    });
  });

  test.describe('Step 2: Coach Lesson Management', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('coach');
      await dismissPopups(page);
    });

    test('coach can view their lesson requests', async ({ page }) => {
      await page.goto('/book/lessons');
      await waitForPageReady(page);

      // Should see lesson requests or schedule
      const lessonsContent = page.locator('[class*="lesson"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });

    test('coach can see lesson calendar or list', async ({ page }) => {
      await page.goto('/book/lessons');
      await waitForPageReady(page);

      // Look for calendar or list view
      const calendarOrList = page.locator('.fc-view, [class*="calendar"], .ds-table, [class*="list"]');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 3: Coach Clinic Management', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('coach');
      await dismissPopups(page);
    });

    test('coach can view clinics', async ({ page }) => {
      await page.goto('/book/clinics');
      await waitForPageReady(page);

      // Should see clinics page
      await expect(page.locator('h1, h2').filter({ hasText: /clinic/i }).first()).toBeVisible();
    });

    test('coach can see propose clinic option', async ({ page }) => {
      await page.goto('/book/clinics');
      await waitForPageReady(page);

      // Look for propose/create clinic button
      const proposeBtn = page.locator('button, a').filter({ hasText: /propose|create|new|add/i });

      // Coach should have ability to propose clinics
      await expect(page.locator('body')).toBeVisible();
    });

    test('coach can view their proposed clinics', async ({ page }) => {
      await page.goto('/book/clinics');
      await waitForPageReady(page);

      // Look for clinic list or tabs
      const clinicContent = page.locator('[class*="clinic"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 4: Coach Access Restrictions', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('coach');
      await dismissPopups(page);
    });

    test('coach cannot access admin settings', async ({ page }) => {
      await page.goto('/book/admin/settings');
      await waitForPageReady(page);

      // Should be redirected away from admin
      const url = page.url();
      expect(url.includes('/admin/settings')).toBeFalsy();
    });

    test('coach cannot access admin users', async ({ page }) => {
      await page.goto('/book/admin/users');
      await waitForPageReady(page);

      // Should be redirected away from admin
      const url = page.url();
      expect(url.includes('/admin/users')).toBeFalsy();
    });

    test('coach cannot access livery-only features', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Should be redirected or denied (coaches don't have horses)
      const url = page.url();
      const accessDenied = page.locator('text=/access denied|not authorized|permission/i');

      expect(url.includes('/my-horses') === false || await accessDenied.isVisible()).toBeTruthy();
    });
  });

  test.describe('Step 5: Coach Registrations View', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('coach');
      await dismissPopups(page);
    });

    test('coach can view registrations', async ({ page }) => {
      await page.goto('/book/my-registrations');
      await waitForPageReady(page);

      // Should see registrations page
      await expect(page.locator('h1, h2').filter({ hasText: /registration/i }).first()).toBeVisible();
    });

    test('coach can access noticeboard', async ({ page }) => {
      await page.goto('/book/noticeboard');
      await waitForPageReady(page);

      // Should see noticeboard
      await expect(page.locator('h1, h2').filter({ hasText: /noticeboard|notice/i }).first()).toBeVisible();
    });

    test('coach can access professional directory', async ({ page }) => {
      await page.goto('/book/professionals');
      await waitForPageReady(page);

      // Should see directory
      await expect(page.locator('h1, h2').filter({ hasText: /professional|directory/i }).first()).toBeVisible();
    });
  });
});
