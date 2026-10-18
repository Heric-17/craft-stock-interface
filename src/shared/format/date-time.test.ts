import { describe, expect, it } from 'vitest';

import {
  businessDayNumber,
  formatBusinessDay,
  formatClock,
  formatDateTime,
  InvalidDateValueError,
} from './date-time';

/** A fixed afternoon in Sao Paulo, so the relative wording has a today. */
const NOW = new Date('2026-10-12T17:00:00-03:00');

describe('formatDateTime', () => {
  it('says today with the clock time', () => {
    expect(formatDateTime('2026-10-12T14:32:00-03:00', NOW)).toBe('Hoje, 14:32');
    expect(formatDateTime('2026-10-12T00:00:00-03:00', NOW)).toBe('Hoje, 00:00');
  });

  it('says yesterday, and no further back than that', () => {
    expect(formatDateTime('2026-10-11T10:18:00-03:00', NOW)).toBe('Ontem, 10:18');
    expect(formatDateTime('2026-10-10T10:18:00-03:00', NOW)).toBe('10 out, 10:18');
  });

  it('writes a date in this year without the year', () => {
    expect(formatDateTime('2026-06-12T16:45:00-03:00', NOW)).toBe('12 jun, 16:45');
    expect(formatDateTime('2026-01-05T09:05:00-03:00', NOW)).toBe('5 jan, 09:05');
  });

  it('writes the year once it is not this one', () => {
    expect(formatDateTime('2025-06-12T16:45:00-03:00', NOW)).toBe('12 jun 2025, 16:45');
    expect(formatDateTime('2027-06-12T16:45:00-03:00', NOW)).toBe('12 jun 2027, 16:45');
  });

  /**
   * The case the whole module exists for. A sale at 21:30 on 31 January in
   * Porto Alegre is 1 February in UTC, and the backend counts it in January.
   * A detail screen that dated it 1 February would disagree with the month's
   * own total, with nothing on screen to explain either number.
   */
  it('reads an instant in the calendar of Sao Paulo, not in UTC', () => {
    const lateJanuary = new Date('2026-02-01T00:30:00Z');

    expect(formatDateTime(lateJanuary, NOW)).toBe('31 jan, 21:30');
  });

  it('reads an instant from the years Brazil kept summer time', () => {
    // 17 February 2018, 23:30 in Sao Paulo, when the offset was -02:00.
    expect(formatDateTime('2018-02-18T01:30:00Z', NOW)).toBe('17 fev 2018, 23:30');
  });

  it('crosses a month and a year boundary by the calendar, not by 24 hours', () => {
    const firstOfMarch = new Date('2026-03-01T10:00:00-03:00');
    const newYear = new Date('2026-01-01T02:00:00-03:00');

    expect(formatDateTime('2026-02-28T23:00:00-03:00', firstOfMarch)).toBe('Ontem, 23:00');
    expect(formatDateTime('2025-12-31T22:00:00-03:00', newYear)).toBe('Ontem, 22:00');
  });

  it('takes a Date as well as the string the API sends', () => {
    expect(formatDateTime(new Date('2026-10-12T14:32:00-03:00'), NOW)).toBe('Hoje, 14:32');
  });

  it.each(['', 'not-a-date', '2026-13-45T00:00:00Z'])('refuses %p', (value) => {
    expect(() => formatDateTime(value, NOW)).toThrow(InvalidDateValueError);
  });
});

describe('businessDayNumber', () => {
  it('puts two instants of the same business day on the same number', () => {
    expect(businessDayNumber('2026-01-31T21:30:00-03:00')).toBe(
      businessDayNumber('2026-01-31T08:00:00-03:00'),
    );
  });

  it('separates a late-evening instant from the UTC day it falls in', () => {
    expect(businessDayNumber('2026-02-01T00:30:00Z')).not.toBe(
      businessDayNumber('2026-02-01T12:00:00-03:00'),
    );
  });
});

describe('formatBusinessDay', () => {
  it('says today and yesterday, and no further back than that', () => {
    expect(formatBusinessDay('2026-10-12T00:05:00-03:00', NOW)).toBe('Hoje');
    expect(formatBusinessDay('2026-10-11T23:59:00-03:00', NOW)).toBe('Ontem');
    expect(formatBusinessDay('2026-10-10T10:18:00-03:00', NOW)).toBe('10 out');
  });

  it('writes the year once it is not this one', () => {
    expect(formatBusinessDay('2026-06-12T16:45:00-03:00', NOW)).toBe('12 jun');
    expect(formatBusinessDay('2025-06-12T16:45:00-03:00', NOW)).toBe('12 jun 2025');
  });

  it('reads the day in the calendar of Sao Paulo, not in UTC', () => {
    expect(formatBusinessDay(new Date('2026-02-01T00:30:00Z'), NOW)).toBe('31 jan');
  });

  it('refuses a value that is not a date', () => {
    expect(() => formatBusinessDay('not-a-date', NOW)).toThrow(InvalidDateValueError);
  });
});

describe('formatClock', () => {
  it('writes the time of day in Sao Paulo with both digits', () => {
    expect(formatClock('2026-10-12T14:32:00-03:00')).toBe('14:32');
    expect(formatClock('2026-10-12T09:05:00-03:00')).toBe('09:05');
    expect(formatClock('2026-10-12T00:00:00-03:00')).toBe('00:00');
  });

  it('does not use the zone of the machine', () => {
    expect(formatClock('2026-02-01T00:30:00Z')).toBe('21:30');
  });
});
