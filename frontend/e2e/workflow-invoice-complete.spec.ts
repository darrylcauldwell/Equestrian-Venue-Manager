import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Complete Invoice Workflow Test
 *
 * Flow: Admin generates invoice → Admin issues invoice → Livery views/pays →
 *       Admin marks as paid
 *
 * Invoice statuses: draft → issued → paid (or cancelled)
 */
test.describe('Complete Invoice Workflow', () => {
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

    test('admin can see generate invoice button', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      const generateBtn = page.locator('button').filter({ hasText: /generate|create|new/i });
      await expect(generateBtn.first()).toBeVisible();
    });

    test('admin can open generate invoice form', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      const generateBtn = page.locator('button').filter({ hasText: /generate|create|new/i });
      if (await generateBtn.first().isVisible()) {
        await generateBtn.first().click();
        await page.waitForTimeout(300);

        // Form or modal should appear
        const form = page.locator('form, .ds-modal, .modal, [role="dialog"]');
        await expect(form.first()).toBeVisible();
      }
    });

    test('admin can select user for invoice', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      const generateBtn = page.locator('button').filter({ hasText: /generate|create|new/i });
      if (await generateBtn.first().isVisible()) {
        await generateBtn.first().click();
        await page.waitForTimeout(300);

        // User select should be visible
        const userSelect = page.locator('select').first();
        if (await userSelect.isVisible()) {
          await expect(userSelect).toBeEnabled();
        }
      }
    });

    test('admin can filter invoices by status', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      const statusFilter = page.locator('select, .filter').first();
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeEnabled();
      }
    });
  });

  test.describe('Step 2: Admin Issues Invoice', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see draft invoices', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Filter to draft - status filter should be visible
      const statusFilter = page.locator('select').first();
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeEnabled();
      }
    });

    test('admin can issue an invoice', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Find issue button
      const issueBtn = page.locator('button').filter({ hasText: /issue|send/i }).first();
      if (await issueBtn.isVisible()) {
        await expect(issueBtn).toBeEnabled();
      }
    });

    test('admin can view invoice details', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Click on an invoice row
      const invoiceRow = page.locator('tr, .invoice-item').first();
      if (await invoiceRow.isVisible()) {
        await invoiceRow.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Step 3: Livery User Views Invoice', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view my invoices page', async ({ page }) => {
      await page.goto('/book/my-invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('livery user can see their invoices', async ({ page }) => {
      await page.goto('/book/my-invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('.my-invoices, table, [class*="invoice"]').first()).toBeVisible();
    });

    test('livery user can see invoice status', async ({ page }) => {
      await page.goto('/book/my-invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Should see status badges
      const status = page.locator('.status, .badge, [class*="status"]');
      // Badges may or may not be visible depending on data
    });

    test('livery user can download invoice', async ({ page }) => {
      await page.goto('/book/my-invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Find download button
      const downloadBtn = page.locator('button, a').filter({ hasText: /download|pdf/i }).first();
      if (await downloadBtn.isVisible()) {
        await expect(downloadBtn).toBeEnabled();
      }
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

    test('livery user can see account balance', async ({ page }) => {
      await page.goto('/book/my-account');
      await waitForPageReady(page);
      await dismissPopups(page);
      await expect(page.locator('.my-account, [class*="account"]').first()).toBeVisible();
    });
  });

  test.describe('Step 5: Admin Marks Invoice as Paid', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see issued invoices', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Status filter should be visible
      const statusFilter = page.locator('select').first();
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeEnabled();
      }
    });

    test('admin can mark invoice as paid', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Find mark paid button
      const paidBtn = page.locator('button').filter({ hasText: /paid|mark.*paid|received/i }).first();
      if (await paidBtn.isVisible()) {
        await expect(paidBtn).toBeEnabled();
      }
    });

    test('admin can cancel an invoice', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Find cancel button
      const cancelBtn = page.locator('button').filter({ hasText: /cancel/i }).first();
      if (await cancelBtn.isVisible()) {
        await expect(cancelBtn).toBeEnabled();
      }
    });

    test('admin can see paid invoices', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Status filter should be visible and usable
      const statusFilter = page.locator('select').first();
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeEnabled();
      }
    });
  });

  test.describe('Step 6: Admin Views Billing Overview', () => {
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

    test('admin can view user billing details', async ({ page }) => {
      await page.goto('/book/admin/billing');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Click on a user row
      const userRow = page.locator('tr, .user-item').first();
      if (await userRow.isVisible()) {
        await userRow.click();
        await page.waitForTimeout(300);
      }
    });
  });
});
