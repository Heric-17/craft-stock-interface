/**
 * Every display string the application produces, in one module.
 *
 * `Intl`, `toLocaleString` and date formatting are forbidden outside it by
 * lint, and the reason is not tidiness: a cost per gram formatted by hand in
 * one component and by `Intl` in another gives two different numbers for the
 * same `Material`, and whichever one is wrong is wrong on a screen somebody
 * prices from.
 */
export { formatCount } from './count';
export { businessDayNumber, formatDateTime, InvalidDateValueError } from './date-time';
export { NON_BREAKING_SPACE } from './decimal';
export { moneyInputText, quantityInputText } from './input-text';
export { formatMoney, formatUnitCost } from './money';
export {
  normalizeDecimalInput,
  parseBasisPointsInput,
  parseCentsInput,
  parseMoneyInput,
  parseQuantityInput,
  type AmbiguousDot,
  type QuantityInputScale,
} from './parse-input';
export { formatBasisPoints, formatMarginPercent, formatPercent } from './percent';
export {
  buildMonthsRange,
  buildPeriodRange,
  businessMonthLabel,
  InvalidPeriodError,
  resolvePeriod,
  type CivilDateRange,
  type PeriodPreset,
  type PeriodRange,
  type PeriodResolution,
  type PeriodSelection,
} from './period';
export { formatQuantity } from './quantity';
export {
  readMarginField,
  readMoneyField,
  readQuantityField,
  type FieldReading,
} from './read-field';
export { baseUnitSymbol, majorUnitSymbol } from './unit-symbol';
