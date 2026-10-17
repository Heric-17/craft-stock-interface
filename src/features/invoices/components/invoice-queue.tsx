import { useNow } from '@/shared/lib/use-now';
import { ErrorState } from '@/shared/ui/error-state';

import { usePendingInvoices } from '../api/use-pending-invoices';
import { hasProcessingInvoice, mergeNewestFirst } from '../model/pending-invoice';

import { PendingInvoiceRow } from './pending-invoice-row';

/**
 * The most the queue asks for. It is the API's ceiling, and a queue that holds
 * more than that has a problem a list cannot fix: the screen says so rather
 * than pretending the rest is not there.
 */
const QUEUE_LIMIT = 100;

/** How often the clock the states are read against moves on, with the screen otherwise still. */
const CLOCK_REFRESH_MS = 30_000;

/**
 * The notes that have been sent and not read yet — being read right now, or
 * waiting because the portal is down or changed. Once a note is read it is a
 * purchase and leaves this list for the history, so this one is empty most of
 * the time, and then it is not on the screen at all.
 *
 * It exists because scanning and finishing are not the same moment, and not even
 * the same device: a note scanned at the counter that the portal would not give
 * up is kept here, and tried again from whichever screen is open.
 *
 * Two questions to the API rather than one list narrowed here: the queue is
 * asked for each status it can be stuck in, so what shows is what the API
 * filtered and the counts are its own.
 */
export function InvoiceQueue({
  classificationPath,
}: {
  classificationPath: (purchaseId: string) => string;
}) {
  const waiting = usePendingInvoices({ status: 'PENDING', limit: QUEUE_LIMIT, offset: 0 });
  const parked = usePendingInvoices({ status: 'UNSTABLE', limit: QUEUE_LIMIT, offset: 0 });
  const now = useNow(CLOCK_REFRESH_MS);

  const failed = waiting.isError ? waiting : parked.isError ? parked : null;

  if (failed !== null) {
    return (
      <ErrorState
        error={failed.error}
        title="Não foi possível carregar as notas aguardando leitura"
        onRetry={() => {
          void waiting.refetch();
          void parked.refetch();
        }}
        retrying={waiting.isFetching || parked.isFetching}
      />
    );
  }

  // Nothing to say until both have answered, and nothing to say if neither has anything.
  if (waiting.data === undefined || parked.data === undefined) {
    return null;
  }

  const invoices = mergeNewestFirst(waiting.data.items, parked.data.items);

  if (invoices.length === 0) {
    return null;
  }

  const watching = hasProcessingInvoice(waiting.data.items, now);
  const hidden = waiting.data.total + parked.data.total - invoices.length;

  return (
    <section
      aria-labelledby="invoice-queue-title"
      className="border-border bg-card shadow-card flex flex-col rounded-xl border"
    >
      <div className="border-border flex flex-col gap-1 border-b p-4 sm:px-5">
        <h2 id="invoice-queue-title" className="text-base font-bold tracking-tight">
          Notas aguardando leitura
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          Estas notas foram enviadas, mas ainda não foram lidas. Nada se perde: elas ficam guardadas
          aqui até darem certo, e você pode tentar de novo em qualquer aparelho.
        </p>
        {watching ? (
          <p className="text-info text-sm" aria-live="polite">
            Acompanhando as notas em processamento…
          </p>
        ) : null}
      </div>
      <ul aria-label="Notas aguardando leitura" className="divide-border divide-y">
        {invoices.map((invoice) => (
          <PendingInvoiceRow
            key={invoice.id}
            invoice={invoice}
            now={now}
            classificationPath={classificationPath}
          />
        ))}
      </ul>
      {hidden > 0 ? (
        <p className="text-muted-foreground border-border border-t p-4 text-sm sm:px-5">
          Mostrando as {invoices.length} mais recentes. Há mais {hidden} guardadas.
        </p>
      ) : null}
    </section>
  );
}
