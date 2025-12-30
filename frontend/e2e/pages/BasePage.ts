import { Page, Locator, expect } from '@playwright/test';

/**
 * Base Page Object
 * Common functionality shared across all page objects
 */
export class BasePage {
  readonly page: Page;
  readonly loadingSpinner: Locator;
  readonly errorAlert: Locator;
  readonly successAlert: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loadingSpinner = page.locator('.ds-loading, .ds-spinner, .loading');
    this.errorAlert = page.locator('.ds-alert-error, .error-message, [role="alert"].error');
    this.successAlert = page.locator('.ds-alert-success, .success-message, [role="alert"].success');
  }

  /**
   * Navigate to the page and wait for it to be ready
   */
  async goto(path: string) {
    await this.page.goto(path);
    await this.waitForPageReady();
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageReady() {
    await this.page.waitForLoadState('domcontentloaded');
    await this.dismissPopups();
  }

  /**
   * Wait for loading spinner to disappear
   */
  async waitForLoading() {
    try {
      await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 30000 });
    } catch {
      // No spinner present, continue
    }
  }

  /**
   * Dismiss any popups or overlays
   */
  async dismissPopups() {
    try {
      const overlay = this.page.locator('.feed-alert-popup-overlay');
      if (await overlay.isVisible({ timeout: 500 })) {
        const dismissBtn = this.page.locator('.feed-alert-popup .dismiss-btn, .feed-alert-popup .close-btn');
        if (await dismissBtn.first().isVisible({ timeout: 300 })) {
          await dismissBtn.first().click();
          await this.page.waitForTimeout(300);
        }
      }
    } catch {
      // No popup to dismiss
    }
  }

  /**
   * Check if an error message is visible
   */
  async hasError(): Promise<boolean> {
    return this.errorAlert.isVisible();
  }

  /**
   * Get error message text
   */
  async getErrorMessage(): Promise<string> {
    if (await this.hasError()) {
      return this.errorAlert.first().textContent() ?? '';
    }
    return '';
  }

  /**
   * Check if success message is visible
   */
  async hasSuccess(): Promise<boolean> {
    return this.successAlert.isVisible();
  }

  /**
   * Get success message text
   */
  async getSuccessMessage(): Promise<string> {
    if (await this.hasSuccess()) {
      return this.successAlert.first().textContent() ?? '';
    }
    return '';
  }

  /**
   * Wait for success message to appear
   */
  async expectSuccess(messagePattern?: string | RegExp) {
    await expect(this.successAlert.first()).toBeVisible({ timeout: 10000 });
    if (messagePattern) {
      if (typeof messagePattern === 'string') {
        await expect(this.successAlert.first()).toContainText(messagePattern);
      } else {
        await expect(this.successAlert.first()).toHaveText(messagePattern);
      }
    }
  }

  /**
   * Wait for error message to appear
   */
  async expectError(messagePattern?: string | RegExp) {
    await expect(this.errorAlert.first()).toBeVisible({ timeout: 10000 });
    if (messagePattern) {
      if (typeof messagePattern === 'string') {
        await expect(this.errorAlert.first()).toContainText(messagePattern);
      } else {
        await expect(this.errorAlert.first()).toHaveText(messagePattern);
      }
    }
  }

  /**
   * Click a button by text
   */
  async clickButton(text: string) {
    const button = this.page.locator(`button:has-text("${text}")`).first();
    await button.click();
  }

  /**
   * Click a link by text
   */
  async clickLink(text: string) {
    const link = this.page.locator(`a:has-text("${text}")`).first();
    await link.click();
  }

  /**
   * Wait for a heading to appear
   */
  async expectHeading(text: string) {
    const heading = this.page.locator(`h1:has-text("${text}"), h2:has-text("${text}"), h3:has-text("${text}")`).first();
    await expect(heading).toBeVisible({ timeout: 10000 });
  }

  /**
   * Take a screenshot for debugging
   */
  async screenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}
