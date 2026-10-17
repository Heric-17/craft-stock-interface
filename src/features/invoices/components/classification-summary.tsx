import { Receipt } from 'lucide-react';

import { formatDateTime, formatMoney } from '@/shared/format';
import { FigureTile } from '@/shared/ui/figure-tile';
import { FormSection } from '@/shared/ui/form-section';

import type { PurchaseDetail } from '../model/purchase-detail';

/**
 * The note as a whole: who issued it, when, and the three figures that do not
 * move while the lines are classified — the lines at full price, the discount
 * and what was paid. All of them are the API's.
 */
export function ClassificationSummary({ purchase }: { purchase: PurchaseDetail }) {
  return (
    <FormSection
      title={purchase.establishmentName}
      description={formatDateTime(purchase.purchaseDate)}
      icon={Receipt}
      tone="success"
    >
      <dl className="grid gap-2 sm:grid-cols-3">
        <FigureTile label="Valor bruto">{formatMoney(purchase.grossTotal)}</FigureTile>
        <FigureTile label="Desconto">{formatMoney(purchase.discountTotal)}</FigureTile>
        <FigureTile label="Valor pago" tone="primary">
          {formatMoney(purchase.netTotal)}
        </FigureTile>
      </dl>
    </FormSection>
  );
}
