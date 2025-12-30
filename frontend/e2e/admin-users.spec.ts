import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

test.describe('Admin User Management', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin');
  });

  test('can view user list', async ({ page }) => {
    await page.goto('/book/admin/users');
    // Should see a table with users
    await expect(page.locator('table.admin-table')).toBeVisible();
  });

  test('can see add user button', async ({ page }) => {
    await page.goto('/book/admin/users');
    await expect(page.locator('button').filter({ hasText: /add user/i })).toBeVisible();
  });

  test('can open add user form', async ({ page }) => {
    await page.goto('/book/admin/users');
    await page.click('button:has-text("Add User")');
    // Form should appear
    await expect(page.locator('form.admin-form')).toBeVisible();
    await expect(page.locator('input#username')).toBeVisible();
    await expect(page.locator('input#name')).toBeVisible();
  });

  test('can see role dropdown for users', async ({ page }) => {
    await page.goto('/book/admin/users');
    // Role select should be in the table
    await expect(page.locator('select.role-select').first()).toBeVisible();
  });

  test('can see reset password button for other users', async ({ page }) => {
    await page.goto('/book/admin/users');
    // Button text is "Reset PW"
    await expect(page.locator('button').filter({ hasText: /reset pw/i }).first()).toBeVisible();
  });

  test('can see status dropdown for other users', async ({ page }) => {
    await page.goto('/book/admin/users');
    // Status is controlled by a select, not a button
    await expect(page.locator('select.status-select').first()).toBeVisible();
  });

  test('shows user status badges', async ({ page }) => {
    await page.goto('/book/admin/users');
    // Should show active badges
    await expect(page.locator('.badge').first()).toBeVisible();
  });

  test('shows current user indicator', async ({ page }) => {
    await page.goto('/book/admin/users');
    // Should show "You" for current user row
    await expect(page.locator('text=You')).toBeVisible();
  });
});
