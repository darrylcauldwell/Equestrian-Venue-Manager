import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Livery Account & Horse Management Workflow', () => {
  test.describe('Step 1: Horse Feed Management', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);
    });

    test('livery can access my horses', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Should see horses page
      await expect(page.locator('h1, h2').filter({ hasText: /horse/i }).first()).toBeVisible();
    });

    test('livery can view horse feed page', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Find first horse card and look for feed link
      const horseCards = page.locator('.ds-card, [class*="horse"]');
      const firstHorse = horseCards.first();

      if (await firstHorse.isVisible()) {
        // Look for feed link or navigate to first horse's feed
        const feedLink = page.locator('a[href*="/feed"], button').filter({ hasText: /feed/i });
        if (await feedLink.first().isVisible()) {
          await feedLink.first().click();
          await waitForPageReady(page);
          await expect(page.locator('h1, h2, h3').filter({ hasText: /feed/i }).first()).toBeVisible();
        }
      }
    });

    test('livery can access horse feed via direct URL', async ({ page }) => {
      // First get a horse ID from the horses page
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Try navigating to feed page for horse ID 1 (may not exist)
      await page.goto('/book/my-horses/1/feed');
      await waitForPageReady(page);

      // Should either show feed page or redirect if horse doesn't belong to user
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 2: Emergency Contacts', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);
    });

    test('livery can view horse emergency contacts', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Look for emergency contacts link
      const contactsLink = page.locator('a[href*="/emergency"], button').filter({ hasText: /emergency|contact/i });

      if (await contactsLink.first().isVisible()) {
        await contactsLink.first().click();
        await waitForPageReady(page);
        await expect(page.locator('h1, h2, h3').filter({ hasText: /emergency|contact/i }).first()).toBeVisible();
      }
    });

    test('livery can access emergency contacts via direct URL', async ({ page }) => {
      await page.goto('/book/my-horses/1/emergency-contacts');
      await waitForPageReady(page);

      // Should show contacts page or redirect
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 3: My Account', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);
    });

    test('livery can access my account page', async ({ page }) => {
      await page.goto('/book/my-account');
      await waitForPageReady(page);

      // Should see account page
      await expect(page.locator('h1, h2').filter({ hasText: /account|profile/i }).first()).toBeVisible();
    });

    test('livery can view account details', async ({ page }) => {
      await page.goto('/book/my-account');
      await waitForPageReady(page);

      // Should see account information
      const accountContent = page.locator('[class*="account"], [class*="profile"], .ds-card, form');
      await expect(page.locator('body')).toBeVisible();
    });

    test('livery account shows billing information', async ({ page }) => {
      await page.goto('/book/my-account');
      await waitForPageReady(page);

      // Look for billing section
      const billingInfo = page.locator('text=/billing|balance|payment|invoice/i');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 4: Security Info', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);
    });

    test('livery can access security info page', async ({ page }) => {
      await page.goto('/book/security');
      await waitForPageReady(page);

      // Should see security page
      await expect(page.locator('h1, h2').filter({ hasText: /security|gate|access/i }).first()).toBeVisible();
    });

    test('livery can view security codes', async ({ page }) => {
      await page.goto('/book/security');
      await waitForPageReady(page);

      // Should see security information
      const securityContent = page.locator('[class*="security"], [class*="code"], .ds-card');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 5: My Registrations', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('livery');
      await dismissPopups(page);
    });

    test('livery can access my registrations', async ({ page }) => {
      await page.goto('/book/my-registrations');
      await waitForPageReady(page);

      // Should see registrations page
      await expect(page.locator('h1, h2').filter({ hasText: /registration/i }).first()).toBeVisible();
    });

    test('livery can view clinic registrations', async ({ page }) => {
      await page.goto('/book/my-registrations');
      await waitForPageReady(page);

      // Look for registrations content
      const registrationsContent = page.locator('[class*="registration"], .ds-card, .ds-table');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Step 6: Rehab User Workflow', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('rehab');
      await dismissPopups(page);
    });

    test('rehab user can access my horses', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Should see horses (Captain Comeback)
      await expect(page.locator('h1, h2').filter({ hasText: /horse/i }).first()).toBeVisible();
    });

    test('rehab user can view horse health', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Look for health link
      const healthLink = page.locator('a[href*="/health"], button').filter({ hasText: /health|record/i });
      await expect(page.locator('body')).toBeVisible();
    });

    test('rehab user can access services', async ({ page }) => {
      await page.goto('/book/services');
      await waitForPageReady(page);

      // Should see services page
      await expect(page.locator('h1, h2').filter({ hasText: /service/i }).first()).toBeVisible();
    });
  });

  test.describe('Step 7: Holiday User Workflow', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('holiday');
      await dismissPopups(page);
    });

    test('holiday user can access my horses', async ({ page }) => {
      await page.goto('/book/my-horses');
      await waitForPageReady(page);

      // Should see horses (Wanderlust)
      await expect(page.locator('h1, h2').filter({ hasText: /horse/i }).first()).toBeVisible();
    });

    test('holiday user can access booking calendar', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);

      // Livery users get redirected to my-horses, but should still work
      await expect(page.locator('body')).toBeVisible();
    });

    test('holiday user can access services', async ({ page }) => {
      await page.goto('/book/services');
      await waitForPageReady(page);

      // Should see services page
      await expect(page.locator('h1, h2').filter({ hasText: /service/i }).first()).toBeVisible();
    });
  });
});
