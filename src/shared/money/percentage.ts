import { renderScaledInteger } from './decimal-string';
import { type Money } from './money';
import { InvalidMoneyOperationError } from './money.error';
import { divideRoundingHalfAwayFromZero, powerOfTen } from './rounding';

/**
 * Decimal places a percentage keeps: one. `76,4%` is as fine as a share, a
 * margin reading or a month-over-month change gets read on a screen, and a
 * second place would only invite someone to treat the figure as a number to
 * calculate with.
 */
const PERCENTAGE_SCALE = 1;

/** A whole unit, as a percentage, in this class's units. */
const PERCENT_UNITS = powerOfTen(PERCENTAGE_SCALE + 2);

/**
 * A percentage, held as a `bigint` count of tenths of a per cent. **For
 * display only.**
 *
 * Margin, variation and share are derived figures: nothing is ever computed
 * from one, which is why this class has no arithmetic. It parses no input and
 * has no addition — a percentage of a percentage is a question nobody in this
 * application asks.
 *
 * A whole of zero answers `null`, never `Infinity` or `NaN`. Dividing by zero
 * is a real case here — a month with no sales, a product with no cost — and it
 * means "there is no share to show", which is a different thing from zero
 * per cent and has to reach the screen as a different thing. `NaN` reaching a
 * component renders the string `"NaN%"`.
 */
export class Percentage {
  private readonly tenthsOfPercent: bigint;

  private constructor(tenthsOfPercent: bigint) {
    this.tenthsOfPercent = tenthsOfPercent;
  }

  static zero(): Percentage {
    return new Percentage(0n);
  }

  /**
   * `part / whole`, as a percentage. The share of a total: what insumos are
   * of the month's spending, what one establishment is of the year.
   */
  static ofMoney(part: Money, whole: Money): Percentage | null {
    return Percentage.ofScaledUnits(part.toScaledUnits(), whole.toScaledUnits());
  }

  /** The same, for two counts: sales paid out of sales made. */
  static ofCounts(part: number, whole: number): Percentage | null {
    if (!Number.isInteger(part) || !Number.isInteger(whole)) {
      throw new InvalidMoneyOperationError(
        `Percentage.ofCounts takes two whole counts, received ${String(part)} and ${String(whole)}.`,
      );
    }

    return Percentage.ofScaledUnits(BigInt(part), BigInt(whole));
  }

  /**
   * The change from one amount to another, as a percentage of the first: this
   * month against last month.
   *
   * `null` when the first amount is zero, because there is no base to compare
   * against. "Spending went from nothing to R$ 400,00" is not an infinite
   * increase, it is a month that had no spending, and the screen says that
   * rather than showing a percentage.
   *
   * The base is taken as a magnitude, so that a fall is negative whichever
   * side of zero the two amounts are on. The datasets this reads only produce
   * amounts at or above zero; the sign handling is there so a subtraction
   * somewhere upstream cannot invert the direction of an arrow on screen.
   */
  static change(from: Money, to: Money): Percentage | null {
    return Percentage.ofScaledUnits(
      to.minus(from).toScaledUnits(),
      from.toScaledUnits() < 0n ? -from.toScaledUnits() : from.toScaledUnits(),
    );
  }

  private static ofScaledUnits(part: bigint, whole: bigint): Percentage | null {
    if (whole === 0n) {
      return null;
    }

    return new Percentage(divideRoundingHalfAwayFromZero(part * PERCENT_UNITS, whole));
  }

  isZero(): boolean {
    return this.tenthsOfPercent === 0n;
  }

  isNegative(): boolean {
    return this.tenthsOfPercent < 0n;
  }

  compare(other: Percentage): -1 | 0 | 1 {
    if (this.tenthsOfPercent < other.tenthsOfPercent) {
      return -1;
    }

    return this.tenthsOfPercent > other.tenthsOfPercent ? 1 : 0;
  }

  /** The percentage as an exact decimal string with one place: `"76.4"`. */
  toDecimalString(): string {
    return renderScaledInteger(this.tenthsOfPercent, PERCENTAGE_SCALE);
  }

  /** For `shared/format`, which turns it into `76,4%`. */
  toScaledUnits(): bigint {
    return this.tenthsOfPercent;
  }

  /** The exception of section 18, again: positioning a point in a chart. */
  toChartValue(): number {
    return Number(this.toDecimalString());
  }
}

/** The scale `Percentage.toScaledUnits()` counts in, for the formatter. */
export const PERCENTAGE_DECIMAL_PLACES = PERCENTAGE_SCALE;
