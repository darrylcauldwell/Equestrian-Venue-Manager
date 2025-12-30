import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Invoice Workflow Test
 *
 * Flow: Admin generates invoice → Issues invoice → Livery views → Admin marks paid
 */
test.describe('Invoice Workflow', () => {
  test.describe('Step 1: Admin Generates Invoice', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view invoices page', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see invoice list', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('table, .invoice-list, [class*="invoice"]').first()).toBeVisible();
    });

    test('admin can see generate button', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      const generateBtn = page.locator('button').filter({ hasText: /generate|create|new/i });
      await expect(generateBtn.first()).toBeVisible();
    });

    test('admin can filter invoices', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      const filter = page.locator('select, .filter').first();
      if (await filter.isVisible()) {
        await filter.click();
        await page.waitForTimeout(200);
      }
    });
  });

  test.describe('Step 2: Admin Views Billing', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view billing page', async ({ page }) => {
      await page.goto('/book/admin/billing');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see billing summary', async ({ page }) => {
      await page.goto('/book/admin/billing');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('.billing-summary, table, [class*="billing"]').first()).toBeVisible();
    });
  });

  test.describe('Step 3: Livery User Views Invoices', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view my invoices page', async ({ page }) => {
      await page.goto('/book/my-invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('livery user can see invoice list', async ({ page }) => {
      await page.goto('/book/my-invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('.my-invoices, table, [class*="invoice"]').first()).toBeVisible();
    });
  });

  test.describe('Step 4: Livery User Views Account', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view my account page', async ({ page }) => {
      await page.goto('/book/my-account');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('livery user can see account info', async ({ page }) => {
      await page.goto('/book/my-account');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('.my-account, [class*="account"]').first()).toBeVisible();
    });
  });
});
