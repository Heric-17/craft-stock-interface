import { CircleCheck, Filter, ShoppingBag, ShoppingCart } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { useCatalogImages, useProductionPendingSales } from '@/features/sales';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';
import { PageHeader } from '@/shared/ui/page-header';

import { useMaterialPackages, useShoppingList } from '../api/use-shopping-list';
import { SalesPickerSheet } from '../components/sales-picker-sheet';
import { ShoppingListSheet } from '../components/shopping-list-sheet';
import { ShortageSummary } from '../components/shortage-summary';
import { ShortageTable } from '../components/shortage-table';
import {
  isLineMarked,
  onlyMissing,
  resolveSaleSelection,
  toggleLineMark,
  type LineMarks,
  type MaterialPackages,
  type ShoppingListLine,
} from '../model/shopping-list';
import { buildShoppingText, totalFor } from '../model/shopping-text';

interface ShortagesPageProps {
  /**
   * Where the sales are, for the screen that has none to read. The route table
   * owns every path, so the page is told this one instead of spelling it.
   */
  salesPath: string;
}

/**
 * What has to be bought to make the open orders: the sales to count, what they
 * need against the stock, and the list to take to the store.
 *
 * The selection starts as **every sale with production pending** and stays that
 * way — including sales that arrive later — until the person chooses. Everything
 * on the table is the API's answer for those sales: the packages to buy, the
 * estimate of each line and the total. The list that "Gerar lista de compras"
 * makes is text built on the spot from what is ticked, and it is never saved.
 *
 * The mockup also draws "o que dá para produzir depois da compra". The API has
 * no such figure, so there is no such card.
 */
export function ShortagesPage({ salesPath }: ShortagesPageProps) {
  const pending = useProductionPendingSales();
  const images = useCatalogImages();
  const packages = useMaterialPackages();

  // `null` is "all of them", which is not the same as a list that happens to hold
  // every sale there is today.
  const [chosen, setChosen] = useState<ReadonlySet<string> | null>(null);
  const [marks, setMarks] = useState<LineMarks>(new Map());
  const [onlyMissingLines, setOnlyMissingLines] = useState(false);
  const [picking, setPicking] = useState(false);
  const [listText, setListText] = useState<string | null>(null);

  const sales = pending.data?.items;
  const saleIds = useMemo(
    () => resolveSaleSelection(sales?.map((sale) => sale.id) ?? [], chosen),
    [sales, chosen],
  );
  const shopping = useShoppingList(saleIds);

  // The previous answer stays on screen while a new set of sales loads, so it is
  // kept apart from a current one: its total must not read as the new set's.
  const list = saleIds.length === 0 || shopping.isPlaceholderData ? undefined : shopping.data;
  const markedLines = list?.lines.filter((line) => isLineMarked(line, marks)) ?? [];

  function generateList(): void {
    if (list === undefined) {
      return;
    }

    setListText(
      buildShoppingText({
        lines: markedLines,
        packages,
        saleCount: saleIds.length,
        total: totalFor(list, marks),
      }),
    );
  }

  const generateAction = (
    <Button disabled={list === undefined || markedLines.length === 0} onClick={generateList}>
      <ShoppingCart aria-hidden="true" />
      Gerar lista de compras
    </Button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Estoque / Planejamento"
        title="Insumos faltantes"
        description="Uma lista de compras baseada nas vendas selecionadas."
        actions={generateAction}
      />

      {pending.isPending ? (
        <LoadingSkeleton variant="table" />
      ) : pending.isError ? (
        <ErrorState
          error={pending.error}
          title="Não foi possível carregar as vendas"
          onRetry={() => void pending.refetch()}
          retrying={pending.isFetching}
        />
      ) : pending.data.total === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhuma venda com produção pendente"
          description="Quando houver pedidos para montar, o que falta de cada insumo aparece aqui."
          action={
            <Button variant="outline" asChild>
              <Link to={salesPath}>Ver vendas</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ShortageSummary
            saleCount={saleIds.length}
            pendingTotal={pending.data.total}
            onChooseSales={() => setPicking(true)}
            list={list}
          />

          {saleIds.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title="Nenhuma venda escolhida"
              description="Escolha ao menos uma venda para ver o que falta comprar."
              action={
                <Button variant="outline" onClick={() => setPicking(true)}>
                  Escolher vendas
                </Button>
              }
            />
          ) : (
            <section aria-labelledby="need-heading" className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex flex-col gap-1">
                  <h2 id="need-heading" className="text-lg font-bold tracking-tight">
                    Necessidade de insumos
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    O que você precisa comprar para atender aos pedidos. Marque o que entra na
                    lista.
                  </p>
                </div>
                <Button
                  variant={onlyMissingLines ? 'primary' : 'outline'}
                  aria-pressed={onlyMissingLines}
                  onClick={() => setOnlyMissingLines((current) => !current)}
                >
                  <Filter aria-hidden="true" />
                  Apenas faltantes
                </Button>
              </div>

              {shopping.isPending ? (
                <LoadingSkeleton variant="table" />
              ) : shopping.isError ? (
                <ErrorState
                  error={shopping.error}
                  title="Não foi possível calcular o que falta"
                  onRetry={() => void shopping.refetch()}
                  retrying={shopping.isFetching}
                />
              ) : (
                <NeedBody
                  lines={onlyMissingLines ? onlyMissing(shopping.data.lines) : shopping.data.lines}
                  hasAnyLine={shopping.data.lines.length > 0}
                  busy={shopping.isPlaceholderData}
                  packages={packages}
                  marks={marks}
                  onToggle={(line) => setMarks((current) => toggleLineMark(current, line))}
                  onShowAll={() => setOnlyMissingLines(false)}
                />
              )}
            </section>
          )}
        </>
      )}

      {sales === undefined ? null : (
        <SalesPickerSheet
          open={picking}
          onOpenChange={setPicking}
          sales={sales}
          selectedIds={saleIds}
          images={images}
          onApply={setChosen}
        />
      )}
      <ShoppingListSheet
        text={listText}
        onOpenChange={(open) => (open ? undefined : setListText(null))}
      />
    </div>
  );
}

function NeedBody({
  lines,
  hasAnyLine,
  busy,
  packages,
  marks,
  onToggle,
  onShowAll,
}: {
  lines: readonly ShoppingListLine[];
  hasAnyLine: boolean;
  busy: boolean;
  packages: ReadonlyMap<string, MaterialPackages>;
  marks: LineMarks;
  onToggle: (line: ShoppingListLine) => void;
  onShowAll: () => void;
}) {
  if (!hasAnyLine) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title="As vendas escolhidas não usam insumos"
        description="Nenhum item dessas vendas consome insumo do estoque."
      />
    );
  }

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={CircleCheck}
        title="Nada falta"
        description="O estoque cobre todas as vendas escolhidas."
        action={
          <Button variant="outline" onClick={onShowAll}>
            Mostrar todos os insumos
          </Button>
        }
      />
    );
  }

  return (
    <div aria-busy={busy} className={cn('transition-opacity', busy && 'opacity-60')}>
      <ShortageTable lines={lines} packages={packages} marks={marks} onToggle={onToggle} />
    </div>
  );
}
