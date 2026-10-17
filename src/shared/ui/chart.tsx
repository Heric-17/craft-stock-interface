import type { CSSProperties, ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';

import { cn } from '@/shared/lib/cn';

/**
 * A series of a chart: the name a legend or a screen reader says, and the theme
 * token that paints it. `color` is a CSS value that points at a token —
 * `var(--primary)` — never a colour typed out, so the chart follows the theme
 * with the rest of the screen.
 */
export type ChartConfig = Record<string, { label: string; color: string }>;

interface ChartContainerProps {
  config: ChartConfig;
  /** What the chart shows, for a screen reader: the drawing itself is not read out. */
  label: string;
  /** Height of the drawing, in pixels. The width is whatever the container gives. */
  height: number;
  /**
   * The narrowest the drawing may get. Under it the container scrolls on its own
   * instead of squeezing the bars until their labels overlap, and the page around
   * it never gets wider.
   */
  minWidth?: number;
  className?: string;
  children: ReactNode;
}

/**
 * The frame every chart of the application sits in, in the manner of shadcn's
 * `ChartContainer`: it makes the series colours available as `--color-<series>`,
 * paints the axes, grid and labels of Recharts from the theme tokens, and sizes
 * the drawing to its container.
 *
 * The container is also where the horizontal scroll lives. A chart with many
 * bars is wider than a phone, and that width belongs to this box, not to the page.
 */
export function ChartContainer({
  config,
  label,
  height,
  minWidth,
  className,
  children,
}: ChartContainerProps) {
  const colors = Object.fromEntries(
    Object.entries(config).map(([key, series]) => [`--color-${key}`, series.color]),
  ) as CSSProperties;

  return (
    <div
      role="img"
      aria-label={label}
      className={cn('min-w-0 overflow-x-auto overscroll-x-contain', className)}
    >
      <div
        style={{ ...colors, height, minWidth }}
        className={cn(
          'w-full',
          '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
          '[&_.recharts-cartesian-grid_line]:stroke-border',
          '[&_.recharts-surface]:outline-hidden',
          '[&_.recharts-rectangle]:outline-hidden',
        )}
      >
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height }}>
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ChartTooltipCardProps {
  title: string;
  /** One line per figure: what it is, and the figure already formatted. */
  rows: readonly { label: string; value: string }[];
  /** A sentence under the figures, for what the reader must not take for granted. */
  note?: string | undefined;
}

/**
 * What a tooltip says. Every figure arrives already written by `shared/format`
 * from the original value object: the tooltip never formats the `number` the bar
 * was positioned with.
 */
export function ChartTooltipCard({ title, rows, note }: ChartTooltipCardProps) {
  return (
    <div className="border-border bg-card text-card-foreground shadow-card grid max-w-60 gap-1.5 rounded-lg border px-3 py-2 text-xs">
      <p className="text-sm font-bold">{title}</p>
      {rows.map((row) => (
        <p key={row.label} className="flex items-baseline justify-between gap-4">
          <span className="text-muted-foreground">{row.label}</span>
          <span className="font-semibold whitespace-nowrap">{row.value}</span>
        </p>
      ))}
      {note === undefined ? null : <p className="text-warning text-pretty">{note}</p>}
    </div>
  );
}
