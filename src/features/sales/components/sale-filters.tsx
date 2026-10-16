import { Button } from '@/shared/ui/button';
import { SelectField } from '@/shared/ui/select-field';

import {
  PAYMENT_FILTER_ALL,
  PAYMENT_STATUS_LABELS,
  PRODUCTION_FILTER_ALL,
  PRODUCTION_STATUS_LABELS,
} from '../model/labels';
import {
  isPaymentStatus,
  isProductionStatus,
  PAYMENT_STATUSES,
  PRODUCTION_STATUSES,
  type PaymentStatus,
  type ProductionStatus,
} from '../model/status';

interface SaleFiltersProps {
  paymentStatus: PaymentStatus | undefined;
  onPaymentStatusChange: (value: PaymentStatus | undefined) => void;
  productionStatus: ProductionStatus | undefined;
  onProductionStatusChange: (value: ProductionStatus | undefined) => void;
  onClear: () => void;
}

/**
 * Two filters, one per axis, independent of each other: payment narrows by
 * whether it was paid, production by how far it got, and they combine. Both go
 * to the API as the parameters it accepts — the list is a page of a history
 * that grows, and filtering the page here would make `total` a lie.
 */
export function SaleFilters({
  paymentStatus,
  onPaymentStatusChange,
  productionStatus,
  onProductionStatusChange,
  onClear,
}: SaleFiltersProps) {
  const narrowed = paymentStatus !== undefined || productionStatus !== undefined;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,16rem))_auto] lg:items-end">
      <SelectField
        label="Pagamento"
        value={paymentStatus ?? ''}
        onChange={(event) =>
          onPaymentStatusChange(
            isPaymentStatus(event.target.value) ? event.target.value : undefined,
          )
        }
      >
        <option value="">{PAYMENT_FILTER_ALL}</option>
        {PAYMENT_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PAYMENT_STATUS_LABELS[status]}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Produção"
        value={productionStatus ?? ''}
        onChange={(event) =>
          onProductionStatusChange(
            isProductionStatus(event.target.value) ? event.target.value : undefined,
          )
        }
      >
        <option value="">{PRODUCTION_FILTER_ALL}</option>
        {PRODUCTION_STATUSES.map((status) => (
          <option key={status} value={status}>
            {PRODUCTION_STATUS_LABELS[status]}
          </option>
        ))}
      </SelectField>
      {narrowed ? (
        <Button
          type="button"
          variant="ghost"
          onClick={onClear}
          className="sm:col-span-2 lg:col-span-1"
        >
          Limpar filtros
        </Button>
      ) : null}
    </div>
  );
}
