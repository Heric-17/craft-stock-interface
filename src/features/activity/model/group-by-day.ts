import { businessDayNumber, formatBusinessDay } from '@/shared/format';

import type { ActivityEntry } from './activity-entry';

export interface ActivityDay {
  /** The calendar day in Sao Paulo, as a number: two entries of one day share it. */
  key: number;
  /** "Hoje", "Ontem", "12 jun". */
  label: string;
  entries: ActivityEntry[];
}

/**
 * Cuts a page of the feed into days of the business calendar, keeping the order
 * the API gave (newest first). A day is a run of neighbours: the feed is sorted,
 * so the entries of a day are always together.
 *
 * Grouping is of the page on screen. A day that continues on the next page
 * shows its heading again there, which is honest — the heading says the day, not
 * how many entries it has.
 */
export function groupByDay(
  entries: readonly ActivityEntry[],
  now: Date = new Date(),
): ActivityDay[] {
  const days: ActivityDay[] = [];

  for (const entry of entries) {
    const key = businessDayNumber(entry.occurredAt);
    const last = days[days.length - 1];

    if (last !== undefined && last.key === key) {
      last.entries.push(entry);
    } else {
      days.push({ key, label: formatBusinessDay(entry.occurredAt, now), entries: [entry] });
    }
  }

  return days;
}
