/**
 * The calendar the whole system agrees on.
 *
 * The backend groups every total by the calendar of `America/Sao_Paulo`, not
 * by UTC: a sale at 21:30 on 31 January in Porto Alegre is 1 February in UTC
 * and is January in every total. The screen reads dates in the same calendar,
 * because a detail page that dated that sale 1 February while the month's
 * total counted it in January would be two different answers to the same
 * question, with nothing on screen to explain either.
 *
 * The browser's own zone never takes part. Someone travelling, or a machine
 * with its clock set elsewhere, sees the business's calendar.
 */
const BUSINESS_TIME_ZONE = 'America/Sao_Paulo';

/**
 * Month abbreviations written out rather than asked of `Intl`, which spells
 * them with a trailing dot in some runtimes and without in others. The screen
 * should not change because a Node version did.
 */
const MONTH_ABBREVIATIONS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
];

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * `Intl` is used for one thing only: which calendar day and clock time an
 * instant falls on in Sao Paulo. Everything readable is assembled from those
 * digits, so the output is the same in every runtime.
 */
const BUSINESS_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export class InvalidDateValueError extends Error {
  constructor(value: unknown) {
    super(`${String(value)} is not a date the API could have sent.`);
    this.name = 'InvalidDateValueError';
  }
}

interface BusinessDateTime {
  year: number;
  month: number;
  day: number;
  hour: string;
  minute: string;
  /** Days since the epoch in the business calendar, for comparing two dates. */
  dayNumber: number;
}

/**
 * An instant as someone at the counter would say it: `Hoje, 14:32`,
 * `Ontem, 10:18`, `12 jun, 16:45`, and with the year once it is not this one,
 * `12 jun 2025, 16:45`.
 *
 * Relative wording only reaches back one day. "Three days ago" is a date the
 * reader has to convert; a date is not.
 *
 * `now` is a parameter so that the relative wording can be tested without
 * moving the clock, and defaults to the real one.
 */
export function formatDateTime(value: Date | string, now: Date = new Date()): string {
  const moment = readBusinessDateTime(toDate(value));
  const today = readBusinessDateTime(now);
  const clock = `${moment.hour}:${moment.minute}`;
  const daysApart = today.dayNumber - moment.dayNumber;

  if (daysApart === 0) {
    return `Hoje, ${clock}`;
  }

  if (daysApart === 1) {
    return `Ontem, ${clock}`;
  }

  const month = MONTH_ABBREVIATIONS[moment.month - 1] ?? '';
  const year = moment.year === today.year ? '' : ` ${moment.year}`;

  return `${moment.day} ${month}${year}, ${clock}`;
}

/** The calendar day of an instant in the business calendar, for grouping. */
export function businessDayNumber(value: Date | string): number {
  return readBusinessDateTime(toDate(value)).dayNumber;
}

function toDate(value: Date | string): Date {
  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    throw new InvalidDateValueError(value);
  }

  return date;
}

function readBusinessDateTime(date: Date): BusinessDateTime {
  const parts = new Map(
    BUSINESS_PARTS.formatToParts(date).map((part) => [part.type, part.value] as const),
  );
  const year = Number(parts.get('year'));
  const month = Number(parts.get('month'));
  const day = Number(parts.get('day'));

  return {
    year,
    month,
    day,
    hour: parts.get('hour') ?? '00',
    minute: parts.get('minute') ?? '00',
    // Built from the calendar digits rather than from the instant, so that a
    // day is a day whatever its length: the Sao Paulo offset has changed by
    // law before and the comparison must not depend on it.
    dayNumber: Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY,
  };
}
