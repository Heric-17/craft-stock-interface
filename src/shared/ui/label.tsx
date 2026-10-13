import type { ComponentProps } from 'react';
import { cn } from '@/shared/lib/cn';
export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('text-foreground text-sm leading-none font-medium', className)}
      {...props}
    />
  );
}
