import type { ComponentProps } from 'react';

import { cn } from '@/shared/lib/cn';

/**
 * A placeholder with the shape of the content that is coming. Deliberately not
 * a spinner: a spinner says "something is happening", a skeleton says what is
 * about to be there, and the screen does not jump when it arrives.
 */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('bg-muted animate-pulse rounded-md', className)}
      {...props}
    />
  );
}
