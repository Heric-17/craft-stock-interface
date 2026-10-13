import type { ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';
interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow === undefined ? null : (
          <p className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.1em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description === undefined ? null : (
          <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
        )}
      </div>
      {actions === undefined ? null : (
        <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:shrink-0 sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </header>
  );
}
