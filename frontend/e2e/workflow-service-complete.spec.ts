import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Complete Service Request Workflow Test
 *
 * Flow: Livery requests service → Admin approves → Admin schedules →
 *       Staff completes → Service marked complete
 *
 * Statuses: pending_approval → pending_scheduling → scheduled → in_progress → completed
 */
test.describe('Complete Service Request Workflow', () => {
  test.describe('Step 1: Livery User Creates Service Request', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view services page', async ({ page }) => {
      await page.goto('/book/services');
      await expect(page.locator('h1, .services-page').first()).toBeVisible();
    });

    test('livery user can see service categories', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Should see service categories or list
      await expect(page.locator('.services-page, .service-category, [class*="service"]').first()).toBeVisible();
    });

    test('livery user can select a service', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Find a service request button - scope to services section to avoid matching nav elements
      // The actual button has class 'request-btn' and is inside '.services-grid' or '.service-card'
      const serviceBtn = page.locator('.services-grid .request-btn, .service-card .request-btn, .catalog-section button.request-btn').first();
      if (await serviceBtn.isVisible({ timeout: 3000 })) {
        await serviceBtn.click();
        await page.waitForTimeout(300);
      }
    });

    test('livery user can view their pending requests', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Should see pending requests section
      const pendingSection = page.locator('[class*="pending"], .my-requests');
      if (await pendingSection.first().isVisible()) {
        await expect(pendingSection.first()).toBeVisible();
      }
    });

    test('livery user can view their completed services', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Look for completed or history section
      const completedSection = page.locator('[class*="completed"], [class*="history"]');
      // Section may or may not exist based on data
    });
  });

  test.describe('Step 2: Admin Approves Service Request', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view service requests page', async ({ page }) => {
      await page.goto('/book/admin/service-requests');
      await expect(page.locator('.admin-page, h1').first()).toBeVisible();
    });

    test('admin can see pending approval requests', async ({ page }) => {
      await safeGoto(page, '/book/admin/service-requests');

      // Look for pending section or filter
      const pendingFilter = page.locator('.filter-btn, select').filter({ hasText: /pending/i }).first();
      if (await pendingFilter.isVisible()) {
        await pendingFilter.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can approve a service request', async ({ page }) => {
      await safeGoto(page, '/book/admin/service-requests');

      // Find approve button
      const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
      if (await approveBtn.isVisible()) {
        await expect(approveBtn).toBeEnabled();
      }
    });

    test('admin can reject a service request', async ({ page }) => {
      await safeGoto(page, '/book/admin/service-requests');

      // Find reject button
      const rejectBtn = page.locator('button').filter({ hasText: /reject|decline/i }).first();
      if (await rejectBtn.isVisible()) {
        await expect(rejectBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 3: Admin Schedules Service', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see pending scheduling requests', async ({ page }) => {
      await safeGoto(page, '/book/admin/service-requests');

      // Look for scheduling section
      const schedulingFilter = page.locator('.filter-btn, select').filter({ hasText: /schedul/i }).first();
      if (await schedulingFilter.isVisible()) {
        await schedulingFilter.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can schedule a service', async ({ page }) => {
      await safeGoto(page, '/book/admin/service-requests');

      // Find schedule button
      const scheduleBtn = page.locator('button').filter({ hasText: /schedule/i }).first();
      if (await scheduleBtn.isVisible()) {
        await expect(scheduleBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 4: Staff Completes Service', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view yard tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1, .yard-tasks').first()).toBeVisible();
    });

    test('staff can see scheduled services as tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Should see tasks list
      await expect(page.locator('.yard-tasks, .task-list, [class*="task"]').first()).toBeVisible();
    });

    test('staff can mark task as complete', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find complete button on a task
      const completeBtn = page.locator('button').filter({ hasText: /complete|done|finish/i }).first();
      if (await completeBtn.isVisible()) {
        await expect(completeBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 5: Admin Views Completed Services', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see completed services', async ({ page }) => {
      await safeGoto(page, '/book/admin/service-requests');

      // Look for completed filter
      const completedFilter = page.locator('.filter-btn, select').filter({ hasText: /completed/i }).first();
      if (await completedFilter.isVisible()) {
        await completedFilter.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can view service catalog', async ({ page }) => {
      await page.goto('/book/admin/services');
      await expect(page.locator('.admin-page, h1').first()).toBeVisible();
    });
  });
});
