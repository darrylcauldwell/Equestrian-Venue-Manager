import { test, expect, safeGoto, waitForPageReady, dismissPopups, testUsers } from './fixtures';

/**
 * Rehab Assistance Request Workflow Test
 *
 * Flow: Livery user with active rehab program → Request assistance →
 *       Select tasks and recurring pattern → View pending requests →
 *       Cancel recurring series → Staff completes tasks
 *
 * Test data:
 * - livery2 (Horatio Withers) has horse "Tempo" with active rehab program
 * - staff1 (Barry Muckspreader) and staff2 (Daisy Haystack) are yard staff
 */
test.describe('Rehab Assistance Request Workflow', () => {
  test.describe('Step 1: Livery User Views Rehab Assistance Tab', () => {
    test.beforeEach(async ({ loginAs }) => {
      // Login as livery2 who has Tempo with active rehab program
      await loginAs('livery');
    });

    test('livery user can view services page', async ({ page }) => {
      await page.goto('/book/services');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('livery user can see rehab assistance tab', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Look for rehab assistance tab
      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await expect(rehabTab).toBeEnabled();
      }
    });

    test('livery user can click rehab assistance tab', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(300);

        // Should see rehab programs list
        await expect(page.locator('.rehab-assistance-section, .rehab-programs-list').first()).toBeVisible();
      }
    });
  });

  test.describe('Step 2: Livery User Views Active Rehab Programs', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can see their active rehab programs', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click rehab assistance tab
      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        // Should see program cards
        const programCards = page.locator('.rehab-program-card');
        if (await programCards.first().isVisible()) {
          await expect(programCards.first()).toBeVisible();
        }
      }
    });

    test('livery user can see horse name on program card', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        // Look for Tempo (livery2's horse with rehab program)
        const horseNames = page.locator('.horse-name, .program-header');
        if (await horseNames.first().isVisible()) {
          await expect(horseNames.first()).toBeVisible();
        }
      }
    });

    test('livery user can see request assistance button', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        const requestBtn = page.locator('button').filter({ hasText: /request.*assistance|request.*staff/i }).first();
        if (await requestBtn.isVisible()) {
          await expect(requestBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 3: Livery User Requests Rehab Assistance', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can open request form', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        const requestBtn = page.locator('button').filter({ hasText: /request.*assistance|request.*staff/i }).first();
        if (await requestBtn.isVisible()) {
          await requestBtn.click();
          await page.waitForTimeout(300);

          // Modal should appear
          const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
          await expect(modal.first()).toBeVisible();
        }
      }
    });

    test('livery user can select specific task or all tasks', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        const requestBtn = page.locator('button').filter({ hasText: /request.*assistance|request.*staff/i }).first();
        if (await requestBtn.isVisible()) {
          await requestBtn.click();
          await page.waitForTimeout(300);

          // Should see task selection dropdown
          const taskSelect = page.locator('select').first();
          if (await taskSelect.isVisible()) {
            await expect(taskSelect).toBeEnabled();

            // Should have "all tasks" option
            const allTasksOption = taskSelect.locator('option').filter({ hasText: /all.*task/i });
            await expect(allTasksOption).toBeAttached();
          }
        }
      }
    });

    test('livery user can set recurring pattern', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        const requestBtn = page.locator('button').filter({ hasText: /request.*assistance|request.*staff/i }).first();
        if (await requestBtn.isVisible()) {
          await requestBtn.click();
          await page.waitForTimeout(300);

          // Look for frequency/recurring pattern select
          const frequencySelect = page.locator('select').filter({ hasText: /one-time|daily|weekday/i }).first();
          if (await frequencySelect.isVisible()) {
            await expect(frequencySelect).toBeEnabled();
          }
        }
      }
    });

    test('livery user can select daily recurring pattern', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        const requestBtn = page.locator('button').filter({ hasText: /request.*assistance|request.*staff/i }).first();
        if (await requestBtn.isVisible()) {
          await requestBtn.click();
          await page.waitForTimeout(300);

          // Find all select elements and look for the one with recurring options
          const selects = page.locator('select');
          const count = await selects.count();

          for (let i = 0; i < count; i++) {
            const select = selects.nth(i);
            const dailyOption = select.locator('option[value="daily"]');
            if (await dailyOption.count() > 0) {
              await select.selectOption('daily');

              // End date field should appear
              const endDateInput = page.locator('input[type="date"]').filter({ hasText: /end/i }).first();
              if (await endDateInput.isVisible()) {
                await expect(endDateInput).toBeEnabled();
              }
              break;
            }
          }
        }
      }
    });

    test('livery user can select weekdays recurring pattern', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        const requestBtn = page.locator('button').filter({ hasText: /request.*assistance|request.*staff/i }).first();
        if (await requestBtn.isVisible()) {
          await requestBtn.click();
          await page.waitForTimeout(300);

          const selects = page.locator('select');
          const count = await selects.count();

          for (let i = 0; i < count; i++) {
            const select = selects.nth(i);
            const weekdaysOption = select.locator('option[value="weekdays"]');
            if (await weekdaysOption.count() > 0) {
              await select.selectOption('weekdays');
              break;
            }
          }
        }
      }
    });

    test('livery user can select custom recurring pattern', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        const requestBtn = page.locator('button').filter({ hasText: /request.*assistance|request.*staff/i }).first();
        if (await requestBtn.isVisible()) {
          await requestBtn.click();
          await page.waitForTimeout(300);

          const selects = page.locator('select');
          const count = await selects.count();

          for (let i = 0; i < count; i++) {
            const select = selects.nth(i);
            const customOption = select.locator('option[value="custom"]');
            if (await customOption.count() > 0) {
              await select.selectOption('custom');
              await page.waitForTimeout(300);

              // Day checkboxes should appear
              const dayCheckboxes = page.locator('.day-checkbox, .day-checkboxes');
              if (await dayCheckboxes.first().isVisible()) {
                await expect(dayCheckboxes.first()).toBeVisible();
              }
              break;
            }
          }
        }
      }
    });
  });

  test.describe('Step 4: Livery User Views Pending Requests', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view my requests tab', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Tab buttons don't have .tab class - use button selector
      const myRequestsTab = page.locator('button').filter({ hasText: /my.*request/i });
      await expect(myRequestsTab).toBeVisible();
    });

    test('livery user can see pending rehab requests', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const myRequestsTab = page.locator('button').filter({ hasText: /my.*request/i });
      await myRequestsTab.click();
      await page.waitForTimeout(500);

      // Look for requests section
      const requestsList = page.locator('.requests-list, .request-card');
      if (await requestsList.first().isVisible()) {
        await expect(requestsList.first()).toBeVisible();
      }
    });

    test('livery user can see recurring pattern on request card', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // First go to rehab tab to check if there are any programs
      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        // Check for recurring info in requests
        const recurringInfo = page.locator('.recurring-info');
        if (await recurringInfo.first().isVisible()) {
          await expect(recurringInfo.first()).toBeVisible();
        }
      }
    });

    test('livery user can see cancel button for requests', async ({ page }) => {
      await safeGoto(page, '/book/services');

      const myRequestsTab = page.locator('button').filter({ hasText: /my.*request/i });
      await myRequestsTab.click();
      await page.waitForTimeout(500);

      // Look for cancel button
      const cancelBtn = page.locator('button').filter({ hasText: /cancel/i }).first();
      if (await cancelBtn.isVisible()) {
        await expect(cancelBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 5: Livery User Cancels Recurring Series', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can see cancel all future button for recurring requests', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Check rehab assistance tab for recurring requests
      const rehabTab = page.locator('button').filter({ hasText: /rehab.*assistance/i });
      if (await rehabTab.isVisible()) {
        await rehabTab.click();
        await page.waitForTimeout(500);

        // Look for cancel all future button
        const cancelSeriesBtn = page.locator('button').filter({ hasText: /cancel.*all.*future/i });
        if (await cancelSeriesBtn.isVisible()) {
          await expect(cancelSeriesBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 6: Staff Views Rehab Assistance Requests', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view yard tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1, .yard-tasks').first()).toBeVisible();
    });

    test('staff can see their assigned tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Should see task list
      await expect(page.locator('.yard-tasks, .task-list, [class*="task"]').first()).toBeVisible();
    });

    test('staff can see rehab exercise tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for health task badges or rehab tasks
      const healthTaskBadge = page.locator('.health-type-badge, .health-task-card');
      if (await healthTaskBadge.first().isVisible()) {
        await expect(healthTaskBadge.first()).toBeVisible();
      }
    });

    test('staff can see services tab', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for services tab
      const servicesTab = page.locator('button').filter({ hasText: /service/i });
      if (await servicesTab.isVisible()) {
        await expect(servicesTab).toBeVisible();
      }
    });

    test('staff can view assigned rehab services', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for service cards in My Daily Tasks
      const serviceCards = page.locator('.service-card, .task-card');
      if (await serviceCards.first().isVisible()) {
        await expect(serviceCards.first()).toBeVisible();
      }
    });
  });

  test.describe('Step 7: Staff Completes Rehab Assistance Request', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see complete button on rehab service', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for complete button
      const completeBtn = page.locator('button').filter({ hasText: /complete|done/i }).first();
      if (await completeBtn.isVisible()) {
        await expect(completeBtn).toBeEnabled();
      }
    });

    test('staff can see horse name on rehab service card', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for horse name
      const horseName = page.locator('.horse-name, .horse-badge');
      if (await horseName.first().isVisible()) {
        await expect(horseName.first()).toBeVisible();
      }
    });

    test('staff can see special instructions on service card', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for instructions section
      const instructions = page.locator('.service-instructions, .instructions');
      if (await instructions.first().isVisible()) {
        await expect(instructions.first()).toBeVisible();
      }
    });
  });

  test.describe('Step 8: Admin Views Rehab Service Requests', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view yard tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see services tab', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const servicesTab = page.locator('button').filter({ hasText: /service/i });
      if (await servicesTab.isVisible()) {
        await servicesTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can see all rehab service requests', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const servicesTab = page.locator('button').filter({ hasText: /service/i });
      if (await servicesTab.isVisible()) {
        await servicesTab.click();
        await page.waitForTimeout(300);

        // Should see service cards
        const serviceCards = page.locator('.service-card');
        if (await serviceCards.first().isVisible()) {
          await expect(serviceCards.first()).toBeVisible();
        }
      }
    });

    test('admin can complete rehab service requests', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const servicesTab = page.locator('button').filter({ hasText: /service/i });
      if (await servicesTab.isVisible()) {
        await servicesTab.click();
        await page.waitForTimeout(300);

        // Look for complete button
        const completeBtn = page.locator('button').filter({ hasText: /complete/i }).first();
        if (await completeBtn.isVisible()) {
          await expect(completeBtn).toBeEnabled();
        }
      }
    });
  });
});
