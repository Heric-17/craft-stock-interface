import type { PeriodSelection } from '@/shared/format';
import { PeriodField } from '@/shared/ui/period-field';
import { SelectField } from '@/shared/ui/select-field';

import { STOCK_LOSS_REASON_LABELS } from '../model/labels';
import { isStockLossReason, STOCK_LOSS_REASONS } from '../model/loss-reason';

interface LossFiltersProps {
  period: PeriodSelection;
  onPeriodChange: (period: PeriodSelection) => void;
  /** Empty for every material. */
  materialId: string;
  onMaterialChange: (materialId: string) => void;
  /** Empty for every reason. */
  reason: string;
  onReasonChange: (reason: string) => void;
  /** Every material, discontinued ones included: a loss outlives the discontinuation. */
  materials: readonly { id: string; name: string }[];
}

/**
 * Period, material and reason: the three parameters of `GET /materials/losses`
 * that a person picks. The list asks the API for the narrowed set, and `total`
 * is the size of it.
 */
export function LossFilters({
  period,
  onPeriodChange,
  materialId,
  onMaterialChange,
  reason,
  onReasonChange,
  materials,
}: LossFiltersProps) {
  const sorted = [...materials].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
      <PeriodField value={period} onChange={onPeriodChange} />
      <SelectField
        label="Insumo"
        value={materialId}
        onChange={(event) => onMaterialChange(event.target.value)}
        className="lg:min-w-52"
      >
        <option value="">Todos os insumos</option>
        {sorted.map((material) => (
          <option key={material.id} value={material.id}>
            {material.name}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Motivo"
        value={isStockLossReason(reason) ? reason : ''}
        onChange={(event) => onReasonChange(event.target.value)}
        className="lg:min-w-44"
      >
        <option value="">Todos os motivos</option>
        {STOCK_LOSS_REASONS.map((value) => (
          <option key={value} value={value}>
            {STOCK_LOSS_REASON_LABELS[value]}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
