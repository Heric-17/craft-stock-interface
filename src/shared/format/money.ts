import { MONEY_DECIMAL_PLACES, type Money } from '@/shared/money';
import { majorUnitFactor, type ConsumptionUnit } from '@/shared/quantity';

import {
  absoluteUnits,
  formatScaledDecimal,
  isNegativeAtPlaces,
  NON_BREAKING_SPACE,
} from './decimal';
import { majorUnitSymbol } from './unit-symbol';

const CURRENCY_SYMBOL = 'R$';

/** Places a closed amount is shown with: the cent, always both digits. */
const CENT_PLACES = 2;

/**
 * A closed amount: `R$ 1.284,70`, `-R$ 3,45`.
 *
 * Always two places, because a total with one looks like a total that lost a
 * digit. The sign goes before the currency symbol, as pt-BR writes it, and the
 * space after the symbol does not break.
 */
export function formatMoney(money: Money): string {
  const units = money.toScaledUnits();
  const sign = isNegativeAtPlaces(units, MONEY_DECIMAL_PLACES, CENT_PLACES) ? '-' : '';
  const digits = formatScaledDecimal(absoluteUnits(units), MONEY_DECIMAL_PLACES, {
    minPlaces: CENT_PLACES,
    maxPlaces: CENT_PLACES,
    grouped: true,
  });

  return `${sign}${CURRENCY_SYMBOL}${NON_BREAKING_SPACE}${digits}`;
}

/**
 * A fractional cost, shown **per larger unit**: `R$ 28,00/kg`, `R$ 38,00/L`,
 * `R$ 4,20/m`, `R$ 0,16/un`.
 *
 * Never `R$ 0,04/g`. A gram of flour out of a R$ 28,00 kilo bag costs
 * R$ 0,028, and rounding that to four cents on screen overstates it by 43%
 * while rounding it to three understates the kilo by R$ 2,00 — either way the
 * number someone would use to decide a price is wrong. Per kilo the same
 * figure is exact and reads the way flour is bought.
 *
 * Two to four places, with no trailing zeros: `R$ 0,1625/un` keeps the fourth
 * place that the API sent, `R$ 0,16/un` does not invent one.
 */
export function formatUnitCost(money: Money, unit: ConsumptionUnit): string {
  const perMajorUnit = money.times(majorUnitFactor(unit));
  const units = perMajorUnit.toScaledUnits();
  const sign = isNegativeAtPlaces(units, MONEY_DECIMAL_PLACES, MONEY_DECIMAL_PLACES) ? '-' : '';
  const digits = formatScaledDecimal(absoluteUnits(units), MONEY_DECIMAL_PLACES, {
    minPlaces: CENT_PLACES,
    maxPlaces: MONEY_DECIMAL_PLACES,
    grouped: true,
  });

  return `${sign}${CURRENCY_SYMBOL}${NON_BREAKING_SPACE}${digits}/${majorUnitSymbol(unit)}`;
}
