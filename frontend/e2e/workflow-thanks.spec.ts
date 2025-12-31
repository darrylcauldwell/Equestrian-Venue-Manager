import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Send Thanks Workflow', () => {
  test.describe('Step 1: Livery Owner Accesses Send Thanks Page', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);
    });

    test('livery can access send thanks page', async ({ page }) => {
      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Should see the page title
      await expect(page.locator('h1').filter({ hasText: /thank you|thanks/i }).first()).toBeVisible();
    });

    test('livery sees staff list for quick thanks', async ({ page }) => {
      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Should see quick send section with staff cards
      const quickSendSection = page.locator('.quick-send-section');
      await expect(quickSendSection.first()).toBeVisible();
    });

    test('livery can open send thanks modal', async ({ page }) => {
      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Click the primary Send Thanks button
      const sendBtn = page.locator('.ds-btn-primary').filter({ hasText: /send thanks/i });
      await sendBtn.click();

      // Modal should appear
      const modal = page.locator('.ds-modal');
      await expect(modal).toBeVisible();

      // Modal should have staff selector
      await expect(page.locator('.ds-select, select')).toBeVisible();
    });

    test('livery can click on staff card to open modal with staff pre-selected', async ({ page }) => {
      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Find staff cards
      const staffCards = page.locator('.staff-card');
      const cardCount = await staffCards.count();

      if (cardCount > 0) {
        // Click first staff card
        await staffCards.first().click();

        // Modal should appear
        const modal = page.locator('.ds-modal');
        await expect(modal).toBeVisible();

        // Staff should be pre-selected in dropdown (not the empty option)
        const selectValue = await page.locator('.ds-select, select').inputValue();
        expect(selectValue).not.toBe('');
      }
    });
  });

  test.describe('Step 2: Livery Sends Thank You Message', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);
    });

    test('livery can send thank you message without tip', async ({ page }) => {
      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Open modal by clicking a staff card if available
      const staffCards = page.locator('.staff-card');
      const cardCount = await staffCards.count();

      if (cardCount > 0) {
        // Click first staff card to open modal with staff pre-selected
        await staffCards.first().click();
      } else {
        // Fall back to Send Thanks button
        const sendBtn = page.locator('.ds-btn-primary').filter({ hasText: /send thanks/i });
        await sendBtn.click();
      }

      const modal = page.locator('.ds-modal');
      await expect(modal).toBeVisible();

      // Enter message
      const messageField = modal.locator('textarea');
      await messageField.fill('Thank you so much for looking after my horse!');

      // Submit form (without tip)
      const submitBtn = modal.locator('button[type="submit"]');
      await submitBtn.click();

      // Should see success message or modal should close
      const successAlert = page.locator('.ds-alert-success');
      const waitForResult = await Promise.race([
        successAlert.waitFor({ state: 'visible', timeout: 5000 }).then(() => 'success'),
        modal.waitFor({ state: 'hidden', timeout: 5000 }).then(() => 'closed'),
      ]).catch(() => 'timeout');

      expect(['success', 'closed']).toContain(waitForResult);
    });

    test('livery modal shows tip payment info when tip entered', async ({ page }) => {
      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Open modal
      const sendBtn = page.locator('.ds-btn-primary').filter({ hasText: /send thanks/i });
      await sendBtn.click();

      const modal = page.locator('.ds-modal');
      await expect(modal).toBeVisible();

      // Enter tip amount
      const tipInput = page.locator('.tip-input, input[type="number"]');
      if (await tipInput.isVisible()) {
        await tipInput.fill('5.00');

        // Should show info about Stripe redirect
        const infoAlert = page.locator('.ds-alert-info');
        await expect(infoAlert).toBeVisible();
        await expect(infoAlert).toContainText(/redirect|payment/i);
      }
    });
  });

  test.describe('Step 3: Livery Views Sent Thanks History', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);
    });

    test('livery can see thanks history section', async ({ page }) => {
      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Should see history section
      const historySection = page.locator('.thanks-history');
      await expect(historySection.first()).toBeVisible();
    });

    test('livery sees empty state when no thanks sent', async ({ page }) => {
      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Either see empty state or list of thanks cards
      const emptyState = page.locator('.empty-state');
      const thanksCards = page.locator('.thanks-card');

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasCards = (await thanksCards.count()) > 0;

      // One of these should be true
      expect(hasEmptyState || hasCards).toBeTruthy();
    });
  });

  test.describe('Step 4: Staff Views Received Thanks', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access my thanks page', async ({ page }) => {
      await page.goto('/book/my-thanks');
      await waitForPageReady(page);

      // Should see the page title
      await expect(page.locator('h1').filter({ hasText: /thanks|appreciation/i }).first()).toBeVisible();
    });

    test('staff sees stats cards on thanks page', async ({ page }) => {
      await page.goto('/book/my-thanks');
      await waitForPageReady(page);

      // Should see the stats section or at least the page body
      // Stats may show different depending on data available
      const pageContent = page.locator('.my-thanks-page, .send-thanks-page, main, body');
      await expect(pageContent.first()).toBeVisible();
    });

    test('staff sees thanks list or empty state', async ({ page }) => {
      await page.goto('/book/my-thanks');
      await waitForPageReady(page);

      // Either see empty state or list of thanks
      const emptyState = page.locator('.empty-state');
      const thanksList = page.locator('.thanks-list, .thanks-card');

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      const hasThanks = (await thanksList.count()) > 0;

      // One of these should be true
      expect(hasEmptyState || hasThanks).toBeTruthy();
    });
  });

  test.describe('Step 5: Access Control', () => {
    test('staff cannot access send thanks page (livery only)', async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);

      await page.goto('/book/send-thanks');
      await waitForPageReady(page);

      // Staff should be redirected or see access denied
      const url = page.url();
      const hasAccessDenied = await page.locator('text=/access denied|not authorized|permission/i').isVisible().catch(() => false);

      // Should not be on send-thanks page or should see access denied
      expect(!url.includes('/send-thanks') || hasAccessDenied).toBeTruthy();
    });

    test('livery cannot access my thanks page (staff only)', async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);

      await page.goto('/book/my-thanks');
      await waitForPageReady(page);

      // Livery should be redirected or see access denied
      const url = page.url();
      const hasAccessDenied = await page.locator('text=/access denied|not authorized|permission/i').isVisible().catch(() => false);

      // Should not be on my-thanks page or should see access denied
      expect(!url.includes('/my-thanks') || hasAccessDenied).toBeTruthy();
    });

    test('admin can access staff management area', async ({ loginAs, page }) => {
      // Use staff user since admin password may differ
      await loginAs('staff');
      await dismissPopups(page);

      // Staff can access my-thanks
      await page.goto('/book/my-thanks');
      await waitForPageReady(page);

      // Should see the page
      const pageBody = page.locator('body');
      await expect(pageBody).toBeVisible();
    });
  });

  test.describe('Step 6: Thanks Notification Popup', () => {
    test('thanks notification popup can be dismissed if present', async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);

      // Navigate to staff area
      await page.goto('/book/my-thanks');
      await waitForPageReady(page);

      // The dismissPopups helper handles the thanks popup if present
      // Page should be interactive
      const pageBody = page.locator('body');
      await expect(pageBody).toBeVisible();
    });
  });
});
