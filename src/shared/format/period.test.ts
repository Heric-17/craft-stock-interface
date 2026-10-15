import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildPeriodRange, InvalidPeriodError, resolvePeriod, type PeriodRange } from './period';

/** Midday in Sao Paulo, so the day cannot be moved by an hour either way. */
function noonIn(date: string): Date {
  return new Date(`${date}T12:00:00-03:00`);
}

/** The window as the API reads it: `from <= instant < to`. */
function contains(range: PeriodRange, instant: Date): boolean {
  return (
    new Date(range.from).getTime() <= instant.getTime() &&
    instant.getTime() < new Date(range.to).getTime()
  );
}

describe('buildPeriodRange: this month', () => {
  it('covers January as the contract documents it', () => {
    expect(buildPeriodRange('THIS_MONTH', noonIn('2026-01-15'))).toEqual({
      from: '2026-01-01T00:00:00-03:00',
      to: '2026-02-01T00:00:00-03:00',
    });
  });

  it('ends at the first instant of the next month, never at the last day of this one', () => {
    const { to } = buildPeriodRange('THIS_MONTH', noonIn('2026-01-15'));

    expect(to).toBe('2026-02-01T00:00:00-03:00');
    expect(to).not.toContain('2026-01-31');
  });

  it.each([
    ['a month of 28 days', '2026-02-10', '2026-02-01T00:00:00-03:00', '2026-03-01T00:00:00-03:00'],
    [
      'a February of 29 days',
      '2024-02-10',
      '2024-02-01T00:00:00-03:00',
      '2024-03-01T00:00:00-03:00',
    ],
    ['a month of 30 days', '2026-04-30', '2026-04-01T00:00:00-03:00', '2026-05-01T00:00:00-03:00'],
    ['a month of 31 days', '2026-07-31', '2026-07-01T00:00:00-03:00', '2026-08-01T00:00:00-03:00'],
  ])('handles %s', (_label, today, from, to) => {
    expect(buildPeriodRange('THIS_MONTH', noonIn(today))).toEqual({ from, to });
  });

  it('crosses the year boundary in December', () => {
    expect(buildPeriodRange('THIS_MONTH', noonIn('2026-12-31'))).toEqual({
      from: '2026-12-01T00:00:00-03:00',
      to: '2027-01-01T00:00:00-03:00',
    });
  });

  it('starts the year in January', () => {
    expect(buildPeriodRange('THIS_MONTH', noonIn('2027-01-01'))).toEqual({
      from: '2027-01-01T00:00:00-03:00',
      to: '2027-02-01T00:00:00-03:00',
    });
  });
});

describe('buildPeriodRange: which month it is', () => {
  /**
   * 21:30 on 31 January in Sao Paulo is already 1 February in UTC. The business
   * is still in January, and so is the window.
   */
  it('reads "now" in the calendar of Sao Paulo, not in UTC', () => {
    const lateJanuary = new Date('2026-02-01T00:30:00Z');

    expect(buildPeriodRange('THIS_MONTH', lateJanuary).from).toBe('2026-01-01T00:00:00-03:00');
  });

  it('changes month exactly at local midnight', () => {
    const lastMillisecond = new Date('2026-03-01T02:59:59.999Z');
    const firstMillisecond = new Date('2026-03-01T03:00:00.000Z');

    expect(buildPeriodRange('THIS_MONTH', lastMillisecond).from).toBe('2026-02-01T00:00:00-03:00');
    expect(buildPeriodRange('THIS_MONTH', firstMillisecond).from).toBe('2026-03-01T00:00:00-03:00');
  });

  describe('whatever zone the machine is set to', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it.each(['UTC', 'Pacific/Auckland', 'America/Los_Angeles', 'Asia/Kolkata'])(
      'gives the same window with the machine in %s',
      (zone) => {
        vi.stubEnv('TZ', zone);

        expect(buildPeriodRange('THIS_MONTH', new Date('2026-02-01T00:30:00Z'))).toEqual({
          from: '2026-01-01T00:00:00-03:00',
          to: '2026-02-01T00:00:00-03:00',
        });
        expect(buildPeriodRange({ startDate: '2026-03-01', endDate: '2026-03-31' })).toEqual({
          from: '2026-03-01T00:00:00-03:00',
          to: '2026-04-01T00:00:00-03:00',
        });
      },
    );
  });
});

describe('buildPeriodRange: the presets', () => {
  it('takes the last 6 months as this one and the five before it', () => {
    expect(buildPeriodRange('LAST_6_MONTHS', noonIn('2026-03-20'))).toEqual({
      from: '2025-10-01T00:00:00-03:00',
      to: '2026-04-01T00:00:00-03:00',
    });
  });

  it('takes the last 12 months as this one and the eleven before it', () => {
    expect(buildPeriodRange('LAST_12_MONTHS', noonIn('2026-03-20'))).toEqual({
      from: '2025-04-01T00:00:00-03:00',
      to: '2026-04-01T00:00:00-03:00',
    });
  });

  it('does not reach into the previous year when the window fits in this one', () => {
    expect(buildPeriodRange('LAST_6_MONTHS', noonIn('2026-12-05'))).toEqual({
      from: '2026-07-01T00:00:00-03:00',
      to: '2027-01-01T00:00:00-03:00',
    });
  });

  it('spans exactly twelve calendar months from January', () => {
    expect(buildPeriodRange('LAST_12_MONTHS', noonIn('2026-01-31'))).toEqual({
      from: '2025-02-01T00:00:00-03:00',
      to: '2026-02-01T00:00:00-03:00',
    });
  });
});

describe('buildPeriodRange: a pair of days', () => {
  it('includes the last day picked, by ending at the start of the day after it', () => {
    expect(buildPeriodRange({ startDate: '2026-01-01', endDate: '2026-01-31' })).toEqual({
      from: '2026-01-01T00:00:00-03:00',
      to: '2026-02-01T00:00:00-03:00',
    });
  });

  it('makes one day of a range that starts and ends on it', () => {
    expect(buildPeriodRange({ startDate: '2026-06-10', endDate: '2026-06-10' })).toEqual({
      from: '2026-06-10T00:00:00-03:00',
      to: '2026-06-11T00:00:00-03:00',
    });
  });

  it('carries the last day of the year into the next one', () => {
    expect(buildPeriodRange({ startDate: '2026-12-01', endDate: '2026-12-31' }).to).toBe(
      '2027-01-01T00:00:00-03:00',
    );
  });

  it('counts 29 February in a leap year', () => {
    expect(buildPeriodRange({ startDate: '2024-02-29', endDate: '2024-02-29' })).toEqual({
      from: '2024-02-29T00:00:00-03:00',
      to: '2024-03-01T00:00:00-03:00',
    });
  });

  it.each([
    ['ends before it starts', { startDate: '2026-02-10', endDate: '2026-02-09' }],
    ['names a day that does not exist', { startDate: '2026-02-30', endDate: '2026-03-01' }],
    ['names 29 February outside a leap year', { startDate: '2026-02-01', endDate: '2026-02-29' }],
    ['is not written as YYYY-MM-DD', { startDate: '10/02/2026', endDate: '2026-02-11' }],
  ])('refuses a range that %s', (_label, range) => {
    expect(() => buildPeriodRange(range)).toThrow(InvalidPeriodError);
  });
});

describe('buildPeriodRange: whole months are covered to the last instant', () => {
  const january = buildPeriodRange('THIS_MONTH', noonIn('2026-01-15'));
  const february = buildPeriodRange('THIS_MONTH', noonIn('2026-02-15'));

  it('contains the last millisecond of the last day', () => {
    expect(contains(january, new Date('2026-01-31T23:59:59.999-03:00'))).toBe(true);
  });

  it('contains the first millisecond of the first day', () => {
    expect(contains(january, new Date('2026-01-01T00:00:00.000-03:00'))).toBe(true);
    expect(contains(january, new Date('2025-12-31T23:59:59.999-03:00'))).toBe(false);
  });

  /**
   * The test that an inclusive `to` would fail. The instant that opens
   * February belongs to February alone: were `to` inclusive it would be in
   * both, and a sale made at that exact moment would be counted twice.
   */
  it('leaves the instant `to` names to the next month, so it is exclusive', () => {
    const openingOfFebruary = new Date(january.to);

    expect(contains(january, openingOfFebruary)).toBe(false);
    expect(contains(february, openingOfFebruary)).toBe(true);
  });

  it('makes the end of one month the start of the next, with no gap and no overlap', () => {
    expect(january.to).toBe(february.from);
  });

  it('tiles a whole year without a gap or an overlap', () => {
    const months = Array.from({ length: 12 }, (_, index) =>
      buildPeriodRange('THIS_MONTH', noonIn(`2026-${String(index + 1).padStart(2, '0')}-15`)),
    );

    for (let index = 1; index < months.length; index += 1) {
      expect(months[index]!.from).toBe(months[index - 1]!.to);
    }
  });
});

/**
 * Brazil dropped summer time in 2019 and the rule may come back. These tests
 * pin what the builder does across the two changes that last happened, so a
 * return of the rule is covered by behaviour that was decided, not assumed.
 *
 * 2018-11-04: clocks went from 00:00 to 01:00 (`-03:00` to `-02:00`).
 * 2019-02-17: clocks went from 00:00 back to 23:00 of the day before
 * (`-02:00` to `-03:00`).
 */
describe('buildPeriodRange: across the summer-time changes', () => {
  it('uses the offset of each end, so a month that holds the change spans 23 hours more or less than its length', () => {
    const november = buildPeriodRange('THIS_MONTH', noonIn('2018-11-20'));

    expect(november).toEqual({
      from: '2018-11-01T00:00:00-03:00',
      to: '2018-12-01T00:00:00-02:00',
    });
    // 30 days, minus the hour the clocks skipped.
    expect(new Date(november.to).getTime() - new Date(november.from).getTime()).toBe(
      (30 * 24 - 1) * 3_600_000,
    );
  });

  it('starts the day of the spring-forward at 01:00, because 00:00 never happened', () => {
    expect(buildPeriodRange({ startDate: '2018-11-04', endDate: '2018-11-04' })).toEqual({
      from: '2018-11-04T01:00:00-02:00',
      to: '2018-11-05T00:00:00-02:00',
    });
  });

  it('makes the spring-forward day 23 hours long', () => {
    const day = buildPeriodRange({ startDate: '2018-11-04', endDate: '2018-11-04' });

    expect(new Date(day.to).getTime() - new Date(day.from).getTime()).toBe(23 * 3_600_000);
  });

  it('keeps the month before the spring-forward on the old offset at both ends', () => {
    expect(buildPeriodRange('THIS_MONTH', noonIn('2018-10-15'))).toEqual({
      from: '2018-10-01T00:00:00-03:00',
      to: '2018-11-01T00:00:00-03:00',
    });
  });

  it('uses the offset of each end for the month that holds the fall-back', () => {
    const february = buildPeriodRange('THIS_MONTH', noonIn('2019-02-20'));

    expect(february).toEqual({
      from: '2019-02-01T00:00:00-02:00',
      to: '2019-03-01T00:00:00-03:00',
    });
    // 28 days, plus the hour the clocks repeated.
    expect(new Date(february.to).getTime() - new Date(february.from).getTime()).toBe(
      (28 * 24 + 1) * 3_600_000,
    );
  });

  it('starts the day of the fall-back at the single midnight it has, on the new offset', () => {
    expect(buildPeriodRange({ startDate: '2019-02-17', endDate: '2019-02-17' }).from).toBe(
      '2019-02-17T00:00:00-03:00',
    );
  });

  it('makes the day before the fall-back 25 hours long', () => {
    const day = buildPeriodRange({ startDate: '2019-02-16', endDate: '2019-02-16' });

    expect(day).toEqual({
      from: '2019-02-16T00:00:00-02:00',
      to: '2019-02-17T00:00:00-03:00',
    });
    expect(new Date(day.to).getTime() - new Date(day.from).getTime()).toBe(25 * 3_600_000);
  });

  it('never leaves a gap or an overlap across either change', () => {
    const october = buildPeriodRange('THIS_MONTH', noonIn('2018-10-15'));
    const november = buildPeriodRange('THIS_MONTH', noonIn('2018-11-15'));
    const december = buildPeriodRange('THIS_MONTH', noonIn('2018-12-15'));

    expect(october.to).toBe(november.from);
    expect(november.to).toBe(december.from);

    const january = buildPeriodRange('THIS_MONTH', noonIn('2019-01-15'));
    const february = buildPeriodRange('THIS_MONTH', noonIn('2019-02-15'));
    const march = buildPeriodRange('THIS_MONTH', noonIn('2019-03-15'));

    expect(january.to).toBe(february.from);
    expect(february.to).toBe(march.from);
  });

  it('is -03:00 for every month of today, with no summer time', () => {
    for (let month = 1; month <= 12; month += 1) {
      const { from, to } = buildPeriodRange(
        'THIS_MONTH',
        noonIn(`2026-${String(month).padStart(2, '0')}-15`),
      );

      expect(from).toMatch(/-03:00$/);
      expect(to).toMatch(/-03:00$/);
    }
  });
});

describe('the format the API reads', () => {
  it.each(['THIS_MONTH', 'LAST_6_MONTHS', 'LAST_12_MONTHS'] as const)(
    'writes %s as instants with an offset, which Date reads back',
    (preset) => {
      const { from, to } = buildPeriodRange(preset, noonIn('2026-05-14'));

      for (const value of [from, to]) {
        expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/);
        expect(Number.isNaN(new Date(value).getTime())).toBe(false);
      }

      expect(new Date(from).getTime()).toBeLessThan(new Date(to).getTime());
    },
  );
});

describe('resolvePeriod', () => {
  const now = noonIn('2026-10-14');

  it('turns a preset into the same range buildPeriodRange gives', () => {
    expect(resolvePeriod({ kind: 'preset', preset: 'THIS_MONTH' }, now)).toEqual({
      ok: true,
      range: buildPeriodRange('THIS_MONTH', now),
    });
  });

  it('turns two typed days into a range that ends at the start of the next day', () => {
    expect(
      resolvePeriod({ kind: 'custom', startDate: '2026-01-01', endDate: '2026-01-31' }, now),
    ).toEqual({
      ok: true,
      range: { from: '2026-01-01T00:00:00-03:00', to: '2026-02-01T00:00:00-03:00' },
    });
  });

  it('is not an error while a day is still missing, because the person is typing', () => {
    expect(resolvePeriod({ kind: 'custom' }, now)).toEqual({ ok: false, reason: 'INCOMPLETE' });
    expect(resolvePeriod({ kind: 'custom', startDate: '2026-01-01' }, now)).toEqual({
      ok: false,
      reason: 'INCOMPLETE',
    });
    expect(resolvePeriod({ kind: 'custom', startDate: '2026-01-01', endDate: '' }, now)).toEqual({
      ok: false,
      reason: 'INCOMPLETE',
    });
  });

  it('says so when the period ends before it starts', () => {
    expect(
      resolvePeriod({ kind: 'custom', startDate: '2026-02-01', endDate: '2026-01-31' }, now),
    ).toEqual({ ok: false, reason: 'INVALID' });
  });
});
