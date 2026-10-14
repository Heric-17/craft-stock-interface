import { MONEY_DECIMAL_PLACES, type Money } from '@/shared/money';
import { QUANTITY_DECIMAL_PLACES, type Quantity } from '@/shared/quantity';

import { absoluteUnits, formatScaledDecimal } from './decimal';

/**
 * A stored amount as the text a field is filled with when a form opens to edit
 * it: `28,00`, not `R$ 28,00`, and `1500`, not `1.500` — a dot in a quantity
 * field is a decimal point, so grouping here would make the field read back as
 * a thousand times less than it holds.
 *
 * What comes out is read back, unchanged in value, by `readMoneyField`.
 */
export function moneyInputText(money: Money): string {
  const units = money.toScaledUnits();
  const digits = formatScaledDecimal(absoluteUnits(units), MONEY_DECIMAL_PLACES, {
    minPlaces: 2,
    maxPlaces: 2,
  });

  return `${money.isNegative() ? '-' : ''}${digits}`;
}

/** The same for a quantity, in its base unit, with no trailing zeros: `0,145`, `1500`. */
export function quantityInputText(quantity: Quantity): string {
  const units = quantity.toScaledUnits();
  const digits = formatScaledDecimal(absoluteUnits(units), QUANTITY_DECIMAL_PLACES, {
    minPlaces: 0,
    maxPlaces: QUANTITY_DECIMAL_PLACES,
  });

  return `${quantity.isNegative() ? '-' : ''}${digits}`;
}
