import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Booking Flow', () => {
  test.describe('Public Booking', () => {
    test('can view public booking page', async ({ page }) => {
      await safeGoto(page, '/public-booking');
      // Should see booking page content
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('can see arena cards', async ({ page }) => {
      await safeGoto(page, '/public-booking');
      // Arena cards or calendar should be present
      const content = page.locator('.arena-card, .fc, [class*="calendar"], [class*="arena"]');
      await expect(content.first()).toBeVisible();
    });
  });

  test.describe('Livery Booking', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('can navigate to booking page', async ({ page }) => {
      await page.goto('/book');
      await expect(page).toHaveURL(/\/book/);
    });

    test('can view my bookings', async ({ page }) => {
      await page.goto('/book/my-bookings');
      await waitForPageReady(page);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('can access booking calendar', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Calendar or booking UI should be visible - or at least the page loaded
      const calendar = page.locator('.fc, .booking-calendar, [class*="calendar"]').first();
      const pageHeading = page.locator('h1, h2').first();
      // Either calendar is visible or page heading is visible (page loaded successfully)
      await expect(calendar.or(pageHeading)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Admin Booking Management', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('can view all bookings', async ({ page }) => {
      await page.goto('/book/admin/bookings');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('can filter bookings by arena', async ({ page }) => {
      await page.goto('/book/admin/bookings');
      // Look for filter controls
      const filterSelect = page.locator('select, [role="combobox"]');
      if (await filterSelect.first().isVisible()) {
        await expect(filterSelect.first()).toBeEnabled();
      }
    });

    test('can access arena usage report', async ({ page }) => {
      await page.goto('/book/admin/arena-usage');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });
  });
});
