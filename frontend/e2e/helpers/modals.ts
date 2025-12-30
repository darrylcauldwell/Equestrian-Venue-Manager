/**
 * E2E Modal Helpers
 * Common modal interaction patterns for Playwright tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Wait for a modal to appear
 */
export async function waitForModal(page: Page, timeout: number = 5000) {
  // Try various modal selectors
  const modalSelectors = [
    '.modal',
    '.ds-modal',
    '[role="dialog"]',
    '.modal-overlay .modal',
    '.ds-modal-overlay .ds-modal',
  ];

  for (const selector of modalSelectors) {
    const modal = page.locator(selector).first();
    try {
      await expect(modal).toBeVisible({ timeout: timeout / modalSelectors.length });
      return modal;
    } catch {
      continue;
    }
  }

  throw new Error('No modal found within timeout');
}

/**
 * Wait for a modal with specific title
 */
export async function waitForModalWithTitle(page: Page, title: string, timeout: number = 5000) {
  const modal = page.locator(`.modal:has-text("${title}"), .ds-modal:has-text("${title}"), [role="dialog"]:has-text("${title}")`).first();
  await expect(modal).toBeVisible({ timeout });
  return modal;
}

/**
 * Close the currently open modal
 */
export async function closeModal(page: Page) {
  // Try various close button selectors - include both .modal and .ds-modal
  const closeSelectors = [
    '.modal-close',
    '.ds-modal-close',
    '[aria-label="Close modal"]',
    '[aria-label="Close"]',
    '.ds-modal button:has-text("×")',
    '.ds-modal button:has-text("Close")',
    '.ds-modal button:has-text("Cancel")',
    '.modal button:has-text("×")',
    '.modal button:has-text("Close")',
    '.modal button:has-text("Cancel")',
  ];

  for (const selector of closeSelectors) {
    const closeBtn = page.locator(selector).first();
    if (await closeBtn.isVisible({ timeout: 500 })) {
      await closeBtn.click();
      await page.waitForTimeout(300);
      return;
    }
  }

  // If no close button found, try clicking overlay to close
  const overlay = page.locator('.modal-overlay, .ds-modal-overlay').first();
  if (await overlay.isVisible({ timeout: 500 })) {
    // Click the overlay (not the modal content)
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);
  }
}

/**
 * Click a button within a modal
 */
export async function clickModalButton(page: Page, buttonText: string) {
  const modalButton = page.locator(`.modal button:has-text("${buttonText}"), .ds-modal button:has-text("${buttonText}"), [role="dialog"] button:has-text("${buttonText}")`).first();
  await expect(modalButton).toBeVisible({ timeout: 3000 });
  await modalButton.click();
}

/**
 * Expect modal to be closed
 */
export async function expectModalClosed(page: Page) {
  const modals = page.locator('.modal:visible, .ds-modal:visible, [role="dialog"]:visible');
  await expect(modals).toHaveCount(0, { timeout: 3000 });
}

/**
 * Confirm a confirmation modal
 */
export async function confirmModal(page: Page, confirmText: string = 'Confirm') {
  await clickModalButton(page, confirmText);
  await page.waitForLoadState('domcontentloaded');
}

/**
 * Cancel a confirmation modal
 */
export async function cancelModal(page: Page, cancelText: string = 'Cancel') {
  await clickModalButton(page, cancelText);
  await page.waitForTimeout(300);
}

/**
 * Wait for modal to contain specific text
 */
export async function expectModalContains(page: Page, text: string | RegExp) {
  const modal = await waitForModal(page);
  await expect(modal).toContainText(text);
}

/**
 * Click a tab within a modal (for tabbed modals)
 */
export async function clickModalTab(page: Page, tabText: string) {
  const tab = page.locator(`.modal .tab-btn:has-text("${tabText}"), .ds-modal .ds-modal-tab:has-text("${tabText}"), [role="dialog"] [role="tab"]:has-text("${tabText}")`).first();
  await tab.click();
  await page.waitForTimeout(300);
}
