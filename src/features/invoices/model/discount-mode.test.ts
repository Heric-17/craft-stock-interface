import { describe, expect, it } from 'vitest';

import { discountModeAvailability } from './discount-mode';

const company = { isCompanyExpense: true };
const personal = { isCompanyExpense: false };

describe('discountModeAvailability', () => {
  it('offers every mode when the note has both kinds of line', () => {
    const availability = discountModeAvailability([company, personal]);

    expect(Object.values(availability).every((mode) => mode.enabled)).toBe(true);
  });

  it('switches "only the company items" off when no line is a company expense', () => {
    const availability = discountModeAvailability([personal, personal]);

    expect(availability.COMPANY_ONLY).toEqual({ enabled: false, block: 'NO_COMPANY_LINE' });
    expect(availability.PERSONAL_ONLY.enabled).toBe(true);
    expect(availability.PROPORTIONAL.enabled).toBe(true);
    expect(availability.MANUAL.enabled).toBe(true);
  });

  it('switches "only the personal items" off when every line is a company expense', () => {
    const availability = discountModeAvailability([company]);

    expect(availability.PERSONAL_ONLY).toEqual({ enabled: false, block: 'NO_PERSONAL_LINE' });
    expect(availability.COMPANY_ONLY.enabled).toBe(true);
  });

  it('offers nothing when there is no line to carry the discount', () => {
    const availability = discountModeAvailability([]);

    expect(Object.values(availability).every((mode) => !mode.enabled)).toBe(true);
  });
});
