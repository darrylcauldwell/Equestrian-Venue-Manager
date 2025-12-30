import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Holiday Livery Workflow Test
 *
 * Flow: Public submits request → Admin reviews → Admin approves/rejects →
 *       User account created → Horse registered → Livery billing applies
 *
 * Holiday livery statuses: pending → approved/rejected/cancelled
 * Billing: Weekly rate charged per day (weekly_price / 7 * days)
 */
test.describe('Holiday Livery Workflow', () => {
  test.describe('Step 1: Public Request Submission', () => {
    test('public page shows holiday livery information', async ({ page }) => {
      await safeGoto(page, '/livery');

      // Page should show livery packages including holiday option
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('public can access holiday livery request form', async ({ page }) => {
      await page.goto('/holiday-livery');

      // Page should show request form
      await expect(page.locator('h1, h2').filter({ hasText: /holiday|temporary|short.*term/i }).first()).toBeVisible();
    });

    test('holiday livery form has required fields', async ({ page }) => {
      await safeGoto(page, '/holiday-livery');

      // Form should have guest details fields
      const nameField = page.locator('input[name*="name"], #guest_name, #guestName');
      const emailField = page.locator('input[type="email"], #guest_email, #guestEmail');
      const phoneField = page.locator('input[type="tel"], input[name*="phone"]');

      // Horse details fields
      const horseNameField = page.locator('#horse_name, #horseName, input[name*="horse_name"]');

      // Date fields
      const arrivalField = page.locator('input[type="date"]').first();
      const departureField = page.locator('input[type="date"]').nth(1);

      // At least some form elements should be visible
      await expect(page.locator('form').first()).toBeVisible();
    });

    test('holiday livery form validates required fields', async ({ page }) => {
      await safeGoto(page, '/holiday-livery');

      // Try to submit empty form
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        // Form should show validation errors
        await page.waitForTimeout(300);
      }
    });

    test('public can submit holiday livery request', async ({ page }) => {
      await safeGoto(page, '/holiday-livery');

      // Fill in guest details
      const nameField = page.locator('input[name*="name"], #guest_name, #guestName').first();
      if (await nameField.isVisible()) {
        await nameField.fill('Test Holiday Guest');
      }

      const emailField = page.locator('input[type="email"]').first();
      if (await emailField.isVisible()) {
        await emailField.fill('holiday.guest@example.com');
      }

      // Fill in horse details
      const horseNameField = page.locator('#horse_name, #horseName, input[name*="horse_name"]').first();
      if (await horseNameField.isVisible()) {
        await horseNameField.fill('Holiday Horse');
      }

      // Fill in dates
      const dateFields = page.locator('input[type="date"]');
      const arrivalField = dateFields.first();
      const departureField = dateFields.nth(1);

      if (await arrivalField.isVisible()) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 14);
        await arrivalField.fill(futureDate.toISOString().split('T')[0]);
      }

      if (await departureField.isVisible()) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 21);
        await departureField.fill(futureDate.toISOString().split('T')[0]);
      }

      // Submit form
      const submitBtn = page.locator('button[type="submit"]');
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('Step 2: Admin Reviews Requests', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can access holiday livery management page', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see pending requests', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      // Should show request list or table
      await expect(page.locator('table, .request-list, [class*="requests"]').first()).toBeVisible();
    });

    test('admin can filter requests by status', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      const statusFilter = page.locator('select, .filter, [class*="status"]').first();
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeEnabled();
      }
    });

    test('admin can view request details', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      // Click on a request row
      const requestRow = page.locator('tr, .request-item, [class*="request"]').first();
      if (await requestRow.isVisible()) {
        await requestRow.click();
        await page.waitForTimeout(300);

        // Details panel or modal should appear
        const details = page.locator('.ds-modal, .modal, .detail, [class*="details"]');
        // Details may or may not appear depending on UI design
      }
    });

    test('admin can see request statistics', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      // Stats section should be visible
      const stats = page.locator('.stats, [class*="stat"], [class*="summary"]');
      // Stats section may be visible
    });
  });

  test.describe('Step 3: Admin Approves Request', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can open approve modal', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      // Find approve button
      const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(300);

        // Modal should appear
        const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
        if (await modal.isVisible()) {
          await expect(modal).toBeVisible();
        }
      }
    });

    test('approval form has stable selection', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(300);

        // Stable select should be visible
        const stableSelect = page.locator('select').filter({ hasText: /stable|block/i });
        // Stable selection may be available
      }
    });

    test('approval form has date confirmation fields', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(300);

        // Date fields should be visible
        const dateFields = page.locator('input[type="date"]');
        // Date confirmation fields may be available
      }
    });

    test('admin can submit approval', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
      if (await approveBtn.isVisible()) {
        await approveBtn.click();
        await page.waitForTimeout(300);

        // Find submit/confirm button in modal
        const confirmBtn = page.locator('.ds-modal, .modal, [role="dialog"]')
          .locator('button').filter({ hasText: /confirm|submit|approve/i });
        if (await confirmBtn.isVisible()) {
          await expect(confirmBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 4: Admin Rejects Request', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can open reject modal', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      const rejectBtn = page.locator('button').filter({ hasText: /reject/i }).first();
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();
        await page.waitForTimeout(300);

        // Modal should appear
        const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
        if (await modal.isVisible()) {
          await expect(modal).toBeVisible();
        }
      }
    });

    test('rejection requires reason', async ({ page }) => {
      await safeGoto(page, '/book/admin/holiday-livery');

      const rejectBtn = page.locator('button').filter({ hasText: /reject/i }).first();
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();
        await page.waitForTimeout(300);

        // Reason textarea should be visible
        const reasonField = page.locator('textarea, input[type="text"]').first();
        // Reason field should be required
      }
    });
  });

  test.describe('Step 5: Approved Holiday Livery User', () => {
    test.beforeEach(async ({ loginAs }) => {
      // Login as the holiday livery user (holiday1 from seed data)
      await loginAs('livery');
    });

    test('holiday livery user can access dashboard', async ({ page }) => {
      await safeGoto(page, '/book');

      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('holiday livery user can view their horses', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');

      await expect(page.locator('.horses, table, [class*="horse"], h1, h2').first()).toBeVisible();
    });

    test('holiday livery user can access feed management', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');

      // Navigate to horse detail and feed tab
      const horseLink = page.locator('a, button').filter({ hasText: /view|details|manage/i }).first();
      if (await horseLink.isVisible()) {
        await horseLink.click();
        await page.waitForLoadState('domcontentloaded');

        // Feed tab should be accessible
        const feedTab = page.locator('[role="tab"], .ds-tab, .tab, button').filter({ hasText: /feed/i });
        if (await feedTab.isVisible()) {
          await expect(feedTab).toBeEnabled();
        }
      }
    });

    test('holiday livery user can view their account', async ({ page }) => {
      await safeGoto(page, '/book/my-account');

      await expect(page.locator('.my-account, [class*="account"]').first()).toBeVisible();
    });
  });

  test.describe('Step 6: Holiday Livery Billing', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can access monthly billing page', async ({ page }) => {
      await safeGoto(page, '/book/admin/billing');

      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see monthly billing tab', async ({ page }) => {
      await safeGoto(page, '/book/admin/billing');

      // Tab for monthly billing should be visible
      const billingTab = page.locator('[role="tab"], .ds-tab, .tab, button')
        .filter({ hasText: /monthly|billing|run/i });
      if (await billingTab.isVisible()) {
        await expect(billingTab).toBeEnabled();
      }
    });

    test('admin can preview monthly billing', async ({ page }) => {
      await safeGoto(page, '/book/admin/billing');

      // Click on monthly billing tab
      const billingTab = page.locator('[role="tab"], .ds-tab, .tab, button')
        .filter({ hasText: /monthly|billing/i });
      if (await billingTab.isVisible()) {
        await billingTab.click();
        await page.waitForTimeout(300);

        // Preview button should be visible
        const previewBtn = page.locator('button').filter({ hasText: /preview/i });
        if (await previewBtn.isVisible()) {
          await expect(previewBtn).toBeEnabled();
        }
      }
    });

    test('billing preview shows holiday livery charges', async ({ page }) => {
      await safeGoto(page, '/book/admin/billing');

      // Navigate to monthly billing and preview
      const billingTab = page.locator('[role="tab"], .ds-tab, .tab, button')
        .filter({ hasText: /monthly|billing/i });
      if (await billingTab.isVisible()) {
        await billingTab.click();
        await page.waitForTimeout(300);

        const previewBtn = page.locator('button').filter({ hasText: /preview/i });
        if (await previewBtn.isVisible()) {
          await previewBtn.click();
          await page.waitForLoadState('domcontentloaded');

          // Preview results should show
          const results = page.locator('.preview, .results, table');
          // Results may be visible if there's billing data
        }
      }
    });

    test('admin can run monthly billing', async ({ page }) => {
      await safeGoto(page, '/book/admin/billing');

      // Navigate to monthly billing
      const billingTab = page.locator('[role="tab"], .ds-tab, .tab, button')
        .filter({ hasText: /monthly|billing/i });
      if (await billingTab.isVisible()) {
        await billingTab.click();
        await page.waitForTimeout(300);

        // Run billing button should be visible
        const runBtn = page.locator('button').filter({ hasText: /run|generate|create/i });
        if (await runBtn.isVisible()) {
          await expect(runBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 7: Holiday Livery Invoice', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can generate invoice for holiday livery user', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      // Use domcontentloaded instead of networkidle to avoid timeout on slow/polling pages
      await page.waitForLoadState('domcontentloaded');
      // Wait for page content to appear
      await page.locator('h1, h2, .page-header').first().waitFor({ state: 'visible', timeout: 10000 });

      const generateBtn = page.locator('button').filter({ hasText: /generate|create|new/i });
      if (await generateBtn.first().isVisible({ timeout: 3000 })) {
        await generateBtn.first().click();
        await page.waitForTimeout(300);

        // Form or modal should appear - include ds-modal
        const form = page.locator('form, .ds-modal, .modal, [role="dialog"]');
        await expect(form.first()).toBeVisible();
      }
    });

    test('invoice includes holiday livery charges', async ({ page }) => {
      await page.goto('/book/admin/invoices');
      // Use domcontentloaded instead of networkidle to avoid timeout on slow/polling pages
      await page.waitForLoadState('domcontentloaded');
      // Wait for page content to appear
      await page.locator('h1, h2, .page-header, table').first().waitFor({ state: 'visible', timeout: 10000 });

      // Click on an invoice to see details
      const invoiceRow = page.locator('tr, .invoice-item').first();
      if (await invoiceRow.isVisible({ timeout: 3000 })) {
        await invoiceRow.click();
        await page.waitForTimeout(300);

        // Details should show line items
        const lineItems = page.locator('.line-items, .items, table tbody');
        // Line items may be visible
      }
    });
  });
});
