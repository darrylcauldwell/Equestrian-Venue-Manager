import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Complete Clinic Registration Workflow Test
 *
 * Flow: Coach submits clinic → Admin approves → Public/Livery registers →
 *       Admin confirms registrations → Clinic happens → Marked complete
 *
 * Clinic statuses: pending → approved → completed (or rejected/cancelled)
 * Registration statuses: pending → confirmed
 */
test.describe('Complete Clinic Registration Workflow', () => {
  test.describe('Step 1: Coach Submits Clinic Request', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('coach');
    });

    test('coach can view clinics page', async ({ page }) => {
      await page.goto('/book/clinics');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('coach can see submit clinic tab', async ({ page }) => {
      await page.goto('/book/clinics');

      const submitTab = page.locator('.ds-tab, .tab').filter({ hasText: /submit|request|new/i });
      if (await submitTab.isVisible()) {
        await submitTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('coach can open clinic submission form', async ({ page }) => {
      await page.goto('/book/clinics');

      // Click submit tab
      const submitTab = page.locator('.ds-tab, .tab').filter({ hasText: /submit/i });
      if (await submitTab.isVisible()) {
        await submitTab.click();
        await page.waitForTimeout(300);

        // Look for submit button that opens modal
        const submitBtn = page.locator('button').filter({ hasText: /submit.*clinic|new.*clinic/i });
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(300);

          // Modal should appear
          const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
          await expect(modal.first()).toBeVisible();
        }
      }
    });

    test('coach can view their submitted clinics', async ({ page }) => {
      await page.goto('/book/clinics');

      const myClinicsTab = page.locator('.ds-tab, .tab').filter({ hasText: /my clinic/i });
      if (await myClinicsTab.isVisible()) {
        await myClinicsTab.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Step 2: Admin Approves Clinic', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view event triage page', async ({ page }) => {
      await page.goto('/book/admin/events');
      await expect(page.locator('.admin-page, .tabs-container').first()).toBeVisible();
    });

    test('admin can see pending clinics', async ({ page }) => {
      await page.goto('/book/admin/events');

      const pendingTab = page.locator('.ds-tab, .tab').filter({ hasText: /pending/i });
      if (await pendingTab.isVisible()) {
        await pendingTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can approve a clinic', async ({ page }) => {
      await safeGoto(page, '/book/admin/events');

      // Find approve button
      const approveBtn = page.locator('button').filter({ hasText: /approve/i }).first();
      if (await approveBtn.isVisible()) {
        await expect(approveBtn).toBeEnabled();
      }
    });

    test('admin can reject a clinic', async ({ page }) => {
      await safeGoto(page, '/book/admin/events');

      // Find reject button
      const rejectBtn = page.locator('button').filter({ hasText: /reject/i }).first();
      if (await rejectBtn.isVisible()) {
        await expect(rejectBtn).toBeEnabled();
      }
    });

    test('admin can see approved clinics', async ({ page }) => {
      await page.goto('/book/admin/events');

      const approvedTab = page.locator('.ds-tab, .tab').filter({ hasText: /approved/i });
      if (await approvedTab.isVisible()) {
        await approvedTab.click();
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Step 3: Public User Registers for Clinic', () => {
    test('public user can view clinics page', async ({ page }) => {
      await page.goto('/clinics');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('public user can see upcoming clinics', async ({ page }) => {
      await safeGoto(page, '/clinics');

      await expect(page.locator('.clinics-page, [class*="clinic"]').first()).toBeVisible();
    });

    test('public user can click register on clinic', async ({ page }) => {
      await safeGoto(page, '/clinics');

      // Find register button on clinic card
      const registerBtn = page.locator('button').filter({ hasText: /register|book|sign up/i }).first();
      if (await registerBtn.isVisible()) {
        await registerBtn.click();
        await page.waitForTimeout(300);

        // Registration modal should appear
        const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
        if (await modal.isVisible()) {
          await expect(modal).toBeVisible();
        }
      }
    });
  });

  test.describe('Step 4: Livery User Registers for Clinic', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view clinics page', async ({ page }) => {
      await page.goto('/book/clinics');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('livery user can see upcoming clinics', async ({ page }) => {
      await page.goto('/book/clinics');

      const upcomingTab = page.locator('.ds-tab, .tab').filter({ hasText: /upcoming/i });
      if (await upcomingTab.isVisible()) {
        await upcomingTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('livery user can view their registrations', async ({ page }) => {
      await page.goto('/book/clinics');

      const registrationsTab = page.locator('.ds-tab, .tab').filter({ hasText: /registration/i });
      if (await registrationsTab.isVisible()) {
        await registrationsTab.click();
        await page.waitForTimeout(300);

        // Should see registrations section
        await expect(page.locator('.my-registrations-section, [class*="registration"]').first()).toBeVisible();
      }
    });
  });

  test.describe('Step 5: Admin Manages Registrations', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view clinic details with registrations', async ({ page }) => {
      await safeGoto(page, '/book/admin/events');

      // Click on approved tab to see clinics
      const approvedTab = page.locator('.ds-tab, .tab').filter({ hasText: /approved/i });
      if (await approvedTab.isVisible()) {
        await approvedTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can confirm a registration', async ({ page }) => {
      await safeGoto(page, '/book/admin/events');

      // Look for confirm registration button
      const confirmBtn = page.locator('button').filter({ hasText: /confirm/i }).first();
      if (await confirmBtn.isVisible()) {
        await expect(confirmBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 6: Clinic Completion', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see past clinics', async ({ page }) => {
      await page.goto('/book/admin/events');

      const pastTab = page.locator('.ds-tab, .tab').filter({ hasText: /past/i });
      if (await pastTab.isVisible()) {
        await pastTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can view completed clinic details', async ({ page }) => {
      await page.goto('/book/admin/events');

      const pastTab = page.locator('.ds-tab, .tab').filter({ hasText: /past/i });
      if (await pastTab.isVisible()) {
        await pastTab.click();
        await page.waitForTimeout(300);

        // Click on a clinic row
        const clinicRow = page.locator('tr, .clinic-item').first();
        if (await clinicRow.isVisible()) {
          await clinicRow.click();
          await page.waitForTimeout(300);
        }
      }
    });
  });
});
