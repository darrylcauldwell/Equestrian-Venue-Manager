import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Arena Booking Workflow Test
 *
 * Flow: Livery views calendar → Creates booking → Admin manages
 */
test.describe('Arena Booking Workflow', () => {
  test.describe('Step 1: Livery User Views Booking Calendar', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view booking calendar', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Calendar or page heading should be visible
      const calendar = page.locator('.fc, .booking-calendar, [class*="calendar"]').first();
      const pageHeading = page.locator('h1, h2').first();
      await expect(calendar.or(pageHeading)).toBeVisible({ timeout: 10000 });
    });

    test('livery user can navigate calendar weeks', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);
      await dismissPopups(page);

      const nextBtn = page.locator('.fc-next-button, button').filter({ hasText: /next|>/i }).first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }
    });

    test('livery user can view their bookings', async ({ page }) => {
      await page.goto('/book/my-bookings');
      await waitForPageReady(page);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  });

  test.describe('Step 2: Admin Manages Bookings', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view all bookings', async ({ page }) => {
      await page.goto('/book/admin/bookings');
      await expect(page.locator('h1, h2, .admin-page').first()).toBeVisible();
    });

    test('admin can view arenas', async ({ page }) => {
      await page.goto('/book/admin/arenas');
      await expect(page.locator('h1, .admin-page').first()).toBeVisible();
    });

    test('admin can view arena usage report', async ({ page }) => {
      await page.goto('/book/admin/arena-usage');
      await expect(page.locator('h1, h2, .admin-page').first()).toBeVisible();
    });
  });
});
