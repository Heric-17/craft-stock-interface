import { divideRoundingHalfAwayFromZero, powerOfTen } from '@/shared/money/rounding';

/**
 * The separators of pt-BR, and the one place they are written down: a dot
 * groups thousands and a comma opens the decimals.
 */
const GROUP_SEPARATOR = '.';
const DECIMAL_SEPARATOR = ',';
const GROUP_SIZE = 3;

/**
 * The space between a number and what it measures.
 *
 * It is a non-breaking space on purpose: "R$" and its amount, and a quantity
 * and its unit, must not end up on two lines. At 360px wide, which is the
 * width the stock gets checked at while someone is standing at the counter, a
 * figure that wraps reads as two different things. CSS could do it as well,
 * but the formatter is the one place that knows a given string is a single
 * reading, so it is the one that joins it.
 */
export const NON_BREAKING_SPACE = ' ';

export interface DecimalFormatOptions {
  /** Places always shown, even when they are zeros. */
  minPlaces: number;
  /** Places at most; anything finer is rounded by the one policy. */
  maxPlaces: number;
  /** Group thousands with a dot. On for money, off inside a small quantity. */
  grouped?: boolean;
}

/**
 * An integer at `scale` decimal places written out in pt-BR, the only function
 * in the application that turns a scaled integer into digits on a screen.
 *
 * It takes the `bigint` the value objects hold, never a `number`: grouping and
 * trimming are done on the digits themselves, so the result is exact at any
 * magnitude and does not depend on what `Intl` does with a float. Rounding,
 * when `maxPlaces` asks for fewer places than the value carries, is the same
 * half-away-from-zero used everywhere else.
 *
 * The sign is **not** written here. `formatMoney` puts it before the currency
 * symbol, which is where pt-BR puts it, so the caller decides.
 */
export function formatScaledDecimal(
  units: bigint,
  scale: number,
  { minPlaces, maxPlaces, grouped = false }: DecimalFormatOptions,
): string {
  const places = Math.min(scale, maxPlaces);
  const rounded =
    places < scale ? divideRoundingHalfAwayFromZero(units, powerOfTen(scale - places)) : units;
  const absolute = rounded < 0n ? -rounded : rounded;
  const unitScale = powerOfTen(places);
  const integerDigits = (absolute / unitScale).toString();
  const fractionDigits = trimTrailingZeros(
    places > 0 ? (absolute % unitScale).toString().padStart(places, '0') : '',
    minPlaces,
  );
  const whole = grouped ? groupThousands(integerDigits) : integerDigits;

  return fractionDigits === '' ? whole : `${whole}${DECIMAL_SEPARATOR}${fractionDigits}`;
}

/** Whether the value, once rounded to `maxPlaces`, is still below zero. */
export function isNegativeAtPlaces(units: bigint, scale: number, maxPlaces: number): boolean {
  const places = Math.min(scale, maxPlaces);
  const rounded =
    places < scale ? divideRoundingHalfAwayFromZero(units, powerOfTen(scale - places)) : units;

  return rounded < 0n;
}

export function absoluteUnits(units: bigint): bigint {
  return units < 0n ? -units : units;
}

function trimTrailingZeros(digits: string, minPlaces: number): string {
  let end = digits.length;

  while (end > minPlaces && digits[end - 1] === '0') {
    end -= 1;
  }

  return digits.slice(0, end);
}

function groupThousands(digits: string): string {
  let grouped = '';

  for (let index = digits.length; index > 0; index -= GROUP_SIZE) {
    const start = Math.max(0, index - GROUP_SIZE);
    const group = digits.slice(start, index);

    grouped = grouped === '' ? group : `${group}${GROUP_SEPARATOR}${grouped}`;
  }

  return grouped;
}
