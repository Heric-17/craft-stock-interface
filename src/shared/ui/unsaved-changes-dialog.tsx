import type { Blocker } from 'react-router';

import { ConfirmDialog } from './confirm-dialog';

/**
 * The question asked when a form with unsaved changes is about to be left. The
 * safe answer — stay and keep working — is the one the dialog closes on; leaving
 * is a deliberate, red choice.
 */
export function UnsavedChangesDialog({
  blocker,
  what = 'o que você preencheu',
}: {
  blocker: Blocker;
  /** What would be lost: "as alterações desta ficha técnica". */
  what?: string;
}) {
  return (
    <ConfirmDialog
      open={blocker.state === 'blocked'}
      onOpenChange={(open) => {
        if (!open && blocker.state === 'blocked') {
          blocker.reset();
        }
      }}
      title="Sair sem salvar?"
      description={
        <div className="flex flex-col gap-2">
          <p className="text-foreground">Você tem alterações que ainda não foram salvas.</p>
          <p>Se sair agora, {what} será perdido.</p>
        </div>
      }
      confirmLabel="Sair sem salvar"
      cancelLabel="Continuar editando"
      destructive
      onConfirm={() => {
        if (blocker.state === 'blocked') {
          blocker.proceed();
        }
      }}
    />
  );
}
