import { useRouteError } from 'react-router';

import { isApiError } from '@/shared/api/api-error';
import { messageForError } from '@/shared/api/error-messages';
import { Button } from '@/shared/ui/button';

/**
 * What a route shows when it fails outright.
 *
 * An unexpected failure shows the support code with a button to copy it:
 * without it the failure the user reports cannot be found in the trail, and
 * "deu erro aqui" is all anyone has to go on. It is the `errorId` when the API
 * recorded one and the `correlationId` otherwise — which is what is left when
 * the response had no body. A stack trace, raw JSON, an error code or an
 * English message never reaches this screen.
 */
export function RouteErrorBoundary() {
  const error = useRouteError();

  const message = isApiError(error)
    ? messageForError(error)
    : 'Algo deu errado ao abrir esta tela. Tente novamente.';

  const errorId = isApiError(error) ? error.supportId : undefined;

  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-4 py-12">
      <h1 className="text-xl font-bold tracking-tight">Não foi possível abrir esta tela</h1>
      <p className="text-muted-foreground text-sm">{message}</p>

      {errorId === undefined ? null : (
        <div className="border-border bg-card w-full rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Envie este código para o suporte</p>
          <div className="mt-2 flex items-center gap-3">
            <code className="bg-muted rounded px-2 py-1 text-xs">{errorId}</code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void navigator.clipboard.writeText(errorId)}
            >
              Copiar código
            </Button>
          </div>
        </div>
      )}

      <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
    </div>
  );
}
