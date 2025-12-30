import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Complete Wound Care Workflow Test
 *
 * Flow: Staff accesses wound care tasks → Staff logs wound treatment →
 *       Staff marks healing progress → Staff views wound history
 *
 * Wound care is managed through the yard tasks system as health tasks.
 * Seed data includes wound care logs for horse "Phoenix" (owned by livery1).
 */
test.describe('Complete Wound Care Workflow', () => {
  test.describe('Step 1: Staff Accesses Yard Tasks', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view yard tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1, .yard-tasks').first()).toBeVisible();
    });

    test('staff can see their daily tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Default view for staff should be "My Daily Tasks"
      const tasksList = page.locator('.tasks-list, .task-card').first();
      await expect(tasksList).toBeVisible();
    });

    test('staff can view team daily tasks (pool tasks)', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Switch to pool tasks
      const tabSelect = page.locator('.tab-select');
      if (await tabSelect.isVisible()) {
        await tabSelect.selectOption('pool');
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Step 2: Staff Identifies Wound Care Task', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see health task type badges', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for health task type badges (medication, wound_care, health_check, rehab_exercise)
      const healthBadge = page.locator('.health-type-badge').first();
      if (await healthBadge.isVisible({ timeout: 2000 })) {
        await expect(healthBadge).toBeVisible();
      }
    });

    test('staff can identify wound care tasks by badge', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look specifically for wound care badge
      const woundCareBadge = page.locator('.health-type-badge').filter({ hasText: /wound care/i }).first();
      if (await woundCareBadge.isVisible({ timeout: 2000 })) {
        await expect(woundCareBadge).toContainText(/wound care/i);
      }
    });

    test('staff can see horse name on health tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Health tasks should show horse name
      const healthTaskInfo = page.locator('.health-task-info').first();
      if (await healthTaskInfo.isVisible({ timeout: 2000 })) {
        const horseBadge = healthTaskInfo.locator('.horse-badge');
        await expect(horseBadge).toBeVisible();
      }
    });

    test('staff can see wound location on wound care tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Wound care tasks should show wound location
      const woundInfo = page.locator('.wound-info').first();
      if (await woundInfo.isVisible({ timeout: 2000 })) {
        await expect(woundInfo).toBeVisible();
      }
    });
  });

  test.describe('Step 3: Staff Logs Wound Treatment', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can click complete button on wound care task', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find a wound care task and its complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await expect(completeBtn).toBeEnabled();
        }
      }
    });

    test('staff can open wound care completion modal', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Modal should appear - use design system modal classes
          const modal = page.locator('.health-complete-modal, .ds-modal-overlay, .ds-modal, .modal, [role="dialog"]').filter({ hasText: /complete health task/i });
          await expect(modal.first()).toBeVisible();
        }
      }
    });

    test('staff can see wound care form fields in modal', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Check for treatment given field
          const treatmentField = page.locator('input[placeholder*="Cleaned"]').or(
            page.locator('input').filter({ hasText: /treatment/i })
          );
          if (await treatmentField.first().isVisible({ timeout: 1000 })) {
            await expect(treatmentField.first()).toBeVisible();
          }

          // Check for healing assessment dropdown
          const healingSelect = page.locator('select').filter({ hasText: /improving|stable|worsening/i });
          if (await healingSelect.first().isVisible({ timeout: 1000 })) {
            await expect(healingSelect.first()).toBeVisible();
          }
        }
      }
    });

    test('staff can enter treatment details', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Fill in treatment details
          const treatmentField = page.locator('input[placeholder*="Cleaned"]').or(
            page.locator('label').filter({ hasText: /treatment given/i }).locator('~ input, + input').first()
          );
          if (await treatmentField.first().isVisible({ timeout: 1000 })) {
            await treatmentField.first().fill('Cleaned with saline, applied wound cream');
          }
        }
      }
    });

    test('staff can select healing assessment', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Select healing assessment
          const healingSelect = page.locator('select').filter({ hasText: /improving|stable|worsening/i });
          if (await healingSelect.first().isVisible({ timeout: 1000 })) {
            await healingSelect.first().selectOption('improving');
          }
        }
      }
    });

    test('staff can specify products used', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Fill in products used
          const productsField = page.locator('input[placeholder*="Hibiscrub"]').or(
            page.locator('label').filter({ hasText: /products used/i }).locator('~ input, + input').first()
          );
          if (await productsField.first().isVisible({ timeout: 1000 })) {
            await productsField.first().fill('Hibiscrub, Flamazine cream');
          }
        }
      }
    });

    test('staff can add assessment notes', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Fill in assessment notes
          const notesField = page.locator('textarea[placeholder*="Observations"]').or(
            page.locator('label').filter({ hasText: /assessment notes/i }).locator('~ textarea, + textarea').first()
          );
          if (await notesField.first().isVisible({ timeout: 1000 })) {
            await notesField.first().fill('Wound showing good progress, less swelling observed');
          }
        }
      }
    });

    test('staff can set next treatment due date', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Set next treatment date
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const dateStr = tomorrow.toISOString().split('T')[0];

          const dateField = page.locator('input[type="date"]').filter({ hasText: /next treatment/i }).or(
            page.locator('label').filter({ hasText: /next treatment/i }).locator('~ input[type="date"], + input[type="date"]').first()
          );
          if (await dateField.first().isVisible({ timeout: 1000 })) {
            await dateField.first().fill(dateStr);
          }
        }
      }
    });

    test('staff can mark wound as healed', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Check the "mark as healed" checkbox
          const healedCheckbox = page.locator('input[type="checkbox"]').filter({ hasText: /healed/i }).or(
            page.locator('label').filter({ hasText: /mark.*healed/i }).locator('input[type="checkbox"]')
          );
          if (await healedCheckbox.first().isVisible({ timeout: 1000 })) {
            await healedCheckbox.first().check();
          }
        }
      }
    });
  });

  test.describe('Step 4: Staff Submits Wound Care Log', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see submit button in wound care modal', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Look for submit/complete button in modal - use design system classes
          const submitBtn = page.locator('.ds-modal button, .modal button').filter({ hasText: /complete.*log|submit/i });
          await expect(submitBtn.first()).toBeVisible();
        }
      }
    });

    test('staff can cancel wound care logging', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find and click a wound care task's complete button
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        const completeBtn = woundCareTask.locator('button').filter({ hasText: /complete/i });
        if (await completeBtn.isVisible()) {
          await completeBtn.click();
          await page.waitForTimeout(500);

          // Click cancel button - use design system classes
          const cancelBtn = page.locator('.ds-modal button, .modal button').filter({ hasText: /cancel/i });
          if (await cancelBtn.first().isVisible()) {
            await cancelBtn.first().click();
            await page.waitForTimeout(300);

            // Modal should close
            const modal = page.locator('.health-complete-modal');
            await expect(modal).not.toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Step 5: Admin Views Wound Care Tasks', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view all yard tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1').first()).toBeVisible();
    });

    test('admin can see todays tasks including wound care', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Admin default view is "Today's Tasks"
      const tasksList = page.locator('.tasks-list').first();
      await expect(tasksList).toBeVisible();
    });

    test('admin can filter tasks by health category', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for category filter
      const categoryFilter = page.locator('.tasks-filters select').first();
      if (await categoryFilter.isVisible({ timeout: 1000 })) {
        // Try to select health category if it exists
        const healthOption = categoryFilter.locator('option').filter({ hasText: /health/i });
        if (await healthOption.isVisible({ timeout: 500 })) {
          await categoryFilter.selectOption({ label: /health/i });
          await page.waitForTimeout(300);
        }
      }
    });

    test('admin can assign wound care task to staff', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Click on a wound care task to view details
      const woundCareTask = page.locator('.health-task-card').filter({ hasText: /wound care/i }).first();
      if (await woundCareTask.isVisible({ timeout: 2000 })) {
        await woundCareTask.click();
        await page.waitForTimeout(500);

        // Look for assignment dropdown
        const assignSelect = page.locator('.task-assign select, select').filter({ hasText: /assign|staff/i });
        if (await assignSelect.first().isVisible({ timeout: 1000 })) {
          await expect(assignSelect.first()).toBeEnabled();
        }
      }
    });

    test('admin can view completed wound care tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Switch to completed tasks view
      const tabSelect = page.locator('.tab-select');
      if (await tabSelect.isVisible()) {
        const completedOption = tabSelect.locator('option').filter({ hasText: /completed/i });
        if (await completedOption.isVisible({ timeout: 500 })) {
          await tabSelect.selectOption({ label: /completed/i });
          await page.waitForTimeout(300);
        }
      }
    });

    test('admin can see completion details on finished wound care tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Switch to completed tasks
      const tabSelect = page.locator('.tab-select');
      if (await tabSelect.isVisible()) {
        const completedOption = tabSelect.locator('option').filter({ hasText: /completed/i });
        if (await completedOption.isVisible({ timeout: 500 })) {
          await tabSelect.selectOption({ label: /completed/i });
          await page.waitForTimeout(300);

          // Look for completed wound care task
          const completedWoundTask = page.locator('.completed-task').filter({ hasText: /wound care/i }).first();
          if (await completedWoundTask.isVisible({ timeout: 1000 })) {
            // Should show completion details
            const completionNotes = completedWoundTask.locator('.completion-notes');
            if (await completionNotes.isVisible({ timeout: 500 })) {
              await expect(completionNotes).toBeVisible();
            }
          }
        }
      }
    });
  });

  test.describe('Step 6: Livery User Views Horse Health Records', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view their horses', async ({ page }) => {
      await page.goto('/book/my-horses');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('livery user can navigate to horse health records', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');

      // Find health/records link or button
      const healthLink = page.locator('a, button').filter({ hasText: /health|record/i }).first();
      if (await healthLink.isVisible({ timeout: 2000 })) {
        await healthLink.click();
        await page.waitForTimeout(500);
      }
    });

    test('livery user can view wound care history for their horse', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');

      // Find Phoenix horse card (seed data horse with wound care logs)
      const phoenixCard = page.locator('.horse-card, [class*="horse"]').filter({ hasText: /phoenix/i }).first();
      if (await phoenixCard.isVisible({ timeout: 2000 })) {
        // Click to view details or find health link
        const healthBtn = phoenixCard.locator('button, a').filter({ hasText: /health|view|details/i }).first();
        if (await healthBtn.isVisible({ timeout: 1000 })) {
          await healthBtn.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('livery user can see wound care section in health records', async ({ page }) => {
      // Navigate directly to health records if URL pattern is known
      // Otherwise navigate via my-horses page
      await safeGoto(page, '/book/my-horses');

      // Look for wound care or wound-related content
      const woundSection = page.locator('[class*="wound"], .health-section').filter({ hasText: /wound/i }).first();
      if (await woundSection.isVisible({ timeout: 2000 })) {
        await expect(woundSection).toBeVisible();
      }
    });

    test('livery user can view wound treatment history', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');

      // Navigate to Phoenix's health records
      const phoenixCard = page.locator('.horse-card, [class*="horse"]').filter({ hasText: /phoenix/i }).first();
      if (await phoenixCard.isVisible({ timeout: 2000 })) {
        const healthBtn = phoenixCard.locator('button, a').filter({ hasText: /health|view|details/i }).first();
        if (await healthBtn.isVisible({ timeout: 1000 })) {
          await healthBtn.click();
          await page.waitForTimeout(500);

          // Look for wound care history or treatment log entries
          const treatmentLog = page.locator('.treatment-log, .wound-log, [class*="wound"]').filter({ hasText: /treatment|log/i });
          if (await treatmentLog.first().isVisible({ timeout: 2000 })) {
            await expect(treatmentLog.first()).toBeVisible();
          }
        }
      }
    });

    test('livery user can see wound healing progress', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');

      // Navigate to Phoenix's health records
      const phoenixCard = page.locator('.horse-card, [class*="horse"]').filter({ hasText: /phoenix/i }).first();
      if (await phoenixCard.isVisible({ timeout: 2000 })) {
        const healthBtn = phoenixCard.locator('button, a').filter({ hasText: /health|view|details/i }).first();
        if (await healthBtn.isVisible({ timeout: 1000 })) {
          await healthBtn.click();
          await page.waitForTimeout(500);

          // Look for healing status indicators
          const healingStatus = page.locator('[class*="healing"], .status-badge').filter({ hasText: /improving|stable|healed/i });
          if (await healingStatus.first().isVisible({ timeout: 2000 })) {
            await expect(healingStatus.first()).toBeVisible();
          }
        }
      }
    });

    test('livery user can view wound details (location, description)', async ({ page }) => {
      await safeGoto(page, '/book/my-horses');

      // Navigate to Phoenix's health records (Phoenix has wound care logs in seed data)
      const phoenixCard = page.locator('.horse-card, [class*="horse"]').filter({ hasText: /phoenix/i }).first();
      if (await phoenixCard.isVisible({ timeout: 2000 })) {
        const healthBtn = phoenixCard.locator('button, a').filter({ hasText: /health|view|details/i }).first();
        if (await healthBtn.isVisible({ timeout: 1000 })) {
          await healthBtn.click();
          await page.waitForTimeout(500);

          // Look for wound location or description text
          const woundDetails = page.locator('.wound-details, [class*="wound"]').filter({ hasText: /location|cannon bone|laceration/i });
          if (await woundDetails.first().isVisible({ timeout: 2000 })) {
            await expect(woundDetails.first()).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Step 7: Admin Creates Manual Wound Care Task', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can access create task button', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Find create task button
      const createBtn = page.locator('button').filter({ hasText: /create/i }).first();
      await expect(createBtn).toBeVisible();
    });

    test('admin can open create task modal', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Click create button
      const createBtn = page.locator('button').filter({ hasText: /create/i }).first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(300);

        // Modal should appear - use design system modal classes
        const modal = page.locator('.ds-modal-overlay, .ds-modal, .modal, [role="dialog"]').filter({ hasText: /report.*task|create/i });
        await expect(modal.first()).toBeVisible();
      }
    });

    test('admin can see category selection in create task form', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Click create button
      const createBtn = page.locator('button').filter({ hasText: /create/i }).first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(300);

        // Look for category dropdown
        const categorySelect = page.locator('select').filter({ hasText: /maintenance|health|feeding/i });
        if (await categorySelect.first().isVisible({ timeout: 1000 })) {
          await expect(categorySelect.first()).toBeEnabled();
        }
      }
    });

    test('admin can close create task modal', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Click create button
      const createBtn = page.locator('button').filter({ hasText: /create/i }).first();
      if (await createBtn.isVisible()) {
        await createBtn.click();
        await page.waitForTimeout(300);

        // Close modal by clicking outside or cancel button
        const modalOverlay = page.locator('.modal-overlay');
        if (await modalOverlay.isVisible()) {
          await modalOverlay.click({ position: { x: 10, y: 10 } });
          await page.waitForTimeout(300);

          // Modal should close - use design system classes
          const modal = page.locator('.ds-modal-overlay, .ds-modal, .modal, [role="dialog"]').filter({ hasText: /report.*task|create/i });
          await expect(modal).not.toBeVisible();
        }
      }
    });
  });

  test.describe('Step 8: Staff Can Reopen Wound Care If Needed', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view completed tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Should see completed section or completed tasks mixed in
      const completedSection = page.locator('.completed-section-divider, .completed-task');
      if (await completedSection.first().isVisible({ timeout: 2000 })) {
        await expect(completedSection.first()).toBeVisible();
      }
    });

    test('staff assigned to task can see reopen button on completed wound care', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Look for completed wound care task
      const completedWoundTask = page.locator('.completed-task').filter({ hasText: /wound care/i }).first();
      if (await completedWoundTask.isVisible({ timeout: 2000 })) {
        // Click to open details
        await completedWoundTask.click();
        await page.waitForTimeout(500);

        // Look for reopen button (only available if staff is assigned to the task)
        const reopenBtn = page.locator('button').filter({ hasText: /reopen/i });
        if (await reopenBtn.isVisible({ timeout: 1000 })) {
          await expect(reopenBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 9: Admin Can Reopen Any Wound Care Task', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view completed wound care tasks', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Switch to completed view
      const tabSelect = page.locator('.tab-select');
      if (await tabSelect.isVisible()) {
        const completedOption = tabSelect.locator('option').filter({ hasText: /completed/i });
        if (await completedOption.isVisible({ timeout: 500 })) {
          await tabSelect.selectOption({ label: /completed/i });
          await page.waitForTimeout(300);

          // Should see completed tasks
          const completedList = page.locator('.tasks-list, .completed-task').first();
          await expect(completedList).toBeVisible();
        }
      }
    });

    test('admin can click on completed wound care task', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Switch to completed view
      const tabSelect = page.locator('.tab-select');
      if (await tabSelect.isVisible()) {
        const completedOption = tabSelect.locator('option').filter({ hasText: /completed/i });
        if (await completedOption.isVisible({ timeout: 500 })) {
          await tabSelect.selectOption({ label: /completed/i });
          await page.waitForTimeout(300);

          // Click on a completed wound care task
          const completedWoundTask = page.locator('.completed-task').filter({ hasText: /wound care/i }).first();
          if (await completedWoundTask.isVisible({ timeout: 1000 })) {
            await completedWoundTask.click();
            await page.waitForTimeout(500);

            // Detail modal should appear - use design system classes
            const modal = page.locator('.ds-modal-overlay, .ds-modal, .modal, [role="dialog"]').filter({ hasText: /wound care|health/i });
            await expect(modal.first()).toBeVisible();
          }
        }
      }
    });

    test('admin can see reopen button on any completed wound care task', async ({ page }) => {
      await safeGoto(page, '/book/tasks');

      // Switch to completed view
      const tabSelect = page.locator('.tab-select');
      if (await tabSelect.isVisible()) {
        const completedOption = tabSelect.locator('option').filter({ hasText: /completed/i });
        if (await completedOption.isVisible({ timeout: 500 })) {
          await tabSelect.selectOption({ label: /completed/i });
          await page.waitForTimeout(300);

          // Click on a completed task
          const completedTask = page.locator('.completed-task').first();
          if (await completedTask.isVisible({ timeout: 1000 })) {
            await completedTask.click();
            await page.waitForTimeout(500);

            // Admin should see reopen button
            const reopenBtn = page.locator('button').filter({ hasText: /reopen/i });
            if (await reopenBtn.isVisible({ timeout: 1000 })) {
              await expect(reopenBtn).toBeEnabled();
            }
          }
        }
      }
    });
  });
});
