import {
  basisPointsFromDecimalString,
  Money,
  parseDecimalString,
  type DecimalString,
} from '@/shared/money';
import {
  majorUnitFactor,
  Quantity,
  QUANTITY_DECIMAL_PLACES,
  type ConsumptionUnit,
} from '@/shared/quantity';

/**
 * Which unit the digits in a field are written in: the base unit the API
 * carries, or the larger unit a person actually says. "1,5" in a field marked
 * kg is 1500 g.
 */
export type QuantityInputScale = 'base' | 'major';

/**
 * What a lone dot means when there is no comma to settle it. A money field
 * reads it as grouping when the digits allow (`1.284` is one thousand two
 * hundred and eighty-four, since an amount has no third decimal place). A
 * quantity field has three decimal places, so `1.500` is one and a half and
 * one thousand five hundred at once and no rule can tell them apart: it reads
 * the dot as a decimal point, and the echo under the field says so.
 */
export type AmbiguousDot = 'grouping' | 'decimal';

/**
 * Text a person typed, turned into the decimal string the value objects parse.
 *
 * pt-BR writes `1.284,70`: **the comma opens the decimals and the dot groups
 * thousands.** So dots are grouping and come out, and the comma becomes the
 * decimal point.
 *
 * One concession, because a dot is also what a numeric keypad offers: with no
 * comma anywhere and a single dot whose last group is not three digits long,
 * the dot is read as a decimal point. `"1.5"` is one and a half and `"1.284"`
 * is one thousand two hundred and eighty-four, which is what each one means to
 * the person who typed it. `"1.500"` meaning one and a half is the one case
 * this reads as the other thing, and it reads it the way pt-BR writes it.
 *
 * `ambiguousDot` moves that one case: a quantity field passes `'decimal'`,
 * because there the collision is total (see {@link AmbiguousDot}). A dot
 * repeated (`1.234.567`) is grouping in both, and so is any dot beside a comma.
 *
 * Answers `null` for anything else — a letter, two commas, an empty field.
 * Nothing here throws: this is text a person is still typing.
 */
export function normalizeDecimalInput(
  text: string,
  ambiguousDot: AmbiguousDot = 'grouping',
): DecimalString | null {
  const trimmed = text.replace(/[\s\u00a0]/g, '').replace(/^R\$/i, '');

  if (trimmed === '') {
    return null;
  }

  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : normalizeDotted(trimmed, ambiguousDot);

  return parseDecimalString(normalized);
}

/**
 * An amount a person typed: `"1.284,70"` is R$ 1.284,70 and `"1,5"` is
 * R$ 1,50.
 *
 * Text finer than a `Money` holds — a fifth decimal place — is refused rather
 * than quietly rounded, the same answer `DecimalString` gives the API for the
 * same reason: a field that silently drops a digit someone typed is a field
 * that shows a different amount from the one they entered. The form says so on
 * the field.
 */
export function parseMoneyInput(text: string): Money | null {
  const decimal = normalizeDecimalInput(text);

  return decimal === null ? null : Money.parse(decimal);
}

/**
 * An amount a person typed into a field that takes whole cents: the same
 * reading as {@link parseMoneyInput}, but text with a third decimal place is
 * refused. What travels is a cent string, and a field that rounded `1,005`
 * to `1,01` behind the person's back would show one amount and send another.
 */
export function parseCentsInput(text: string): Money | null {
  const money = parseMoneyInput(text);

  return money !== null && money.equals(money.roundToCents()) ? money : null;
}

/**
 * A quantity a person typed, in the unit the field is marked with: `"1,5"` in
 * a kg field is 1500 g, and the same text in a g field is 1,5 g.
 *
 * A lone dot is a decimal point here: `"1.500"` in a g field is 1,5 g. The
 * field's echo shows that reading, and what is sent is what the echo showed.
 *
 * The conversion exists only here. What travels is always the base unit. Text
 * with more places than the quantity holds is refused, never rounded.
 */
export function parseQuantityInput(
  text: string,
  unit: ConsumptionUnit,
  scale: QuantityInputScale = 'base',
): Quantity | null {
  const decimal = normalizeDecimalInput(text, 'decimal');

  if (decimal === null || !fitsQuantityPlaces(decimal, unit, scale)) {
    return null;
  }

  return scale === 'major' ? Quantity.fromMajorUnit(decimal, unit) : Quantity.parse(decimal, unit);
}

/**
 * Whether the digits survive the conversion to the thousandth of the base unit
 * without rounding. A quantity has three decimal places, and text finer than
 * that is refused instead of rounded: the echo is the promise of what is sent,
 * and a fourth place that quietly vanished would be the echo lying.
 *
 * In the larger unit more places are still exact: `1,2345` kg is `1234,5` g,
 * and a kilo is a thousand grams, so three places more fit. Trailing zeros are
 * not places (`1,5000` is `1,5`).
 */
function fitsQuantityPlaces(
  decimal: string,
  unit: ConsumptionUnit,
  scale: QuantityInputScale,
): boolean {
  const factorDigits = scale === 'major' ? String(majorUnitFactor(unit)).length - 1 : 0;
  const places = (decimal.split('.')[1] ?? '').replace(/0+$/, '').length;

  return places <= QUANTITY_DECIMAL_PLACES + factorDigits;
}

/**
 * A margin a person typed, as the basis points the API carries: `"33,33"` is
 * `3333`.
 *
 * `null` for text that is not a percentage, for one with a third decimal place,
 * and for a margin above the 999,99% the column holds, so the form answers on
 * the field instead of waiting for a 400.
 */
export function parseBasisPointsInput(text: string): number | null {
  const decimal = normalizeDecimalInput(text);

  // A third decimal place is refused here, not rounded: `33,333` would be
  // shown as `33,33` and sent as `3333`, which is an echo that lies.
  if (decimal === null || !fitsMarginPlaces(decimal)) {
    return null;
  }

  return basisPointsFromDecimalString(decimal);
}

/** Places a margin written as a percentage carries: two, one basis point. */
const MARGIN_PLACES = 2;

function fitsMarginPlaces(decimal: string): boolean {
  const places = (decimal.split('.')[1] ?? '').replace(/0+$/, '').length;

  return places <= MARGIN_PLACES;
}

/**
 * Thousands grouped with dots: `1.284`, `1.284.567`. The first group never
 * starts with a zero — nobody writes 145 as `0.145` — so `0.145` is a
 * quantity with three decimal places and not a hundred and forty-five.
 */
const GROUPED_THOUSANDS = /^-?[1-9]\d{0,2}(\.\d{3})+$/;

/** More than one dot can only be grouping, whichever way a single one is read. */
const REPEATED_GROUPING = /^-?[1-9]\d{0,2}(\.\d{3}){2,}$/;

function normalizeDotted(text: string, ambiguousDot: AmbiguousDot): string {
  const pattern = ambiguousDot === 'grouping' ? GROUPED_THOUSANDS : REPEATED_GROUPING;

  return pattern.test(text) ? text.replace(/\./g, '') : text;
}
