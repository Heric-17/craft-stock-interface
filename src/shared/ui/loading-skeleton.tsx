import { cn } from '@/shared/lib/cn';
import { Skeleton } from './skeleton';
type LoadingSkeletonVariant = 'table' | 'cards' | 'form';
interface LoadingSkeletonProps {
  variant: LoadingSkeletonVariant;
  count?: number;
  className?: string;
}
const DEFAULT_COUNT: Record<LoadingSkeletonVariant, number> = {
  table: 5,
  cards: 3,
  form: 4,
};
export function LoadingSkeleton({ variant, count, className }: LoadingSkeletonProps) {
  const amount = count ?? DEFAULT_COUNT[variant];
  const items = Array.from({ length: amount }, (_, index) => index);
  return (
    <div role="status" aria-busy="true" className={cn('w-full', className)}>
      <span className="sr-only">Carregando…</span>
      {variant === 'table' ? (
        <div
          aria-hidden="true"
          className="border-border bg-card flex flex-col overflow-hidden rounded-xl border"
        >
          <div className="border-border flex items-center gap-3 border-b p-4">
            <Skeleton className="h-11 w-full max-w-60" />
          </div>
          {items.map((item) => (
            <div
              key={item}
              className="border-border flex items-center gap-4 border-b p-4 last:border-b-0"
            >
              <Skeleton className="size-11 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="hidden h-4 w-20 md:block" />
              <Skeleton className="hidden h-4 w-20 md:block" />
            </div>
          ))}
        </div>
      ) : null}
      {variant === 'cards' ? (
        <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item}
              className="border-border bg-card flex items-center gap-4 rounded-xl border p-4 sm:p-5"
            >
              <Skeleton className="size-11 shrink-0 rounded-lg" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-6 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {variant === 'form' ? (
        <div aria-hidden="true" className="flex max-w-xl flex-col gap-5">
          {items.map((item) => (
            <div key={item} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
          <Skeleton className="h-11 w-32" />
        </div>
      ) : null}
    </div>
  );
}
