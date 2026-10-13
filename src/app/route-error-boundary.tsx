import { useRouteError } from 'react-router';
import { ErrorState } from '@/shared/ui/error-state';
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
