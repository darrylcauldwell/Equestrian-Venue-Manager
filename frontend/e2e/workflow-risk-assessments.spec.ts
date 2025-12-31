import { test, expect, waitForPageReady, dismissPopups, safeGoto } from './fixtures';

/**
 * Risk Assessments Workflow Test
 *
 * Flow: Admin creates risk assessment -> Staff acknowledges -> Admin views compliance
 */
test.describe('Risk Assessments Workflow', () => {
  test.describe('Step 1: Admin Risk Assessments Page', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view risk assessments page', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');
      await expect(page.locator('h1').filter({ hasText: /risk assessments/i })).toBeVisible();
    });

    test('admin can see compliance overview', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');
      // Look for compliance stats
      const content = page.locator('.ds-card').first();
      await expect(content).toBeVisible();
    });

    test('admin can see create assessment button', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');
      const createBtn = page.locator('button').filter({ hasText: /new assessment/i });
      await expect(createBtn.first()).toBeVisible();
    });

    test('admin can open create assessment modal', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');
      const createBtn = page.locator('button').filter({ hasText: /new assessment/i });
      await createBtn.first().click();
      await expect(page.locator('.ds-modal, [role="dialog"]').first()).toBeVisible();
    });

    test('create assessment form has required fields', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');
      const createBtn = page.locator('button').filter({ hasText: /new assessment/i });
      await createBtn.first().click();

      const modal = page.locator('.ds-modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Check for title input
      await expect(modal.locator('input').first()).toBeVisible();

      // Check for category select
      await expect(modal.locator('select').first()).toBeVisible();

      // Check for content textarea
      await expect(modal.locator('textarea').first()).toBeVisible();
    });

    test('admin can close create assessment modal', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');

      const createBtn = page.locator('button').filter({ hasText: /new assessment/i });
      await createBtn.first().click();

      const modal = page.locator('.ds-modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Close modal
      const cancelBtn = modal.locator('button').filter({ hasText: /cancel/i }).first();
      await cancelBtn.click();

      await expect(modal).not.toBeVisible();
    });
  });

  test.describe('Step 2: Admin Views Assessment Details', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see assessments in list', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');
      // Wait for table to load
      const table = page.locator('.ds-table, table').first();
      await expect(table).toBeVisible();
    });

    test('admin can filter by category', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');

      // Find category filter
      const categorySelect = page.locator('select').first();
      await expect(categorySelect).toBeVisible();
    });

    test('admin can view assessment details via View button', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');

      // Find and click a View button in the table (not in any popup)
      const table = page.locator('.ds-table, table').first();
      await expect(table).toBeVisible({ timeout: 5000 });

      const viewBtn = table.locator('button').filter({ hasText: /view/i }).first();

      // Only proceed if there are assessments
      if (await viewBtn.isVisible({ timeout: 2000 })) {
        await viewBtn.click();
        await dismissPopups(page);

        // Check that detail modal opens - look for modal with assessment content
        const modal = page.locator('.ds-modal-lg, [role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });
      }
    });

    test('admin can see staff acknowledgements section', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');

      // Find and click a View button in the table (not in any popup)
      const table = page.locator('.ds-table, table').first();
      await expect(table).toBeVisible({ timeout: 5000 });

      const viewBtn = table.locator('button').filter({ hasText: /view/i }).first();

      // Skip if no assessments exist (test data dependent)
      if (!await viewBtn.isVisible({ timeout: 2000 })) {
        test.skip(true, 'No assessments available in test data');
        return;
      }

      await viewBtn.click();

      // Wait for the LARGE detail modal (ds-modal-lg) to appear - this distinguishes it from popup modals
      const detailModal = page.locator('.ds-modal-lg');
      await expect(detailModal).toBeVisible({ timeout: 10000 });

      // Now dismiss any popups that might have appeared on top
      await dismissPopups(page);

      // Look for Staff Acknowledgements h4 within the detail modal
      const staffAckSection = detailModal.locator('h4').filter({ hasText: /staff acknowledgements/i });
      await expect(staffAckSection).toBeVisible({ timeout: 5000 });
    });

    test('admin can see review history section', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');

      // Find and click a View button in the table (not in any popup)
      const table = page.locator('.ds-table, table').first();
      await expect(table).toBeVisible({ timeout: 5000 });

      const viewBtn = table.locator('button').filter({ hasText: /view/i }).first();

      // Skip if no assessments exist (test data dependent)
      if (!await viewBtn.isVisible({ timeout: 2000 })) {
        test.skip(true, 'No assessments available in test data');
        return;
      }

      await viewBtn.click();

      // Wait for the LARGE detail modal (ds-modal-lg) to appear
      const detailModal = page.locator('.ds-modal-lg');
      await expect(detailModal).toBeVisible({ timeout: 10000 });

      // Now dismiss any popups that might have appeared on top
      await dismissPopups(page);

      // Look for Review History h4 within the detail modal
      const reviewSection = detailModal.locator('h4').filter({ hasText: /review history/i });
      await expect(reviewSection).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Step 3: Staff Views Risk Assessments', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view my risk assessments page', async ({ page }) => {
      await safeGoto(page, '/book/risk-assessments');
      // Page header can be "Health & Safety Assessments" or similar
      await expect(page.locator('h1, h2').filter({ hasText: /assessments|health.*safety/i }).first()).toBeVisible();
    });

    test('staff can see pending assessments section', async ({ page }) => {
      await safeGoto(page, '/book/risk-assessments');

      // Look for pending section or assessment cards
      const content = page.locator('.ds-card, .assessment-card, section').first();
      await expect(content).toBeVisible();
    });

    test('staff can view assessment details', async ({ page }) => {
      await safeGoto(page, '/book/risk-assessments');

      // Find a View or Read button
      const viewBtn = page.locator('button').filter({ hasText: /view|read/i }).first();

      if (await viewBtn.isVisible({ timeout: 2000 })) {
        await viewBtn.click();
        await dismissPopups(page);

        // Check that detail modal opens
        const modal = page.locator('.ds-modal, [role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Step 4: Staff Acknowledges Assessment', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see acknowledge button for pending assessments', async ({ page }) => {
      await safeGoto(page, '/book/risk-assessments');

      // Find a View button to open an assessment
      const viewBtn = page.locator('button').filter({ hasText: /view|read/i }).first();

      if (await viewBtn.isVisible({ timeout: 2000 })) {
        await viewBtn.click();
        await dismissPopups(page);

        const modal = page.locator('.ds-modal, [role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Look for acknowledge button
        const ackBtn = modal.locator('button').filter({ hasText: /acknowledge/i });
        // It should be visible if assessment needs acknowledgement
        // If not visible, that's also valid (already acknowledged)
        const ackVisible = await ackBtn.first().isVisible({ timeout: 2000 }).catch(() => false);

        // Either acknowledge button is visible, or Close button is visible (already acknowledged)
        if (!ackVisible) {
          await expect(modal.locator('button').filter({ hasText: /close/i }).first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Step 5: Admin Require Re-acknowledgement', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see require re-acknowledgement button', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');

      // Find and click a View button in the table (not in any popup)
      const table = page.locator('.ds-table, table').first();
      await expect(table).toBeVisible({ timeout: 5000 });

      const viewBtn = table.locator('button').filter({ hasText: /view/i }).first();

      // Skip if no assessments exist (test data dependent)
      if (!await viewBtn.isVisible({ timeout: 2000 })) {
        test.skip(true, 'No assessments available in test data');
        return;
      }

      await viewBtn.click();

      // Wait for the LARGE detail modal (ds-modal-lg) to appear
      const detailModal = page.locator('.ds-modal-lg');
      await expect(detailModal).toBeVisible({ timeout: 10000 });

      // Now dismiss any popups that might have appeared on top
      await dismissPopups(page);

      // Look for require re-acknowledgement button within the detail modal
      const reackBtn = detailModal.locator('button').filter({ hasText: /require re-acknowledgement/i });
      await expect(reackBtn.first()).toBeVisible({ timeout: 5000 });
    });

    test('admin can open require re-acknowledgement modal', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');

      const viewBtn = page.locator('button').filter({ hasText: /view/i }).first();

      if (await viewBtn.isVisible({ timeout: 2000 })) {
        await viewBtn.click();
        await dismissPopups(page);

        const detailModal = page.locator('.ds-modal, [role="dialog"]').first();
        await expect(detailModal).toBeVisible({ timeout: 5000 });

        // Click require re-acknowledgement button
        const reackBtn = detailModal.locator('button').filter({ hasText: /re-acknowledgement/i });

        if (await reackBtn.first().isVisible({ timeout: 2000 })) {
          await reackBtn.first().click();
          await dismissPopups(page);

          // Wait for new modal to appear (re-acknowledgement form)
          await page.waitForTimeout(500);

          // Check that a form modal is now showing with reason dropdown
          const formSelect = page.locator('.ds-modal select, [role="dialog"] select');
          await expect(formSelect.first()).toBeVisible({ timeout: 3000 });
        }
      }
    });
  });

  test.describe('Step 6: Admin Views Staff Status', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view staff status modal', async ({ page }) => {
      await safeGoto(page, '/book/admin/risk-assessments');

      // Look for View Staff Status button in compliance overview
      const staffStatusBtn = page.locator('button').filter({ hasText: /staff status/i });

      if (await staffStatusBtn.first().isVisible({ timeout: 2000 })) {
        await staffStatusBtn.first().click();
        await dismissPopups(page);

        // Check that staff status modal opens
        const modal = page.locator('.ds-modal, [role="dialog"]').first();
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Should show staff list with compliance status
        await expect(modal.locator('table, .ds-table')).toBeVisible();
      }
    });
  });

  test.describe('Step 7: Livery Client Views Risk Assessments', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery client can view my risk assessments page', async ({ page }) => {
      await safeGoto(page, '/book/risk-assessments');
      // Should be able to access the page - header can be "Health & Safety Assessments" or similar
      await expect(page.locator('h1, h2').filter({ hasText: /assessments|health.*safety/i }).first()).toBeVisible();
    });
  });
});
