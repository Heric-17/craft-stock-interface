import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

type FigureTone = 'neutral' | 'primary';

const TONE_CLASSES: Record<FigureTone, string> = {
  neutral: 'bg-muted',
  primary: 'bg-secondary text-secondary-foreground',
};

/**
 * One figure the person has to read while working: what it is, small, and its
 * value, large. It goes inside a `<dl>`, so a screen reader hears "label, value".
 *
 * The size is deliberate — a cost or a stock beside the field being filled is
 * what the typing is checked against, and it is not a caption.
 */
export function FigureTile({
  label,
  children,
  tone = 'neutral',
  className,
}: {
  label: string;
  children: ReactNode;
  tone?: FigureTone;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5 rounded-lg px-3 py-2.5',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <dt className={cn('text-sm', tone === 'primary' ? 'font-semibold' : 'text-muted-foreground')}>
        {label}
      </dt>
      <dd className="text-xl font-bold whitespace-nowrap">{children}</dd>
    </div>
  );
}
