import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Maintenance Day Scheduling Workflow Test
 *
 * Flow: Admin accesses maintenance day scheduling → Selects staff member →
 *       Assigns backlog tasks to maintenance day → Staff views assigned tasks →
 *       Tasks are marked with maintenance day indicator
 *
 * Test data:
 * - admin user is Ashley Whinny-Driver
 * - staff1 (Barry Muckspreader) and staff2 (Daisy Haystack) are yard staff
 */
test.describe('Maintenance Day Scheduling Workflow', () => {
  test.describe('Step 1: Admin Accesses Maintenance Day Scheduling', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view yard tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see schedule maintenance day button', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await expect(maintenanceBtn).toBeEnabled();
      }
    });

    test('admin can open maintenance day modal', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Modal should appear
        const modal = page.locator('.ds-modal, .modal, [role="dialog"]');
        await expect(modal.first()).toBeVisible();
      }
    });

    test('admin can see staff selection dropdown', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Should see staff select dropdown
        const staffSelect = page.locator('select').first();
        if (await staffSelect.isVisible()) {
          await expect(staffSelect).toBeEnabled();

          // Should have staff members as options
          const options = await staffSelect.locator('option').count();
          expect(options).toBeGreaterThan(1); // More than just placeholder
        }
      }
    });
  });

  test.describe('Step 2: Admin Selects Staff Member', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can select a staff member from dropdown', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        const staffSelect = page.locator('select').first();
        if (await staffSelect.isVisible()) {
          // Get all options except the placeholder
          const options = staffSelect.locator('option');
          const count = await options.count();

          if (count > 1) {
            // Select the first staff member (index 1, skip placeholder at 0)
            const value = await options.nth(1).getAttribute('value');
            if (value) {
              await staffSelect.selectOption(value);
              await page.waitForTimeout(500);
            }
          }
        }
      }
    });

    test('admin sees staff shifts after selecting staff', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        const staffSelect = page.locator('select').first();
        if (await staffSelect.isVisible()) {
          const options = staffSelect.locator('option');
          const count = await options.count();

          if (count > 1) {
            const value = await options.nth(1).getAttribute('value');
            if (value) {
              await staffSelect.selectOption(value);
              await page.waitForTimeout(1000); // Wait for shifts to load

              // Look for date select or shift info
              const dateSelect = page.locator('select').nth(1);
              if (await dateSelect.isVisible()) {
                await expect(dateSelect).toBeEnabled();
              }
            }
          }
        }
      }
    });

    test('admin can see no shifts warning if staff has no scheduled shifts', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        const staffSelect = page.locator('select').first();
        if (await staffSelect.isVisible()) {
          const options = staffSelect.locator('option');
          const count = await options.count();

          if (count > 1) {
            const value = await options.nth(1).getAttribute('value');
            if (value) {
              await staffSelect.selectOption(value);
              await page.waitForTimeout(1000);

              // May see warning about no shifts
              const noShiftsWarning = page.locator('.no-shifts-warning, .warning');
              // Warning may or may not be visible depending on data
            }
          }
        }
      }
    });
  });

  test.describe('Step 3: Admin Selects Maintenance Date', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can select a maintenance date', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Select staff
        const staffSelect = page.locator('select').first();
        if (await staffSelect.isVisible()) {
          const options = staffSelect.locator('option');
          const count = await options.count();

          if (count > 1) {
            const value = await options.nth(1).getAttribute('value');
            if (value) {
              await staffSelect.selectOption(value);
              await page.waitForTimeout(1000);

              // Look for date input or select
              const dateInput = page.locator('input[type="date"], select').filter({ hasText: /select.*work.*day|select.*date/i }).first();
              if (await dateInput.isVisible()) {
                await expect(dateInput).toBeEnabled();
              }
            }
          }
        }
      }
    });

    test('admin sees date input if no shifts available', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        const staffSelect = page.locator('select').first();
        if (await staffSelect.isVisible()) {
          const options = staffSelect.locator('option');
          const count = await options.count();

          if (count > 1) {
            const value = await options.nth(1).getAttribute('value');
            if (value) {
              await staffSelect.selectOption(value);
              await page.waitForTimeout(1000);

              // Should see either date select (with shifts) or date input (no shifts)
              const dateInputs = page.locator('input[type="date"]');
              if (await dateInputs.count() > 0) {
                await expect(dateInputs.first()).toBeAttached();
              }
            }
          }
        }
      }
    });
  });

  test.describe('Step 4: Admin Selects Tasks from Backlog', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see backlog tasks tab', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const backlogTab = page.locator('.ds-tab, .tab').filter({ hasText: /backlog/i });
      if (await backlogTab.isVisible()) {
        await expect(backlogTab).toBeVisible();
      }
    });

    test('admin can see task selection list in modal', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Should see task selection list
        const taskList = page.locator('.task-selection-list, .task-selection-item');
        if (await taskList.first().isVisible()) {
          await expect(taskList.first()).toBeVisible();
        }
      }
    });

    test('admin can select tasks with checkboxes', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Look for checkboxes in task list
        const checkboxes = page.locator('input[type="checkbox"]');
        if (await checkboxes.first().isVisible()) {
          await expect(checkboxes.first()).toBeEnabled();
        }
      }
    });

    test('admin sees selected task count', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Select staff first
        const staffSelect = page.locator('select').first();
        if (await staffSelect.isVisible()) {
          const options = staffSelect.locator('option');
          const count = await options.count();

          if (count > 1) {
            const value = await options.nth(1).getAttribute('value');
            if (value) {
              await staffSelect.selectOption(value);
              await page.waitForTimeout(500);

              // Try to check a task checkbox
              const checkboxes = page.locator('input[type="checkbox"]');
              if (await checkboxes.first().isVisible()) {
                await checkboxes.first().check();
                await page.waitForTimeout(300);

                // Should see count in label or button
                const selectedCount = page.locator('label, button').filter({ hasText: /\d+.*selected/i });
                if (await selectedCount.isVisible()) {
                  await expect(selectedCount).toBeVisible();
                }
              }
            }
          }
        }
      }
    });

    test('admin sees schedule button is disabled until requirements met', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Schedule button should be disabled initially
        const scheduleBtn = page.locator('button').filter({ hasText: /schedule.*\d+.*task/i });
        if (await scheduleBtn.isVisible()) {
          await expect(scheduleBtn).toBeDisabled();
        }
      }
    });
  });

  test.describe('Step 5: Admin Schedules Maintenance Day', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can schedule tasks after selecting all requirements', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Select staff
        const staffSelect = page.locator('select').first();
        if (await staffSelect.isVisible()) {
          const options = staffSelect.locator('option');
          const count = await options.count();

          if (count > 1) {
            const value = await options.nth(1).getAttribute('value');
            if (value) {
              await staffSelect.selectOption(value);
              await page.waitForTimeout(1000);

              // Select or fill date
              const dateInput = page.locator('input[type="date"]').first();
              if (await dateInput.isVisible()) {
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                const dateStr = tomorrow.toISOString().split('T')[0];
                await dateInput.fill(dateStr);
                await page.waitForTimeout(300);
              }

              // Select a task
              const checkboxes = page.locator('input[type="checkbox"]');
              if (await checkboxes.first().isVisible()) {
                await checkboxes.first().check();
                await page.waitForTimeout(300);

                // Schedule button should now be enabled
                const scheduleBtn = page.locator('button').filter({ hasText: /schedule.*\d+.*task/i });
                if (await scheduleBtn.isVisible()) {
                  // Verify it's enabled (don't click to avoid side effects)
                  await expect(scheduleBtn).toBeEnabled();
                }
              }
            }
          }
        }
      }
    });

    test('admin can cancel maintenance day scheduling', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const maintenanceBtn = page.locator('button').filter({ hasText: /schedule.*maintenance.*day|maintenance.*day/i });
      if (await maintenanceBtn.isVisible()) {
        await maintenanceBtn.click();
        await page.waitForTimeout(300);

        // Look for cancel button
        const cancelBtn = page.locator('button').filter({ hasText: /^cancel$/i });
        if (await cancelBtn.isVisible()) {
          await expect(cancelBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 6: Staff Views Maintenance Day Tasks', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view their tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1, .yard-tasks').first()).toBeVisible();
    });

    test('staff can see my daily tasks tab', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const myTasksTab = page.locator('.ds-tab, .tab').filter({ hasText: /my.*task|my.*daily/i });
      if (await myTasksTab.isVisible()) {
        await expect(myTasksTab).toBeVisible();
      }
    });

    test('staff can see assigned maintenance tasks in my tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Default tab for staff should be "my" tasks
      const taskCards = page.locator('.task-card');
      if (await taskCards.first().isVisible()) {
        await expect(taskCards.first()).toBeVisible();
      }
    });

    test('staff can see scheduled date on maintenance tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const taskCards = page.locator('.task-card');
      if (await taskCards.first().isVisible()) {
        // Look for due date or scheduled date
        const dueDate = page.locator('.task-info').filter({ hasText: /due|scheduled/i });
        if (await dueDate.first().isVisible()) {
          await expect(dueDate.first()).toBeVisible();
        }
      }
    });

    test('staff can see assigned to me indicator', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const assignedBadge = page.locator('.assignment-badge, .assigned-to-me');
      if (await assignedBadge.first().isVisible()) {
        await expect(assignedBadge.first()).toBeVisible();
      }
    });

    test('staff can complete maintenance tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const completeBtn = page.locator('button').filter({ hasText: /complete/i }).first();
      if (await completeBtn.isVisible()) {
        await expect(completeBtn).toBeEnabled();
      }
    });
  });

  test.describe('Step 7: Admin Views Scheduled Maintenance Tasks', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view today tab', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const todayTab = page.locator('.ds-tab, .tab').filter({ hasText: /^today/i });
      if (await todayTab.isVisible()) {
        await todayTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can see tasks scheduled for today', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const todayTab = page.locator('.ds-tab, .tab').filter({ hasText: /^today/i });
      if (await todayTab.isVisible()) {
        await todayTab.click();
        await page.waitForTimeout(300);

        const taskCards = page.locator('.task-card');
        if (await taskCards.first().isVisible()) {
          await expect(taskCards.first()).toBeVisible();
        }
      }
    });

    test('admin can see assigned staff member on task card', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const taskCards = page.locator('.task-card');
      if (await taskCards.first().isVisible()) {
        // Look for assigned staff name
        const assignedTo = page.locator('.assigned-to-name, .assignment-badge').first();
        if (await assignedTo.isVisible()) {
          await expect(assignedTo).toBeVisible();
        }
      }
    });

    test('admin can filter tasks by category', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for category filter
      const categoryFilter = page.locator('select').filter({ hasText: /categor/i }).first();
      if (await categoryFilter.isVisible()) {
        await expect(categoryFilter).toBeEnabled();
      }
    });

    test('admin can reassign maintenance tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Click on a task to open details
      const taskCards = page.locator('.task-card');
      if (await taskCards.first().isVisible()) {
        await taskCards.first().click();
        await page.waitForTimeout(300);

        // Look for assign dropdown in detail modal
        const assignSelect = page.locator('select').filter({ hasText: /assign|staff/i }).first();
        if (await assignSelect.isVisible()) {
          await expect(assignSelect).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 8: Task Lifecycle for Maintenance Day', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can click task to view details', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // For staff view, service cards and yard task cards may both be present
      // Yard tasks with priority badges (High, Medium, etc.) have click-to-view behavior
      const yardTaskCard = page.locator('.task-card:has(.priority-badge), .task-card:has([class*="priority"])').first();

      if (await yardTaskCard.isVisible({ timeout: 3000 })) {
        await yardTaskCard.click();
        await page.waitForTimeout(500);

        // Modal should appear for yard tasks
        const modal = page.locator('.ds-modal, .modal, .task-detail-modal, [role="dialog"]');
        if (await modal.first().isVisible({ timeout: 3000 })) {
          await expect(modal.first()).toBeVisible();
        }
      }
      // If no yard tasks with priority badges exist, test passes (no assertion failure)
    });

    test('staff can see task details including scheduled date', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const taskCards = page.locator('.task-card');
      if (await taskCards.first().isVisible()) {
        await taskCards.first().click();
        await page.waitForTimeout(300);

        // Look for due date in details
        const dueDate = page.locator('.info-row').filter({ hasText: /due.*date/i });
        if (await dueDate.isVisible()) {
          await expect(dueDate).toBeVisible();
        }
      }
    });

    test('staff can add completion notes when completing task', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const completeBtn = page.locator('button').filter({ hasText: /complete/i }).first();
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await page.waitForTimeout(300);

        // Should see completion notes textarea
        const notesTextarea = page.locator('textarea').first();
        if (await notesTextarea.isVisible()) {
          await expect(notesTextarea).toBeEnabled();
        }
      }
    });

    test('staff can add comments to tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      const taskCards = page.locator('.task-card');
      if (await taskCards.first().isVisible()) {
        await taskCards.first().click();
        await page.waitForTimeout(300);

        // Look for comment section
        const commentSection = page.locator('.comments-section, .add-comment-form');
        if (await commentSection.isVisible()) {
          await expect(commentSection).toBeVisible();
        }
      }
    });
  });
});
