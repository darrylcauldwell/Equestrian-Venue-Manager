import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Login Page Object
 */
export class LoginPage extends BasePage {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly registerLink: Locator;
  readonly forgotPasswordLink: Locator;

  constructor(page: Page) {
    super(page);
    this.usernameInput = page.locator('#username');
    this.passwordInput = page.locator('#password');
    this.submitButton = page.locator('button[type="submit"]');
    this.registerLink = page.locator('a:has-text("Register")');
    this.forgotPasswordLink = page.locator('a:has-text("Forgot")');
  }

  /**
   * Navigate to login page
   */
  async goto() {
    await super.goto('/login');
  }

  /**
   * Fill login form
   */
  async fillCredentials(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /**
   * Submit login form
   */
  async submit() {
    await this.submitButton.click();
  }

  /**
   * Perform complete login
   */
  async login(username: string, password: string) {
    await this.fillCredentials(username, password);
    await this.submit();
    // Wait for navigation after successful login
    await this.page.waitForURL(/\/(dashboard|book|admin)?$/, { timeout: 10000 });
    await this.waitForPageReady();
  }

  /**
   * Attempt login expecting failure
   */
  async loginExpectingError(username: string, password: string) {
    await this.fillCredentials(username, password);
    await this.submit();
    await this.expectError();
  }

  /**
   * Check if currently on login page
   */
  async isOnLoginPage(): Promise<boolean> {
    return this.page.url().includes('/login');
  }
}
