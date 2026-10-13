import type { Money } from '@/shared/money';
import type { ConsumptionUnit, Quantity } from '@/shared/quantity';

import { formatMoney } from './money';
import { parseCentsInput, parseQuantityInput, type QuantityInputScale } from './parse-input';
import { formatQuantity } from './quantity';

/**
 * What a field's text means: the value that will be sent and the words the echo
 * shows for it.
 *
 * Both come out of one call, which is the point. The echo under a field exists
 * so a person can see what the system understood before it is saved, and that
 * only holds if the string shown and the value sent cannot drift apart. The
 * echo renders `display`; the submit handler takes `value`; neither parses the
 * text a second time with arguments of its own.
 */
export interface FieldReading<T> {
  value: T;
  display: string;
}

/**
 * A quantity field's text, in the unit the field is marked with. `null` for an
 * empty or unreadable field, which has no echo and sends nothing.
 *
 * `"1.500"` in a g field reads as `1,5 g`: a quantity has three decimal places,
 * so a lone dot is ambiguous and is taken as the decimal point. The echo is how
 * the person finds out.
 */
export function readQuantityField(
  text: string,
  unit: ConsumptionUnit,
  scale: QuantityInputScale = 'base',
): FieldReading<Quantity> | null {
  const value = parseQuantityInput(text, unit, scale);

  return value === null ? null : { value, display: formatQuantity(value, { exact: true }) };
}

/**
 * A money field's text. Whole cents only: a third decimal place is unreadable
 * rather than rounded, so the echo never shows a different amount from the one
 * that goes to the API.
 */
export function readMoneyField(text: string): FieldReading<Money> | null {
  const value = parseCentsInput(text);

  return value === null ? null : { value, display: formatMoney(value) };
}
