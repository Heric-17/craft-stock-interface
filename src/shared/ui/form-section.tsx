import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/cn';

/** The colour of the icon tile: what the block is about, at a glance. */
type SectionTone = 'primary' | 'info' | 'success' | 'warning';

const TONE_CLASSES: Record<SectionTone, string> = {
  primary: 'bg-secondary text-secondary-foreground',
  info: 'bg-info-muted text-info',
  success: 'bg-success-muted text-success',
  warning: 'bg-warning-muted text-warning',
};

/**
 * A titled block of a screen: a card with what it is for, then its content. An
 * icon, when there is one, sits in a coloured tile beside the title, so a long
 * page can be scanned by colour as well as by reading.
 */
export function FormSection({
  title,
  description,
  icon: Icon,
  tone = 'primary',
  children,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: SectionTone;
  children: ReactNode;
}) {
  return (
    <section className="border-border bg-card shadow-card flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {Icon === undefined ? null : (
          <span
            aria-hidden="true"
            className={cn(
              'grid size-10 shrink-0 place-items-center rounded-lg',
              TONE_CLASSES[tone],
            )}
          >
            <Icon className="size-5" />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          {description === undefined ? null : (
            <p className="text-muted-foreground text-sm text-pretty">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
