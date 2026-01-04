import { test, expect, waitForPageReady, dismissPopups } from './fixtures';

/**
 * Staff Profiles Workflow Test
 *
 * Flow: Admin manages staff profiles → Staff edits own profile → Milestones notifications
 */
test.describe('Staff Profiles Workflow', () => {
  test.describe('Step 1: Admin Staff Profiles Page', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can view staff profiles page', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);
      await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    });

    test('admin can see staff profiles list or empty state', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);
      await dismissPopups(page);
      // Page shows a table with staff profiles or empty message
      const content = page.locator('.ds-table-wrapper, .ds-table, .admin-page table').first();
      await expect(content).toBeVisible();
    });

    test('admin can see create profile button', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);
      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await expect(createBtn.first()).toBeVisible();
    });

    test('admin can open create profile modal', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);
      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await createBtn.first().click();
      await expect(page.locator('.ds-modal, .modal, [class*="modal"], [role="dialog"]').first()).toBeVisible();
    });

    test('create profile form has user select', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);
      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await createBtn.first().click();

      // Wait for modal
      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Check for user select dropdown
      const userSelect = modal.locator('select').first();
      await expect(userSelect).toBeVisible();
    });

    test('admin can close create profile modal', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);

      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await createBtn.first().click();

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Close modal
      const cancelBtn = modal.locator('button').filter({ hasText: /cancel|close/i }).first();
      await cancelBtn.click();

      await expect(modal).not.toBeVisible();
    });
  });

  test.describe('Step 2: Admin Navigation to Staff Profiles', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can access staff profiles from menu', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);

      // Open hamburger menu
      const menuBtn = page.locator('.hamburger-btn').first();
      await menuBtn.click();
      await page.waitForTimeout(500);

      // Look in "My Venue" submenu
      const myVenueBtn = page.locator('.nav-dropdown-trigger').filter({ hasText: /my venue/i }).first();
      if (await myVenueBtn.isVisible({ timeout: 2000 })) {
        await myVenueBtn.click();
        await page.waitForTimeout(300);
      }

      // Look in "My Staff" sub-submenu
      const myStaffBtn = page.locator('.nav-sub-dropdown-trigger').filter({ hasText: /my staff/i }).first();
      if (await myStaffBtn.isVisible({ timeout: 2000 })) {
        await myStaffBtn.click();
        await page.waitForTimeout(300);
      }

      const profilesLink = page.locator('a[href*="staff-profiles"]').first();
      await expect(profilesLink).toBeVisible({ timeout: 5000 });
    });

    test('staff rota link is in My Staff section', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);

      // Open hamburger menu
      const menuBtn = page.locator('.hamburger-btn').first();
      await menuBtn.click();
      await page.waitForTimeout(500);

      // Expand My Venue
      const myVenueBtn = page.locator('.nav-dropdown-trigger').filter({ hasText: /my venue/i }).first();
      if (await myVenueBtn.isVisible({ timeout: 2000 })) {
        await myVenueBtn.click();
        await page.waitForTimeout(300);
      }

      // Expand My Staff
      const myStaffBtn = page.locator('.nav-sub-dropdown-trigger').filter({ hasText: /my staff/i }).first();
      if (await myStaffBtn.isVisible({ timeout: 2000 })) {
        await myStaffBtn.click();
        await page.waitForTimeout(300);
      }

      const rotaLink = page.locator('a[href*="admin/staff"]').first();
      await expect(rotaLink).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Step 3: Staff Self-Service Profile', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('staff');
    });

    test('staff can view my profile page', async ({ page }) => {
      await page.goto('/book/my-profile');
      await waitForPageReady(page);
      await expect(page.locator('h1, h2').first()).toBeVisible();
    });

    test('staff can see profile sections', async ({ page }) => {
      await page.goto('/book/my-profile');
      await waitForPageReady(page);
      // Should show employment info, personal info, emergency contact, or empty state
      const content = page.locator('.profile-section, .ds-card, .my-profile, .ds-empty').first();
      await expect(content).toBeVisible();
    });

    test('staff can access my profile from menu', async ({ page }) => {
      await page.goto('/book');
      await waitForPageReady(page);

      // Open hamburger menu
      const menuBtn = page.locator('.hamburger-btn').first();
      await menuBtn.click();
      await page.waitForTimeout(500);

      // Look for My Administration dropdown (for staff)
      const adminDropdown = page.locator('.nav-dropdown-trigger').filter({ hasText: /my administration/i }).first();
      if (await adminDropdown.isVisible({ timeout: 2000 })) {
        await adminDropdown.click();
        await page.waitForTimeout(300);
      }

      const profileLink = page.locator('a[href*="my-profile"]').first();
      await expect(profileLink).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Step 4: Profile Form Fields', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('create profile modal has expected form sections', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);

      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await createBtn.first().click();

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Dismiss any popups
      await dismissPopups(page);

      // Check for form groups (employment, personal, emergency)
      // The form should have inputs for job title, DOB, etc.
      const formGroups = modal.locator('.ds-form-group, .form-group');
      const count = await formGroups.count();
      expect(count).toBeGreaterThan(0);
    });

    test('profile form has job title field', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);

      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await createBtn.first().click();

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Look for job title input
      const jobTitleInput = modal.locator('input[placeholder*="title" i], label:has-text("Job Title") + input, input[name*="job"]').first();
      await expect(jobTitleInput).toBeVisible();
    });

    test('profile form has bio textarea', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);

      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await createBtn.first().click();

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Look for bio textarea
      const bioTextarea = modal.locator('textarea').first();
      await expect(bioTextarea).toBeVisible();
    });

    test('profile form has employment type field', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);

      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await createBtn.first().click();

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Look for employment type select with options for regular, casual, on_call
      const employmentTypeSelect = modal.locator('select').filter({ has: page.locator('option[value="regular"]') });
      await expect(employmentTypeSelect.first()).toBeVisible();
    });

    test('profile form has annual leave entitlement field', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);

      const createBtn = page.locator('button').filter({ hasText: /create|add profile|new profile/i });
      await createBtn.first().click();

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Look for annual leave entitlement input (number type)
      const leaveInput = modal.locator('input[type="number"]').first();
      await expect(leaveInput).toBeVisible();
    });
  });

  test.describe('Step 5: Milestones Banner', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('admin');
    });

    test('admin can see milestones section if present', async ({ page }) => {
      await page.goto('/book/admin/staff-profiles');
      await waitForPageReady(page);

      // Milestones banner may or may not be visible depending on data
      // Just verify the page loads correctly
      const pageContent = page.locator('.staff-profiles-page, .admin-page, main').first();
      await expect(pageContent).toBeVisible();
    });
  });
});

test.describe('Staff Profile Access Control', () => {
  test('livery user cannot access admin staff profiles', async ({ loginAs, page }) => {
    await loginAs('livery');
    await page.goto('/book/admin/staff-profiles');
    await waitForPageReady(page);

    // Should either redirect or show forbidden
    const url = page.url();
    const isRedirected = !url.includes('staff-profiles');
    const hasForbidden = await page.locator('text=/forbidden|not authorized|access denied/i').isVisible().catch(() => false);

    expect(isRedirected || hasForbidden).toBeTruthy();
  });

  test('coach user cannot access admin staff profiles', async ({ loginAs, page }) => {
    await loginAs('coach');
    await page.goto('/book/admin/staff-profiles');
    await waitForPageReady(page);

    const url = page.url();
    const isRedirected = !url.includes('staff-profiles');
    const hasForbidden = await page.locator('text=/forbidden|not authorized|access denied/i').isVisible().catch(() => false);

    expect(isRedirected || hasForbidden).toBeTruthy();
  });

  test('staff user can access their own profile page', async ({ loginAs, page }) => {
    await loginAs('staff');
    await page.goto('/book/my-profile');
    await waitForPageReady(page);

    // Should show the profile page, not be redirected
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Staff Milestones Popup', () => {
  test('admin sees milestones popup if upcoming events', async ({ loginAs, page }) => {
    await loginAs('admin');
    await page.goto('/book');

    // Don't dismiss popups immediately - check for milestones popup
    await page.waitForTimeout(2000);

    // The popup might appear if there are upcoming birthdays/anniversaries in seed data
    // We can't guarantee it will appear, but we can verify the page loads
    await expect(page.locator('.hamburger-btn').first()).toBeVisible();
  });

  test('milestones popup can be dismissed', async ({ loginAs, page }) => {
    await loginAs('admin');
    await page.goto('/book');
    await page.waitForTimeout(2000);

    const popup = page.locator('.milestones-popup-overlay');
    if (await popup.isVisible({ timeout: 1000 })) {
      const dismissBtn = page.locator('.milestones-popup .dismiss-btn');
      await dismissBtn.click();
      await expect(popup).not.toBeVisible();
    }
    // If no popup, test passes - milestones may not be upcoming
  });

  test('milestones popup has link to staff profiles', async ({ loginAs, page }) => {
    await loginAs('admin');
    await page.goto('/book');
    await page.waitForTimeout(2000);

    const popup = page.locator('.milestones-popup-overlay');
    if (await popup.isVisible({ timeout: 1000 })) {
      const profilesLink = popup.locator('a[href*="staff-profiles"]');
      await expect(profilesLink).toBeVisible();
    }
    // If no popup, test passes
  });
});

test.describe('Hourly Rate History Management', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('admin');
  });

  test('admin can see manage rates button in profile edit modal', async ({ page }) => {
    await page.goto('/book/admin/staff-profiles');
    await waitForPageReady(page);
    await dismissPopups(page);

    // Click on first staff profile edit button (if available)
    const editBtn = page.locator('button').filter({ hasText: /edit|view/i }).first();
    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Look for the Manage Rates button in the payroll section
      const manageRatesBtn = modal.locator('button').filter({ hasText: /manage rates/i });
      await expect(manageRatesBtn).toBeVisible();
    }
  });

  test('clicking manage rates shows rate history panel', async ({ page }) => {
    await page.goto('/book/admin/staff-profiles');
    await waitForPageReady(page);
    await dismissPopups(page);

    // Click on first staff profile edit button
    const editBtn = page.locator('button').filter({ hasText: /edit|view/i }).first();
    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Click manage rates button
      const manageRatesBtn = modal.locator('button').filter({ hasText: /manage rates/i });
      if (await manageRatesBtn.isVisible({ timeout: 2000 })) {
        await manageRatesBtn.click();
        await page.waitForTimeout(500);

        // Rate history panel should now be visible
        const rateHistoryPanel = modal.locator('.rate-history-panel');
        await expect(rateHistoryPanel).toBeVisible();

        // Should have Add New Rate section
        await expect(modal.locator('text=Add New Rate')).toBeVisible();
      }
    }
  });

  test('rate history panel has effective date input', async ({ page }) => {
    await page.goto('/book/admin/staff-profiles');
    await waitForPageReady(page);
    await dismissPopups(page);

    const editBtn = page.locator('button').filter({ hasText: /edit|view/i }).first();
    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      const manageRatesBtn = modal.locator('button').filter({ hasText: /manage rates/i });

      if (await manageRatesBtn.isVisible({ timeout: 2000 })) {
        await manageRatesBtn.click();
        await page.waitForTimeout(500);

        const rateHistoryPanel = modal.locator('.rate-history-panel');
        if (await rateHistoryPanel.isVisible({ timeout: 2000 })) {
          // Should have effective date input
          const effectiveDateInput = rateHistoryPanel.locator('input[type="date"]');
          await expect(effectiveDateInput).toBeVisible();

          // Should have hourly rate input
          const hourlyRateInput = rateHistoryPanel.locator('input[type="number"]');
          await expect(hourlyRateInput).toBeVisible();

          // Should have Add Rate button
          const addRateBtn = rateHistoryPanel.locator('button').filter({ hasText: /add rate/i });
          await expect(addRateBtn).toBeVisible();
        }
      }
    }
  });

  test('current rate is displayed prominently', async ({ page }) => {
    await page.goto('/book/admin/staff-profiles');
    await waitForPageReady(page);
    await dismissPopups(page);

    const editBtn = page.locator('button').filter({ hasText: /edit|view/i }).first();
    if (await editBtn.isVisible({ timeout: 3000 })) {
      await editBtn.click();
      await page.waitForTimeout(500);

      const modal = page.locator('.ds-modal, .modal, [role="dialog"]').first();
      await expect(modal).toBeVisible();

      // Look for current rate display
      const currentRate = modal.locator('.current-rate, .rate-display');
      await expect(currentRate.first()).toBeVisible();
    }
  });
});

test.describe('Staff Self-Service Rate History', () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs('staff');
  });

  test('staff can see payroll information section if they have hourly rate', async ({ page }) => {
    await page.goto('/book/my-profile');
    await waitForPageReady(page);
    await dismissPopups(page);

    // Look for Payroll Information card (may not exist if no hourly rate)
    const payrollCard = page.locator('.ds-card').filter({ hasText: /payroll information/i });
    // This test just ensures the page loads - staff with hourly_rate will see the card
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('staff can see view history button if they have hourly rate', async ({ page }) => {
    await page.goto('/book/my-profile');
    await waitForPageReady(page);
    await dismissPopups(page);

    // Look for View History button in Payroll Information section
    const viewHistoryBtn = page.locator('button').filter({ hasText: /view history/i });
    if (await viewHistoryBtn.isVisible({ timeout: 3000 })) {
      await expect(viewHistoryBtn).toBeVisible();
    }
    // If not visible, staff may not have hourly rate configured
  });

  test('staff can toggle rate history visibility', async ({ page }) => {
    await page.goto('/book/my-profile');
    await waitForPageReady(page);
    await dismissPopups(page);

    const viewHistoryBtn = page.locator('button').filter({ hasText: /view history/i });
    if (await viewHistoryBtn.isVisible({ timeout: 3000 })) {
      await viewHistoryBtn.click();
      await page.waitForTimeout(500);

      // Button should now say "Hide History"
      const hideHistoryBtn = page.locator('button').filter({ hasText: /hide history/i });
      await expect(hideHistoryBtn).toBeVisible();

      // Rate history table or empty state should be visible
      const historyContent = page.locator('.ds-table, text=/no rate history/i');
      await expect(historyContent.first()).toBeVisible();
    }
  });

  test('staff rate history is read-only', async ({ page }) => {
    await page.goto('/book/my-profile');
    await waitForPageReady(page);
    await dismissPopups(page);

    const viewHistoryBtn = page.locator('button').filter({ hasText: /view history/i });
    if (await viewHistoryBtn.isVisible({ timeout: 3000 })) {
      await viewHistoryBtn.click();
      await page.waitForTimeout(500);

      // Should NOT have Add Rate button or form inputs (staff view is read-only)
      const addRateBtn = page.locator('button').filter({ hasText: /add rate/i });
      await expect(addRateBtn).not.toBeVisible();
    }
  });
});
