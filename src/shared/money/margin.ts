import { parseDecimalString, scaleDecimalString } from './decimal-string';
import { type Money } from './money';
import { InvalidMoneyOperationError } from './money.error';

/** A margin of 100% is 10 000 basis points. */
const BASIS_POINTS_PER_UNIT = 10_000;

/**
 * Largest margin the API accepts: `Decimal(5,2)` holds up to 999,99%, which is
 * 99 999 basis points. Anything above it is refused by the backend's input
 * validation, so the form refuses it too, before the round trip.
 */
export const MAX_MARGIN_BASIS_POINTS = 99_999;

/** Decimal places a margin carries once it is written as a percentage. */
export const MARGIN_PERCENT_PLACES = 2;

/**
 * `amount x (10 000 + marginBasisPoints) / 10 000`, rounded once, to the cent.
 *
 * Ported from `applyMargin` in the backend's
 * `src/shared/domain/money/margin.ts`, and the reason a margin travels as a
 * whole number of basis points: `1 + 33.33 / 100` is not exactly
 * representable, and a float multiplication lands a hair under a half-cent tie
 * that the exact value sits on. 125 cents at 34,80% is exactly 168,5 cents and
 * becomes 169; in floating point it is 168,49999999999997 and becomes 168.
 *
 * The factor is one multiplication followed by one division, so the rounding
 * happens last and only once. Marking up and then adding, or marking up per
 * line and then summing, rounds more than once and drifts by cents — see
 * `pricing-formula.md` section 4.
 */
export function applyMargin(amount: Money, marginBasisPoints: number): Money {
  return amount.scaledToCents(
    BASIS_POINTS_PER_UNIT + requireBasisPoints(marginBasisPoints),
    BASIS_POINTS_PER_UNIT,
  );
}

/**
 * Basis points out of a percentage written as a decimal string: `"33.33"` is
 * `3333`, `"35"` is `3500`, `"0.5"` is `50`.
 *
 * Reads the digits instead of multiplying a float by 100, for the same reason
 * the margin travels as an integer at all. A third decimal place is rounded by
 * the one policy, because the field holds two. Answers `null` for anything
 * that is not a percentage the column can hold, so the form shows the error on
 * the field instead of sending a request that comes back 400.
 *
 * The pt-BR text a person typed (`"33,33"`) is normalised by
 * `shared/format`, which is where the comma belongs. **Never ask anyone for
 * `3333`**: the field shows and accepts `33,33`, and basis points are
 * transport and arithmetic, as `pricing-formula.md` section 1 puts it.
 */
export function basisPointsFromDecimalString(value: string): number | null {
  const decimal = parseDecimalString(value);

  if (decimal === null) {
    return null;
  }

  const basisPoints = Number(scaleDecimalString(decimal, MARGIN_PERCENT_PLACES));

  return isBasisPoints(basisPoints) ? basisPoints : null;
}

/** A margin as the API spells it, for the field and for the DTO. */
export function isBasisPoints(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_MARGIN_BASIS_POINTS;
}

function requireBasisPoints(value: number): number {
  if (!isBasisPoints(value)) {
    throw new InvalidMoneyOperationError(
      `A margin is a whole number of basis points between 0 and ${MAX_MARGIN_BASIS_POINTS}, received ${String(value)}.`,
    );
  }

  return value;
}
