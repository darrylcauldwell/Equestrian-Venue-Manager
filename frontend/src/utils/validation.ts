// Form validation utilities

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export function validateRequired(value: string | undefined | null, fieldName: string): ValidationResult {
  if (!value || value.trim() === '') {
    return { isValid: false, message: `${fieldName} is required` };
  }
  return { isValid: true };
}

export function validateEmail(value: string | undefined | null): ValidationResult {
  if (!value || value.trim() === '') {
    return { isValid: false, message: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(value)) {
    return { isValid: false, message: 'Please enter a valid email address' };
  }
  return { isValid: true };
}

export function validatePhone(value: string | undefined | null): ValidationResult {
  if (!value || value.trim() === '') {
    return { isValid: true }; // Phone is often optional
  }
  // UK phone number patterns
  const phoneRegex = /^(\+44|0)[1-9]\d{8,9}$/;
  const cleanPhone = value.replace(/[\s()-]/g, '');
  if (!phoneRegex.test(cleanPhone)) {
    return { isValid: false, message: 'Please enter a valid UK phone number' };
  }
  return { isValid: true };
}

export function validateFutureDate(value: string | undefined | null, fieldName: string): ValidationResult {
  if (!value) {
    return { isValid: false, message: `${fieldName} is required` };
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return { isValid: false, message: `${fieldName} must be a valid date` };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (date < today) {
    return { isValid: false, message: `${fieldName} must be today or in the future` };
  }
  return { isValid: true };
}
