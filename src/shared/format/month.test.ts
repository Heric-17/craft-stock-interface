import { describe, expect, it } from 'vitest';

import { InvalidDateValueError } from './date-time';
import { formatMonthLabel, formatMonthName, formatMonthNameShort } from './month';

describe('formatMonthLabel', () => {
  it('writes the month the way an axis does, and with the year when asked', () => {
    expect(formatMonthLabel('2026-10')).toBe('out');
    expect(formatMonthLabel('2026-01', true)).toBe('jan 2026');
  });

  it.each([
    ['2026-01', 'jan'],
    ['2026-02', 'fev'],
    ['2026-03', 'mar'],
    ['2026-04', 'abr'],
    ['2026-05', 'mai'],
    ['2026-06', 'jun'],
    ['2026-07', 'jul'],
    ['2026-08', 'ago'],
    ['2026-09', 'set'],
    ['2026-10', 'out'],
    ['2026-11', 'nov'],
    ['2026-12', 'dez'],
  ])('calls %s %s', (label, expected) => {
    expect(formatMonthLabel(label)).toBe(expected);
  });

  it.each(['2026-13', '2026-00', '2026-1', 'out', '', '2026-10-01'])(
    'refuses %s, which the API never sends as a month',
    (label) => {
      expect(() => formatMonthLabel(label)).toThrow(InvalidDateValueError);
    },
  );
});

describe('formatMonthName', () => {
  it('writes the month out for a sentence', () => {
    expect(formatMonthName('2026-10')).toBe('outubro de 2026');
    expect(formatMonthName('2026-03')).toBe('março de 2026');
    expect(formatMonthName('2025-12')).toBe('dezembro de 2025');
  });

  it('writes the month alone', () => {
    expect(formatMonthNameShort('2026-09')).toBe('setembro');
  });
});
