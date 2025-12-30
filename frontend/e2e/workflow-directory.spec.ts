import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Professional Directory & Noticeboard Workflow Test
 *
 * Flow: Users view directory → Admin manages professionals → Users view notices → Admin manages notices
 */
test.describe('Professional Directory & Noticeboard Workflow', () => {
  test.describe('Step 1: Livery User Views Professional Directory', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view professional directory', async ({ page }) => {
      await page.goto('/book/professionals');
      await dismissPopups(page);
      await expect(page.locator('h1').filter({ hasText: /professional|directory/i })).toBeVisible();
    });

    test('livery user can see category tabs', async ({ page }) => {
      await safeGoto(page, '/book/professionals');
      // Category filter tabs should be visible
      await expect(page.locator('.category-tabs, .category-tab, [class*="category"]').first()).toBeVisible();
    });

    test('livery user can filter by recommended', async ({ page }) => {
      await safeGoto(page, '/book/professionals');
      const recommendedFilter = page.locator('label, input').filter({ hasText: /recommended/i });
      if (await recommendedFilter.isVisible()) {
        await expect(recommendedFilter).toBeEnabled();
      }
    });

    test('livery user can view professional details', async ({ page }) => {
      await safeGoto(page, '/book/professionals');

      // Click on first professional card if available
      const professionalCard = page.locator('.professional-card').first();
      if (await professionalCard.isVisible()) {
        await professionalCard.click();
        // Modal should open with details
        await expect(page.locator('.professional-modal, [class*="modal"]').first()).toBeVisible();
      }
    });
  });

  test.describe('Step 2: Admin Manages Professionals', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view professional directory', async ({ page }) => {
      await page.goto('/book/professionals');
      await dismissPopups(page);
      await expect(page.locator('h1').filter({ hasText: /professional|directory/i })).toBeVisible();
    });

    test('admin can see add professional button', async ({ page }) => {
      await safeGoto(page, '/book/professionals');
      const addBtn = page.locator('button').filter({ hasText: /add|create|new/i });
      await expect(addBtn.first()).toBeVisible();
    });

    test('admin can open add professional form', async ({ page }) => {
      await safeGoto(page, '/book/professionals');

      const addBtn = page.locator('button').filter({ hasText: /add|create|new/i });
      if (await addBtn.first().isVisible()) {
        await addBtn.first().click();
        // Form should appear
        await expect(page.locator('form, .form-container, [class*="form"]').first()).toBeVisible();
      }
    });

    test('admin can see edit button on professional card', async ({ page }) => {
      await safeGoto(page, '/book/professionals');

      // Click on first professional card if available
      const professionalCard = page.locator('.professional-card').first();
      if (await professionalCard.isVisible()) {
        await professionalCard.click();
        // Modal should have edit button
        const editBtn = page.locator('button').filter({ hasText: /edit/i });
        await expect(editBtn.first()).toBeVisible();
      }
    });
  });

  test.describe('Step 3: Livery User Views Noticeboard', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view noticeboard', async ({ page }) => {
      await page.goto('/book/noticeboard');
      await dismissPopups(page);
      await expect(page.locator('h1').filter({ hasText: /notice|board/i })).toBeVisible();
    });

    test('livery user can see notices list', async ({ page }) => {
      await safeGoto(page, '/book/noticeboard');
      await expect(page.locator('.noticeboard-page, [class*="notice"]').first()).toBeVisible();
    });

    test('livery user can filter notices by category', async ({ page }) => {
      await safeGoto(page, '/book/noticeboard');
      // Category filter should be visible
      const categoryFilter = page.locator('.category-tabs, select, [class*="filter"]').first();
      if (await categoryFilter.isVisible()) {
        await expect(categoryFilter).toBeEnabled();
      }
    });

    test('livery user can expand notice details', async ({ page }) => {
      await safeGoto(page, '/book/noticeboard');

      // Click on first notice to expand if available
      const noticeCard = page.locator('.notice-card').first();
      if (await noticeCard.isVisible()) {
        await noticeCard.click();
        // Expanded content should be visible or modal should open
        await expect(page.locator('.notice-content, [class*="expanded"], [class*="modal"]').first()).toBeVisible();
      }
    });
  });

  test.describe('Step 4: Admin Manages Notices', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view noticeboard', async ({ page }) => {
      await page.goto('/book/noticeboard');
      await dismissPopups(page);
      await expect(page.locator('h1').filter({ hasText: /notice|board/i })).toBeVisible();
    });

    test('admin can see add notice button', async ({ page }) => {
      await safeGoto(page, '/book/noticeboard');
      const addBtn = page.locator('button').filter({ hasText: /add|create|new|post/i });
      await expect(addBtn.first()).toBeVisible();
    });

    test('admin can open add notice form', async ({ page }) => {
      await safeGoto(page, '/book/noticeboard');

      const addBtn = page.locator('button').filter({ hasText: /add|create|new|post/i });
      if (await addBtn.first().isVisible()) {
        await addBtn.first().click();
        // Form should appear
        await expect(page.locator('form, .notice-form, [class*="form"]').first()).toBeVisible();
      }
    });

    test('admin can see edit and delete buttons', async ({ page }) => {
      await safeGoto(page, '/book/noticeboard');

      // Admin action buttons should be visible on notices
      const actionBtns = page.locator('.notice-actions, button').filter({ hasText: /edit|delete/i });
      // At least one action button should be visible if notices exist
      const noticeCard = page.locator('.notice-card').first();
      if (await noticeCard.isVisible()) {
        await expect(actionBtns.first()).toBeVisible();
      }
    });

    test('admin notice form has required fields', async ({ page }) => {
      await safeGoto(page, '/book/noticeboard');

      const addBtn = page.locator('button').filter({ hasText: /add|create|new|post/i });
      if (await addBtn.first().isVisible()) {
        await addBtn.first().click();
        await page.waitForLoadState('domcontentloaded');

        // Form should have title and content fields
        await expect(page.locator('input[name="title"], input#title, label:has-text("Title") + input').first()).toBeVisible();
        await expect(page.locator('textarea[name="content"], textarea, label:has-text("Content") + textarea').first()).toBeVisible();
      }
    });
  });
});
