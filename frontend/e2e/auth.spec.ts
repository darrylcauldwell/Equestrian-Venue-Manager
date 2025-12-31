import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Authentication', () => {
  test.describe('Login', () => {
    test('should show login page', async ({ page }) => {
      await page.goto('/login');
      await expect(page.locator('h1, h2').filter({ hasText: /login|sign in/i })).toBeVisible();
      await expect(page.locator('#username')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
    });

    test('should login successfully as admin', async ({ page, loginAs }) => {
      await loginAs('admin');
      // After login, admin users are redirected - verify we're not on login
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).toHaveURL(/\/(dashboard|admin|book)/);
    });

    test('should login successfully as livery', async ({ page, loginAs }) => {
      await loginAs('livery');
      // After login, livery users are redirected to /book or a subpage - verify we're not on login
      await expect(page).not.toHaveURL(/\/login/);
      await expect(page).toHaveURL(/\/(dashboard|book)/);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/login');
      await page.fill('#username', 'nonexistent');
      await page.fill('#password', 'wrongpassword');
      await page.click('button[type="submit"]');
      await expect(page.locator('.auth-error')).toBeVisible();
    });

    test('should logout successfully', async ({ page, loginAs, logout }) => {
      await loginAs('livery');
      await logout();
      // After logout, user is redirected to home - verify we're not on a protected page
      // The URL should end with / or /book or contain /login
      await expect(page).toHaveURL(/\/$|\/book$|\/login/);
    });
  });

  test.describe('Registration', () => {
    test('should show registration page', async ({ page }) => {
      await page.goto('/register');
      await expect(page.locator('h1, h2').filter({ hasText: /register|sign up|create account/i })).toBeVisible();
    });

    test('should require all fields', async ({ page }) => {
      await page.goto('/register');
      await page.click('button[type="submit"]');
      // Form should show validation errors - at least one required field should be invalid
      const invalidCount = await page.locator(':invalid').count();
      expect(invalidCount).toBeGreaterThanOrEqual(1);
    });
  });
});
