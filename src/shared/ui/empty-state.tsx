import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'border-border bg-card flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-10 text-center',
        className,
      )}
    >
      {Icon === undefined ? null : (
        <span
          aria-hidden="true"
          className="bg-secondary text-secondary-foreground grid size-12 place-items-center rounded-full"
        >
          <Icon className="size-6" />
        </span>
      )}
      <h2 className="text-foreground text-base font-bold tracking-tight">{title}</h2>
      {description === undefined ? null : (
        <p className="text-muted-foreground max-w-sm text-sm text-pretty">{description}</p>
      )}
      {action === undefined ? null : <div className="mt-1">{action}</div>}
    </div>
  );
}
