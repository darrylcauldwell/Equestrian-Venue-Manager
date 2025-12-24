import { test as base, expect, Page } from '@playwright/test';

// Helper to dismiss any popups that might overlay the page
export async function dismissPopups(page: Page) {
  // Dismiss feed alert popup if present - try multiple selectors
  try {
    const overlay = page.locator('.feed-alert-popup-overlay');
    if (await overlay.isVisible({ timeout: 500 })) {
      // Try the dismiss button first (in footer)
      const dismissBtn = page.locator('.feed-alert-popup .dismiss-btn');
      if (await dismissBtn.isVisible({ timeout: 300 })) {
        await dismissBtn.click();
        await page.waitForTimeout(300);
        return;
      }
      // Try the close button (X in header)
      const closeBtn = page.locator('.feed-alert-popup .close-btn');
      if (await closeBtn.isVisible({ timeout: 300 })) {
        await closeBtn.click();
        await page.waitForTimeout(300);
        return;
      }
    }
  } catch {
    // No popup to dismiss
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
    username: 'public1',
    password: 'password',
    name: 'Public User',
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
      await page.goto('/login');
      await page.fill('#username', user.username);
      await page.fill('#password', user.password);
      await page.click('button[type="submit"]');
      // Wait for redirect after successful login
      await page.waitForURL(/\/(dashboard|book|admin)?$/, { timeout: 10000 });
    };
    await use(loginAs);
  },
  logout: async ({ page }, use) => {
    const logout = async () => {
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
        await page.waitForURL('/');
      }
    };
    await use(logout);
  }
});

export { expect };
