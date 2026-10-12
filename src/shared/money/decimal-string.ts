import { InvalidMoneyOperationError } from './money.error';
import { divideRoundingHalfAwayFromZero, powerOfTen } from './rounding';

declare const decimalStringBrand: unique symbol;

/**
 * A decimal amount as the API sends it: `"19.90"`, `"0.0280"`, `"-3.45"`.
 *
 * It is a marked type so that a plain `string` — a label, a form field, the
 * result of a template literal — cannot be handed to `Money.parse` by
 * accident, and so that a `number` cannot be handed to it at all. Only
 * {@link parseDecimalString} and {@link requireDecimalString} produce the type
 * at runtime; the DTOs declare their monetary fields as `DecimalString`
 * because that is what the contract promises for them, and `Money.parse`
 * validates the value anyway, which is where a backend that broke its own
 * contract is caught.
 */
export type DecimalString = string & { readonly [decimalStringBrand]: true };

/**
 * Sign, integer digits, optional fractional digits. Nothing else: no `+`, no
 * leading or bare dot (`.5`, `1.`), no exponent, no separator. Scientific
 * notation is rejected rather than read because `"1e-7"` reaching a monetary
 * field means something upstream turned an amount into a `number`, and reading
 * it would hide that.
 */
const DECIMAL_STRING_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

/**
 * Four places is what the contract carries: closed amounts come with two
 * (`"3.36"`) and display unit costs with four (`"0.0280"`). A fifth place is
 * not rounded away, it is refused: the API does not send one, so a value that
 * has one is a contract change, and rounding it silently would leave the
 * screen showing a plausible number with no sign that anything moved.
 */
export const DECIMAL_STRING_MAX_PLACES = 4;

export function isDecimalString(value: unknown): value is DecimalString {
  if (typeof value !== 'string') {
    return false;
  }

  const match = DECIMAL_STRING_PATTERN.exec(value);

  return match !== null && (match[3]?.length ?? 0) <= DECIMAL_STRING_MAX_PLACES;
}

/** The validated parser. Answers `null` instead of throwing. */
export function parseDecimalString(value: unknown): DecimalString | null {
  return isDecimalString(value) ? value : null;
}

/** The same, for a value that comes from the API and must follow the contract. */
export function requireDecimalString(value: unknown): DecimalString {
  const parsed = parseDecimalString(value);

  if (parsed === null) {
    throw new InvalidMoneyOperationError(
      `${describe(value)} is not a decimal amount with up to ${DECIMAL_STRING_MAX_PLACES} decimal places.`,
    );
  }

  return parsed;
}

/**
 * A decimal string as an exact fraction of two integers: `"1.284"` is
 * `1284 / 1000`.
 *
 * Every conversion of a decimal string into a scaled integer goes through
 * here, so that no digit is read with `Number` and no rounding happens before
 * the one the caller asks for. The numerator carries the sign.
 */
export function decimalStringToFraction(value: string): { numerator: bigint; denominator: bigint } {
  const match = DECIMAL_STRING_PATTERN.exec(value.trim());

  if (!match) {
    throw new InvalidMoneyOperationError(`"${value}" is not a valid decimal amount.`);
  }

  const [, sign, integerDigits = '', fractionDigits = ''] = match;
  const magnitude = BigInt(`${integerDigits}${fractionDigits}`);

  return {
    numerator: sign === '-' ? -magnitude : magnitude,
    denominator: powerOfTen(fractionDigits.length),
  };
}

/**
 * A decimal string as an integer at `scale` decimal places: `"1.5"` at scale 3
 * is `1500`.
 *
 * Exact when the string has no more places than `scale`, which is the only
 * case the API produces. A longer string is rounded once, by the one rounding
 * function, so that text a person typed into a field lands on the same value
 * the backend would have computed.
 */
export function scaleDecimalString(value: string, scale: number): bigint {
  const { numerator, denominator } = decimalStringToFraction(value);

  return divideRoundingHalfAwayFromZero(numerator * powerOfTen(scale), denominator);
}

/**
 * An integer at `scale` decimal places rendered back as a decimal string, with
 * exactly `scale` places. `1500` at scale 3 is `"1.500"`.
 */
export function renderScaledInteger(units: bigint, scale: number): string {
  const sign = units < 0n ? '-' : '';
  const absolute = units < 0n ? -units : units;
  const unitScale = powerOfTen(scale);
  const integerPart = absolute / unitScale;
  const fractionPart = (absolute % unitScale).toString().padStart(scale, '0');

  return scale === 0 ? `${sign}${integerPart}` : `${sign}${integerPart}.${fractionPart}`;
}

function describe(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : `${typeof value} ${String(value)}`;
}
