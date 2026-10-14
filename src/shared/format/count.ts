import { formatScaledDecimal } from './decimal';

/**
 * A count of things, grouped like every other number on screen: `24`, `1.284`.
 * The one place an integer is written for display, so a count never goes
 * through `toLocaleString` somewhere else.
 */
export function formatCount(count: number): string {
  return formatScaledDecimal(BigInt(count), 0, { minPlaces: 0, maxPlaces: 0, grouped: true });
}
