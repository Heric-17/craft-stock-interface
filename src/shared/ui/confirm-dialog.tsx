import * as AlertDialog from '@radix-ui/react-alert-dialog';
import type { ReactNode } from 'react';
import { Button } from './button';
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancelar',
  destructive = false,
  pending = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
        }
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="bg-foreground/40 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-40" />
        <AlertDialog.Content className="border-border bg-card text-card-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-xl border p-5 shadow-lg sm:p-6">
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
            <AlertDialog.Title className="text-base font-bold tracking-tight">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description asChild>
              <div className="text-muted-foreground text-sm">{description}</div>
            </AlertDialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {}
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              disabled={pending}
              onClick={onConfirm}
            >
              {pending ? 'Aguarde…' : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
