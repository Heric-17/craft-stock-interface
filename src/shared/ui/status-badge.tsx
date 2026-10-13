import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-destructive-muted text-destructive',
  info: 'bg-info-muted text-info',
};
export function StatusBadge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
