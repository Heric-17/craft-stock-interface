import type { ApiError } from '@/shared/api/api-error';
import { ErrorState } from '@/shared/ui/error-state';
import { Skeleton } from '@/shared/ui/skeleton';
import { retryRestoreSession } from '../api/use-session';
export function SessionLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-background grid min-h-dvh place-items-center px-4"
    >
      <span className="sr-only">Carregando…</span>
      <div aria-hidden="true" className="flex w-full max-w-xs flex-col items-center gap-4">
        <Skeleton className="size-10 rounded-xl" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
    </div>
  );
}
export function SessionRestoreFailed({ error }: { error: ApiError }) {
  return (
    <div className="bg-background grid min-h-dvh place-items-center px-4 py-8">
      <ErrorState
        title="Não foi possível abrir o CraftStock"
        error={error}
        onRetry={retryRestoreSession}
      />
    </div>
  );
}
