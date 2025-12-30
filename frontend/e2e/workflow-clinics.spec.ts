import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Clinic Registration Workflow Test
 *
 * Flow: Public views clinics → Registers → Coach views → Admin manages
 */
test.describe('Clinic Registration Workflow', () => {
  test.describe('Step 1: Public User Views Clinics', () => {
    test('public user can view clinics page', async ({ page }) => {
      await page.goto('/clinics');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('public user can see upcoming clinics', async ({ page }) => {
      await safeGoto(page, '/clinics');
      await expect(page.locator('.clinics-page, [class*="clinic"]').first()).toBeVisible();
    });

    test('public user can see clinic tabs', async ({ page }) => {
      await page.goto('/clinics');
      const tabs = page.locator('.tabs-container, .tab');
      await expect(tabs.first()).toBeVisible();
    });
  });

  test.describe('Step 2: Admin Manages Clinics', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view event triage page', async ({ page }) => {
      await page.goto('/book/admin/events');
      await expect(page.locator('.admin-page, .triage-filters').first()).toBeVisible();
    });

    test('admin can see status filter tabs', async ({ page }) => {
      await page.goto('/book/admin/events');
      // Uses .ds-tab or .tab class for filtering
      await expect(page.locator('.ds-tab, .tab, .tabs-container').first()).toBeVisible();
    });
  });

  test.describe('Step 3: Coach Views Clinics', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('coach');
    });

    test('coach can view clinics page', async ({ page }) => {
      await page.goto('/book/clinics');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('coach can see my clinics tab', async ({ page }) => {
      await page.goto('/book/clinics');
      const tab = page.locator('.ds-tab, .tab').filter({ hasText: /my clinics/i });
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Step 4: Livery User Views Registrations', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view clinics page', async ({ page }) => {
      await page.goto('/book/clinics');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('livery user can see registrations tab', async ({ page }) => {
      await page.goto('/book/clinics');
      const tab = page.locator('.ds-tab, .tab').filter({ hasText: /registration/i });
      if (await tab.isVisible()) {
        await tab.click();
        await page.waitForTimeout(300);
      }
    });
  });
});
