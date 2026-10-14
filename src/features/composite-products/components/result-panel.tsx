import { ChevronDown, ChevronUp } from 'lucide-react';
import { useId, useState } from 'react';

import { formatMoney, formatQuantity } from '@/shared/format';
import { cn } from '@/shared/lib/cn';
import type { Money } from '@/shared/money';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { StatusBadge } from '@/shared/ui/status-badge';

import { bottleneckItem, type CompositeProduct } from '../model/composite-product';
import {
  CAPACITY_TEXT,
  RESULT_SOURCE_LABELS,
  RESULT_SOURCE_NOTES,
  unitsText,
} from '../model/labels';
import type { ResultFigures, ResultSource } from '../model/result-figures';

const MISSING = '—';

interface ResultPanelProps {
  /** `side` is the column beside the form; `summary` is the strip that sticks to the top. */
  variant: 'side' | 'summary';
  source: ResultSource;
  figures: ResultFigures;
  /** The product as the API has it, for capacity and bottleneck. `null` while it is new. */
  saved: CompositeProduct | null;
  /** The lines of the form are not the lines of the saved product. */
  capacityStale: boolean;
}

/**
 * What the screen is for: what this product costs, what it sells for and how
 * many of it can be made with what is on the shelf, and which material is the
 * one that runs out.
 *
 * The prices are the API's for a saved product, or a preview while the form is
 * being edited, and the seal says which. Capacity and the bottleneck are
 * **only** ever the API's: they depend on stock, and nothing on this side
 * calculates them — so while the lines are being changed they keep describing
 * the saved bill, and say so.
 *
 * Beside the form on a wide screen; on a narrower one a summary sticks to the
 * top, because the figure that matters is the one that has to stay in view
 * while the form scrolls.
 */
export function ResultPanel({ variant, source, figures, saved, capacityStale }: ResultPanelProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  if (variant === 'side') {
    return (
      <section
        aria-label="Resultado da ficha técnica"
        className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5"
      >
        <PanelHeader source={source} />
        <ResultBody source={source} figures={figures} saved={saved} capacityStale={capacityStale} />
      </section>
    );
  }

  return (
    <section
      aria-label="Resultado da ficha técnica"
      // Sticks under the header, which is 56px on a phone and 64px from `md`.
      className="border-border bg-card sticky top-14 z-5 flex flex-col gap-3 rounded-xl border p-3 shadow-sm md:top-16 md:p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
          <Figure label="Preço praticado" value={moneyOrDash(figures.finalPrice)} strong />
          <Figure
            label={CAPACITY_TEXT.title}
            value={saved === null ? MISSING : unitsText(saved.productionCapacity)}
            strong
            danger={saved !== null && saved.productionCapacity === 0}
          />
        </div>
        <StatusBadge tone={source === 'saved' ? 'success' : 'info'}>
          {RESULT_SOURCE_LABELS[source]}
        </StatusBadge>
      </div>
      <Button
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((current) => !current)}
        className="self-start"
      >
        {open ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
        {open ? 'Ocultar detalhes' : 'Ver detalhes'}
      </Button>
      {open ? (
        <div id={bodyId} className="flex max-h-[55dvh] flex-col gap-4 overflow-y-auto">
          <ResultBody
            source={source}
            figures={figures}
            saved={saved}
            capacityStale={capacityStale}
          />
        </div>
      ) : null}
    </section>
  );
}

function PanelHeader({ source }: { source: ResultSource }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-base font-bold tracking-tight">Resultado</h2>
      <StatusBadge tone={source === 'saved' ? 'success' : 'info'}>
        {RESULT_SOURCE_LABELS[source]}
      </StatusBadge>
    </div>
  );
}

function ResultBody({
  source,
  figures,
  saved,
  capacityStale,
}: Pick<ResultPanelProps, 'source' | 'figures' | 'saved' | 'capacityStale'>) {
  return (
    <>
      <Capacity saved={saved} stale={capacityStale} />

      <dl className="flex flex-col gap-3">
        <Row label="Custo dos insumos" value={moneyOrDash(figures.materialsCost)} />
        <Row label="Custo fixo" value={moneyOrDash(figures.fixedOperationalCost)} />
        <Row label="Custo total" value={moneyOrDash(figures.totalCost)} strong />
        <div className="border-border border-t pt-3">
          <Row label="Preço sugerido" value={moneyOrDash(figures.suggestedPrice)} strong />
        </div>
        <Row
          label="Preço praticado"
          value={moneyOrDash(figures.finalPrice)}
          strong
          caption={figures.manualPriceSet ? 'preço manual' : 'igual ao sugerido'}
        />
      </dl>

      <p className="text-muted-foreground text-xs text-pretty">{RESULT_SOURCE_NOTES[source]}</p>
    </>
  );
}

function Capacity({ saved, stale }: { saved: CompositeProduct | null; stale: boolean }) {
  if (saved === null) {
    return <Callout tone="neutral">{CAPACITY_TEXT.newProduct}</Callout>;
  }

  const empty = saved.productionCapacity === 0;
  const item = bottleneckItem(saved);

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'flex flex-col gap-1 rounded-lg p-4',
          empty
            ? 'bg-destructive-muted text-destructive'
            : 'bg-secondary text-secondary-foreground',
        )}
      >
        <p className="text-xs font-medium">{CAPACITY_TEXT.title}</p>
        <p className="text-2xl font-bold tracking-tight">{unitsText(saved.productionCapacity)}</p>
        {empty ? (
          <p className="text-sm">
            {saved.bottleneck === null ? CAPACITY_TEXT.noItems : CAPACITY_TEXT.zero}
          </p>
        ) : null}
      </div>

      {saved.bottleneck === null ? null : (
        <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <p className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.08em] uppercase">
            {CAPACITY_TEXT.bottleneck}
          </p>
          <p className="text-base font-bold text-balance">{saved.bottleneck.materialName}</p>
          {item === null ? null : (
            <dl className="grid grid-cols-2 gap-3">
              <Fact label={CAPACITY_TEXT.inStock} value={formatQuantity(item.stockQuantity)} />
              <Fact label={CAPACITY_TEXT.perUnit} value={formatQuantity(item.quantity)} />
            </dl>
          )}
        </div>
      )}

      {stale ? <Callout tone="warning">{CAPACITY_TEXT.stale}</Callout> : null}
    </div>
  );
}

function Figure({
  label,
  value,
  strong = false,
  danger = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <p className="text-muted-foreground text-[0.625rem] font-bold tracking-[0.08em] uppercase">
        {label}
      </p>
      <p
        className={cn(
          'text-base tracking-tight',
          strong && 'font-bold',
          danger && 'text-destructive',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}

function Row({
  label,
  value,
  strong = false,
  caption,
}: {
  label: string;
  value: string;
  strong?: boolean;
  caption?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground flex min-w-0 flex-col text-sm">
        {label}
        {caption === undefined ? null : <span className="text-xs">{caption}</span>}
      </dt>
      <dd className={cn('shrink-0 text-sm whitespace-nowrap', strong && 'text-base font-bold')}>
        {value}
      </dd>
    </div>
  );
}

function moneyOrDash(money: Money | null): string {
  return money === null ? MISSING : formatMoney(money);
}
