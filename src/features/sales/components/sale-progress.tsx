import { useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { showErrorToast } from '@/shared/ui/error-toast';
import { SegmentedControl } from '@/shared/ui/segmented-control';

import { PAYMENT_TONES, PRODUCTION_TONES } from './sale-tones';
import { useUpdatePaymentStatus, useUpdateProductionStatus } from '../api/use-sale-mutations';
import { PAYMENT_STATUS_LABELS, PRODUCTION_STATUS_LABELS } from '../model/labels';
import {
  productionConfirmation,
  productionChangeEffect,
  type ProductionChangeEffect,
} from '../model/production-change';
import type { Sale } from '../model/sale';
import {
  PAYMENT_STATUSES,
  PRODUCTION_STATUSES,
  type PaymentStatus,
  type ProductionStatus,
} from '../model/status';

interface SaleProgressProps {
  sale: Sale;
}

/**
 * The two axes of a sale, as two controls that do not know about each other:
 * changing the payment never sends, reads or resets the production, and the
 * other way round. The page says so in so many words, because a single
 * "status" is what people expect and the reason these are two is not obvious.
 *
 * Production is the one that reaches the stock. Assembling a sale debits it
 * and going back to pending returns it, so those two moves ask first, and say
 * which.
 */
export function SaleProgress({ sale }: SaleProgressProps) {
  const updatePayment = useUpdatePaymentStatus();
  const updateProduction = useUpdateProductionStatus();
  // The production the person asked for and has not yet confirmed.
  const [asking, setAsking] = useState<{
    to: ProductionStatus;
    effect: Exclude<ProductionChangeEffect, 'NONE'>;
  } | null>(null);

  function changePayment(paymentStatus: PaymentStatus): void {
    updatePayment.mutate(
      { id: sale.id, paymentStatus },
      {
        onSuccess: () =>
          toast.success(`Pagamento marcado como ${PAYMENT_STATUS_LABELS[paymentStatus]}.`),
        onError: showErrorToast,
      },
    );
  }

  function changeProduction(productionStatus: ProductionStatus): void {
    updateProduction.mutate(
      { id: sale.id, productionStatus },
      {
        onSuccess: () =>
          toast.success(`Produção marcada como ${PRODUCTION_STATUS_LABELS[productionStatus]}.`),
        onError: showErrorToast,
        onSettled: () => setAsking(null),
      },
    );
  }

  function askProduction(to: ProductionStatus): void {
    const effect = productionChangeEffect(sale.productionStatus, to);

    if (effect === 'NONE') {
      changeProduction(to);

      return;
    }

    setAsking({ to, effect });
  }

  const confirmation = asking === null ? null : productionConfirmation(asking.effect, asking.to);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm text-pretty">
        Pagamento e produção são independentes: mudar um não altera o outro.
      </p>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-1">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Pagamento</h3>
          <SegmentedControl
            label="Pagamento"
            options={PAYMENT_STATUSES.map((value) => ({
              value,
              label: PAYMENT_STATUS_LABELS[value],
              tone: PAYMENT_TONES[value],
            }))}
            value={sale.paymentStatus}
            onChange={changePayment}
            disabled={updatePayment.isPending}
            hint="Não mexe na produção nem no estoque."
          />
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Produção</h3>
          <SegmentedControl
            label="Produção"
            options={PRODUCTION_STATUSES.map((value) => ({
              value,
              label: PRODUCTION_STATUS_LABELS[value],
              tone: PRODUCTION_TONES[value],
            }))}
            value={sale.productionStatus}
            onChange={askProduction}
            disabled={updateProduction.isPending}
            hint="Sair de Pendente (Montado ou Entregue) debita o estoque. Voltar para Pendente devolve. Não mexe no pagamento."
          />
        </div>
      </div>

      <ConfirmDialog
        open={asking !== null}
        onOpenChange={(open) => !open && setAsking(null)}
        title={confirmation?.title ?? ''}
        description={
          confirmation === null ? null : (
            <div className="flex flex-col gap-2">
              <p className="text-foreground font-medium">{confirmation.effect}</p>
              <p>{confirmation.note}</p>
            </div>
          )
        }
        confirmLabel={confirmation?.confirmLabel ?? ''}
        pending={updateProduction.isPending}
        onConfirm={() => asking !== null && changeProduction(asking.to)}
      />
    </div>
  );
}
