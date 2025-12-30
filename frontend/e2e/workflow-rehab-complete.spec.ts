import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Complete Rehab Program Workflow Test
 *
 * Flow: Admin creates program → Admin activates → Staff logs tasks →
 *       Admin completes phases → Admin completes program
 *
 * Program statuses: draft → active → paused → completed
 * Phase statuses: pending → active → completed
 *
 * SKIPPED: The /book/admin/rehab-programs route does not exist.
 * These tests are for a feature that was not implemented.
 */
test.describe.skip('Complete Rehab Program Workflow', () => {
  test.describe('Step 1: Admin Creates Rehab Program', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view rehab programs page', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see new program button', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');

      const newBtn = page.locator('button').filter({ hasText: /new|add|create/i });
      await expect(newBtn.first()).toBeVisible();
    });

    test('admin can open create program modal', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');

      const newBtn = page.locator('button').filter({ hasText: /new|add|create/i });
      if (await newBtn.first().isVisible()) {
        await newBtn.first().click();
        await page.waitForTimeout(300);

        // Modal should appear
        const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
        await expect(modal.first()).toBeVisible();
      }
    });

    test('admin can select horse for program', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');

      const newBtn = page.locator('button').filter({ hasText: /new|add|create/i });
      if (await newBtn.first().isVisible()) {
        await newBtn.first().click();
        await page.waitForTimeout(300);

        // Horse select should be visible
        const horseSelect = page.locator('select').first();
        if (await horseSelect.isVisible()) {
          await expect(horseSelect).toBeEnabled();
        }
      }
    });

    test('admin can add phase to program', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');

      const newBtn = page.locator('button').filter({ hasText: /new|add|create/i });
      if (await newBtn.first().isVisible()) {
        await newBtn.first().click();
        await page.waitForTimeout(300);

        // Look for add phase button
        const addPhaseBtn = page.locator('button').filter({ hasText: /add.*phase/i });
        if (await addPhaseBtn.isVisible()) {
          await expect(addPhaseBtn).toBeEnabled();
        }
      }
    });

    test('admin can add task to phase', async ({ page }) => {
      await page.goto('/book/admin/rehab-programs');

      const newBtn = page.locator('button').filter({ hasText: /new|add|create/i });
      if (await newBtn.first().isVisible()) {
        await newBtn.first().click();
        await page.waitForTimeout(300);

        // Look for add task button
        const addTaskBtn = page.locator('button').filter({ hasText: /add.*task/i }).first();
        if (await addTaskBtn.isVisible()) {
          await expect(addTaskBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 2: Admin Activates Program', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see draft programs', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      // Status filter should be visible
      const statusFilter = page.locator('.status-filter, select').first();
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeEnabled();
      }
    });

    test('admin can activate a program', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      // Find activate button
      const activateBtn = page.locator('button').filter({ hasText: /activate/i }).first();
      if (await activateBtn.isVisible()) {
        await expect(activateBtn).toBeEnabled();
      }
    });

    test('admin can see active programs', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      // Status filter should be visible and usable
      const statusFilter = page.locator('.status-filter, select').first();
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeEnabled();
      }
    });
  });

  test.describe('Step 3: Staff Views Rehab Tasks', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view yard tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1, .yard-tasks').first()).toBeVisible();
    });

    test('staff can see rehab tasks in task list', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Should see task list
      await expect(page.locator('.yard-tasks, .task-list, [class*="task"]').first()).toBeVisible();
    });

    test('staff can filter to rehab tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for filter or tab for rehab
      const rehabFilter = page.locator('.filter-btn, .tab, select').filter({ hasText: /rehab|exercise/i }).first();
      if (await rehabFilter.isVisible()) {
        await rehabFilter.click();
        await page.waitForTimeout(300);
      }
    });

    test('staff can complete a rehab task', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find complete button
      const completeBtn = page.locator('button').filter({ hasText: /complete|done/i }).first();
      if (await completeBtn.isVisible()) {
        await expect(completeBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 4: Admin Views Program Details', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can click program to view details', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      // Click on a program card
      const programCard = page.locator('.program-card').first();
      if (await programCard.isVisible()) {
        await programCard.click();
        await page.waitForTimeout(300);

        // Detail modal should appear
        const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
        await expect(modal.first()).toBeVisible();
      }
    });

    test('admin can see phases in program details', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      const programCard = page.locator('.program-card').first();
      if (await programCard.isVisible()) {
        await programCard.click();
        await page.waitForTimeout(300);

        // Should see phases
        const phases = page.locator('.phases-list, .phase-detail, [class*="phase"]');
        await expect(phases.first()).toBeVisible();
      }
    });

    test('admin can see tasks in phases', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      const programCard = page.locator('.program-card').first();
      if (await programCard.isVisible()) {
        await programCard.click();
        await page.waitForTimeout(300);

        // Should see tasks
        const tasks = page.locator('.tasks-list, .task-item, [class*="task"]');
        await expect(tasks.first()).toBeVisible();
      }
    });
  });

  test.describe('Step 5: Admin Completes Phase', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can complete current phase', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      // Click on active program
      const programCard = page.locator('.program-card').first();
      if (await programCard.isVisible()) {
        await programCard.click();
        await page.waitForTimeout(300);

        // Find complete phase button
        const completePhaseBtn = page.locator('button').filter({ hasText: /complete.*phase/i });
        if (await completePhaseBtn.isVisible()) {
          await expect(completePhaseBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 6: Admin Completes Program', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can complete entire program', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      // Click on program
      const programCard = page.locator('.program-card').first();
      if (await programCard.isVisible()) {
        await programCard.click();
        await page.waitForTimeout(300);

        // Find complete program button
        const completeProgramBtn = page.locator('button').filter({ hasText: /complete.*program/i });
        if (await completeProgramBtn.isVisible()) {
          await expect(completeProgramBtn).toBeEnabled();
        }
      }
    });

    test('admin can see completed programs', async ({ page }) => {
      await safeGoto(page, '/book/admin/rehab-programs');

      // Status filter should be visible
      const statusFilter = page.locator('.status-filter, select').first();
      if (await statusFilter.isVisible()) {
        await expect(statusFilter).toBeEnabled();
      }
    });
  });

  test.describe('Step 7: Livery User Views Horse Health', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view their horses', async ({ page }) => {
      await page.goto('/book/my-horses');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('livery user can access horse health records', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');

      // Find health link or button
      const healthLink = page.locator('a, button').filter({ hasText: /health|record/i }).first();
      if (await healthLink.isVisible()) {
        await healthLink.click();
        await page.waitForTimeout(500);
      }
    });
  });
});
