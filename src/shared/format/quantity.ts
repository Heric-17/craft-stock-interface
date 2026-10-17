import { divideRoundingHalfAwayFromZero } from '@/shared/money/rounding';
import {
  hasMajorUnit,
  majorUnitFactor,
  QUANTITY_DECIMAL_PLACES,
  type Quantity,
} from '@/shared/quantity';

import { absoluteUnits, formatScaledDecimal, NON_BREAKING_SPACE } from './decimal';
import { baseUnitSymbol, majorUnitSymbol } from './unit-symbol';

/**
 * Where a quantity stops being read in its base unit. A thousand grams is a
 * kilo, and `1,44 kg` is how much flour that is; `1440 g` is a number someone
 * has to divide in their head.
 */
const MAJOR_UNIT_THRESHOLD = 1000;

/** Places a quantity is shown with at most: the three the API carries. */
const MAX_QUANTITY_PLACES = QUANTITY_DECIMAL_PLACES;

/**
 * A quantity with its unit, always: `680 g`, `120 ml`, `1,44 kg`, `8 un`,
 * `0,145 g`.
 *
 * Below a thousand base units the base unit is the reading; from a thousand up
 * it switches to the larger one, with up to three places and no trailing
 * zeros. `UNIT` has no larger unit and stays `un` at every size.
 *
 * A number with no unit on it means nothing on this screen — 120 of flour is
 * either a fifth of a bag or a rounding error — so the unit is part of the
 * string and joined to it by a space that does not break.
 *
 * `exact` is for the echo under a field: it keeps the larger unit only when the
 * conversion loses nothing at three places, and otherwise stays in the base
 * unit. `1500,5 g` is not `1,501 kg` — one of those is what the person typed
 * and the other is a gram more.
 */
export function formatQuantity(quantity: Quantity, options: { exact?: boolean } = {}): string {
  const units = quantity.toScaledUnits();
  const absolute = absoluteUnits(units);
  const sign = units < 0n ? '-' : '';
  const factor = BigInt(majorUnitFactor(quantity.unit));
  const readInMajorUnit =
    hasMajorUnit(quantity.unit) &&
    absolute >= BigInt(MAJOR_UNIT_THRESHOLD) * 10n ** BigInt(QUANTITY_DECIMAL_PLACES) &&
    (options.exact !== true || absolute % factor === 0n);

  // Dividing by the factor keeps the same scale: a thousandth of a gram is a
  // millionth of a kilo, which is below what is shown and rounds once, here.
  const shown = readInMajorUnit ? divideRoundingHalfAwayFromZero(absolute, factor) : absolute;
  const digits = formatScaledDecimal(shown, QUANTITY_DECIMAL_PLACES, {
    minPlaces: 0,
    maxPlaces: MAX_QUANTITY_PLACES,
    grouped: true,
  });
  const symbol = readInMajorUnit ? majorUnitSymbol(quantity.unit) : baseUnitSymbol(quantity.unit);

  return `${sign}${digits}${NON_BREAKING_SPACE}${symbol}`;
}

/**
 * A quantity as a note printed it: `2 UN`, `0,35 KG`. The unit is the note's own
 * text and says nothing about how the material is consumed, so the value is read
 * in that unit and never converted. A note that printed no unit is read in
 * units, which is what a count of packages is.
 */
export function formatPrintedQuantity(quantity: Quantity, printedUnit: string | null): string {
  const digits = formatScaledDecimal(quantity.toScaledUnits(), QUANTITY_DECIMAL_PLACES, {
    minPlaces: 0,
    maxPlaces: MAX_QUANTITY_PLACES,
    grouped: true,
  });

  return `${digits}${NON_BREAKING_SPACE}${printedUnit ?? 'un'}`;
}
