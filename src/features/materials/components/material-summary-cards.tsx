import { AlertTriangle, Boxes, CircleDollarSign } from 'lucide-react';

import { formatCount, formatMoney } from '@/shared/format';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { StatCard } from '@/shared/ui/stat-card';

import { useInventorySummary } from '../api/use-materials';

/**
 * The three cards at the top of the screen. All three come from the inventory
 * summary, which the backend adds up over every material: this screen never
 * sums the list, which could be a different set from the one the summary
 * covers, and never re-rounds the value, which is rounded per material on the
 * server so that it closes with the `stockValue` of each row.
 *
 * The cards follow the same "include discontinued" switch as the list, and say
 * which of the two they are showing.
 */
export function MaterialSummaryCards({ includeDiscontinued }: { includeDiscontinued: boolean }) {
  const summary = useInventorySummary({ includeDiscontinued });

  if (summary.isPending) {
    return <LoadingSkeleton variant="cards" />;
  }

  if (summary.isError) {
    return (
      <ErrorState
        error={summary.error}
        title="Não foi possível carregar o resumo do estoque"
        onRetry={() => void summary.refetch()}
        retrying={summary.isFetching}
      />
    );
  }

  const { materialCount, belowMinimumCount, totalStockValue } = summary.data;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <StatCard
        icon={Boxes}
        tone="info"
        label="Itens cadastrados"
        value={formatCount(materialCount)}
        caption={includeDiscontinued ? 'Com os descontinuados' : 'Insumos ativos'}
      />
      <StatCard
        icon={AlertTriangle}
        tone="warning"
        label="Abaixo do mínimo"
        value={formatCount(belowMinimumCount)}
        caption={belowMinimumCount === 0 ? 'Tudo em dia' : 'Requer atenção'}
      />
      <div className="sm:col-span-2 xl:col-span-1">
        <StatCard
          icon={CircleDollarSign}
          tone="primary"
          label="Valor em estoque"
          value={formatMoney(totalStockValue)}
          caption="Soma do estoque de todos os insumos"
        />
      </div>
    </div>
  );
}
