import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { formatDateTime } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { StatusBadge } from '@/shared/ui/status-badge';
import { SupportCode } from '@/shared/ui/support-code';

import { useReprocessInvoice } from '../api/use-invoice-mutations';
import { attemptsText, INVOICE_STATE_DESCRIPTIONS, INVOICE_STATE_LABELS } from '../model/labels';
import { deriveInvoiceState, type PendingInvoice } from '../model/pending-invoice';

import { InvoiceFailure } from './invoice-failure';
import {
  INVOICE_STATE_ICONS,
  INVOICE_STATE_TONES,
  INVOICE_TILE_CLASSES,
} from './invoice-state-style';

interface PendingInvoiceRowProps {
  invoice: PendingInvoice;
  /** The clock the state is read against: a capture that has waited too long is not "processing". */
  now: Date;
  classificationPath: (purchaseId: string) => string;
}

/**
 * One note that has not been read yet. The API does not say which shop it is or
 * what it came to — that is only known once it has been read — so the row is
 * named by the one thing that tells two of them apart: when it was sent.
 */
export function PendingInvoiceRow({ invoice, now, classificationPath }: PendingInvoiceRowProps) {
  const state = deriveInvoiceState(invoice, now);
  const tone = INVOICE_STATE_TONES[state];
  const Icon = INVOICE_STATE_ICONS[state];
  const reprocess = useReprocessInvoice();

  const canRetry =
    state === 'STALLED' || state === 'SOURCE_UNAVAILABLE' || state === 'STRUCTURE_CHANGED';

  function retry(): void {
    reprocess.mutate(invoice.id, {
      onSuccess: () => toast.success('Nota importada. Já dá para classificar os itens.'),
    });
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:px-5" data-state={state}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn(
              'grid size-11 shrink-0 place-items-center rounded-lg',
              INVOICE_TILE_CLASSES[tone],
            )}
          >
            <Icon
              className={cn(
                'size-5',
                state === 'PROCESSING' && 'animate-spin motion-reduce:animate-none',
              )}
            />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm font-semibold">Enviada {formatDateTime(invoice.createdAt)}</p>
            <p className="text-muted-foreground text-xs text-pretty">{progress(invoice, state)}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={tone}>{INVOICE_STATE_LABELS[state]}</StatusBadge>

          {canRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={reprocess.isPending}
              onClick={retry}
            >
              <RefreshCw
                aria-hidden="true"
                className={
                  reprocess.isPending ? 'animate-spin motion-reduce:animate-none' : undefined
                }
              />
              {reprocess.isPending ? 'Tentando…' : 'Tentar novamente'}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-muted-foreground text-sm text-pretty">
        {INVOICE_STATE_DESCRIPTIONS[state]}
      </p>

      {/* The queue carries no error code of its own: the id of the capture is what the log of the failed attempt is filed under. */}
      {state === 'STRUCTURE_CHANGED' ? <SupportCode code={invoice.id} /> : null}

      {reprocess.isError ? (
        <InvoiceFailure error={reprocess.error} classificationPath={classificationPath} />
      ) : null}
    </li>
  );
}

function progress(invoice: PendingInvoice, state: ReturnType<typeof deriveInvoiceState>): string {
  if (invoice.lastAttemptAt === null) {
    return state === 'PROCESSING' ? 'Primeira leitura em andamento' : 'Nenhuma tentativa concluída';
  }

  return `${attemptsText(invoice.attemptCount)} · última ${formatDateTime(invoice.lastAttemptAt)}`;
}
