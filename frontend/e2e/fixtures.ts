import { test as base, expect, Page } from '@playwright/test';

/**
 * Safe navigation helper - combines goto with proper waiting
 * Use this instead of bare page.goto() to avoid flaky tests
 */
export async function safeGoto(page: Page, url: string, options?: { skipPopupDismissal?: boolean }) {
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');
  await waitForPageReady(page);
  if (!options?.skipPopupDismissal) {
    await dismissPopups(page);
  }
}

// Helper to wait for page to be fully loaded (not showing loading state)
export async function waitForPageReady(page: Page, timeout = 15000) {
  const startTime = Date.now();

  // Wait for loading indicator to disappear (with extended timeout for slow CI)
  const loadingIndicator = page.locator('.ds-loading');
  try {
    // First check if there's a loading indicator
    const hasLoading = await loadingIndicator.count() > 0;
    if (hasLoading) {
      await loadingIndicator.waitFor({ state: 'hidden', timeout });
    }
  } catch (error) {
    // Capture diagnostic info if loading indicator doesn't disappear
    const url = page.url();
    const loadingCount = await loadingIndicator.count();
    console.warn(`waitForPageReady: Loading indicator still visible after ${Date.now() - startTime}ms`);
    console.warn(`  URL: ${url}`);
    console.warn(`  Loading elements: ${loadingCount}`);
  }

  // Wait for the layout to be visible (hamburger button is always rendered)
  try {
    await page.locator('.hamburger-btn').waitFor({ state: 'visible', timeout });
  } catch (error) {
    // Capture diagnostic info on failure
    const url = page.url();
    const hamburgerCount = await page.locator('.hamburger-btn').count();
    const loadingCount = await page.locator('.ds-loading').count();
    const errorCount = await page.locator('.error, .ds-alert-error, [class*="error"]').count();

    // Check what's actually on the page
    const bodyText = await page.locator('body').textContent().catch(() => '');
    const hasLogin = bodyText?.includes('Login') || bodyText?.includes('Sign in');
    const hasError = bodyText?.toLowerCase().includes('error');

    console.error('waitForPageReady FAILED - Page did not load properly');
    console.error(`  URL: ${url}`);
    console.error(`  Time elapsed: ${Date.now() - startTime}ms`);
    console.error(`  Hamburger buttons found: ${hamburgerCount}`);
    console.error(`  Loading indicators found: ${loadingCount}`);
    console.error(`  Error elements found: ${errorCount}`);
    console.error(`  Shows login page: ${hasLogin}`);
    console.error(`  Contains error text: ${hasError}`);
    console.error(`  Body text preview: ${bodyText?.substring(0, 200)}...`);

    throw error;
  }

  // Dismiss any popups that appear after page load
  await dismissPopups(page);
}

// Helper to dismiss any popups that might overlay the page
// ROBUST: Loops for up to 3 seconds to catch popups that appear after API calls complete
export async function dismissPopups(page: Page) {
  const maxWaitTime = 3000; // Maximum time to wait for popups (3 seconds)
  const checkInterval = 200; // Check every 200ms
  const startTime = Date.now();

  // Wait a moment for any pending API calls to complete and popups to render
  await page.waitForTimeout(500);

  // Keep checking and dismissing popups until none appear for a full cycle
  let consecutiveEmptyChecks = 0;
  const requiredEmptyChecks = 3; // Need 3 consecutive checks with no popups to be sure

  while (Date.now() - startTime < maxWaitTime && consecutiveEmptyChecks < requiredEmptyChecks) {
    let foundPopup = false;

    // Check and dismiss vaccination alert popup
    try {
      const vaccPopup = page.locator('.vaccination-alert-popup-overlay');
      if (await vaccPopup.isVisible({ timeout: 100 })) {
        foundPopup = true;
        const dismissBtn = page.locator('.vaccination-alert-popup .dismiss-btn');
        if (await dismissBtn.isVisible({ timeout: 100 })) {
          await dismissBtn.click();
        } else {
          const closeBtn = page.locator('.vaccination-alert-popup .close-btn');
          if (await closeBtn.isVisible({ timeout: 100 })) {
            await closeBtn.click();
          }
        }
        await page.waitForTimeout(200); // Wait for popup to close
      }
    } catch {
      // No vaccination popup
    }

    // Check and dismiss feed alert popup
    try {
      const feedPopup = page.locator('.feed-alert-popup-overlay');
      if (await feedPopup.isVisible({ timeout: 100 })) {
        foundPopup = true;
        const dismissBtn = page.locator('.feed-alert-popup .dismiss-btn');
        if (await dismissBtn.isVisible({ timeout: 100 })) {
          await dismissBtn.click();
        } else {
          const closeBtn = page.locator('.feed-alert-popup .close-btn');
          if (await closeBtn.isVisible({ timeout: 100 })) {
            await closeBtn.click();
          }
        }
        await page.waitForTimeout(200); // Wait for popup to close
      }
    } catch {
      // No feed popup
    }

    // Check and dismiss quote alert popup
    try {
      const quotePopup = page.locator('.quote-alert-popup-overlay');
      if (await quotePopup.isVisible({ timeout: 100 })) {
        foundPopup = true;
        const dismissBtn = page.locator('.quote-alert-popup .dismiss-btn');
        if (await dismissBtn.isVisible({ timeout: 100 })) {
          await dismissBtn.click();
        } else {
          const closeBtn = page.locator('.quote-alert-popup .close-btn');
          if (await closeBtn.isVisible({ timeout: 100 })) {
            await closeBtn.click();
          }
        }
        await page.waitForTimeout(200); // Wait for popup to close
      }
    } catch {
      // No quote popup
    }

    // Check and dismiss staff milestones popup
    try {
      const milestonesPopup = page.locator('.milestones-popup-overlay');
      if (await milestonesPopup.isVisible({ timeout: 100 })) {
        foundPopup = true;
        const dismissBtn = page.locator('.milestones-popup .dismiss-btn');
        if (await dismissBtn.isVisible({ timeout: 100 })) {
          await dismissBtn.click();
        } else {
          const closeBtn = page.locator('.milestones-popup .close-btn');
          if (await closeBtn.isVisible({ timeout: 100 })) {
            await closeBtn.click();
          }
        }
        await page.waitForTimeout(200); // Wait for popup to close
      }
    } catch {
      // No milestones popup
    }

    // Check and dismiss flood alert popup
    try {
      const floodPopup = page.locator('.flood-alert-popup-overlay');
      if (await floodPopup.isVisible({ timeout: 100 })) {
        foundPopup = true;
        const dismissBtn = page.locator('.flood-alert-popup .dismiss-btn');
        if (await dismissBtn.isVisible({ timeout: 100 })) {
          await dismissBtn.click();
        } else {
          const closeBtn = page.locator('.flood-alert-popup .close-btn');
          if (await closeBtn.isVisible({ timeout: 100 })) {
            await closeBtn.click();
          }
        }
        await page.waitForTimeout(200); // Wait for popup to close
      }
    } catch {
      // No flood popup
    }

    // Check and dismiss thanks notification popup
    try {
      const thanksPopup = page.locator('.thanks-notification-overlay');
      if (await thanksPopup.isVisible({ timeout: 100 })) {
        foundPopup = true;
        const laterBtn = page.locator('.thanks-notification-popup button:has-text("Later")');
        if (await laterBtn.isVisible({ timeout: 100 })) {
          await laterBtn.click();
        } else {
          const closeBtn = page.locator('.thanks-notification-popup .close-btn');
          if (await closeBtn.isVisible({ timeout: 100 })) {
            await closeBtn.click();
          }
        }
        await page.waitForTimeout(200); // Wait for popup to close
      }
    } catch {
      // No thanks popup
    }

    if (foundPopup) {
      consecutiveEmptyChecks = 0; // Reset counter when we find a popup
    } else {
      consecutiveEmptyChecks++;
    }

    // Small wait before next check
    await page.waitForTimeout(checkInterval);
  }
}

// Test user credentials - these should match seed data
// All seed users use 'password' as their password
export const testUsers = {
  admin: {
    username: 'admin',
    password: 'password',
    name: 'Admin User',
    role: 'admin'
  },
  livery: {
    username: 'livery1',
    password: 'password',
    name: 'Jane Smith',
    role: 'livery'
  },
  livery2: {
    username: 'livery2',
    password: 'password',
    name: 'Bob Jones',
    role: 'livery'
  },
  coach: {
    username: 'coach',
    password: 'password',
    name: 'Sarah Coach',
    role: 'coach'
  },
  staff: {
    username: 'staff1',
    password: 'password',
    name: 'Tom Staff',
    role: 'staff'
  },
  public: {
    username: 'clinic1',  // Use clinic1 as the default public user (exists in seed data)
    password: 'password',
    name: 'Pippa Dressage',
    role: 'public'
  },
  rehab: {
    username: 'rehab1',
    password: 'password',
    name: 'Rehab Owner',
    role: 'livery'
  },
  holiday: {
    username: 'holiday1',
    password: 'password',
    name: 'Holiday Owner',
    role: 'livery'
  },
  clinic1: {
    username: 'clinic1',
    password: 'password',
    name: 'Clinic User One',
    role: 'public'
  },
  clinic2: {
    username: 'clinic2',
    password: 'password',
    name: 'Clinic User Two',
    role: 'public'
  },
  clinic3: {
    username: 'clinic3',
    password: 'password',
    name: 'Clinic User Three',
    role: 'public'
  }
};

// Extended test fixture with authentication helpers
export const test = base.extend<{
  loginAs: (role: keyof typeof testUsers) => Promise<void>;
  logout: () => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    const loginAs = async (role: keyof typeof testUsers) => {
      const user = testUsers[role];

      // Navigate to login page and wait for it to be ready
      await page.goto('/login', { waitUntil: 'networkidle' });

      // Wait for login form to be visible
      const usernameField = page.locator('#username');
      await usernameField.waitFor({ state: 'visible', timeout: 10000 });

      // Fill credentials
      await usernameField.fill(user.username);
      await page.locator('#password').fill(user.password);
      await page.locator('button[type="submit"]').click();

      // Wait for redirect after successful login (extended timeout for slow CI)
      // Match any page that isn't the login page
      try {
        await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15000 });
      } catch (error) {
        // Capture diagnostic info on login failure
        const url = page.url();
        const bodyText = await page.locator('body').textContent().catch(() => '');
        const hasError = await page.locator('.error, .ds-alert-error, [class*="error"]').count() > 0;

        console.error(`Login failed for user: ${user.username} (role: ${role})`);
        console.error(`  Current URL: ${url}`);
        console.error(`  Has error message: ${hasError}`);
        console.error(`  Body preview: ${bodyText?.substring(0, 300)}...`);

        throw error;
      }

      // Wait a moment for auth context to update
      await page.waitForTimeout(500);

      // Automatically dismiss any popups that appear after login
      await dismissPopups(page);
    };
    await use(loginAs);
  },
  logout: async ({ page }, use) => {
    const logout = async () => {
      // Dismiss any popups that might be blocking the UI
      await dismissPopups(page);

      // Open hamburger menu first (logout is in slide-out nav)
      const hamburgerBtn = page.locator('.hamburger-btn');
      if (await hamburgerBtn.isVisible({ timeout: 1000 })) {
        await hamburgerBtn.click();
        await page.waitForTimeout(300); // Wait for slide animation
      }
      // Click logout button
      const logoutBtn = page.locator('.nav-logout-btn, button:has-text("Logout")');
      if (await logoutBtn.isVisible({ timeout: 2000 })) {
        await logoutBtn.click();
        // After logout, user is redirected to home (/ or /book)
        await page.waitForURL(/\/(book)?$/);
      }
    };
    await use(logout);
  }
});

export { expect };
