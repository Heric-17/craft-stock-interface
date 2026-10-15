import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { resolvePeriod, type PeriodSelection } from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { PageHeader } from '@/shared/ui/page-header';

import { useMaterials } from '../api/use-materials';
import { LossFilters } from '../components/loss-filters';
import { LossHistory } from '../components/loss-history';
import { LossPeriodCard } from '../components/loss-period-card';
import { isStockLossReason } from '../model/loss-reason';

/** The API's default page, and a size that reads well on a phone. */
const PAGE_SIZE = 20;

/**
 * The address parameters the filters live in, so a link — "Ver perdas deste
 * insumo", a reload, the back button — lands on the same list.
 */
const MATERIAL_PARAM = 'materialId';
const REASON_PARAM = 'reason';

/** A year, so a link from one material does not hide a loss from last quarter. */
const DEFAULT_PERIOD: PeriodSelection = { kind: 'preset', preset: 'LAST_12_MONTHS' };

/**
 * Everything that left the stock without a sale: what it was, why, and what it
 * cost — and the one action the history allows, reversing a loss.
 *
 * Two different questions are answered by two different sources, and kept
 * apart on purpose. "How much did I lose in this period" is the dataset's, in
 * the card. "Which losses were they" is the paginated list's. Nothing in the
 * card is added up from the list.
 */
export function MaterialLossesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const materialId = searchParams.get(MATERIAL_PARAM) ?? '';
  const reasonParam = searchParams.get(REASON_PARAM) ?? '';
  const reason = isStockLossReason(reasonParam) ? reasonParam : '';

  const [period, setPeriod] = useState<PeriodSelection>(DEFAULT_PERIOD);
  const [offset, setOffset] = useState(0);

  const materials = useMaterials({ includeDiscontinued: true });
  const resolution = resolvePeriod(period);

  function setParam(name: string, value: string): void {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);

        if (value === '') {
          next.delete(name);
        } else {
          next.set(name, value);
        }

        return next;
      },
      { replace: true },
    );
    // A different filter is a different list: it starts from its first page.
    setOffset(0);
  }

  function clearFilters(): void {
    setSearchParams({}, { replace: true });
    setOffset(0);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Estoque"
        title="Perdas de estoque"
        description="Tudo o que saiu do estoque sem ser por venda, com o motivo e quanto custou."
        actions={
          <Button asChild variant="outline">
            <Link to=".." relative="path">
              <ArrowLeft aria-hidden="true" />
              Voltar para insumos
            </Link>
          </Button>
        }
      />

      <LossFilters
        period={period}
        onPeriodChange={(next) => {
          setPeriod(next);
          setOffset(0);
        }}
        materialId={materialId}
        onMaterialChange={(value) => setParam(MATERIAL_PARAM, value)}
        reason={reason}
        onReasonChange={(value) => setParam(REASON_PARAM, value)}
        materials={materials.data ?? []}
      />

      {resolution.ok ? (
        <>
          <LossPeriodCard range={resolution.range} />
          <LossHistory
            filters={{
              from: resolution.range.from,
              to: resolution.range.to,
              materialId: materialId === '' ? undefined : materialId,
              reason: reason === '' ? undefined : reason,
              limit: PAGE_SIZE,
              offset,
            }}
            narrowed={materialId !== '' || reason !== ''}
            onOffsetChange={setOffset}
            onClearFilters={clearFilters}
          />
        </>
      ) : (
        <Callout tone="info">
          {resolution.reason === 'INCOMPLETE'
            ? 'Escolha o primeiro e o último dia do período para ver as perdas.'
            : 'Corrija o período: a data final vem antes da inicial.'}
        </Callout>
      )}
    </div>
  );
}
