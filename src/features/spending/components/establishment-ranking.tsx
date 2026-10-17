import { ChevronRight, Store } from 'lucide-react';
import { Link } from 'react-router';

import { formatCount, formatMoney, formatPeriodPreset } from '@/shared/format';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';

import { useSpendingDataset } from '../api/use-spending-dataset';
import { NO_ESTABLISHMENT_NAME, purchaseCountText } from '../model/labels';
import { purchasesLink } from '../model/purchase-link';
import { establishmentRanking, type RankedEstablishment } from '../model/spending-metrics';

import type { PeriodWindow } from './use-period-window';

/** Enough to see where the money goes; the rest is one tap away in the list. */
const RANKING_SIZE = 5;

interface EstablishmentRankingProps {
  scope: PeriodWindow;
  /** Where the list of purchases is. */
  purchasesPath: string;
}

/**
 * Where the money went, shop by shop, for the period the field chose. A row opens
 * the list of purchases already narrowed to that shop and that period, so what
 * the list adds up to is what the row said.
 *
 * The purchases with no shop on the note are a row like any other, but there is
 * no shop to narrow the list by, so that row is not a link.
 */
export function EstablishmentRanking({ scope, purchasesPath }: EstablishmentRankingProps) {
  const dataset = useSpendingDataset(scope.range);

  return (
    <section
      aria-labelledby="establishment-ranking-title"
      className="border-border bg-card shadow-card flex min-w-0 flex-col rounded-xl border"
    >
      <div className="border-border flex items-start justify-between gap-3 border-b p-4 sm:px-5">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="establishment-ranking-title" className="text-base font-bold tracking-tight">
            Onde você compra
          </h2>
          <p className="text-muted-foreground text-sm text-pretty">
            Onde mais saiu dinheiro · {formatPeriodPreset(scope.preset)}
          </p>
        </div>
      </div>

      {dataset.isPending ? <LoadingSkeleton variant="table" count={3} className="p-4" /> : null}

      {dataset.isError ? (
        <div className="p-4">
          <ErrorState
            error={dataset.error}
            title="Não foi possível carregar os estabelecimentos"
            onRetry={() => void dataset.refetch()}
            retrying={dataset.isFetching}
          />
        </div>
      ) : null}

      {dataset.isSuccess ? (
        <Rows
          ranking={establishmentRanking(dataset.data).slice(0, RANKING_SIZE)}
          scope={scope}
          purchasesPath={purchasesPath}
        />
      ) : null}
    </section>
  );
}

function Rows({
  ranking,
  scope,
  purchasesPath,
}: {
  ranking: readonly RankedEstablishment[];
  scope: PeriodWindow;
  purchasesPath: string;
}) {
  if (ranking.length === 0) {
    return (
      <p className="text-muted-foreground flex items-center gap-3 p-4 text-sm sm:px-5">
        <Store aria-hidden="true" className="size-5 shrink-0" />
        Nenhuma compra neste período.
      </p>
    );
  }

  return (
    <ol className="divide-border divide-y">
      {ranking.map((shop, index) => (
        <li key={shop.key}>
          <ShopRow
            position={index + 1}
            shop={shop}
            href={
              shop.establishmentId === null
                ? undefined
                : purchasesLink(purchasesPath, {
                    establishmentId: shop.establishmentId,
                    preset: scope.preset,
                  })
            }
          />
        </li>
      ))}
    </ol>
  );
}

function ShopRow({
  position,
  shop,
  href,
}: {
  position: number;
  shop: RankedEstablishment;
  href: string | undefined;
}) {
  const content = (
    <>
      <span aria-hidden="true" className="text-muted-foreground w-6 shrink-0 text-xs font-bold">
        {String(position).padStart(2, '0')}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold text-pretty wrap-break-word">
          {shop.name ?? NO_ESTABLISHMENT_NAME}
        </span>
        <span className="text-muted-foreground text-xs">
          {purchaseCountText(shop.purchaseCount, formatCount(shop.purchaseCount))}
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold whitespace-nowrap">
        {formatMoney(shop.netSpend)}
      </span>
      {href === undefined ? null : (
        <ChevronRight aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
      )}
    </>
  );

  const className = 'flex min-h-16 items-center gap-3 p-4 sm:px-5';

  return href === undefined ? (
    <div className={className}>{content}</div>
  ) : (
    <Link
      to={href}
      className={`${className} hover:bg-muted/60 focus-visible:bg-muted/60 transition-colors`}
    >
      {content}
    </Link>
  );
}
