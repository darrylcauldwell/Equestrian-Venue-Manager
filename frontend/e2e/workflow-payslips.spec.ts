import { test, expect, waitForPageReady, dismissPopups } from './fixtures';
import { navigateToAdmin } from './helpers/navigation';
import { waitForModal, closeModal, clickModalButton } from './helpers/modals';
import path from 'path';
import fs from 'fs';

// Create a minimal test PDF file for upload tests
const TEST_PDF_DIR = path.join(__dirname, '..', 'test-assets');
const TEST_PDF_PATH = path.join(TEST_PDF_DIR, 'test-payslip.pdf');
const TEST_TXT_PATH = path.join(TEST_PDF_DIR, 'not-a-pdf.txt');

test.beforeAll(async () => {
  // Ensure test assets directory exists
  if (!fs.existsSync(TEST_PDF_DIR)) {
    fs.mkdirSync(TEST_PDF_DIR, { recursive: true });
  }

  // Create a minimal valid PDF for upload tests
  const pdfContent = Buffer.from(
    '%PDF-1.4\n1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj\n' +
    '2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj\n' +
    '3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj\n' +
    'xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n' +
    '0000000058 00000 n \n0000000115 00000 n \n' +
    'trailer <</Size 4 /Root 1 0 R>>\nstartxref\n190\n%%EOF\n'
  );
  fs.writeFileSync(TEST_PDF_PATH, pdfContent);

  // Create a non-PDF file for rejection tests
  fs.writeFileSync(TEST_TXT_PATH, 'This is not a PDF');
});

test.afterAll(async () => {
  // Clean up test assets
  if (fs.existsSync(TEST_PDF_PATH)) fs.unlinkSync(TEST_PDF_PATH);
  if (fs.existsSync(TEST_TXT_PATH)) fs.unlinkSync(TEST_TXT_PATH);
  if (fs.existsSync(TEST_PDF_DIR)) {
    try { fs.rmdirSync(TEST_PDF_DIR); } catch { /* dir not empty or doesn't exist */ }
  }
});

test.describe('Payslip Workflow', () => {

  test.describe('Step 1: Staff My Payslips Page', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('staff');
      await dismissPopups(page);
    });

    test('staff can access my payslips page', async ({ page }) => {
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Should see the My Payslips heading
      await expect(page.locator('h1').filter({ hasText: /payslip/i }).first()).toBeVisible();
    });

    test('staff can see their seeded payslips', async ({ page }) => {
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Should see payslip cards (seeded data includes Oct, Nov 2025 monthly + annual summary)
      const payslipCards = page.locator('.payslip-card');
      const cardCount = await payslipCards.count();
      expect(cardCount).toBeGreaterThan(0);
    });

    test('staff can see year selector when payslips exist', async ({ page }) => {
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Year selector should be visible
      const yearSelector = page.locator('.year-selector select, .year-selector .ds-input');
      await expect(yearSelector).toBeVisible();
    });

    test('staff can see monthly payslips section', async ({ page }) => {
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Should see "Monthly Payslips" heading
      await expect(page.locator('h2').filter({ hasText: /monthly payslip/i }).first()).toBeVisible();
    });

    test('staff can see annual summary section when available', async ({ page }) => {
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Should see "Annual Summary" heading (seeded data includes a P60)
      await expect(page.locator('h2').filter({ hasText: /annual summary/i }).first()).toBeVisible();
    });

    test('staff payslip cards have download buttons', async ({ page }) => {
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Each payslip card should have a download button
      const downloadButtons = page.locator('.payslip-card .ds-btn');
      const buttonCount = await downloadButtons.count();
      expect(buttonCount).toBeGreaterThan(0);

      // First download button should be visible
      await expect(downloadButtons.first()).toBeVisible();
      await expect(downloadButtons.first()).toContainText(/download/i);
    });

    test('staff payslip cards show month names', async ({ page }) => {
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Should display month names like "October 2025", "November 2025"
      const monthlySection = page.locator('.payslip-section').filter({ hasText: /monthly/i });
      await expect(monthlySection).toBeVisible();

      // Check for at least one month name
      const hasMonthName = await page.locator('.payslip-title').filter({
        hasText: /january|february|march|april|may|june|july|august|september|october|november|december/i
      }).first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasMonthName).toBeTruthy();
    });
  });

  test.describe('Step 2: Admin Payslip Management', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('admin');
      await dismissPopups(page);
    });

    test('admin can access payroll tab with payslip section', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      // Should see "Payslip Documents" heading
      await expect(page.locator('h3').filter({ hasText: /payslip documents/i }).first()).toBeVisible();
    });

    test('admin can see upload payslip button', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      // Should see "Upload Payslip" button
      const uploadBtn = page.locator('button').filter({ hasText: /upload payslip/i });
      await expect(uploadBtn).toBeVisible();
    });

    test('admin can see seeded payslips in table', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      // The payslip documents section should have table rows
      const payslipSection = page.locator('.payslip-documents-section');
      await expect(payslipSection).toBeVisible();

      const tableRows = payslipSection.locator('tbody tr');
      const rowCount = await tableRows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test('admin payslip table shows staff name, type, and period', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      const payslipSection = page.locator('.payslip-documents-section');
      const firstRow = payslipSection.locator('tbody tr').first();

      // Should have staff name
      await expect(firstRow.locator('td').first()).not.toBeEmpty();

      // Table headers should include Staff, Type, Period
      const headers = payslipSection.locator('thead th');
      await expect(headers.filter({ hasText: /staff/i }).first()).toBeVisible();
      await expect(headers.filter({ hasText: /type/i }).first()).toBeVisible();
      await expect(headers.filter({ hasText: /period/i }).first()).toBeVisible();
    });

    test('admin can open upload payslip modal', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      // Click "Upload Payslip" button
      const uploadBtn = page.locator('button').filter({ hasText: /upload payslip/i });
      await uploadBtn.click();

      // Modal should appear
      const modal = await waitForModal(page);
      await expect(modal).toBeVisible();

      // Modal should have required form fields
      await expect(page.locator('text=Staff Member')).toBeVisible();
      await expect(page.locator('text=Document Type')).toBeVisible();
      await expect(page.locator('text=Year')).toBeVisible();
      await expect(page.locator('text=PDF File')).toBeVisible();
    });

    test('admin can close upload payslip modal', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      // Open modal
      const uploadBtn = page.locator('button').filter({ hasText: /upload payslip/i });
      await uploadBtn.click();
      await waitForModal(page);

      // Close modal via Cancel button
      await clickModalButton(page, 'Cancel');
      await page.waitForTimeout(500);

      // Modal should be closed
      const modals = page.locator('.ds-modal:visible, .modal:visible');
      await expect(modals).toHaveCount(0, { timeout: 3000 });
    });

    test('admin upload modal shows month selector for monthly payslip type', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      // Open upload modal
      const uploadBtn = page.locator('button').filter({ hasText: /upload payslip/i });
      await uploadBtn.click();
      await waitForModal(page);

      // Default type is "Monthly Payslip" - month field should be visible
      await expect(page.locator('text=Month')).toBeVisible();

      // Switch to "Annual Summary" - month field should hide
      const typeSelect = page.locator('.ds-modal select').filter({ has: page.locator('option[value="annual_summary"]') });
      await typeSelect.selectOption('annual_summary');
      await page.waitForTimeout(300);

      // Month label should no longer be visible (the FormGroup is conditionally rendered)
      const monthLabel = page.locator('.ds-modal').locator('label').filter({ hasText: /^Month$/ });
      await expect(monthLabel).toHaveCount(0);

      // Close modal
      await clickModalButton(page, 'Cancel');
    });

    test('admin payslip table rows have download and delete buttons', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      const payslipSection = page.locator('.payslip-documents-section');
      const firstRow = payslipSection.locator('tbody tr').first();

      // Should have Download button
      await expect(firstRow.locator('button').filter({ hasText: /download/i })).toBeVisible();

      // Should have Delete button
      await expect(firstRow.locator('button').filter({ hasText: /delete/i })).toBeVisible();
    });

    test('admin can upload a new payslip PDF', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      // Count existing payslips
      const payslipSection = page.locator('.payslip-documents-section');
      const initialRows = await payslipSection.locator('tbody tr').count();

      // Open upload modal
      const uploadBtn = page.locator('button').filter({ hasText: /upload payslip/i });
      await uploadBtn.click();
      await waitForModal(page);

      // Fill form - select staff member (first non-default option)
      const staffSelect = page.locator('.ds-modal select').first();
      const staffOptions = await staffSelect.locator('option').all();
      // Select the first staff member (skip "Select staff..." placeholder)
      if (staffOptions.length > 1) {
        await staffSelect.selectOption({ index: 1 });
      }

      // Set document type to monthly payslip (default)
      // Set year to 2025
      const yearInput = page.locator('.ds-modal input[type="number"]');
      await yearInput.fill('2025');

      // Set month to January (a month not used by seed data)
      const monthSelect = page.locator('.ds-modal select').filter({ has: page.locator('option:has-text("January")') });
      await monthSelect.selectOption('1');

      // Upload PDF file
      const fileInput = page.locator('.ds-modal input[type="file"]');
      await fileInput.setInputFiles(TEST_PDF_PATH);

      // Add optional notes
      const notesField = page.locator('.ds-modal textarea');
      if (await notesField.isVisible({ timeout: 1000 }).catch(() => false)) {
        await notesField.fill('E2E test payslip upload');
      }

      // Click Upload button
      await clickModalButton(page, 'Upload');

      // Wait for modal to close and table to update
      await page.waitForTimeout(2000);

      // Verify new payslip appears in table
      const updatedRows = await payslipSection.locator('tbody tr').count();
      expect(updatedRows).toBeGreaterThan(initialRows);
    });

    test('admin can delete a payslip', async ({ page }) => {
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      const payslipSection = page.locator('.payslip-documents-section');
      const initialRows = await payslipSection.locator('tbody tr').count();

      if (initialRows > 0) {
        // Click delete on the last row (to delete the one we just uploaded)
        const lastRow = payslipSection.locator('tbody tr').last();
        const deleteBtn = lastRow.locator('button').filter({ hasText: /delete/i });
        await deleteBtn.click();

        // Confirmation modal should appear
        const confirmModal = await waitForModal(page);
        await expect(confirmModal).toBeVisible();

        // Confirm deletion
        const confirmBtn = page.locator('.ds-modal button').filter({ hasText: /delete|confirm|yes/i });
        await confirmBtn.click();

        // Wait for deletion
        await page.waitForTimeout(2000);

        // Table should have one fewer row
        const updatedRows = await payslipSection.locator('tbody tr').count();
        expect(updatedRows).toBeLessThan(initialRows);
      }
    });
  });

  test.describe('Step 3: Access Control', () => {
    test('staff cannot access admin staff management', async ({ loginAs, page }) => {
      await loginAs('staff');
      await page.goto('/book/admin/staff?tab=payroll');
      await waitForPageReady(page);

      // Staff should be redirected away from admin pages
      const url = page.url();
      expect(url.includes('/admin/staff')).toBeFalsy();
    });

    test('livery user cannot access my payslips page', async ({ loginAs, page }) => {
      await loginAs('livery');
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Livery users don't have staff role - should be redirected
      const url = page.url();
      const isOnPayslips = url.includes('/my-payslips');
      const accessDenied = await page.locator('text=/access denied|not authorized|permission/i')
        .isVisible({ timeout: 1000 }).catch(() => false);

      expect(!isOnPayslips || accessDenied).toBeTruthy();
    });

    test('coach cannot access my payslips page', async ({ loginAs, page }) => {
      await loginAs('coach');
      await page.goto('/book/my-payslips');
      await waitForPageReady(page);

      // Coach users don't have staff role - should be redirected
      const url = page.url();
      const isOnPayslips = url.includes('/my-payslips');
      const accessDenied = await page.locator('text=/access denied|not authorized|permission/i')
        .isVisible({ timeout: 1000 }).catch(() => false);

      expect(!isOnPayslips || accessDenied).toBeTruthy();
    });
  });

  test.describe('Step 4: Navigation', () => {
    test('staff can navigate to my payslips from menu', async ({ loginAs, page }) => {
      await loginAs('staff');
      await page.goto('/book/tasks');
      await waitForPageReady(page);

      // Open hamburger menu
      const hamburgerBtn = page.locator('.hamburger-btn');
      await hamburgerBtn.click();
      await page.waitForTimeout(300);

      // Open "My Administration" dropdown
      const adminDropdown = page.locator('button.nav-dropdown-trigger').filter({ hasText: /my administration/i });
      if (await adminDropdown.isVisible({ timeout: 2000 }).catch(() => false)) {
        await adminDropdown.click();
        await page.waitForTimeout(300);
      }

      // Click "My Payslips" link
      const payslipsLink = page.locator('nav a').filter({ hasText: /my payslips/i });
      await expect(payslipsLink).toBeVisible({ timeout: 3000 });
      await payslipsLink.click();

      // Should navigate to my-payslips page
      await waitForPageReady(page);
      await expect(page).toHaveURL(/\/book\/my-payslips/);
    });

    test('admin can navigate to payroll tab', async ({ loginAs, page }) => {
      await loginAs('admin');
      await page.goto('/book/admin/staff');
      await waitForPageReady(page);

      // Click Payroll tab
      const payrollTab = page.locator('button').filter({ hasText: /payroll/i }).first();
      await payrollTab.click();
      await page.waitForTimeout(500);

      // Should see payslip documents section
      await expect(page.locator('.payslip-documents-section')).toBeVisible();
    });
  });
});
