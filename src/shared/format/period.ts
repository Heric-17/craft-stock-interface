import { readBusinessDateTime } from './date-time';

/**
 * The window a query asks the API about.
 *
 * `from` is inclusive and `to` is **exclusive**, and both are instants carrying
 * the offset of `America/Sao_Paulo` — `2026-01-01T00:00:00-03:00`, never a bare
 * date. The API groups every total by the calendar of that zone, so a window
 * cut anywhere else shifts a whole day of data in or out with no error to show
 * for it.
 *
 * This lives in `shared/format` rather than `shared/lib` because working out
 * the offset of a zone takes `Intl`, and `Intl` is allowed in one folder only.
 * The browser's own zone never takes part: nothing below reads a local getter,
 * and `Date` is used purely as a counter of milliseconds.
 */
export interface PeriodRange {
  from: string;
  to: string;
}

/**
 * The presets cover calendar months, the current one included: "last 6 months"
 * is this month and the five before it, the same six months a per-month chart
 * draws.
 */
export type PeriodPreset = 'THIS_MONTH' | 'LAST_6_MONTHS' | 'LAST_12_MONTHS';

/**
 * Two calendar days as someone picks them in a date field, as `YYYY-MM-DD`.
 * **Both ends are days to include**: picking 1 to 31 January means all of
 * January, so the range handed to the API ends at the first instant of 1
 * February.
 */
export interface CivilDateRange {
  startDate: string;
  endDate: string;
}

export class InvalidPeriodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidPeriodError';
  }
}

const MONTHS_IN_PRESET: Record<PeriodPreset, number> = {
  THIS_MONTH: 1,
  LAST_6_MONTHS: 6,
  LAST_12_MONTHS: 12,
};

const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 86_400_000;

/** A calendar day with no instant attached. `month` runs from 1 to 12. */
interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export function buildPeriodRange(
  period: PeriodPreset | CivilDateRange,
  now: Date = new Date(),
): PeriodRange {
  if (typeof period === 'string') {
    return buildMonthsRange(MONTHS_IN_PRESET[period], now);
  }

  const start = parseCivilDate(period.startDate);
  const end = parseCivilDate(period.endDate);

  if (compareCivilDates(start, end) > 0) {
    throw new InvalidPeriodError('The period ends before it starts.');
  }

  return { from: startOfDay(start), to: startOfDay(addDays(end, 1)) };
}

/**
 * The last `months` calendar months, the current one included: `from` is the
 * first instant of the oldest, `to` the first instant of the month after the
 * current one. Two months is "this month and the one before it", which is what
 * a month-over-month comparison asks the API for.
 */
export function buildMonthsRange(months: number, now: Date = new Date()): PeriodRange {
  if (!Number.isInteger(months) || months < 1) {
    throw new InvalidPeriodError(`${String(months)} is not a number of months.`);
  }

  const today = readBusinessDateTime(now);
  const thisMonth: CivilDate = { year: today.year, month: today.month, day: 1 };

  return {
    from: startOfDay(addMonths(thisMonth, -(months - 1))),
    to: startOfDay(addMonths(thisMonth, 1)),
  };
}

/**
 * The month an instant falls in, written as the API labels its monthly cells
 * (`2026-10`), on the calendar of `America/Sao_Paulo`.
 */
export function businessMonthLabel(now: Date = new Date()): string {
  const { year, month } = readBusinessDateTime(now);

  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseCivilDate(value: string): CivilDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (match === null) {
    throw new InvalidPeriodError(`${value} is not a date written as YYYY-MM-DD.`);
  }

  const date: CivilDate = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };

  // `Date.UTC` rolls 30 February over into March instead of refusing it, so the
  // day is read back and compared: only a date that survives the round trip
  // exists on the calendar.
  const roundTrip = new Date(Date.UTC(date.year, date.month - 1, date.day));

  if (
    roundTrip.getUTCFullYear() !== date.year ||
    roundTrip.getUTCMonth() !== date.month - 1 ||
    roundTrip.getUTCDate() !== date.day
  ) {
    throw new InvalidPeriodError(`${value} is not a day that exists.`);
  }

  return date;
}

function compareCivilDates(a: CivilDate, b: CivilDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function addMonths(date: CivilDate, months: number): CivilDate {
  const total = date.year * 12 + (date.month - 1) + months;

  return { year: Math.floor(total / 12), month: (total % 12) + 1, day: date.day };
}

/** Calendar arithmetic done on UTC fields, which have no zone to go wrong. */
function addDays(date: CivilDate, days: number): CivilDate {
  const moved = new Date(Date.UTC(date.year, date.month - 1, date.day + days));

  return {
    year: moved.getUTCFullYear(),
    month: moved.getUTCMonth() + 1,
    day: moved.getUTCDate(),
  };
}

/**
 * The wall clock of an instant in Sao Paulo, written as if it were UTC. The
 * difference between this and the instant itself is the zone's offset.
 */
function wallClockAsUtc(instant: number): number {
  const wall = readBusinessDateTime(new Date(instant));

  return Date.UTC(wall.year, wall.month - 1, wall.day, Number(wall.hour), Number(wall.minute));
}

/** Milliseconds to add to an instant to get the wall clock. Negative in Brazil. */
function offsetAt(instant: number): number {
  const wholeMinute = Math.floor(instant / MILLISECONDS_PER_MINUTE) * MILLISECONDS_PER_MINUTE;

  return wallClockAsUtc(wholeMinute) - wholeMinute;
}

/**
 * The first instant of a calendar day, formatted with the offset in force at
 * that instant.
 *
 * Midnight is not always the first instant of the day. When Brazil kept summer
 * time the clocks jumped from 00:00 to 01:00, so on that day 00:00 never
 * happened and the day began at 01:00 (`-02:00`). Searching the offsets on both
 * sides of the day and keeping the earliest instant whose wall clock reads
 * midnight handles that, and the fall-back day, with no table of transitions.
 */
function startOfDay(date: CivilDate): string {
  const midnightAsUtc = Date.UTC(date.year, date.month - 1, date.day);
  const offsetBefore = offsetAt(midnightAsUtc - MILLISECONDS_PER_DAY);
  const offsetAfter = offsetAt(midnightAsUtc + MILLISECONDS_PER_DAY);

  const midnights = [...new Set([offsetBefore, offsetAfter])]
    .map((offset) => midnightAsUtc - offset)
    .filter((instant) => wallClockAsUtc(instant) === midnightAsUtc)
    .sort((a, b) => a - b);

  // No instant reads midnight: the day began in the gap the clocks skipped, and
  // the first instant of it is where midnight would have fallen on the old offset.
  const first = midnights[0] ?? midnightAsUtc - offsetBefore;

  return formatInstant(first);
}

function formatInstant(instant: number): string {
  const offset = offsetAt(instant);
  const wall = new Date(wallClockAsUtc(instant)).toISOString().slice(0, 19);
  const sign = offset < 0 ? '-' : '+';
  const offsetMinutes = Math.abs(offset) / MILLISECONDS_PER_MINUTE;
  const hours = String(Math.floor(offsetMinutes / 60)).padStart(2, '0');
  const minutes = String(offsetMinutes % 60).padStart(2, '0');

  return `${wall}${sign}${hours}:${minutes}`;
}

/**
 * What a period field holds: one of the presets, or two days typed in. Kept as
 * what the person chose and turned into a range by {@link resolvePeriod}, so the
 * field never holds an instant it made up.
 */
export type PeriodSelection =
  { kind: 'preset'; preset: PeriodPreset } | ({ kind: 'custom' } & Partial<CivilDateRange>);

export type PeriodResolution =
  | { ok: true; range: PeriodRange }
  | {
      ok: false;
      /** A day is still missing, or the end comes before the start. */
      reason: 'INCOMPLETE' | 'INVALID';
    };

/**
 * The range a selection means, or why it does not mean one yet. A custom period
 * with an empty day is not an error — the person is still typing — and one that
 * ends before it starts is, and the field says so instead of asking the API.
 */
export function resolvePeriod(
  selection: PeriodSelection,
  now: Date = new Date(),
): PeriodResolution {
  if (selection.kind === 'preset') {
    return { ok: true, range: buildPeriodRange(selection.preset, now) };
  }

  const { startDate, endDate } = selection;

  if (startDate === undefined || startDate === '' || endDate === undefined || endDate === '') {
    return { ok: false, reason: 'INCOMPLETE' };
  }

  try {
    return { ok: true, range: buildPeriodRange({ startDate, endDate }, now) };
  } catch (error) {
    if (error instanceof InvalidPeriodError) {
      return { ok: false, reason: 'INVALID' };
    }

    throw error;
  }
}
