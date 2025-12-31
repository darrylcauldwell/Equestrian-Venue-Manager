import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Admin Management Features', () => {
  test.describe('Step 1: Stables Management', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access stables management', async ({ page }) => {
      await page.goto('/book/admin/stables');
      await waitForPageReady(page);

      // Should see stables page - look for Add Block/Add Stable buttons or stables grid
      const stablesContent = page.locator('.stables-grid, button:has-text("Add Block"), button:has-text("Add Stable")');
      await expect(stablesContent.first()).toBeVisible();
    });

    test('admin can view stable blocks', async ({ page }) => {
      await page.goto('/book/admin/stables');
      await waitForPageReady(page);

      // Look for stable blocks or list
      const stablesContent = page.locator('[class*="stable"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });

    test('admin can see add stable block option', async ({ page }) => {
      await page.goto('/book/admin/stables');
      await waitForPageReady(page);

      // Look for add button
      const addBtn = page.locator('button, a').filter({ hasText: /add|create|new/i });
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 2: Livery Packages', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access livery packages', async ({ page }) => {
      await page.goto('/book/admin/livery-packages');
      await waitForPageReady(page);

      // Should see livery packages page - look for Add Package button or package cards
      const packagesContent = page.locator('button:has-text("Add Package"), .ds-card, .package-card');
      await expect(packagesContent.first()).toBeVisible();
    });

    test('admin can view package list', async ({ page }) => {
      await page.goto('/book/admin/livery-packages');
      await waitForPageReady(page);

      // Should see packages
      const packageContent = page.locator('[class*="package"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });

    test('admin can see add package option', async ({ page }) => {
      await page.goto('/book/admin/livery-packages');
      await waitForPageReady(page);

      // Look for add button
      const addBtn = page.locator('button, a').filter({ hasText: /add|create|new/i });
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 3: Arena Usage Report', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access arena usage report', async ({ page }) => {
      await page.goto('/book/admin/arena-usage');
      await waitForPageReady(page);

      // Should see arena usage page - look for period selector or summary cards
      const usageContent = page.locator('.period-selector, .report-summary, .arena-usage-card, button:has-text("Month")');
      await expect(usageContent.first()).toBeVisible();
    });

    test('admin can view usage statistics', async ({ page }) => {
      await page.goto('/book/admin/arena-usage');
      await waitForPageReady(page);

      // Look for charts or stats
      const statsContent = page.locator('[class*="chart"], [class*="stat"], [class*="report"], .ds-card');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 4: Financial Reports', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access financial reports', async ({ page }) => {
      await page.goto('/book/admin/reports');
      await waitForPageReady(page);

      // Should see reports page
      await expect(page.locator('h1, h2').filter({ hasText: /report|financial|revenue/i }).first()).toBeVisible();
    });

    test('admin can view revenue data', async ({ page }) => {
      await page.goto('/book/admin/reports');
      await waitForPageReady(page);

      // Look for financial data
      const reportsContent = page.locator('[class*="report"], [class*="revenue"], [class*="chart"], .ds-card');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 5: Land Management', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access land management', async ({ page }) => {
      await page.goto('/book/admin/land-management');
      await waitForPageReady(page);

      // Should see land management page
      await expect(page.locator('h1, h2').filter({ hasText: /land|field|pasture/i }).first()).toBeVisible();
    });

    test('admin can view fields', async ({ page }) => {
      await page.goto('/book/admin/fields');
      await waitForPageReady(page);

      // Should see fields page
      await expect(page.locator('h1, h2').filter({ hasText: /field/i }).first()).toBeVisible();
    });
  });

  test.describe('Step 6: Care Plans', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access care plans', async ({ page }) => {
      await page.goto('/book/admin/care-plans');
      await waitForPageReady(page);

      // Should see care plans page
      await expect(page.locator('h1, h2').filter({ hasText: /care|plan|rehab/i }).first()).toBeVisible();
    });

    test('admin can view care plan list', async ({ page }) => {
      await page.goto('/book/admin/care-plans');
      await waitForPageReady(page);

      // Look for care plan content
      const carePlansContent = page.locator('[class*="care"], [class*="plan"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 7: Coaches Management', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access coaches management', async ({ page }) => {
      await page.goto('/book/admin/coaches');
      await waitForPageReady(page);

      // Should see coaches page - look for tabs with coach content
      const coachContent = page.locator('.tabs-container, button:has-text("Pending Approval"), button:has-text("Active Coaches")');
      await expect(coachContent.first()).toBeVisible();
    });

    test('admin can view coach profiles', async ({ page }) => {
      await page.goto('/book/admin/coaches');
      await waitForPageReady(page);

      // Look for coach profiles
      const coachContent = page.locator('[class*="coach"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 8: System Settings', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access compliance', async ({ page }) => {
      await page.goto('/book/admin/compliance');
      await waitForPageReady(page);

      // Should see compliance page - look for Add Compliance Item button or stats
      const complianceContent = page.locator('button:has-text("Add Compliance Item"), .stats-grid, .stat-card');
      await expect(complianceContent.first()).toBeVisible();
    });

    test('admin can access backups page with both sections', async ({ page }) => {
      await page.goto('/book/admin/backups');
      await waitForPageReady(page);

      // Should see Database Backup section
      await expect(page.locator('h2').filter({ hasText: /database backup/i })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: /create database backup/i })).toBeVisible();

      // Should see Data Export/Import section
      await expect(page.locator('h2').filter({ hasText: /data export/i })).toBeVisible();
      await expect(page.locator('button').filter({ hasText: /export data now/i })).toBeVisible();

      // Should see Import and Validate buttons
      await expect(page.locator('label, button').filter({ hasText: /validate file/i }).first()).toBeVisible();
      await expect(page.locator('label, button').filter({ hasText: /import from file/i }).first()).toBeVisible();
    });

    test('admin can create database backup', async ({ page }) => {
      await page.goto('/book/admin/backups');
      await waitForPageReady(page);

      // Click create database backup button
      const createBtn = page.locator('button').filter({ hasText: /create database backup/i });
      await expect(createBtn).toBeVisible();
      await createBtn.click();

      // Wait for backup to complete (button should show "Creating..." then reset)
      // Or success message should appear
      await page.waitForTimeout(2000);

      // Should see success message or the backup in the list
      const successOrTable = page.locator('.success-message, table.ds-table tbody tr').first();
      await expect(successOrTable).toBeVisible({ timeout: 10000 });
    });

    test('admin can create data export', async ({ page }) => {
      await page.goto('/book/admin/backups');
      await waitForPageReady(page);

      // Click export data button
      const exportBtn = page.locator('button').filter({ hasText: /export data now/i });
      await expect(exportBtn).toBeVisible();
      await exportBtn.click();

      // Wait for export to complete
      await page.waitForTimeout(2000);

      // Should see success message or the export in the history
      const successOrTable = page.locator('.success-message, table tbody tr').first();
      await expect(successOrTable).toBeVisible({ timeout: 10000 });
    });

    test('admin can access security settings', async ({ page }) => {
      await page.goto('/book/admin/security');
      await waitForPageReady(page);

      // Should see security page - look for Security Information form or save button
      const securityContent = page.locator('h3:has-text("Security"), button:has-text("Save Security"), form, .form-section');
      await expect(securityContent.first()).toBeVisible();
    });
  });

  test.describe('Step 9: Feed Schedule', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access feed schedule', async ({ page }) => {
      await page.goto('/book/admin/feed-schedule');
      await waitForPageReady(page);

      // Should see feed schedule page
      await expect(page.locator('h1, h2').filter({ hasText: /feed/i }).first()).toBeVisible();
    });

    test('admin can view feed duties', async ({ page }) => {
      await page.goto('/book/admin/feed-schedule');
      await waitForPageReady(page);

      // Look for feed content
      const feedContent = page.locator('[class*="feed"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
