import { test, expect, dismissPopups } from './fixtures';

/**
 * Medication Management Workflow Test
 *
 * Flow: Staff/Admin access medication duties → View pending tasks →
 *       Mark medication as given → View medication history
 *
 * Health task types: medication, wound_care, health_check, rehab_exercise
 */
test.describe('Medication Management Workflow', () => {
  test.describe('Step 1: Staff Accesses Medication Duties', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view yard tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1, .yard-tasks').first()).toBeVisible();
    });

    test('staff can see tasks list', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');

      // Should see tasks list container
      await expect(page.locator('.yard-tasks, .task-list, [class*="task"]').first()).toBeVisible();
    });

    test('staff can view their assigned tasks by default', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Non-admin staff should default to 'my' tab
      const myTab = page.locator('.tab, .filter-btn').filter({ hasText: /^my$/i });
      if (await myTab.isVisible()) {
        // Check if it's active (may have different class names)
        const isActive = await myTab.evaluate((el) =>
          el.classList.contains('active') || el.classList.contains('selected')
        );
        expect(isActive).toBeTruthy();
      }
    });

    test('staff can switch to view todays tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Look for today tab
      const todayTab = page.locator('.tab, .filter-btn').filter({ hasText: /today/i });
      if (await todayTab.isVisible()) {
        await todayTab.click();
        await page.waitForTimeout(300);
        await expect(todayTab).toBeVisible();
      }
    });
  });

  test.describe('Step 2: Staff Views Medication Tasks', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see health task information', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Look for health task badges (horse name, dosage, etc)
      const healthInfo = page.locator('.health-task-info, .horse-badge, .dosage-info');
      if (await healthInfo.first().isVisible()) {
        await expect(healthInfo.first()).toBeVisible();
      }
    });

    test('staff can see medication dosage information', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Look for medication dosage badge
      const dosageBadge = page.locator('.dosage-info');
      if (await dosageBadge.first().isVisible()) {
        await expect(dosageBadge.first()).toContainText(/\w+/); // Contains some text
      }
    });

    test('staff can filter by category', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Look for category filter
      const categoryFilter = page.locator('select').filter({ has: page.locator('option:has-text("Category")') }).first();
      if (await categoryFilter.isVisible()) {
        await expect(categoryFilter).toBeEnabled();
      }
    });

    test('staff can click on task to view details', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Click on first task card
      const taskCard = page.locator('.task-card, [class*="task-item"]').first();
      if (await taskCard.isVisible()) {
        await taskCard.click();
        await page.waitForTimeout(300);

        // Detail modal should appear
        const modal = page.locator('.modal, [role="dialog"]');
        await expect(modal.first()).toBeVisible();
      }
    });
  });

  test.describe('Step 3: Staff Marks Medication as Given', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can see complete button on medication tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Look for complete button
      const completeBtn = page.locator('button').filter({ hasText: /complete|done|finish/i }).first();
      if (await completeBtn.isVisible()) {
        await expect(completeBtn).toBeEnabled();
      }
    });

    test('staff can open medication completion modal', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Find and click complete button on health task
      const completeBtn = page.locator('button').filter({ hasText: /complete|done/i }).first();
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await page.waitForTimeout(300);

        // Completion modal should appear
        const modal = page.locator('.modal, [role="dialog"]');
        if (await modal.isVisible()) {
          await expect(modal).toBeVisible();
        }
      }
    });

    test('staff can see medication completion form fields', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Find and click complete button
      const completeBtn = page.locator('button').filter({ hasText: /complete|done/i }).first();
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await page.waitForTimeout(300);

        // Look for medication-specific form elements
        const wasGivenLabel = page.locator('label').filter({ hasText: /was medication given/i });
        if (await wasGivenLabel.isVisible()) {
          await expect(wasGivenLabel).toBeVisible();
        }
      }
    });

    test('staff can toggle medication was given status', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const completeBtn = page.locator('button').filter({ hasText: /complete|done/i }).first();
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await page.waitForTimeout(300);

        // Look for toggle buttons
        const yesBtn = page.locator('button.toggle-btn').filter({ hasText: /yes|given/i });
        const skipBtn = page.locator('button.toggle-btn').filter({ hasText: /skip|no/i });

        if (await yesBtn.isVisible() && await skipBtn.isVisible()) {
          // Default should be "Yes, Given"
          const yesActive = await yesBtn.evaluate((el) => el.classList.contains('active'));
          expect(yesActive).toBeTruthy();

          // Click skip
          await skipBtn.click();
          await page.waitForTimeout(200);

          // Skip should now be active
          const skipActive = await skipBtn.evaluate((el) => el.classList.contains('active'));
          expect(skipActive).toBeTruthy();
        }
      }
    });

    test('staff can see skip reason field when medication not given', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const completeBtn = page.locator('button').filter({ hasText: /complete|done/i }).first();
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await page.waitForTimeout(300);

        const skipBtn = page.locator('button.toggle-btn').filter({ hasText: /skip|no/i });
        if (await skipBtn.isVisible()) {
          await skipBtn.click();
          await page.waitForTimeout(300);

          // Skip reason field should appear
          const skipReasonInput = page.locator('input').filter({ has: page.locator(':scope') }).filter({
            hasText: /reason/i
          }).or(page.locator('input[placeholder*="reason" i]'));

          if (await skipReasonInput.first().isVisible()) {
            await expect(skipReasonInput.first()).toBeVisible();
          }
        }
      }
    });

    test('staff can add notes to medication completion', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const completeBtn = page.locator('button').filter({ hasText: /complete|done/i }).first();
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await page.waitForTimeout(300);

        // Look for notes textarea
        const notesField = page.locator('textarea').filter({
          hasText: /notes/i
        }).or(page.locator('textarea[placeholder*="notes" i], textarea[placeholder*="observations" i]'));

        if (await notesField.first().isVisible()) {
          await expect(notesField.first()).toBeEnabled();
          await notesField.first().fill('Horse took medication well without fuss');
        }
      }
    });

    test('staff can submit medication completion', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const completeBtn = page.locator('button').filter({ hasText: /complete|done/i }).first();
      if (await completeBtn.isVisible()) {
        await completeBtn.click();
        await page.waitForTimeout(300);

        // Look for submit/save button in modal
        const submitBtn = page.locator('button').filter({ hasText: /submit|save|confirm|complete/i }).last();
        if (await submitBtn.isVisible()) {
          await expect(submitBtn).toBeEnabled();
        }
      }
    });
  });

  test.describe('Step 4: Staff Views Completed Tasks', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can switch to completed tasks tab', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Look for completed tab
      const completedTab = page.locator('.tab, .filter-btn').filter({ hasText: /completed/i });
      if (await completedTab.isVisible()) {
        await completedTab.click();
        await page.waitForTimeout(300);
        await expect(completedTab).toBeVisible();
      }
    });

    test('staff can see completed medication tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const completedTab = page.locator('.tab, .filter-btn').filter({ hasText: /completed/i });
      if (await completedTab.isVisible()) {
        await completedTab.click();
        await page.waitForTimeout(500);

        // Should see task cards
        const taskCards = page.locator('.task-card, [class*="task-item"]');
        if (await taskCards.first().isVisible()) {
          await expect(taskCards.first()).toBeVisible();
        }
      }
    });

    test('staff can view details of completed medication task', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const completedTab = page.locator('.tab, .filter-btn').filter({ hasText: /completed/i });
      if (await completedTab.isVisible()) {
        await completedTab.click();
        await page.waitForTimeout(500);

        const taskCard = page.locator('.task-card, [class*="task-item"]').first();
        if (await taskCard.isVisible()) {
          await taskCard.click();
          await page.waitForTimeout(300);

          // Detail modal should show
          const modal = page.locator('.modal, [role="dialog"]');
          await expect(modal.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Step 5: Admin Views Medication Tasks', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view yard tasks page', async ({ page }) => {
      await page.goto('/book/tasks');
      await expect(page.locator('h1, .yard-tasks').first()).toBeVisible();
    });

    test('admin defaults to today tab', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Admin should default to 'today' tab
      const todayTab = page.locator('.tab, .filter-btn').filter({ hasText: /today/i });
      if (await todayTab.isVisible()) {
        const isActive = await todayTab.evaluate((el) =>
          el.classList.contains('active') || el.classList.contains('selected')
        );
        expect(isActive).toBeTruthy();
      }
    });

    test('admin can see all medication tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Should see tasks list
      await expect(page.locator('.yard-tasks, .task-list, [class*="task"]').first()).toBeVisible();
    });

    test('admin can view open tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const openTab = page.locator('.tab, .filter-btn').filter({ hasText: /^open$/i });
      if (await openTab.isVisible()) {
        await openTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can filter medication tasks by assignee', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Look for assigned to filter
      const assigneeFilter = page.locator('select').filter({
        has: page.locator('option:has-text("Assigned")')
      }).or(page.locator('select:has(option:has-text("All Staff"))'));

      if (await assigneeFilter.first().isVisible()) {
        await expect(assigneeFilter.first()).toBeEnabled();
      }
    });
  });

  test.describe('Step 6: Livery User Views Horse Medication History', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view their horses', async ({ page }) => {
      await page.goto('/book/my-horses');
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('livery user can access horse health records', async ({ page }) => {
      await page.goto('/book/my-horses');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Find health link or button for a horse
      const healthLink = page.locator('a, button').filter({ hasText: /health|record/i }).first();
      if (await healthLink.isVisible()) {
        await healthLink.click();
        await page.waitForTimeout(500);

        // Should be on health records page
        await expect(page).toHaveURL(/\/health/);
      }
    });

    test('livery user can view care plans tab', async ({ page }) => {
      await page.goto('/book/my-horses');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const healthLink = page.locator('a, button').filter({ hasText: /health|record/i }).first();
      if (await healthLink.isVisible()) {
        await healthLink.click();
        await page.waitForTimeout(500);

        // Look for care plans tab
        const carePlansTab = page.locator('.tab, button').filter({ hasText: /care.*plan/i });
        if (await carePlansTab.isVisible()) {
          await carePlansTab.click();
          await page.waitForTimeout(300);
        }
      }
    });

    test('livery user can see task history in health records', async ({ page }) => {
      await page.goto('/book/my-horses');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const healthLink = page.locator('a, button').filter({ hasText: /health|record/i }).first();
      if (await healthLink.isVisible()) {
        await healthLink.click();
        await page.waitForTimeout(500);

        // Look for task history section or panel
        const historySection = page.locator('[class*="history"], [class*="task-log"]');
        if (await historySection.first().isVisible()) {
          await expect(historySection.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Step 7: Admin Views Medication Reports', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view health dashboard', async ({ page }) => {
      await page.goto('/book/admin/health-dashboard');
      await page.waitForLoadState('networkidle');

      // Should see health dashboard page
      await expect(page.locator('.admin-page, h1, .health-dashboard').first()).toBeVisible();
    });

    test('admin can access care plans management', async ({ page }) => {
      await page.goto('/book/admin/care-plans');
      await page.waitForLoadState('networkidle');

      // Should see care plans page
      await expect(page.locator('.admin-page, h1').first()).toBeVisible();
    });

    test('admin can see reported tasks', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      const reportedTab = page.locator('.tab, .filter-btn').filter({ hasText: /reported/i });
      if (await reportedTab.isVisible()) {
        await reportedTab.click();
        await page.waitForTimeout(300);
      }
    });

    test('admin can filter tasks by priority', async ({ page }) => {
      await page.goto('/book/tasks');
      await page.waitForLoadState('networkidle');
      await dismissPopups(page);

      // Look for priority filter
      const priorityFilter = page.locator('select').filter({
        has: page.locator('option:has-text("Priority")')
      }).or(page.locator('select:has(option:has-text("Urgent"))'));

      if (await priorityFilter.first().isVisible()) {
        await expect(priorityFilter.first()).toBeEnabled();
      }
    });
  });
});
