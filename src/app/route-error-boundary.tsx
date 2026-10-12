import { useRouteError } from 'react-router';

import { ErrorState } from '@/shared/ui/error-state';

/**
 * What a route shows when it fails outright.
 *
 * An unexpected failure carries the support code with a button to copy it —
 * `ErrorState` owns that, so this screen and every inline error state tell the
 * same story. Retrying reloads the page: the route itself is what broke, so
 * there is no narrower thing to repeat.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  return (
    <div className="mx-auto flex max-w-xl px-4 py-12">
      <ErrorState
        title="Não foi possível abrir esta tela"
        error={error}
        onRetry={() => window.location.reload()}
      />
    </div>
  );
}
