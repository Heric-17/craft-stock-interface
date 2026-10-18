import { describe, expect, it } from 'vitest';

import type { ActivityEntry } from './activity-entry';
import { groupByDay } from './group-by-day';

const NOW = new Date('2026-10-12T17:00:00-03:00');

function at(id: string, occurredAt: string): ActivityEntry {
  return {
    id,
    occurredAt,
    userId: null,
    entityType: 'Material',
    entityId: 'mat-1',
    entityLabel: null,
    operation: 'UPDATE',
    intent: null,
    changes: {},
  };
}

describe('groupByDay', () => {
  it('puts the entries of one day together, keeping the order of the feed', () => {
    const days = groupByDay(
      [
        at('a', '2026-10-12T14:00:00-03:00'),
        at('b', '2026-10-12T09:00:00-03:00'),
        at('c', '2026-10-11T22:00:00-03:00'),
      ],
      NOW,
    );

    expect(days.map((day) => [day.label, day.entries.map((entry) => entry.id)])).toEqual([
      ['Hoje', ['a', 'b']],
      ['Ontem', ['c']],
    ]);
  });

  it('cuts the day by the calendar of Sao Paulo, not by UTC', () => {
    // 21:30 on 11 October in Sao Paulo is already 12 October in UTC.
    const days = groupByDay(
      [at('late', '2026-10-12T00:30:00Z'), at('morning', '2026-10-11T12:00:00-03:00')],
      NOW,
    );

    expect(days).toHaveLength(1);
    expect(days[0]?.label).toBe('Ontem');
    expect(days[0]?.entries.map((entry) => entry.id)).toEqual(['late', 'morning']);
  });

  it('writes the year of a day that is not in this one', () => {
    const [day] = groupByDay([at('old', '2025-12-30T09:00:00-03:00')], NOW);

    expect(day?.label).toBe('30 dez 2025');
  });

  it('gives an empty page no days', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});
