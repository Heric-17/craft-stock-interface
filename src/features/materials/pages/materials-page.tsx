import { Boxes, PackageMinus, Plus, SearchX, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { formatCount } from '@/shared/format';
import { useDebouncedValue } from '@/shared/lib/use-debounced-value';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { PageHeader } from '@/shared/ui/page-header';

import { useMaterials } from '../api/use-materials';
import { MaterialDetailSheet } from '../components/material-detail-sheet';
import { MaterialCards } from '../components/material-cards';
import { MaterialFilters } from '../components/material-filters';
import { MaterialFormSheet } from '../components/material-form-sheet';
import { MaterialSummaryCards } from '../components/material-summary-cards';
import { StockAdjustmentSheet } from '../components/stock-adjustment-sheet';
import type { StockFilter } from '../model/labels';
import type { Material } from '../model/material';
import type { StockAdjustmentKind } from '../model/stock-adjustment';

/** How long the search box waits for the person to stop typing. */
const SEARCH_DELAY_MS = 300;

/**
 * The address parameter that opens a material's detail. It lives in the URL so
 * a link, a reload or the back button all land on the same material — and so
 * this feature needs no route of its own beyond `/insumos`.
 */
const DETAIL_PARAM = 'insumo';

interface MaterialsPageProps {
  /**
   * Where the loss history is, relative to this screen. The route table owns
   * every path, so the page is told this one instead of spelling it.
   */
  lossesPath: string;
}

export function MaterialsPage({ lossesPath }: MaterialsPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const detailId = searchParams.get(DETAIL_PARAM);

  const [search, setSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [includeDiscontinued, setIncludeDiscontinued] = useState(false);

  // Each sheet keeps its target after closing, so the content does not turn
  // into something else while it slides out.
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ open: boolean; material?: Material }>({ open: false });
  const [adjusting, setAdjusting] = useState<{
    open: boolean;
    kind: StockAdjustmentKind;
    material?: Material;
  }>({ open: false, kind: 'ENTRY' });

  const name = useDebouncedValue(search.trim(), SEARCH_DELAY_MS);
  const list = useMaterials({
    name: name === '' ? undefined : name,
    includeDiscontinued,
  });

  // The API has no low-stock parameter. The list is a bounded set that comes
  // back whole, so narrowing it here hides nothing from anyone; the `lowStock`
  // flag it narrows by is the backend's, not a comparison made on this side.
  const visible = (list.data ?? []).filter(
    (material) => stockFilter === 'all' || material.lowStock,
  );
  const filtering = name !== '' || stockFilter !== 'all';

  const detailOpen = detailId !== null && !editing.open && !adjusting.open;

  function closeDetail(): void {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(DETAIL_PARAM);

        return next;
      },
      { replace: true },
    );
  }

  function clearFilters(): void {
    setSearch('');
    setStockFilter('all');
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Estoque"
        title="Insumos"
        description="Acompanhe tudo o que entra e sai da sua produção."
        actions={
          <>
            <Button variant="secondary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" />
              Novo insumo
            </Button>
            <Button onClick={() => setAdjusting({ open: true, kind: 'ENTRY' })}>
              <SlidersHorizontal aria-hidden="true" />
              Ajustar estoque
            </Button>
            <Button asChild variant="outline">
              <Link to={lossesPath}>
                <PackageMinus aria-hidden="true" />
                Perdas
              </Link>
            </Button>
          </>
        }
      />

      <MaterialSummaryCards includeDiscontinued={includeDiscontinued} />

      <MaterialFilters
        search={search}
        onSearchChange={setSearch}
        stockFilter={stockFilter}
        onStockFilterChange={setStockFilter}
        includeDiscontinued={includeDiscontinued}
        onIncludeDiscontinuedChange={setIncludeDiscontinued}
      />

      {list.isPending ? (
        <LoadingSkeleton variant="table" />
      ) : list.isError ? (
        <ErrorState
          error={list.error}
          title="Não foi possível carregar os insumos"
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      ) : visible.length === 0 ? (
        filtering ? (
          <EmptyState
            icon={SearchX}
            title="Nenhum insumo encontrado"
            description="Nenhum insumo combina com a busca e o filtro escolhidos."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Limpar busca e filtro
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Boxes}
            title="Nenhum insumo cadastrado"
            description="Cadastre o primeiro insumo para acompanhar estoque, custo e quanto dá para produzir."
            action={
              <Button onClick={() => setCreating(true)}>
                <Plus aria-hidden="true" />
                Novo insumo
              </Button>
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {visible.length === 1 ? '1 insumo' : `${formatCount(visible.length)} insumos`}
          </p>
          <MaterialCards
            materials={visible}
            hrefFor={(material) => `?${DETAIL_PARAM}=${encodeURIComponent(material.id)}`}
          />
        </div>
      )}

      <MaterialDetailSheet
        materialId={detailOpen ? detailId : null}
        lossesPath={lossesPath}
        onClose={closeDetail}
        onEdit={(material) => setEditing({ open: true, material })}
        onAdjustStock={(material, kind) => setAdjusting({ open: true, kind, material })}
      />

      <MaterialFormSheet open={creating} onOpenChange={setCreating} />

      <MaterialFormSheet
        open={editing.open}
        onOpenChange={(open) => setEditing((current) => ({ ...current, open }))}
        material={editing.material}
      />

      <StockAdjustmentSheet
        open={adjusting.open}
        onOpenChange={(open) => setAdjusting((current) => ({ ...current, open }))}
        kind={adjusting.kind}
        material={adjusting.material}
      />
    </div>
  );
}
