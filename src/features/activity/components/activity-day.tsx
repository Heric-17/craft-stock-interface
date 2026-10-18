import { Pencil, Plus, Trash2, type LucideIcon } from 'lucide-react';

import { formatClock } from '@/shared/format';
import { cn } from '@/shared/lib/cn';

import { describeActivity, type ActivityContext } from '../model/activity-sentence';
import type { ActivityDay } from '../model/group-by-day';

/** What each operation looks like, by colour as well as by shape: made, changed, removed. */
const OPERATION_STYLE: Record<string, { icon: LucideIcon; tile: string }> = {
  CREATE: { icon: Plus, tile: 'bg-success-muted text-success' },
  UPDATE: { icon: Pencil, tile: 'bg-info-muted text-info' },
  DELETE: { icon: Trash2, tile: 'bg-destructive-muted text-destructive' },
};

const OTHER_OPERATION = { icon: Pencil, tile: 'bg-secondary text-secondary-foreground' };

interface ActivityDayProps {
  day: ActivityDay;
  context: ActivityContext;
}

/**
 * One day of the feed: its heading and, under it, a row per entry with the
 * sentence the model made, the lines that say what changed and the time.
 */
export function ActivityDayGroup({ day, context }: ActivityDayProps) {
  return (
    <section aria-label={day.label} className="flex flex-col gap-2">
      <h2 className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
        {day.label}
      </h2>
      <ul className="border-border bg-card shadow-card divide-border divide-y overflow-hidden rounded-xl border">
        {day.entries.map((entry) => {
          const { sentence, details } = describeActivity(entry, context);
          const style = OPERATION_STYLE[entry.operation] ?? OTHER_OPERATION;
          const Icon = style.icon;

          return (
            <li key={entry.id} className="flex items-start gap-3 p-4">
              <span
                aria-hidden="true"
                className={cn('grid size-10 shrink-0 place-items-center rounded-lg', style.tile)}
              >
                <Icon className="size-5" />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-foreground text-sm font-semibold text-pretty [overflow-wrap:anywhere]">
                  {sentence}
                </p>
                {details.length === 0 ? null : (
                  <ul className="text-muted-foreground flex flex-col gap-0.5 text-sm">
                    {details.map((line) => (
                      <li key={line} className="text-pretty [overflow-wrap:anywhere]">
                        {line}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <time
                dateTime={entry.occurredAt}
                className="text-muted-foreground shrink-0 pt-0.5 text-xs tabular-nums"
              >
                {formatClock(entry.occurredAt)}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
