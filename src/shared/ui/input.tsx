import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(
        'border-input bg-card text-foreground placeholder:text-muted-foreground aria-invalid:border-destructive h-11 w-full min-w-0 rounded-md border px-3 text-base transition-colors disabled:opacity-60 md:text-sm',
        className,
      )}
      {...props}
    />
  );
}
