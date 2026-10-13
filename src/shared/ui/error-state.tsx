import { Button } from './button';
import { UnexpectedError } from './unexpected-error';
interface ErrorStateProps {
  error: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
}
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
