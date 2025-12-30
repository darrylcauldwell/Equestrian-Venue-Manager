/**
 * Page Object Models
 *
 * Usage:
 *   import { LoginPage, BookingPage } from './pages';
 *
 *   test('login flow', async ({ page }) => {
 *     const loginPage = new LoginPage(page);
 *     await loginPage.goto();
 *     await loginPage.login('admin', 'password');
 *   });
 */

export { BasePage } from './BasePage';
export { LoginPage } from './LoginPage';
export { BookingPage } from './BookingPage';
