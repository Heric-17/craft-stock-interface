import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
type StatTone = 'primary' | 'info' | 'warning' | 'danger';
const TONE_CLASSES: Record<StatTone, string> = {
  primary: 'bg-secondary text-secondary-foreground',
  info: 'bg-info-muted text-info',
  warning: 'bg-warning-muted text-warning',
  danger: 'bg-destructive-muted text-destructive',
};
interface StatCardProps {
  label: string;
  value: string;
  caption?: string;
  icon: LucideIcon;
  tone?: StatTone;
}
export function StatCard({ label, value, caption, icon: Icon, tone = 'primary' }: StatCardProps) {
  return (
    <div className="@container border-border bg-card min-w-0 rounded-xl border">
      <div className="flex flex-col items-start gap-3 p-4 @[15rem]:flex-row @[15rem]:items-center @[15rem]:gap-4 sm:p-5">
        <span
          aria-hidden="true"
          className={cn('grid size-11 shrink-0 place-items-center rounded-lg', TONE_CLASSES[tone])}
        >
          <Icon className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-foreground text-xl font-bold tracking-tight">{value}</p>
          {caption === undefined ? null : (
            <p className="text-muted-foreground text-xs">{caption}</p>
          )}
        </div>
      </div>
    </div>
  );
}
