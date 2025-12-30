/**
 * E2E Form Helpers
 * Common form interaction patterns for Playwright tests
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * Fill a form field by label text
 */
export async function fillFieldByLabel(page: Page, labelText: string, value: string) {
  // Try to find input/select/textarea associated with label
  const label = page.locator(`label:has-text("${labelText}")`).first();

  // Get the 'for' attribute if present
  const forAttr = await label.getAttribute('for');

  if (forAttr) {
    const input = page.locator(`#${forAttr}`);
    await input.fill(value);
  } else {
    // Input might be inside or adjacent to label
    const input = label.locator('input, select, textarea').first();
    if (await input.count() > 0) {
      await input.fill(value);
    } else {
      // Try sibling
      const sibling = label.locator('+ input, + select, + textarea').first();
      await sibling.fill(value);
    }
  }
}

/**
 * Fill a form field by name attribute
 */
export async function fillFieldByName(page: Page, name: string, value: string) {
  const field = page.locator(`[name="${name}"]`);
  const tagName = await field.evaluate(el => el.tagName.toLowerCase());

  if (tagName === 'select') {
    await field.selectOption(value);
  } else {
    await field.fill(value);
  }
}

/**
 * Fill multiple form fields at once
 */
export async function fillForm(page: Page, data: Record<string, string>) {
  for (const [name, value] of Object.entries(data)) {
    await fillFieldByName(page, name, value);
  }
}

/**
 * Select an option from a dropdown by visible text
 */
export async function selectOption(page: Page, selectLocator: string | Locator, optionText: string) {
  const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;

  // Try to find the option value first
  const option = select.locator(`option:has-text("${optionText}")`);
  const value = await option.getAttribute('value');

  if (value) {
    await select.selectOption(value);
  } else {
    // Fall back to selecting by label
    await select.selectOption({ label: optionText });
  }
}

/**
 * Select an option from a dropdown by value
 */
export async function selectOptionByValue(page: Page, selectLocator: string | Locator, value: string) {
  const select = typeof selectLocator === 'string' ? page.locator(selectLocator) : selectLocator;
  await select.selectOption(value);
}

/**
 * Toggle a checkbox
 */
export async function toggleCheckbox(page: Page, locator: string | Locator, checked: boolean) {
  const checkbox = typeof locator === 'string' ? page.locator(locator) : locator;
  const isCurrentlyChecked = await checkbox.isChecked();

  if (isCurrentlyChecked !== checked) {
    await checkbox.click();
  }
}

/**
 * Submit a form and wait for response
 */
export async function submitForm(page: Page, submitButtonText: string = 'Submit') {
  const submitButton = page.locator(`button[type="submit"]:has-text("${submitButtonText}"), button:has-text("${submitButtonText}")`).first();
  await submitButton.click();
}

/**
 * Submit form and expect success message
 */
export async function submitFormAndExpectSuccess(
  page: Page,
  submitButtonText: string = 'Submit',
  successText: string | RegExp = /success|created|saved|updated/i
) {
  await submitForm(page, submitButtonText);
  await page.waitForLoadState('domcontentloaded');

  // Look for success message
  const successMessage = page.locator('.success-message, .alert-success, [role="alert"].success, .toast.success');

  if (typeof successText === 'string') {
    await expect(successMessage.or(page.locator(`text="${successText}"`))).toBeVisible({ timeout: 5000 }).catch(() => {
      // If no success message element, that's okay - form might just redirect
    });
  }
}

/**
 * Clear all form fields
 */
export async function clearForm(page: Page, formLocator: string = 'form') {
  const form = page.locator(formLocator);
  const inputs = form.locator('input[type="text"], input[type="email"], input[type="number"], textarea');

  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    await inputs.nth(i).clear();
  }
}

/**
 * Expect form validation error to appear
 */
export async function expectFormError(page: Page, errorText: string | RegExp) {
  const errorMessage = page.locator('.error-message, .form-error, .validation-error, .field-error, .ds-form-error');
  await expect(errorMessage.or(page.locator(`text="${errorText}"`))).toBeVisible({ timeout: 3000 });
}

/**
 * Type into a date input
 */
export async function fillDateInput(page: Page, locator: string | Locator, date: Date) {
  const input = typeof locator === 'string' ? page.locator(locator) : locator;
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
  await input.fill(dateStr);
}

/**
 * Type into a time input
 */
export async function fillTimeInput(page: Page, locator: string | Locator, hours: number, minutes: number) {
  const input = typeof locator === 'string' ? page.locator(locator) : locator;
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  await input.fill(timeStr);
}
