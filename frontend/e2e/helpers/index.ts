/**
 * E2E Test Helpers
 *
 * Usage:
 *   import { navigateTo, fillForm, waitForModal } from './helpers';
 *
 * Or import from specific modules:
 *   import { navigateToAdmin } from './helpers/navigation';
 *   import { fillFieldByLabel } from './helpers/forms';
 *   import { confirmModal } from './helpers/modals';
 */

// Navigation helpers
export {
  navigateTo,
  navigateToAdmin,
  navigateToBook,
  clickNavLink,
  clickTab,
  waitForPageTitle,
  expectUrl,
  goBack,
} from './navigation';

// Form helpers
export {
  fillFieldByLabel,
  fillFieldByName,
  fillForm,
  selectOption,
  selectOptionByValue,
  toggleCheckbox,
  submitForm,
  submitFormAndExpectSuccess,
  clearForm,
  expectFormError,
  fillDateInput,
  fillTimeInput,
} from './forms';

// Modal helpers
export {
  waitForModal,
  waitForModalWithTitle,
  closeModal,
  clickModalButton,
  expectModalClosed,
  confirmModal,
  cancelModal,
  expectModalContains,
  clickModalTab,
} from './modals';
