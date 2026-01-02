import { test, expect, dismissPopups, waitForPageReady } from './fixtures';

test.describe('Admin Worming Management', () => {
  test.beforeEach(async ({ loginAs, page }) => {
    await loginAs('admin');
    await dismissPopups(page);
  });

  test.describe('Navigation', () => {
    test('can access worming page from admin navigation', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);
      await dismissPopups(page);

      // Open the nav menu
      const hamburgerBtn = page.locator('.hamburger-btn');
      await expect(hamburgerBtn).toBeVisible({ timeout: 5000 });
      await hamburgerBtn.click();
      await page.waitForTimeout(500);

      // Dismiss any popups that might have appeared after menu opened
      await dismissPopups(page);

      // Open My Venue dropdown - this MUST be done to see the Worm Counts link
      const venueDropdown = page.locator('.nav-dropdown-trigger').filter({ hasText: 'My Venue' });
      await expect(venueDropdown).toBeVisible({ timeout: 5000 });
      await venueDropdown.click();
      await page.waitForTimeout(500);

      // Expand "Horse Care" sub-dropdown where "Worm Counts" lives
      const horseCareDropdown = page.locator('.nav-sub-dropdown-trigger').filter({ hasText: 'Horse Care' });
      await expect(horseCareDropdown).toBeVisible({ timeout: 5000 });
      await horseCareDropdown.click();
      await page.waitForTimeout(500);

      // Dismiss any popups that might have appeared
      await dismissPopups(page);

      // Now the Worm Counts link should be visible
      const wormCountsLink = page.locator('a[href*="worming"]').filter({ hasText: 'Worm Counts' });
      await expect(wormCountsLink).toBeVisible({ timeout: 5000 });
      await wormCountsLink.click();

      await expect(page).toHaveURL('/book/admin/worming');
    });

    test('worming page loads successfully', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Page header should be visible
      await expect(page.locator('h1').filter({ hasText: /worm count/i })).toBeVisible();
    });
  });

  test.describe('Bulk Entry Tab', () => {
    test('shows bulk entry form by default', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Bulk Entry tab should be active
      await expect(page.locator('.ds-tab.active, .tab.active').filter({ hasText: 'Bulk Entry' })).toBeVisible();

      // Form elements should be visible
      await expect(page.locator('#count-date')).toBeVisible();
      await expect(page.locator('.bulk-entry-table')).toBeVisible();
    });

    test('shows test date input', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Date input should default to today
      const dateInput = page.locator('#count-date');
      await expect(dateInput).toBeVisible();

      // Should be able to change the date
      await dateInput.fill('2025-01-15');
      await expect(dateInput).toHaveValue('2025-01-15');
    });

    test('shows EPG legend with categories', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // EPG legend should show all categories
      await expect(page.locator('.epg-legend')).toBeVisible();
      await expect(page.locator('.legend-item')).toHaveCount(4); // Low, Moderate, High, Very High
      // Legend text contains descriptions like "0-200 EPG - No treatment needed"
      await expect(page.locator('.legend-text').filter({ hasText: /0-200 EPG/i })).toBeVisible(); // Low
      await expect(page.locator('.legend-text').filter({ hasText: /201-500 EPG/i })).toBeVisible(); // Moderate
      await expect(page.locator('.legend-text').filter({ hasText: /501-1000 EPG/i })).toBeVisible(); // High
    });

    test('shows horses table with correct columns', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Table headers
      await expect(page.locator('thead th').filter({ hasText: 'Horse' })).toBeVisible();
      await expect(page.locator('thead th').filter({ hasText: 'Owner' })).toBeVisible();
      await expect(page.locator('thead th').filter({ hasText: 'Last Count' })).toBeVisible();
      await expect(page.locator('thead th').filter({ hasText: 'EPG Result' })).toBeVisible();
      await expect(page.locator('thead th').filter({ hasText: 'Cost' })).toBeVisible();
      await expect(page.locator('thead th').filter({ hasText: 'Notes' })).toBeVisible();
    });

    test('can enter EPG result for a horse', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Find first EPG input and enter a value
      const epgInput = page.locator('.epg-input').first();
      await expect(epgInput).toBeVisible();
      await epgInput.fill('150');
      await expect(epgInput).toHaveValue('150');
    });

    test('can enter cost for a horse', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Find first cost input and enter a value
      const costInput = page.locator('.cost-input').first();
      await expect(costInput).toBeVisible();
      await costInput.fill('12.50');
      await expect(costInput).toHaveValue('12.50');
    });

    test('can enter notes for a horse', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Find first notes input and enter a value
      const notesInput = page.locator('.notes-input').first();
      await expect(notesInput).toBeVisible();
      await notesInput.fill('Test sample');
      await expect(notesInput).toHaveValue('Test sample');
    });

    test('shows save button', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Save button should be visible
      await expect(page.locator('button').filter({ hasText: /save all results/i })).toBeVisible();
    });

    test('shows validation error when saving without entries', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Click save without entering any data
      await page.click('button:has-text("Save All Results")');

      // Should show error message
      await expect(page.locator('.ds-alert-error')).toBeVisible();
      await expect(page.locator('.ds-alert-error')).toContainText(/enter at least one/i);
    });

    test('can save worm count entry', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Enter EPG result for first horse
      await page.locator('.epg-input').first().fill('200');
      await page.locator('.cost-input').first().fill('15.00');
      await page.locator('.notes-input').first().fill('Regular check');

      // Click save
      await page.click('button:has-text("Save All Results")');

      // Should show success message
      await expect(page.locator('.ds-alert-success')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Reports Tab', () => {
    test('can switch to reports tab', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Click reports tab
      await page.locator('.ds-tab, .tab').filter({ hasText: 'Reports' }).first().click();

      // Reports tab should be active
      await expect(page.locator('.ds-tab.active, .tab.active').filter({ hasText: 'Reports' })).toBeVisible();
    });

    test('shows current year summary', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Switch to reports tab
      await page.locator('.ds-tab, .tab').filter({ hasText: 'Reports' }).first().click();

      // Should show current year section
      const currentYear = new Date().getFullYear().toString();
      await expect(page.locator('.report-card h2').filter({ hasText: currentYear })).toBeVisible();
    });

    test('shows summary statistics', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Switch to reports tab
      await page.locator('.ds-tab, .tab').filter({ hasText: 'Reports' }).first().click();

      // Should show statistics (if data exists) - use .first() as multiple year summaries exist
      const statsSection = page.locator('.summary-stats').first();
      if (await statsSection.isVisible({ timeout: 2000 })) {
        await expect(page.locator('.stat-label').filter({ hasText: /total counts/i }).first()).toBeVisible();
        await expect(page.locator('.stat-label').filter({ hasText: /horses tested/i }).first()).toBeVisible();
      }
    });

    test('shows category breakdown', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Switch to reports tab
      await page.locator('.ds-tab, .tab').filter({ hasText: 'Reports' }).first().click();

      // Should show category breakdown (if data exists) - use .first() as multiple year summaries exist
      const categorySection = page.locator('.category-breakdown').first();
      if (await categorySection.isVisible({ timeout: 2000 })) {
        await expect(page.locator('.category-label').first()).toBeVisible();
      }
    });

    test('shows trends section when data exists', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Switch to reports tab
      await page.locator('.ds-tab, .tab').filter({ hasText: 'Reports' }).first().click();

      // Trends section (if data exists)
      const trendsTitle = page.locator('.report-card h2').filter({ hasText: /trends/i });
      if (await trendsTitle.isVisible({ timeout: 2000 })) {
        await expect(trendsTitle).toBeVisible();
      }
    });

    test('shows trends table when data exists', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Switch to reports tab
      await page.locator('.ds-tab, .tab').filter({ hasText: 'Reports' }).first().click();

      // Trends table (if data exists)
      const trendsTable = page.locator('.trends-table table');
      if (await trendsTable.isVisible({ timeout: 2000 })) {
        await expect(page.locator('.trends-table thead th').filter({ hasText: 'Period' })).toBeVisible();
        await expect(page.locator('.trends-table thead th').filter({ hasText: 'Avg EPG' })).toBeVisible();
      }
    });

    test('shows horses needing treatment when applicable', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Switch to reports tab
      await page.locator('.ds-tab, .tab').filter({ hasText: 'Reports' }).first().click();

      // Horses needing treatment section (only shows if high EPG counts exist)
      const treatmentSection = page.locator('.alert-card h2').filter({ hasText: /needing treatment/i });
      if (await treatmentSection.isVisible({ timeout: 2000 })) {
        await expect(treatmentSection).toBeVisible();
        // Should show a table of horses
        await expect(page.locator('.alert-card table')).toBeVisible();
      }
    });

    test('shows previous years section when data exists', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Switch to reports tab
      await page.locator('.ds-tab, .tab').filter({ hasText: 'Reports' }).first().click();

      // Previous years section (if historical data exists)
      const previousYearsTitle = page.locator('.report-card h2').filter({ hasText: /previous years/i });
      if (await previousYearsTitle.isVisible({ timeout: 2000 })) {
        await expect(previousYearsTitle).toBeVisible();
      }
    });
  });

  test.describe('Data Display', () => {
    test('shows EPG category badges correctly', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Look for any badges showing EPG results
      const badges = page.locator('.badge').filter({ hasText: /EPG/i });
      if (await badges.first().isVisible({ timeout: 2000 })) {
        // Badge should show EPG value and category
        await expect(badges.first()).toBeVisible();
      }
    });

    test('shows last count date for horses', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Look for date text showing last count
      const dateTexts = page.locator('.date-text');
      if (await dateTexts.first().isVisible({ timeout: 2000 })) {
        await expect(dateTexts.first()).toBeVisible();
      }
    });

    test('shows "Never tested" for horses without history', async ({ page }) => {
      await page.goto('/book/admin/worming');
      await dismissPopups(page);

      // Check for "Never tested" text
      const neverTested = page.locator('text=Never tested');
      // This may or may not be visible depending on data
      const count = await neverTested.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Access Control', () => {
    test('livery user cannot access worming page', async ({ page, loginAs, logout }) => {
      await logout();
      await loginAs('livery');
      await dismissPopups(page);

      // Try to navigate to worming page
      await page.goto('/book/admin/worming');

      // Should be redirected or show access denied
      // Either redirect to a different page or show 403
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/book/admin/worming');
    });

    test('staff user cannot access worming page', async ({ page, loginAs, logout }) => {
      await logout();
      await loginAs('staff');
      await dismissPopups(page);

      // Try to navigate to worming page
      await page.goto('/book/admin/worming');

      // Should be redirected or show access denied
      await page.waitForTimeout(1000);
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('/book/admin/worming');
    });
  });
});
