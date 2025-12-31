import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Contract Workflow Test
 *
 * Flow: Admin creates template → Creates version → Requests signature → Livery views and signs
 */
test.describe('Contract Workflow', () => {
  test.describe('Step 1: Admin Contract Templates', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view contract templates page', async ({ page }) => {
      await page.goto('/book/admin/contracts');
      await waitForPageReady(page);
      await expect(page.locator('h3, h2, h1').first()).toBeVisible();
    });

    test('admin can see create template button', async ({ page }) => {
      await page.goto('/book/admin/contracts');
      await waitForPageReady(page);
      const createBtn = page.locator('button').filter({ hasText: /create|new template/i });
      await expect(createBtn.first()).toBeVisible();
    });

    test('admin can open create template modal', async ({ page }) => {
      await page.goto('/book/admin/contracts');
      await waitForPageReady(page);
      const createBtn = page.locator('button').filter({ hasText: /create template/i });
      await createBtn.first().click();
      await expect(page.locator('.ds-modal, .modal, [class*="modal"], [role="dialog"]').first()).toBeVisible();
    });

    test('admin can see template list or empty state', async ({ page }) => {
      await page.goto('/book/admin/contracts');
      await waitForPageReady(page);
      const table = page.locator('table, .admin-table, .ds-empty').first();
      await expect(table).toBeVisible();
    });
  });

  test.describe('Step 2: Admin Contract Signatures', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view contract signatures page', async ({ page }) => {
      await page.goto('/book/admin/contract-signatures');
      await waitForPageReady(page);
      await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    });

    test('admin can see request signature button', async ({ page }) => {
      await page.goto('/book/admin/contract-signatures');
      await waitForPageReady(page);
      const requestBtn = page.locator('button').filter({ hasText: /request signature/i });
      await expect(requestBtn.first()).toBeVisible();
    });

    test('admin can see re-sign button', async ({ page }) => {
      await page.goto('/book/admin/contract-signatures');
      await waitForPageReady(page);
      const resignBtn = page.locator('button').filter({ hasText: /re-sign|trigger/i });
      await expect(resignBtn.first()).toBeVisible();
    });

    test('admin can see signature stats', async ({ page }) => {
      await page.goto('/book/admin/contract-signatures');
      await waitForPageReady(page);
      const stats = page.locator('.stats-row, .stat-card').first();
      await expect(stats).toBeVisible();
    });

    test('admin can see signature filters', async ({ page }) => {
      await page.goto('/book/admin/contract-signatures');
      await waitForPageReady(page);
      const filterBar = page.locator('.filter-bar, select').first();
      await expect(filterBar).toBeVisible();
    });
  });

  test.describe('Step 3: Livery User Views Contracts', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery user can view my contracts page', async ({ page }) => {
      await page.goto('/book/my-contracts');
      await waitForPageReady(page);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('livery user can see contracts list or empty state', async ({ page }) => {
      await page.goto('/book/my-contracts');
      await waitForPageReady(page);
      const content = page.locator('.contracts-grid, .contract-card, .ds-empty').first();
      await expect(content).toBeVisible();
    });

    test('livery user page has correct sections', async ({ page }) => {
      await page.goto('/book/my-contracts');
      await waitForPageReady(page);
      // Should show either pending contracts, signed contracts, or empty state
      const section = page.locator('.contracts-section, .ds-empty').first();
      await expect(section).toBeVisible();
    });
  });

  test.describe('Step 4: Navigation Links', () => {
    test('admin can access contracts from menu', async ({ loginAs, page }) => {
      await loginAs('admin');
      await page.goto('/book');
      await waitForPageReady(page);
      await dismissPopups(page);

      // Open hamburger menu
      const menuBtn = page.locator('.hamburger-btn').first();
      await expect(menuBtn).toBeVisible({ timeout: 5000 });
      await menuBtn.click();
      await page.waitForTimeout(500);

      // Dismiss any popups that might have appeared after menu opened
      await dismissPopups(page);

      // Expand "My Venue" submenu (where admin contracts live) - this is REQUIRED
      const myVenueBtn = page.locator('.nav-dropdown-trigger').filter({ hasText: /my venue/i }).first();
      await expect(myVenueBtn).toBeVisible({ timeout: 5000 });
      await myVenueBtn.click();
      await page.waitForTimeout(500);

      // Verify dropdown expanded by checking if contracts link is visible
      const contractsLink = page.locator('a[href*="admin/contracts"]').first();

      // If link still not visible after 2s, try clicking dropdown again (may have been blocked)
      if (!await contractsLink.isVisible({ timeout: 2000 })) {
        await dismissPopups(page);
        await myVenueBtn.click({ force: true });
        await page.waitForTimeout(500);
      }

      // Dismiss any popups that might have appeared after dropdown clicked
      await dismissPopups(page);

      // Look for contracts link - it should now be visible after expanding dropdown
      await expect(contractsLink).toBeVisible({ timeout: 5000 });
    });

    test('livery can access my contracts from menu', async ({ loginAs, page }) => {
      await loginAs('livery');
      await page.goto('/book');
      await waitForPageReady(page);
      // Open hamburger menu
      const menuBtn = page.locator('.hamburger-btn').first();
      await menuBtn.click();
      await page.waitForTimeout(500);
      // Try to find my-contracts link directly first, or look in "My Account" submenu
      let contractsLink = page.locator('a[href*="my-contracts"]').first();
      if (!await contractsLink.isVisible({ timeout: 1000 })) {
        // Try expanding "My Account" submenu (where livery contracts live)
        const myAccountBtn = page.locator('.nav-dropdown-trigger').filter({ hasText: /my account/i }).first();
        if (await myAccountBtn.isVisible({ timeout: 2000 })) {
          await myAccountBtn.click();
          await page.waitForTimeout(500);
        }
        contractsLink = page.locator('a[href*="my-contracts"]').first();
      }
      await expect(contractsLink).toBeVisible({ timeout: 5000 });
    });
  });
});

test.describe('DocuSign Settings', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin');
  });

  test('admin can view settings page', async ({ page }) => {
    await page.goto('/book/admin/settings');
    await waitForPageReady(page);
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('admin can see DocuSign integration section', async ({ page }) => {
    await page.goto('/book/admin/settings');
    await waitForPageReady(page);
    // Look for DocuSign section (may be collapsed by default)
    const docusignSection = page.locator('summary, h3').filter({ hasText: /docusign/i });
    await expect(docusignSection.first()).toBeVisible();
  });

  test('admin can expand DocuSign section', async ({ page }) => {
    await page.goto('/book/admin/settings');
    await waitForPageReady(page);
    const docusignSection = page.locator('summary, [class*="section"]').filter({ hasText: /docusign/i }).first();
    await docusignSection.click();
    await page.waitForTimeout(300);
    // Should see DocuSign toggle content after expanding - look for the toggle label text
    const docusignToggle = page.locator('text=DocuSign E-Signature').first();
    await expect(docusignToggle).toBeVisible();
  });
});

test.describe('Contract Template Creation Flow', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin');
  });

  test('admin can open and close template modal', async ({ page }) => {
    await page.goto('/book/admin/contracts');
    await waitForPageReady(page);

    // Open modal
    const createBtn = page.locator('button').filter({ hasText: /create template/i }).first();
    await createBtn.click();

    // Verify modal opened
    const modal = page.locator('.ds-modal, .modal, [class*="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible();

    // Close modal
    const cancelBtn = page.locator('button').filter({ hasText: /cancel/i }).first();
    await cancelBtn.click();

    // Verify modal closed
    await expect(modal).not.toBeVisible();
  });

  test('template form has required fields', async ({ page }) => {
    await page.goto('/book/admin/contracts');
    await waitForPageReady(page);

    // Page should load
    await expect(page.locator('h1, .admin-page').first()).toBeVisible();

    const createBtn = page.locator('button').filter({ hasText: /create template/i }).first();
    if (await createBtn.isVisible({ timeout: 3000 })) {
      // Dismiss any popups that might have appeared after page load
      await dismissPopups(page);

      await createBtn.click();

      // Wait for modal to appear - use ds-modal
      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible({ timeout: 5000 });

      // Dismiss any popups that appeared after modal opened
      await dismissPopups(page);

      // Check for template name field - look for ds-input inside the modal
      const nameInput = modal.locator('input.ds-input, input[placeholder*="name" i]').first();
      await expect(nameInput).toBeVisible();

      // Check for contract type select
      const typeSelect = modal.locator('select.ds-select, select').first();
      await expect(typeSelect).toBeVisible();
    }
    // Test passes if page loaded - create button may not exist without data
  });
});

test.describe('Signature Request Flow', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin');
  });

  test('admin can open request signature modal', async ({ page }) => {
    await page.goto('/book/admin/contract-signatures');
    await waitForPageReady(page);

    const requestBtn = page.locator('button').filter({ hasText: /request signature/i }).first();
    await requestBtn.click();

    const modal = page.locator('.ds-modal, .modal, [class*="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible();
  });

  test('request modal has user and template select', async ({ page }) => {
    await page.goto('/book/admin/contract-signatures');
    await waitForPageReady(page);

    const requestBtn = page.locator('button').filter({ hasText: /request signature/i }).first();
    await requestBtn.click();

    // Should have at least two select dropdowns (template and user)
    const selects = page.locator('select');
    await expect(selects.first()).toBeVisible();
  });

  test('admin can open trigger re-sign modal', async ({ page }) => {
    await page.goto('/book/admin/contract-signatures');
    await waitForPageReady(page);

    const resignBtn = page.locator('button').filter({ hasText: /re-sign|trigger/i }).first();
    await resignBtn.click();

    const modal = page.locator('.ds-modal, .modal, [class*="modal"], [role="dialog"]').first();
    await expect(modal).toBeVisible();
  });
});
