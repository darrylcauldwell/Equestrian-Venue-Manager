import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * Booking Page Object
 * Handles arena booking calendar and booking creation
 */
export class BookingPage extends BasePage {
  readonly calendar: Locator;
  readonly arenaSelector: Locator;
  readonly dateSelector: Locator;
  readonly bookingModal: Locator;
  readonly bookingForm: Locator;
  readonly startTimeInput: Locator;
  readonly endTimeInput: Locator;
  readonly horseSelector: Locator;
  readonly notesInput: Locator;
  readonly submitBookingButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.calendar = page.locator('.booking-calendar, .calendar-container');
    this.arenaSelector = page.locator('select[name="arena"], #arena-select');
    this.dateSelector = page.locator('input[type="date"]');
    this.bookingModal = page.locator('.ds-modal, .booking-modal');
    this.bookingForm = page.locator('.booking-form, form');
    this.startTimeInput = page.locator('input[name="start_time"], #start-time');
    this.endTimeInput = page.locator('input[name="end_time"], #end-time');
    this.horseSelector = page.locator('select[name="horse_id"], #horse-select');
    this.notesInput = page.locator('textarea[name="notes"], #notes');
    this.submitBookingButton = page.locator('button:has-text("Book"), button:has-text("Create"), button[type="submit"]');
    this.cancelButton = page.locator('button:has-text("Cancel")');
  }

  /**
   * Navigate to booking calendar
   */
  async goto() {
    await super.goto('/book');
  }

  /**
   * Select an arena from dropdown
   */
  async selectArena(arenaName: string) {
    await this.arenaSelector.selectOption({ label: arenaName });
    await this.waitForLoading();
  }

  /**
   * Select a date on the calendar
   */
  async selectDate(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    await this.dateSelector.fill(dateStr);
    await this.waitForLoading();
  }

  /**
   * Click on a time slot to start booking
   */
  async clickTimeSlot(hour: number) {
    const timeSlot = this.page.locator(`.time-slot[data-hour="${hour}"], .calendar-slot:has-text("${hour}:00")`).first();
    await timeSlot.click();
  }

  /**
   * Fill booking form
   */
  async fillBookingForm(options: {
    startTime: string;
    endTime: string;
    horse?: string;
    notes?: string;
  }) {
    await this.startTimeInput.fill(options.startTime);
    await this.endTimeInput.fill(options.endTime);

    if (options.horse) {
      await this.horseSelector.selectOption({ label: options.horse });
    }

    if (options.notes) {
      await this.notesInput.fill(options.notes);
    }
  }

  /**
   * Submit booking form
   */
  async submitBooking() {
    await this.submitBookingButton.first().click();
    await this.waitForLoading();
  }

  /**
   * Create a complete booking
   */
  async createBooking(options: {
    arena?: string;
    date: Date;
    startTime: string;
    endTime: string;
    horse?: string;
    notes?: string;
  }) {
    if (options.arena) {
      await this.selectArena(options.arena);
    }
    await this.selectDate(options.date);
    await this.clickTimeSlot(parseInt(options.startTime.split(':')[0]));
    await expect(this.bookingModal).toBeVisible({ timeout: 5000 });
    await this.fillBookingForm({
      startTime: options.startTime,
      endTime: options.endTime,
      horse: options.horse,
      notes: options.notes,
    });
    await this.submitBooking();
  }

  /**
   * Verify booking exists on calendar
   */
  async expectBookingVisible(bookingText: string) {
    const booking = this.page.locator(`.booking-item:has-text("${bookingText}"), .calendar-event:has-text("${bookingText}")`);
    await expect(booking.first()).toBeVisible({ timeout: 5000 });
  }

  /**
   * Cancel modal without saving
   */
  async cancelModal() {
    await this.cancelButton.click();
    await expect(this.bookingModal).not.toBeVisible();
  }
}
