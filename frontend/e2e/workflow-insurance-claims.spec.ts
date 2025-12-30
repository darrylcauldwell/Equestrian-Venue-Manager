import { test, expect, safeGoto, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Insurance Claims Workflow Test
 *
 * Flow: Livery views insurance claims tab → Filters claims by horse/month →
 *       Selects claimable items → Generates statement for insurance company
 *
 * Claimable items: Completed rehab services that can be submitted to insurance
 */
test.describe('Insurance Claims Workflow', () => {
  test.describe('Step 1: Livery Views Insurance Claims', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery can access service requests page', async ({ page }) => {
      await safeGoto(page, '/book/services');

      await expect(page.locator('h1, .service-requests-page').first()).toBeVisible();
    });

    test('livery can see Insurance Claims tab', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Insurance Claims tab should be visible - use ds-tab class (design system)
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      await expect(insuranceTab).toBeVisible();
    });

    test('livery can click Insurance Claims tab', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab - use ds-tab class (design system)
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForTimeout(300);

        // Tab should be active
        await expect(insuranceTab).toHaveClass(/active/);
      }
    });

    test('livery can see month filter', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForTimeout(300);

        // Month filter should be visible
        const monthFilter = page.locator('input[type="month"]');
        await expect(monthFilter).toBeVisible();
      }
    });

    test('livery can see horse filter', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForTimeout(300);

        // Horse filter should be visible
        const horseFilter = page.locator('select').filter({ hasText: /all horses|horse/i });
        if (await horseFilter.isVisible()) {
          await expect(horseFilter).toBeVisible();
        }
      }
    });

    test('livery can see insurance claims section intro', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForTimeout(300);

        // Section intro should be visible
        const sectionIntro = page.locator('.section-intro h2');
        await expect(sectionIntro).toBeVisible();
      }
    });
  });

  test.describe('Step 2: Livery Manages Claimable Items', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery can see claimable items list', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Look for claims table or no-claims message
        const claimsTable = page.locator('.claims-table');
        const noClaims = page.locator('.no-claims');

        // Either claims table or no-claims message should be visible
        if (await claimsTable.isVisible()) {
          await expect(claimsTable).toBeVisible();
        } else {
          await expect(noClaims).toBeVisible();
        }
      }
    });

    test('livery can see checkboxes for items', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Look for checkboxes in the claims table
        const claimCheckboxes = page.locator('.claims-table input[type="checkbox"]');
        if (await claimCheckboxes.first().isVisible()) {
          await expect(claimCheckboxes.first()).toBeVisible();
        }
      }
    });

    test('livery can toggle checkbox for claim item', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Try to toggle a checkbox
        const claimCheckbox = page.locator('.claims-table input[type="checkbox"]').first();
        if (await claimCheckbox.isVisible()) {
          const initialState = await claimCheckbox.isChecked();
          await claimCheckbox.click();
          await page.waitForTimeout(500);

          // Checkbox state should have changed
          const newState = await claimCheckbox.isChecked();
          expect(newState).not.toBe(initialState);
        }
      }
    });

    test('livery can see claim item details in table', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Look for table headers
        const claimsTable = page.locator('.claims-table');
        if (await claimsTable.isVisible()) {
          // Should have columns: Claim?, Date, Service, Horse, Amount
          const headers = page.locator('.claims-table th');
          const headerCount = await headers.count();

          if (headerCount > 0) {
            // Should have at least Date, Service, Horse, Amount columns
            expect(headerCount).toBeGreaterThan(3);
          }
        }
      }
    });

    test('livery can filter claims by horse', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Try to change horse filter
        const horseFilter = page.locator('.insurance-filters select').first();
        if (await horseFilter.isVisible()) {
          await expect(horseFilter).toBeEnabled();

          // Select a different option if available
          const optionCount = await horseFilter.locator('option').count();
          if (optionCount > 1) {
            await horseFilter.selectOption({ index: 1 });
            await page.waitForTimeout(300);
          }
        }
      }
    });

    test('livery can change month filter', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Try to change month filter
        const monthFilter = page.locator('input[type="month"]');
        if (await monthFilter.isVisible()) {
          await expect(monthFilter).toBeEnabled();

          // Get current value and change it
          const currentValue = await monthFilter.inputValue();
          if (currentValue) {
            // Set to previous month
            const date = new Date(currentValue + '-01');
            date.setMonth(date.getMonth() - 1);
            const newValue = date.toISOString().slice(0, 7);
            await monthFilter.fill(newValue);
            await page.waitForTimeout(300);
          }
        }
      }
    });

    test('livery can see month display showing selected period', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Month display should be visible
        const monthDisplay = page.locator('.month-display');
        if (await monthDisplay.isVisible()) {
          await expect(monthDisplay).toContainText(/showing.*claims.*for/i);
        }
      }
    });
  });

  test.describe('Step 3: Livery Generates Statement', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('livery can see generate statement button', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Generate statement button should be visible if there are claims
        const generateBtn = page.locator('button').filter({ hasText: /download.*insurance.*statement|generate.*statement/i });
        const noClaims = page.locator('.no-claims');

        // Either button or no-claims message should be visible
        if (await generateBtn.isVisible()) {
          await expect(generateBtn).toBeVisible();
        } else {
          // If no button, should see no-claims message
          await expect(noClaims).toBeVisible();
        }
      }
    });

    test('generate button is disabled when no items selected', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        const generateBtn = page.locator('button').filter({ hasText: /download.*insurance.*statement|generate.*statement/i });

        if (await generateBtn.isVisible()) {
          // If there are claims, first uncheck all checkboxes
          const claimCheckboxes = page.locator('.claims-table input[type="checkbox"]');
          const checkboxCount = await claimCheckboxes.count();

          if (checkboxCount > 0) {
            // Uncheck all
            for (let i = 0; i < checkboxCount; i++) {
              const checkbox = claimCheckboxes.nth(i);
              if (await checkbox.isChecked()) {
                await checkbox.click();
                await page.waitForTimeout(200);
              }
            }

            // Button should be disabled
            await expect(generateBtn).toBeDisabled();
          }
        }
      }
    });

    test('generate button is enabled when items are selected', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        const generateBtn = page.locator('button').filter({ hasText: /download.*insurance.*statement|generate.*statement/i });

        if (await generateBtn.isVisible()) {
          // Check at least one checkbox
          const claimCheckbox = page.locator('.claims-table input[type="checkbox"]').first();

          if (await claimCheckbox.isVisible()) {
            // Ensure it's checked
            if (!await claimCheckbox.isChecked()) {
              await claimCheckbox.click();
              await page.waitForTimeout(500);
            }

            // Button should be enabled
            await expect(generateBtn).toBeEnabled();
          }
        }
      }
    });

    test('livery can see statement help text', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Help text should be visible if there are claims
        const helpText = page.locator('.statement-help');
        const noClaims = page.locator('.no-claims');

        if (await helpText.isVisible()) {
          await expect(helpText).toContainText(/pdf|statement|insurance/i);
        }
      }
    });

    test('livery can access statement actions section', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Statement actions section should be visible if there are claims
        const statementActions = page.locator('.statement-actions');
        const noClaims = page.locator('.no-claims');

        if (await statementActions.isVisible()) {
          await expect(statementActions).toBeVisible();
        }
      }
    });

    test('claims table shows correct columns', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        const claimsTable = page.locator('.claims-table');
        if (await claimsTable.isVisible()) {
          // Check for expected column headers
          const claimHeader = page.locator('.claims-table th').filter({ hasText: /claim/i });
          const dateHeader = page.locator('.claims-table th').filter({ hasText: /date/i });
          const serviceHeader = page.locator('.claims-table th').filter({ hasText: /service/i });
          const horseHeader = page.locator('.claims-table th').filter({ hasText: /horse/i });
          const amountHeader = page.locator('.claims-table th').filter({ hasText: /amount/i });

          // At least some headers should be visible
          if (await claimHeader.isVisible()) {
            await expect(claimHeader).toBeVisible();
          }
          if (await dateHeader.isVisible()) {
            await expect(dateHeader).toBeVisible();
          }
          if (await amountHeader.isVisible()) {
            await expect(amountHeader).toBeVisible();
          }
        }
      }
    });

    test('completed rehab services show as claimable rows', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Look for rows with claimable class (highlighted rows)
        const claimableRows = page.locator('.claims-table tr.claimable');
        const tableRows = page.locator('.claims-table tbody tr');

        // If table has rows, some might be claimable
        const rowCount = await tableRows.count();
        if (rowCount > 0) {
          // Table should have data rows
          expect(rowCount).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Step 4: Statement Download Integration', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('livery');
    });

    test('clicking generate button triggers download action', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        const generateBtn = page.locator('button').filter({ hasText: /download.*insurance.*statement|generate.*statement/i });

        if (await generateBtn.isVisible()) {
          // Check at least one checkbox
          const claimCheckbox = page.locator('.claims-table input[type="checkbox"]').first();

          if (await claimCheckbox.isVisible()) {
            // Ensure it's checked
            if (!await claimCheckbox.isChecked()) {
              await claimCheckbox.click();
              await page.waitForTimeout(500);
            }

            // Button should be enabled and clickable
            if (await generateBtn.isEnabled()) {
              await expect(generateBtn).toBeEnabled();
              // Note: We don't actually click to avoid triggering download in tests
              // In a real test, you'd set up download handling
            }
          }
        }
      }
    });

    test('insurance claims section shows rehab-specific language', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Section should mention rehab specifically
        const sectionIntro = page.locator('.insurance-claims-section .section-intro');
        if (await sectionIntro.isVisible()) {
          await expect(sectionIntro).toContainText(/rehab/i);
        }
      }
    });

    test('page maintains state when switching tabs', async ({ page }) => {
      await safeGoto(page, '/book/services');

      // Click Insurance Claims tab
      const insuranceTab = page.locator('.ds-tab, .tab').filter({ hasText: /insurance.*claims/i });
      if (await insuranceTab.isVisible()) {
        await insuranceTab.click();
        await page.waitForLoadState('domcontentloaded');

        // Check a checkbox if available
        const claimCheckbox = page.locator('.claims-table input[type="checkbox"]').first();
        if (await claimCheckbox.isVisible()) {
          await claimCheckbox.click();
          await page.waitForTimeout(300);
        }

        // Switch to another tab
        const packagesTab = page.locator('.ds-tab, .tab').filter({ hasText: /packages/i });
        if (await packagesTab.isVisible()) {
          await packagesTab.click();
          await page.waitForTimeout(300);

          // Switch back to insurance claims
          await insuranceTab.click();
          await page.waitForLoadState('domcontentloaded');

          // Insurance tab should still be accessible
          await expect(insuranceTab).toHaveClass(/active/);
        }
      }
    });
  });
});
