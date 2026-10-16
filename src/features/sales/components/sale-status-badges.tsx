import { StatusBadge } from '@/shared/ui/status-badge';

import { PAYMENT_STATUS_LABELS, PRODUCTION_STATUS_LABELS } from '../model/labels';
import type { Sale } from '../model/sale';
import type { PaymentStatus, ProductionStatus } from '../model/status';

import { PAYMENT_TONES, PRODUCTION_TONES } from './sale-tones';

/**
 * The two seals of a sale, one per axis and never one combined. Both can read
 * "Pendente", so each says which axis it is for in a word only a screen reader
 * hears; on screen the label beside it, or the column, does that.
 */
export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <StatusBadge tone={PAYMENT_TONES[status]}>
      <span className="sr-only">Pagamento: </span>
      {PAYMENT_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function ProductionBadge({ status }: { status: ProductionStatus }) {
  return (
    <StatusBadge tone={PRODUCTION_TONES[status]}>
      <span className="sr-only">Produção: </span>
      {PRODUCTION_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

/** Both seals, each under the name of its axis. */
export function SaleAxisBadges({
  sale,
}: {
  sale: Pick<Sale, 'paymentStatus' | 'productionStatus'>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="text-muted-foreground text-xs">
          Pagamento
        </span>
        <PaymentBadge status={sale.paymentStatus} />
      </span>
      <span className="flex items-center gap-2">
        <span aria-hidden="true" className="text-muted-foreground text-xs">
          Produção
        </span>
        <ProductionBadge status={sale.productionStatus} />
      </span>
    </div>
  );
}
