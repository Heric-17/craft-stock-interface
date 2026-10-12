import { MARGIN_PERCENT_PLACES, PERCENTAGE_DECIMAL_PLACES, type Percentage } from '@/shared/money';

import { absoluteUnits, formatScaledDecimal } from './decimal';

/**
 * A derived percentage: `76,4%`, `-12,5%`, `0,0%`.
 *
 * One place, which is what `Percentage` holds. A share nobody can act on at a
 * finer resolution does not get shown at one.
 */
export function formatPercent(percentage: Percentage): string {
  const units = percentage.toScaledUnits();
  const digits = formatScaledDecimal(absoluteUnits(units), PERCENTAGE_DECIMAL_PLACES, {
    minPlaces: PERCENTAGE_DECIMAL_PLACES,
    maxPlaces: PERCENTAGE_DECIMAL_PLACES,
    grouped: true,
  });

  return `${percentage.isNegative() ? '-' : ''}${digits}%`;
}

/**
 * A margin, from the basis points the API carries to what the field shows:
 * `3333` is `"33,33"`, `3500` is `"35"`, `50` is `"0,5"`.
 *
 * Two places at most and no trailing zeros, so a round margin reads as `35`
 * and not `35,00`. Nobody is ever shown `3333`.
 */
export function formatBasisPoints(basisPoints: number): string {
  return formatScaledDecimal(BigInt(basisPoints), MARGIN_PERCENT_PLACES, {
    minPlaces: 0,
    maxPlaces: MARGIN_PERCENT_PLACES,
    grouped: true,
  });
}

/** The same margin with its sign on it, for reading rather than editing. */
export function formatMarginPercent(basisPoints: number): string {
  return `${formatBasisPoints(basisPoints)}%`;
}
