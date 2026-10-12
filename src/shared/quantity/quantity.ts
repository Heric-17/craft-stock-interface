import {
  isDecimalString,
  renderScaledInteger,
  scaleDecimalString,
  type DecimalString,
} from '@/shared/money/decimal-string';
import { InvalidQuantityOperationError } from '@/shared/money/money.error';
import { divideRoundingHalfAwayFromZero, powerOfTen } from '@/shared/money/rounding';

import { majorUnitFactor, type ConsumptionUnit } from './consumption-unit';

/**
 * Decimal places a quantity keeps: three, which is what the contract carries.
 * The columns are `Decimal(12,3)` and the input DTOs validate
 * `maxDecimalPlaces: 3`, so a thousandth of the base unit is the finest
 * fraction that exists on either side.
 */
const QUANTITY_SCALE = 3;

/** The scale `Quantity.toScaledUnits()` counts in, for `shared/format`. */
export const QUANTITY_DECIMAL_PLACES = QUANTITY_SCALE;

/**
 * Places kept from text typed in the larger unit before the conversion to the
 * base unit. Six is three more than the API carries, so every digit a person
 * could type survives the multiplication and only the fuzz below it is
 * dropped.
 */
const MAJOR_UNIT_PARSE_PLACES = 6;

/**
 * A quantity: a decimal amount and the {@link ConsumptionUnit} it is measured
 * in. Immutable, held as a `bigint` count of thousandths of the base unit, the
 * same discipline `Money` keeps and for the same reason.
 *
 * **A quantity travels as a `number`, not as a decimal string.** That is the
 * one place the API treats a fractional value differently from money, and it
 * is a deliberate exception, written down so that nobody "fixes" it later
 * thinking it is an oversight: {@link Quantity.fromApi} is the only function
 * in the frontend allowed to receive one, and nothing past it ever sees the
 * original `number` again.
 *
 * The rounding function and the decimal-string helpers come from
 * `shared/money`, by direct import rather than through its barrel: they are
 * the decimal primitives of the shared layer, and there is exactly one of
 * each in the application.
 */
export class Quantity {
  private readonly thousandths: bigint;
  readonly unit: ConsumptionUnit;

  private constructor(thousandths: bigint, unit: ConsumptionUnit) {
    this.thousandths = thousandths;
    this.unit = unit;
  }

  static zero(unit: ConsumptionUnit): Quantity {
    return new Quantity(0n, unit);
  }

  /**
   * The frontier. A quantity the API sent, as the `number` it sent.
   *
   * The conversion goes through the value's decimal representation, never
   * through a multiplication: `0.145` arrives as `0.14499999999999999`, and
   * `0.145 * 1000` is `144.99999999999997`, which truncates to 144 and loses a
   * thousandth of a gram on every line that has one. `toFixed` expands the
   * exact binary value of the double and rounds it in decimal, at the place
   * the contract stops, so the digits that come out are the digits that went
   * in on the other side.
   *
   * Nothing downstream of this point uses the `number`.
   */
  static fromApi(value: number, unit: ConsumptionUnit): Quantity {
    if (!Number.isFinite(value)) {
      throw new InvalidQuantityOperationError(
        `A quantity from the API must be a finite number, received ${String(value)}.`,
      );
    }

    const digits = value.toFixed(QUANTITY_SCALE);

    // Above 1e21 `toFixed` answers in exponential notation, which is not a
    // decimal amount and not a quantity any column could have held.
    if (!isDecimalString(digits)) {
      throw new InvalidQuantityOperationError(
        `${String(value)} is too large to be a quantity: it has no plain decimal form.`,
      );
    }

    return new Quantity(scaleDecimalString(digits, QUANTITY_SCALE), unit);
  }

  /**
   * A quantity written as a decimal string, in its base unit. For the contract
   * fixtures, which spell quantities out, and for text already normalised by
   * `shared/format`.
   */
  static parse(value: DecimalString, unit: ConsumptionUnit): Quantity {
    if (typeof value !== 'string') {
      throw new InvalidQuantityOperationError(
        `Quantity.parse takes a decimal string; a number from the API goes through Quantity.fromApi. Received ${String(value)}.`,
      );
    }

    return new Quantity(scaleDecimalString(value, QUANTITY_SCALE), unit);
  }

  /**
   * A quantity typed in the larger unit: `"1.5"` in `GRAM` is 1500 g.
   *
   * The conversion is exact for anything a person can usefully type, and the
   * single rounding lands on the thousandth of the base unit that the API
   * carries. `UNIT` has no larger unit and converts by one.
   */
  static fromMajorUnit(value: DecimalString, unit: ConsumptionUnit): Quantity {
    const factor = BigInt(majorUnitFactor(unit));
    const scaled = scaleDecimalString(value, QUANTITY_SCALE + MAJOR_UNIT_PARSE_PLACES);

    return new Quantity(
      divideRoundingHalfAwayFromZero(scaled * factor, powerOfTen(MAJOR_UNIT_PARSE_PLACES)),
      unit,
    );
  }

  static sum(quantities: Iterable<Quantity>, unit: ConsumptionUnit): Quantity {
    let total = 0n;

    for (const quantity of quantities) {
      total += requireSameUnit(quantity, unit).thousandths;
    }

    return new Quantity(total, unit);
  }

  plus(other: Quantity): Quantity {
    return new Quantity(
      this.thousandths + requireSameUnit(other, this.unit).thousandths,
      this.unit,
    );
  }

  minus(other: Quantity): Quantity {
    return new Quantity(
      this.thousandths - requireSameUnit(other, this.unit).thousandths,
      this.unit,
    );
  }

  compare(other: Quantity): -1 | 0 | 1 {
    const theirs = requireSameUnit(other, this.unit).thousandths;

    if (this.thousandths < theirs) {
      return -1;
    }

    return this.thousandths > theirs ? 1 : 0;
  }

  isZero(): boolean {
    return this.thousandths === 0n;
  }

  isNegative(): boolean {
    return this.thousandths < 0n;
  }

  /** The quantity as an exact decimal string with three places: `"1500.000"`. */
  toDecimalString(): string {
    return renderScaledInteger(this.thousandths, QUANTITY_SCALE);
  }

  /**
   * The quantity as the `number` the API expects, rounded to three places —
   * which it already is, so the value is exact.
   *
   * The other side of the frontier opened by {@link Quantity.fromApi}, and the
   * only other place a quantity is a `number`. Two input DTOs on the backend
   * (`classify-invoice.dto.ts`, in `packageQuantity` and `minimumStockAlert`)
   * do not validate decimal places while the columns are still
   * `Decimal(12,3)`, so sending more places there would be lost in the
   * database without an error. Everything leaves here with three.
   */
  toApiNumber(): number {
    return Number(this.toDecimalString());
  }

  /**
   * The internal count of thousandths. What a feature hands to `Money.scaled`
   * so that reproducing a line cost never turns a quantity into a `number`.
   */
  toScaledUnits(): bigint {
    return this.thousandths;
  }

  /** The exception of section 18: positioning a bar in a chart, and nothing else. */
  toChartValue(): number {
    return Number(this.toDecimalString());
  }
}

function requireSameUnit(quantity: Quantity, unit: ConsumptionUnit): Quantity {
  if (quantity.unit !== unit) {
    throw new InvalidQuantityOperationError(
      `Quantities in ${quantity.unit} and ${unit} do not add up: a conversion between consumption units is not a thing the system does.`,
    );
  }

  return quantity;
}
