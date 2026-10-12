import {
  DECIMAL_STRING_MAX_PLACES,
  renderScaledInteger,
  scaleDecimalString,
  type DecimalString,
} from './decimal-string';
import { InvalidMoneyOperationError } from './money.error';
import { divideRoundingHalfAwayFromZero, powerOfTen } from './rounding';

/**
 * Decimal places a `Money` keeps. Four, one pair more than a closed amount
 * needs, for two reasons that both come from the contract:
 *
 * - the API sends display unit costs with four places (`"0.0280"` for a gram
 *   of flour out of a R$ 28,00 kilo bag), and a value object that could not
 *   hold one would round it to `0.03` the moment it was parsed, which is the
 *   25% error the backend's `formatFractionalAmount` exists to avoid;
 * - showing that cost per larger unit is then exact: `0.0280 x 1000` is
 *   `28.0000`, with no rounding anywhere on the way to `R$ 28,00/kg`.
 *
 * The backend's `Money` holds whole cents instead, so **the cent is where the
 * two sides have to meet**. Every amount the API derives is rounded to the
 * cent, and anything computed here in order to reproduce one is rounded the
 * same way, in a single step, by {@link Money.scaledToCents} and
 * {@link Money.roundToCents}. Rounding to four places first and to the cent
 * afterwards would round twice, and two roundings can land a cent away from
 * one: half a ten-thousandth short of half a cent rounds up to half a cent at
 * four places and up again to the next cent, while the exact value rounds
 * down.
 */
const MONEY_SCALE = DECIMAL_STRING_MAX_PLACES;

/** The scale `Money.toScaledUnits()` counts in, for `shared/format`. */
export const MONEY_DECIMAL_PLACES = MONEY_SCALE;

/** How many of this class's units make a cent. */
const UNITS_PER_CENT = powerOfTen(MONEY_SCALE - 2);

/**
 * Decimal places taken from a `number` multiplier or divisor before it enters
 * the arithmetic, copied from the backend's `QUANTITY_DECIMAL_PLACES`.
 *
 * Six is above what any quantity column carries (`Decimal(12,3)`, and the
 * product of two of them), so no real quantity loses a digit. What it drops is
 * the binary fuzz a `number` arrives with — `0.1 + 0.2` is
 * `0.30000000000000004` — which must not be what decides a tie.
 */
const MULTIPLIER_DECIMAL_PLACES = 6;

const MULTIPLIER_SCALE = powerOfTen(MULTIPLIER_DECIMAL_PLACES);

/**
 * A monetary amount. Immutable, held as a `bigint` count of ten-thousandths of
 * a real (see {@link MONEY_SCALE}), so that nothing it does goes through
 * floating point.
 *
 * Rounding policy: **half away from zero, applied once, to the exact result**,
 * in {@link divideRoundingHalfAwayFromZero} and nowhere else. The policy and
 * its test vectors are ported from the backend's
 * `src/shared/domain/money/money.ts` and `money.spec.ts`; the vectors live in
 * `rounding-vectors.ts`, and a case that stops matching is a divergence
 * between the two implementations, not a number to adjust.
 *
 * The only way in is {@link Money.parse}, from a `DecimalString`. There is no
 * constructor from a `number`: a `number` that reached a monetary field has
 * already lost whatever it lost, and accepting it here would make this class a
 * decoration.
 */
export class Money {
  private readonly units: bigint;

  private constructor(units: bigint) {
    this.units = units;
  }

  static zero(): Money {
    return new Money(0n);
  }

  /**
   * The single entry point, from the decimal string the API sends.
   *
   * `DecimalString` is what stops a plain string at compile time; the runtime
   * check is for the wire boundary, where a DTO declares the field and nobody
   * validated the response. A `number` is refused with its own message,
   * because that is the mistake worth naming.
   */
  static parse(value: DecimalString): Money {
    if (typeof value !== 'string') {
      throw new InvalidMoneyOperationError(
        `Money.parse takes a decimal string, never a ${typeof value}: an amount that became a number has already lost precision. Received ${String(value)}.`,
      );
    }

    return new Money(scaleDecimalString(value, MONEY_SCALE));
  }

  /** Exact addition. No rounding, because there is nothing to round. */
  static sum(amounts: Iterable<Money>): Money {
    let total = 0n;

    for (const amount of amounts) {
      total += amount.units;
    }

    return new Money(total);
  }

  plus(other: Money): Money {
    return new Money(this.units + other.units);
  }

  minus(other: Money): Money {
    return new Money(this.units - other.units);
  }

  /**
   * `this x factor`, rounded once, at this class's own scale.
   *
   * Used to express an amount in another unit — a cost per gram as a cost per
   * kilo — where the factor is a power of ten and the result is exact.
   */
  times(factor: number | bigint): Money {
    return this.scaled(factor, 1n);
  }

  /**
   * `this x multiplier / divisor`, rounded **once**, at this class's scale.
   *
   * Multiplying before dividing is the point of the operation. A 1 kg bag of
   * flour at R$ 28,00 costs R$ 0,028 per gram; dividing first and multiplying
   * after forces that per-unit cost into a representable amount before it is
   * ever multiplied, and the 120 g a recipe uses then costs R$ 3,60 instead of
   * R$ 3,36 — 7% on every line with a fractional ingredient.
   *
   * A `bigint` multiplier is taken as the exact integer it is, which is what
   * `Quantity.toScaledUnits()` hands over and the reason a feature never needs
   * to turn a quantity into a `number` to use this. A `number` is read through
   * its decimal expansion at {@link MULTIPLIER_DECIMAL_PLACES} places, exactly
   * as the backend reads it, so both sides discard the same binary fuzz.
   */
  scaled(multiplier: number | bigint, divisor: number | bigint): Money {
    return new Money(
      divideRoundingHalfAwayFromZero(
        this.units * toScaledFactor(multiplier, 'multiplier'),
        requireNonZeroDivisor(divisor),
      ),
    );
  }

  /**
   * `this x multiplier / divisor`, rounded **once, to the cent**. The exact
   * equivalent of the backend's `Money.scaled`.
   *
   * This is the operation that reproduces an amount the API derives: the cost
   * of a `BomItem` line, the total of a `SaleItem`. Those are whole cents on
   * the other side, and reaching them in one rounding is what keeps a preview
   * equal to the value that comes back after saving. See `pricing-formula.md`
   * section 3, steps 1 and 4.
   */
  scaledToCents(multiplier: number | bigint, divisor: number | bigint): Money {
    const cents = divideRoundingHalfAwayFromZero(
      this.units * toScaledFactor(multiplier, 'multiplier'),
      requireNonZeroDivisor(divisor) * UNITS_PER_CENT,
    );

    return new Money(cents * UNITS_PER_CENT);
  }

  /**
   * The same amount rounded to a whole number of cents, by the one policy.
   *
   * Every closed amount in the system is a whole number of cents: that is what
   * the columns hold and what the API sends. An amount assembled on this side
   * passes through here before it is shown as a total or sent back.
   */
  roundToCents(): Money {
    return new Money(divideRoundingHalfAwayFromZero(this.units, UNITS_PER_CENT) * UNITS_PER_CENT);
  }

  compare(other: Money): -1 | 0 | 1 {
    if (this.units < other.units) {
      return -1;
    }

    return this.units > other.units ? 1 : 0;
  }

  equals(other: Money): boolean {
    return this.units === other.units;
  }

  isZero(): boolean {
    return this.units === 0n;
  }

  isNegative(): boolean {
    return this.units < 0n;
  }

  /**
   * The amount as an exact decimal string with four places: `"28.0000"`,
   * `"0.0280"`. Never rounded — this is the amount, written out.
   */
  toDecimalString(): string {
    return renderScaledInteger(this.units, MONEY_SCALE);
  }

  /**
   * The amount as a decimal string with two places, rounded to the cent. What
   * goes back to the API, whose monetary columns are `Decimal(12,2)`.
   */
  toCentsString(): string {
    return renderScaledInteger(divideRoundingHalfAwayFromZero(this.units, UNITS_PER_CENT), 2);
  }

  /**
   * The internal count of ten-thousandths. For the rest of `shared/money`, for
   * `shared/format`, and for the one case a feature needs: handing an amount
   * or a quantity to {@link Money.scaled} as an exact integer. A `bigint`
   * cannot be mixed into floating-point arithmetic by accident — `1n * 1.5`
   * throws — which is why this representation may leave the class and a
   * `number` may not.
   */
  toScaledUnits(): bigint {
    return this.units;
  }

  /**
   * The amount as a `number`, **only** to position a bar or a point in a
   * chart. The label and the tooltip of that bar use the `Money` itself,
   * formatted. This is the single exception named in section 18 of the project
   * rules, and there is no other.
   */
  toChartValue(): number {
    return Number(this.toDecimalString());
  }
}

function requireNonZeroDivisor(divisor: number | bigint): bigint {
  const scaled = toScaledFactor(divisor, 'divisor');

  if (scaled === 0n) {
    throw new InvalidMoneyOperationError(
      `A divisor of ${String(divisor)} is zero at ${MULTIPLIER_DECIMAL_PLACES} decimal places.`,
    );
  }

  return scaled;
}

function toScaledFactor(value: number | bigint, role: string): bigint {
  if (typeof value === 'bigint') {
    return value * MULTIPLIER_SCALE;
  }

  if (!Number.isFinite(value)) {
    throw new InvalidMoneyOperationError(
      `Money arithmetic requires a finite ${role}, received ${String(value)}.`,
    );
  }

  // `toFixed` expands the exact binary value of the double and rounds it in
  // decimal, which is what turns `0.30000000000000004` back into `0.300000`.
  return BigInt(value.toFixed(MULTIPLIER_DECIMAL_PLACES).replace('.', ''));
}
