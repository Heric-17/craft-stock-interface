import { parseCentsInput } from '@/shared/format';
import { Money } from '@/shared/money';

/** What is wrong with the amount typed for one line. */
export type ManualLineIssue = 'UNREADABLE' | 'NEGATIVE' | 'OVER_CEILING';

export interface ManualLineReading {
  itemId: string;
  /** The line's value at full price: the most it can receive. */
  ceiling: Money;
  /** `null` while the field is empty or unreadable. An empty field is a line that gets nothing. */
  amount: Money | null;
  issue: ManualLineIssue | null;
}

export interface ManualReading {
  lines: ManualLineReading[];
  /** What the lines hold so far. */
  assigned: Money;
  /** The whole discount of the note. */
  expected: Money;
  /** `expected - assigned`: positive while some is left, negative when it was overspent. */
  remaining: Money;
  /**
   * The only state in which the note can be concluded: every field readable, no
   * line above its own value and the sum **exactly** the discount. Compared as
   * `Money`, to the cent — never as a float that is "close enough".
   */
  closes: boolean;
  hasIssues: boolean;
}

/**
 * Reads the amounts typed line by line when the person spreads the discount
 * themself.
 *
 * Each field takes whole cents (a third decimal place is refused, not rounded)
 * and may not pass the line's own value. The sum is not checked for being near
 * the discount: it is checked for being it. The API enforces the same rules and
 * answers `SUM_MISMATCH` or `LINE_EXCEEDS_GROSS` otherwise — this is what lets
 * the screen say so before sending anything.
 */
export function readManualAllocation(
  lines: readonly { itemId: string; grossValue: Money }[],
  inputs: Readonly<Record<string, string>>,
  expected: Money,
): ManualReading {
  const readings = lines.map((line): ManualLineReading => {
    const text = inputs[line.itemId] ?? '';

    if (text.trim() === '') {
      return { itemId: line.itemId, ceiling: line.grossValue, amount: null, issue: null };
    }

    const amount = parseCentsInput(text);

    if (amount === null) {
      return { itemId: line.itemId, ceiling: line.grossValue, amount: null, issue: 'UNREADABLE' };
    }

    const issue: ManualLineIssue | null = amount.isNegative()
      ? 'NEGATIVE'
      : amount.compare(line.grossValue) > 0
        ? 'OVER_CEILING'
        : null;

    return { itemId: line.itemId, ceiling: line.grossValue, amount, issue };
  });

  const assigned = Money.sum(readings.map((reading) => reading.amount ?? Money.zero()));
  const hasIssues = readings.some((reading) => reading.issue !== null);

  return {
    lines: readings,
    assigned,
    expected,
    remaining: expected.minus(assigned),
    closes: !hasIssues && assigned.equals(expected),
    hasIssues,
  };
}
