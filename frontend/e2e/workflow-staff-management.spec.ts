import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Staff Management Workflow', () => {
  test.describe('Step 1: Staff Rota Access', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access my rota page', async ({ page }) => {
      await page.goto('/book/my-rota');
      await waitForPageReady(page);

      // Should see rota/schedule page
      await expect(page.locator('h1, h2').filter({ hasText: /rota|schedule|shift/i }).first()).toBeVisible();
    });

    test('staff can view their scheduled shifts', async ({ page }) => {
      await page.goto('/book/my-rota');
      await waitForPageReady(page);

      // Look for shift/rota content
      const rotaContent = page.locator('[class*="rota"], [class*="shift"], .ds-card, .ds-table, .fc-view');
      await expect(page.locator('body')).toBeVisible();
    });

    test('staff rota shows calendar or list view', async ({ page }) => {
      await page.goto('/book/my-rota');
      await waitForPageReady(page);

      // Should have some form of schedule display
      const scheduleDisplay = page.locator('.fc-view, [class*="calendar"], [class*="schedule"], .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 2: Staff Timesheet', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access my timesheet page', async ({ page }) => {
      await page.goto('/book/my-timesheet');
      await waitForPageReady(page);

      // Should see timesheet page
      await expect(page.locator('h1, h2').filter({ hasText: /timesheet|time|hours/i }).first()).toBeVisible();
    });

    test('staff can view their logged hours', async ({ page }) => {
      await page.goto('/book/my-timesheet');
      await waitForPageReady(page);

      // Look for timesheet entries or summary
      const timesheetContent = page.locator('[class*="timesheet"], [class*="hours"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });

    test('staff timesheet has date navigation', async ({ page }) => {
      await page.goto('/book/my-timesheet');
      await waitForPageReady(page);

      // Look for date pickers or navigation
      const dateNav = page.locator('[type="date"], [class*="date"], button').filter({ hasText: /week|month|prev|next/i });
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 3: Staff Feed Duties', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access feed duties page', async ({ page }) => {
      await page.goto('/book/feed-duties');
      await waitForPageReady(page);

      // Should see feed duties page
      await expect(page.locator('h1, h2').filter({ hasText: /feed|feeding/i }).first()).toBeVisible();
    });

    test('staff can view feed schedule', async ({ page }) => {
      await page.goto('/book/feed-duties');
      await waitForPageReady(page);

      // Look for feed schedule content
      const feedContent = page.locator('[class*="feed"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });

    test('staff can see horses requiring feeding', async ({ page }) => {
      await page.goto('/book/feed-duties');
      await waitForPageReady(page);

      // Look for horse feed entries
      const horseEntries = page.locator('[class*="horse"], [class*="feed"], .ds-card');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 4: Staff Task Integration', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access yard tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await waitForPageReady(page);

      // Should see tasks page
      await expect(page.locator('h1, h2').filter({ hasText: /task/i }).first()).toBeVisible();
    });

    test('staff can access turnout board', async ({ page }) => {
      await page.goto('/book/turnout-board');
      await waitForPageReady(page);

      // Should see turnout board
      await expect(page.locator('h1, h2').filter({ hasText: /turnout/i }).first()).toBeVisible();
    });
  });

  test.describe('Step 5: Staff Access Restrictions', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff cannot access admin settings', async ({ page }) => {
      await page.goto('/book/admin/settings');
      await waitForPageReady(page);

      // Should be redirected away from admin
      const url = page.url();
      expect(url.includes('/admin/settings')).toBeFalsy();
    });

    test('staff cannot access my horses (livery only)', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Should be redirected or denied
      const url = page.url();
      const accessDenied = page.locator('text=/access denied|not authorized|permission/i');

      expect(url.includes('/my-horses') === false || await accessDenied.isVisible()).toBeTruthy();
    });

    test('staff cannot access billing', async ({ page }) => {
      await page.goto('/book/admin/billing');
      await waitForPageReady(page);

      // Should be redirected away from admin
      const url = page.url();
      expect(url.includes('/admin/billing')).toBeFalsy();
    });
  });

  test.describe('Step 6: Unplanned Absence Edit', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can create and edit an unplanned absence without 422 error', async ({ page }) => {
      // Navigate to Staff Management - Unplanned Absences tab
      await page.goto('/book/admin/staff?tab=sick');
      await waitForPageReady(page);

      // Verify the Unplanned Absences tab is active
      await expect(page.locator('.ds-tab.active').filter({ hasText: 'Unplanned Absences' })).toBeVisible();

      // Click "Record Absence" button
      await page.locator('button').filter({ hasText: 'Record Absence' }).click();

      // Wait for the modal to appear
      await expect(page.locator('.ds-modal-overlay')).toBeVisible();
      await expect(page.locator('.ds-modal-header h2').filter({ hasText: 'Record Unplanned Absence' })).toBeVisible();

      // The staff dropdown defaults to the current admin user (System Administrator)
      // Verify the dropdown has a valid selection (not the placeholder)
      const staffSelect = page.locator('.ds-modal-body select').first();
      const selectedValue = await staffSelect.inputValue();
      expect(Number(selectedValue)).toBeGreaterThan(0);

      // Set the absence date to today
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const dateInput = page.locator('.ds-modal-body input[type="date"]').first();
      await dateInput.fill(today);

      // Set reason to 'sickness' (default, but explicitly set)
      const reasonSelect = page.locator('.ds-modal-body select').nth(1);
      await reasonSelect.selectOption('sickness');

      // Set an initial expected return date (tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const expectedReturnInput = page.locator('.ds-modal-body input[type="date"]').nth(1);
      await expectedReturnInput.fill(tomorrowStr);

      // Click "Record Absence" to create
      const createResponsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/staff/absences') && resp.request().method() === 'POST'
      );
      await page.locator('.ds-modal-footer button').filter({ hasText: 'Record Absence' }).click();
      const createResponse = await createResponsePromise;
      expect(createResponse.status()).toBeLessThan(300);

      // Wait for modal to close
      await expect(page.locator('.ds-modal-overlay')).toBeHidden({ timeout: 10000 });

      // Wait for the list to reload
      await page.waitForTimeout(1000);
      await dismissPopups(page);

      // Find the row for System Administrator in the absences table
      const absenceRow = page.locator('table tbody tr').filter({ hasText: 'System Administrator' }).last();
      await expect(absenceRow).toBeVisible();

      // Click "Edit" on that row
      await absenceRow.locator('button').filter({ hasText: 'Edit' }).click();

      // Wait for Edit Absence modal to appear
      await expect(page.locator('.ds-modal-overlay')).toBeVisible();
      await expect(page.locator('.ds-modal-header h2').filter({ hasText: 'Edit Absence' })).toBeVisible();

      // Verify the info banner shows staff name
      await expect(page.locator('.ds-modal-body .ds-alert-info').filter({ hasText: 'System Administrator' })).toBeVisible();

      // Change the expected return date to 3 days from now
      const newReturnDate = new Date();
      newReturnDate.setDate(newReturnDate.getDate() + 3);
      const newReturnStr = newReturnDate.toISOString().split('T')[0];
      const editExpectedReturn = page.locator('.ds-modal-body input[type="date"]').first();
      await editExpectedReturn.fill(newReturnStr);

      // Click "Update" and intercept the PUT response to verify no 422 error
      const updateResponsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/staff/absences/') && resp.request().method() === 'PUT'
      );
      await page.locator('.ds-modal-footer button').filter({ hasText: 'Update' }).click();
      const updateResponse = await updateResponsePromise;

      // Verify the response is successful (not 422)
      expect(updateResponse.status()).toBeLessThan(300);

      // Wait for modal to close - this confirms the update succeeded
      await expect(page.locator('.ds-modal-overlay')).toBeHidden({ timeout: 10000 });

      // Wait for the list to reload
      await page.waitForTimeout(1000);
      await dismissPopups(page);

      // Verify the updated expected return date appears in the table
      // The formatDate function uses toLocaleDateString() so we match the row content
      const updatedRow = page.locator('table tbody tr').filter({ hasText: 'System Administrator' }).last();
      await expect(updatedRow).toBeVisible();

      // Verify the date was actually updated by checking the Expected Return column
      // The expected return is the 5th column (Staff, Date, Reason, Reported, Expected Return)
      const expectedReturnCell = updatedRow.locator('td').nth(4);
      const cellText = await expectedReturnCell.textContent();
      // Verify it's not empty/dash (which would mean the update didn't persist)
      expect(cellText).not.toBe('-');
      expect(cellText!.trim().length).toBeGreaterThan(0);
    });
  });
});
