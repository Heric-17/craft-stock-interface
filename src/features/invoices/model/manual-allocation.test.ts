import { describe, expect, it } from 'vitest';

import { Money, requireDecimalString } from '@/shared/money';

import { readManualAllocation } from './manual-allocation';

const money = (value: string): Money => Money.parse(requireDecimalString(value));

const LINES = [
  { itemId: 'a', grossValue: money('20.00') },
  { itemId: 'b', grossValue: money('10.00') },
  { itemId: 'c', grossValue: money('5.00') },
];

describe('readManualAllocation', () => {
  it('closes only when the sum is exactly the discount', () => {
    const reading = readManualAllocation(LINES, { a: '8,00', b: '4,00' }, money('12.00'));

    expect(reading.assigned.equals(money('12.00'))).toBe(true);
    expect(reading.remaining.isZero()).toBe(true);
    expect(reading.closes).toBe(true);
  });

  it('does not close one cent short, and says how much is left', () => {
    const reading = readManualAllocation(LINES, { a: '8,00', b: '3,99' }, money('12.00'));

    expect(reading.closes).toBe(false);
    expect(reading.remaining.equals(money('0.01'))).toBe(true);
  });

  it('does not close one cent over, and says how much it passed by', () => {
    const reading = readManualAllocation(LINES, { a: '8,00', b: '4,01' }, money('12.00'));

    expect(reading.closes).toBe(false);
    expect(reading.remaining.equals(money('-0.01'))).toBe(true);
  });

  it('adds cents the way money adds, with no float drift', () => {
    // 0.1 + 0.2 is not 0.3 as floats; as Money it is exactly R$ 0,30.
    const reading = readManualAllocation(LINES, { a: '0,10', b: '0,20' }, money('0.30'));

    expect(reading.closes).toBe(true);
  });

  it('treats an empty field as a line that receives nothing', () => {
    const reading = readManualAllocation(LINES, { a: '12,00', b: '', c: '   ' }, money('12.00'));

    expect(reading.closes).toBe(true);
    expect(reading.lines.find((line) => line.itemId === 'b')?.amount).toBeNull();
    expect(reading.lines.find((line) => line.itemId === 'b')?.issue).toBeNull();
  });

  it('caps each line at its own value at full price', () => {
    const reading = readManualAllocation(LINES, { c: '5,01', b: '10,00' }, money('15.01'));
    const capped = reading.lines.find((line) => line.itemId === 'c');
    const atTheCeiling = reading.lines.find((line) => line.itemId === 'b');

    expect(capped?.issue).toBe('OVER_CEILING');
    expect(capped?.ceiling.equals(money('5.00'))).toBe(true);
    expect(atTheCeiling?.issue).toBeNull();
    // The sum matches, but a line is over its ceiling: the note is not concluded.
    expect(reading.assigned.equals(money('15.01'))).toBe(true);
    expect(reading.closes).toBe(false);
    expect(reading.hasIssues).toBe(true);
  });

  it('refuses a third decimal place instead of rounding it', () => {
    const reading = readManualAllocation(LINES, { a: '1,005' }, money('1.01'));

    expect(reading.lines[0]?.issue).toBe('UNREADABLE');
    expect(reading.closes).toBe(false);
  });

  it('refuses text that is not an amount, and a negative one', () => {
    const reading = readManualAllocation(LINES, { a: 'abc', b: '-1,00' }, money('0.00'));

    expect(reading.lines[0]?.issue).toBe('UNREADABLE');
    expect(reading.lines[1]?.issue).toBe('NEGATIVE');
    expect(reading.closes).toBe(false);
  });

  it('reads the pt-BR grouping of a money field', () => {
    const lines = [{ itemId: 'a', grossValue: money('2000.00') }];
    const reading = readManualAllocation(lines, { a: '1.284,70' }, money('1284.70'));

    expect(reading.closes).toBe(true);
  });
});
