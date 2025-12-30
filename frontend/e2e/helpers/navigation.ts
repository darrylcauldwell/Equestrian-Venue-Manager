/**
 * E2E Navigation Helpers
 * Common navigation patterns for Playwright tests
 */

import { Page, expect } from '@playwright/test';
import { dismissPopups } from '../fixtures';

/**
 * Navigate to a page and wait for it to be ready
 */
export async function navigateTo(page: Page, path: string, options: { waitForNetworkIdle?: boolean } = {}) {
  const { waitForNetworkIdle = true } = options;

  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  await page.goto(normalizedPath);

  if (waitForNetworkIdle) {
    await page.waitForLoadState('domcontentloaded');
  }

  await dismissPopups(page);
}

/**
 * Navigate to an admin page
 */
export async function navigateToAdmin(page: Page, subPath: string) {
  await navigateTo(page, `/book/admin/${subPath}`);
}

/**
 * Navigate to a livery/user page
 */
export async function navigateToBook(page: Page, subPath: string) {
  await navigateTo(page, `/book/${subPath}`);
}

/**
 * Click a navigation link
 */
export async function clickNavLink(page: Page, text: string) {
  const navLink = page.locator(`nav a:has-text("${text}"), .nav-menu a:has-text("${text}")`);
  await navLink.click();
  await page.waitForLoadState('domcontentloaded');
  await dismissPopups(page);
}

/**
 * Click a tab button
 */
export async function clickTab(page: Page, tabText: string) {
  const tab = page.locator(`button:has-text("${tabText}"), .tab-btn:has-text("${tabText}"), .ds-tab:has-text("${tabText}")`).first();
  await tab.click();
  await page.waitForTimeout(300); // Allow for tab animation
}

/**
 * Wait for a page title to appear
 */
export async function waitForPageTitle(page: Page, title: string) {
  const heading = page.locator(`h1:has-text("${title}"), h2:has-text("${title}")`).first();
  await expect(heading).toBeVisible({ timeout: 10000 });
}

/**
 * Check current URL matches expected path
 */
export async function expectUrl(page: Page, expectedPath: string | RegExp) {
  if (typeof expectedPath === 'string') {
    await expect(page).toHaveURL(new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } else {
    await expect(page).toHaveURL(expectedPath);
  }
}

/**
 * Navigate back using browser history
 */
export async function goBack(page: Page) {
  await page.goBack();
  await page.waitForLoadState('domcontentloaded');
  await dismissPopups(page);
}
