import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

import type { StatusTone } from './status-badge';

type CalloutTone = Exclude<StatusTone, 'success'>;

const TONE_CLASSES: Record<CalloutTone, string> = {
  neutral: 'bg-muted text-foreground',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-destructive-muted text-destructive',
  info: 'bg-info-muted text-info',
};

/**
 * A boxed note inside a form or a panel: what a change will cause, or why a
 * control is off. `alert` makes a screen reader announce it when it appears.
 */
export function Callout({
  tone = 'info',
  alert = false,
  children,
  className,
}: {
  tone?: CalloutTone;
  alert?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={alert ? 'alert' : 'note'}
      className={cn('rounded-md px-3 py-2.5 text-sm text-pretty', TONE_CLASSES[tone], className)}
    >
      {children}
    </div>
  );
}
