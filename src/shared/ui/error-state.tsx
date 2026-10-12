import { Button } from './button';
import { UnexpectedError } from './unexpected-error';

interface ErrorStateProps {
  error: unknown;
  /** Omit when trying again cannot help, e.g. a screen whose address is wrong. */
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
}

/**
 * The error state of a screen that has data to show: what failed, the support
 * code when the failure is ours, and the way to try again. A blank area and a
 * spinner that never ends are the two things this exists to prevent.
 */
export function ErrorState({
  error,
  onRetry,
  retrying = false,
  title = 'Não foi possível carregar',
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-border bg-card flex w-full max-w-xl flex-col items-start gap-4 rounded-xl border p-5 sm:p-6"
    >
      <h2 className="text-foreground text-base font-bold tracking-tight">{title}</h2>
      <UnexpectedError error={error} />
      {onRetry === undefined ? null : (
        <Button variant="outline" onClick={onRetry} disabled={retrying}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
