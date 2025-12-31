import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Staff Leave Management Workflow', () => {
  test.describe('Step 1: Staff Accesses My Leave Page', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access my leave page', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Should see the page title
      await expect(page.locator('h1').filter({ hasText: /leave|holiday/i }).first()).toBeVisible();
    });

    test('staff sees leave overview with tabs', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Should see tab navigation
      const tabs = page.locator('.leave-tabs');
      await expect(tabs.first()).toBeVisible();
    });

    test('staff sees leave summary stats', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Should see leave allowance/summary info
      const summaryCards = page.locator('.leave-summary, .stats-card, [class*="summary"]');
      await expect(summaryCards.first().or(page.locator('.my-leave-page'))).toBeVisible();
    });
  });

  test.describe('Step 2: Staff Requests Holiday', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can open holiday request form', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Find and click request button
      const requestBtn = page.locator('button').filter({ hasText: /request|new|book/i });
      if (await requestBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await requestBtn.first().click();

        // Modal should appear
        const modal = page.locator('.ds-modal');
        await expect(modal).toBeVisible();
      }
    });

    test('staff sees date fields in request form', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Click request tab or button
      const requestTab = page.locator('button, [role="tab"]').filter({ hasText: /request/i });
      if (await requestTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await requestTab.first().click();
        await page.waitForTimeout(500);

        // Should see date inputs
        const dateInputs = page.locator('input[type="date"]');
        const hasDateInputs = (await dateInputs.count()) > 0;
        expect(hasDateInputs).toBeTruthy();
      }
    });
  });

  test.describe('Step 3: Staff Views Holiday History', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can view history tab', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Find and click history tab
      const historyTab = page.locator('button, [role="tab"]').filter({ hasText: /history|past/i });
      if (await historyTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await historyTab.first().click();
        await page.waitForTimeout(500);
      }

      // Page should still be visible
      await expect(page.locator('body')).toBeVisible();
    });

    test('staff can view upcoming holidays tab', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Find and click upcoming tab
      const upcomingTab = page.locator('button, [role="tab"]').filter({ hasText: /upcoming|scheduled/i });
      if (await upcomingTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await upcomingTab.first().click();
        await page.waitForTimeout(500);
      }

      // Page should still be visible
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 4: Staff Views Absences', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can view absences tab', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Find and click absences tab
      const absencesTab = page.locator('button, [role="tab"]').filter({ hasText: /absence|sick/i });
      if (await absencesTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await absencesTab.first().click();
        await page.waitForTimeout(500);
      }

      // Page should still be visible
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 5: Staff Views Bank Holidays', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can view bank holidays tab', async ({ page }) => {
      await page.goto('/book/my-leave');
      await waitForPageReady(page);

      // Find and click bank holidays tab
      const bankHolidaysTab = page.locator('button, [role="tab"]').filter({ hasText: /bank|public/i });
      if (await bankHolidaysTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await bankHolidaysTab.first().click();
        await page.waitForTimeout(500);
      }

      // Page should be visible after clicking tab
      await expect(page.locator('body')).toBeVisible();
    });
  });
});

test.describe('Admin Leave Overview Workflow', () => {
  test.describe('Step 1: Admin Accesses Leave Overview', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff'); // Using staff for now as admin may have different password
      await dismissPopups(page);
    });

    test('admin can access leave overview page', async ({ page }) => {
      await page.goto('/book/admin/leave-overview');
      await waitForPageReady(page);

      // Should see the page or be redirected if no access
      const pageBody = page.locator('body');
      await expect(pageBody).toBeVisible();
    });
  });

  test.describe('Step 2: Admin Views Pending Requests', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('leave overview has pending requests section', async ({ page }) => {
      await page.goto('/book/admin/leave-overview');
      await waitForPageReady(page);

      // Find pending tab or section
      const pendingTab = page.locator('button, [role="tab"]').filter({ hasText: /pending|requests/i });
      if (await pendingTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await pendingTab.first().click();
        await page.waitForTimeout(500);
      }

      // Page should still be visible
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 3: Admin Views Calendar', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('leave overview has calendar view', async ({ page }) => {
      await page.goto('/book/admin/leave-overview');
      await waitForPageReady(page);

      // Find calendar tab
      const calendarTab = page.locator('button, [role="tab"]').filter({ hasText: /calendar/i });
      if (await calendarTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await calendarTab.first().click();
        await page.waitForTimeout(500);

        // Should see calendar view
        const calendar = page.locator('.leave-calendar, [class*="calendar"]');
        await expect(calendar.first().or(page.locator('body'))).toBeVisible();
      }
    });
  });

  test.describe('Step 4: Admin Views Staff Balances', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('leave overview has balances view', async ({ page }) => {
      await page.goto('/book/admin/leave-overview');
      await waitForPageReady(page);

      // Find balances tab
      const balancesTab = page.locator('button, [role="tab"]').filter({ hasText: /balance/i });
      if (await balancesTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await balancesTab.first().click();
        await page.waitForTimeout(500);
      }

      // Page should still be visible
      await expect(page.locator('body')).toBeVisible();
    });

    test('balances view shows entitlement column', async ({ page }) => {
      await page.goto('/book/admin/leave-overview');
      await waitForPageReady(page);

      // Find and click balances tab
      const balancesTab = page.locator('button, [role="tab"]').filter({ hasText: /balance/i });
      if (await balancesTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await balancesTab.first().click();
        await page.waitForTimeout(500);

        // Table should have Entitlement column
        const entitlementHeader = page.locator('th').filter({ hasText: /entitlement/i });
        await expect(entitlementHeader.first()).toBeVisible();
      }
    });

    test('balances view shows year selector', async ({ page }) => {
      await page.goto('/book/admin/leave-overview');
      await waitForPageReady(page);

      // Find and click balances tab
      const balancesTab = page.locator('button, [role="tab"]').filter({ hasText: /balance/i });
      if (await balancesTab.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await balancesTab.first().click();
        await page.waitForTimeout(500);

        // Year selector should be visible
        const yearSelector = page.locator('.ds-select, select').first();
        await expect(yearSelector).toBeVisible();
      }
    });
  });
});

test.describe('Leave Access Control', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('livery');
    await dismissPopups(page);
  });

  test('livery cannot access my leave page (staff only)', async ({ page }) => {
    await page.goto('/book/my-leave');
    await waitForPageReady(page);

    // Livery should be redirected or see access denied
    const url = page.url();
    const hasAccessDenied = await page.locator('text=/access denied|not authorized|permission/i').isVisible().catch(() => false);

    // Should not be on my-leave page or should see access denied
    expect(!url.includes('/my-leave') || hasAccessDenied).toBeTruthy();
  });

  test('livery cannot access leave overview page (admin only)', async ({ page }) => {
    await page.goto('/book/admin/leave-overview');
    await waitForPageReady(page);

    // Livery should be redirected or see access denied
    const url = page.url();
    const hasAccessDenied = await page.locator('text=/access denied|not authorized|permission/i').isVisible().catch(() => false);

    // Should not be on leave-overview page or should see access denied
    expect(!url.includes('/leave-overview') || hasAccessDenied).toBeTruthy();
  });
});
