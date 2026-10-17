/**
 * How the discount of a note is spread over its lines. The names are the API's:
 * the first three are worked out by the backend from the lines' values, and
 * `MANUAL` is the one where the person says how much goes to each line.
 */
export const DISCOUNT_ALLOCATION_MODES = [
  'PROPORTIONAL',
  'COMPANY_ONLY',
  'PERSONAL_ONLY',
  'MANUAL',
] as const;

export type DiscountAllocationMode = (typeof DISCOUNT_ALLOCATION_MODES)[number];

/** Why a mode cannot be chosen: the lines it would spread the discount over do not exist. */
export type DiscountModeBlock = 'NO_LINES' | 'NO_COMPANY_LINE' | 'NO_PERSONAL_LINE';

export type DiscountModeAvailability = Record<
  DiscountAllocationMode,
  { enabled: true } | { enabled: false; block: DiscountModeBlock }
>;

/**
 * Which modes have a line to land on. This only counts lines — how much each one
 * receives is the API's to work out — and it exists so that a mode the API would
 * refuse with `NO_ELIGIBLE_LINE` is switched off, with the reason, before it can
 * be chosen.
 *
 * `MANUAL` needs no particular kind of line: any line can be given any part of
 * the discount, up to its own value.
 */
export function discountModeAvailability(
  lines: readonly { isCompanyExpense: boolean }[],
): DiscountModeAvailability {
  if (lines.length === 0) {
    const blocked = { enabled: false, block: 'NO_LINES' } as const;

    return {
      PROPORTIONAL: blocked,
      COMPANY_ONLY: blocked,
      PERSONAL_ONLY: blocked,
      MANUAL: blocked,
    };
  }

  const hasCompanyLine = lines.some((line) => line.isCompanyExpense);
  const hasPersonalLine = lines.some((line) => !line.isCompanyExpense);

  return {
    PROPORTIONAL: { enabled: true },
    COMPANY_ONLY: hasCompanyLine ? { enabled: true } : { enabled: false, block: 'NO_COMPANY_LINE' },
    PERSONAL_ONLY: hasPersonalLine
      ? { enabled: true }
      : { enabled: false, block: 'NO_PERSONAL_LINE' },
    MANUAL: { enabled: true },
  };
}
