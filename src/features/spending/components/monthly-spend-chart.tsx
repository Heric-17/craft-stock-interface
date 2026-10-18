import { BarChart3 } from 'lucide-react';
import { Link } from 'react-router';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Tooltip, XAxis, YAxis } from 'recharts';

import {
  formatCount,
  formatMonthLabel,
  formatMonthName,
  formatMoney,
  formatPeriodPreset,
} from '@/shared/format';
import { Button } from '@/shared/ui/button';
import { ChartContainer, ChartTooltipCard, type ChartConfig } from '@/shared/ui/chart';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingSkeleton } from '@/shared/ui/loading-skeleton';

import { useSpendingDataset } from '../api/use-spending-dataset';
import {
  purchaseCountText,
  RUNNING_MONTH_BADGE,
  RUNNING_MONTH_CHART_NOTE,
  RUNNING_MONTH_LEGEND,
} from '../model/labels';
import { monthlySeries, type MonthlyPoint } from '../model/spending-metrics';

import type { PeriodWindow } from './use-period-window';

/** What each bar gets, so that the label above it never runs into its neighbour's. */
const BAR_SLOT_WIDTH = 80;
const CHART_HEIGHT = 260;

const CHART_CONFIG: ChartConfig = {
  spend: { label: 'Gasto no mês', color: 'var(--primary)' },
};

/**
 * One bar of the chart. The `value` positions the bar and nothing else: the text
 * on the bar and in the tooltip is the `Money` formatted, written here before the
 * chart ever sees it.
 */
interface ChartDatum {
  month: string;
  value: number;
  text: string;
  partial: boolean;
  tooltip: { title: string; rows: { label: string; value: string }[] };
}

function toDatum(point: MonthlyPoint): ChartDatum {
  return {
    month: point.month,
    // The one place a `Money` becomes a `number`, to give a bar its height.
    value: point.netSpend.toChartValue(),
    text: formatMoney(point.netSpend),
    partial: point.partial,
    tooltip: {
      title: point.partial
        ? `${formatMonthName(point.month)} (${RUNNING_MONTH_BADGE})`
        : formatMonthName(point.month),
      rows: [
        { label: 'Gasto', value: formatMoney(point.netSpend) },
        { label: 'Descontos', value: formatMoney(point.discountTotal) },
        { label: 'Compras', value: formatCount(point.purchaseCount) },
      ],
    },
  };
}

interface TickProps {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string | number };
}

interface TooltipProps {
  active?: boolean | undefined;
  payload?: readonly { payload?: ChartDatum }[] | undefined;
}

interface MonthlySpendChartProps {
  scope: PeriodWindow;
  /** Where importing a note goes, for a period with nothing in it. */
  importPath: string;
}

/**
 * The months of the period, one bar each, as bars of what was paid.
 *
 * The running month is drawn apart — dashed and lighter, labelled "em andamento"
 * under the axis and in the tooltip — because the period always ends with it, and
 * set beside closed months a bar that has not finished looks like a month that
 * went badly. Months without a purchase are bars at zero, not gaps.
 *
 * What the bars say is also in a table, which is what a screen reader reads: the
 * drawing is an image to it. The chart scrolls inside its own box when the months
 * do not fit, and never makes the page wider.
 */
export function MonthlySpendChart({ scope, importPath }: MonthlySpendChartProps) {
  const dataset = useSpendingDataset(scope.range);

  return (
    <section
      aria-labelledby="monthly-spend-title"
      className="border-border bg-card shadow-card flex min-w-0 flex-col gap-4 rounded-xl border p-4 sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id="monthly-spend-title" className="text-base font-bold tracking-tight">
          Gastos por mês
        </h2>
        <p className="text-muted-foreground text-sm text-pretty">
          O valor pago em cada mês · {formatPeriodPreset(scope.preset)}
        </p>
      </div>

      {dataset.isPending ? <LoadingSkeleton variant="cards" count={1} /> : null}

      {dataset.isError ? (
        <ErrorState
          error={dataset.error}
          title="Não foi possível carregar o gráfico"
          onRetry={() => void dataset.refetch()}
          retrying={dataset.isFetching}
        />
      ) : null}

      {dataset.isSuccess && dataset.data.months.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhuma compra neste período"
          description="Nenhuma nota entrou nos gastos nestes meses. Importe uma nota ou escolha outro período."
          action={
            <Button asChild variant="outline">
              <Link to={importPath}>Importar nota</Link>
            </Button>
          }
        />
      ) : null}

      {dataset.isSuccess && dataset.data.months.length > 0 ? (
        <Chart points={monthlySeries(dataset.data, scope.months, scope.currentMonth)} />
      ) : null}
    </section>
  );
}

function Chart({ points }: { points: readonly MonthlyPoint[] }) {
  const data = points.map(toDatum);
  // Two `jan` on one axis are two different months: the year goes in as soon as the
  // period crosses a turn of it.
  const years = new Set(points.map((point) => point.month.slice(0, 4)));
  const withYear = years.size > 1;
  const hasRunningMonth = points.some((point) => point.partial);

  return (
    <div className="flex flex-col gap-3">
      <ChartContainer
        config={CHART_CONFIG}
        label="Gráfico de barras com o valor pago em cada mês. Os mesmos valores estão na tabela abaixo."
        height={CHART_HEIGHT}
        minWidth={data.length * BAR_SLOT_WIDTH}
      >
        <BarChart
          data={data}
          margin={{ top: 28, right: 8, bottom: 8, left: 8 }}
          barCategoryGap="22%"
        >
          <CartesianGrid vertical={false} />
          {/* Hidden: the labels over the bars carry the values, and an axis of `number`s would be a second formatting of them. */}
          <YAxis hide domain={[0, 'auto']} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            interval={0}
            height={44}
            tick={(props: TickProps) => <MonthTick {...props} withYear={withYear} data={data} />}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
            content={(props: TooltipProps) => <MonthTooltip {...props} />}
          />
          {/* A month at zero keeps a sliver of bar: without one Recharts draws nothing, and its label "R$ 0,00" goes with it. */}
          <Bar dataKey="value" radius={[6, 6, 0, 0]} minPointSize={2} isAnimationActive={false}>
            {data.map((datum) => (
              <Cell
                key={datum.month}
                fill="var(--color-spend)"
                fillOpacity={datum.partial ? 0.35 : 1}
                stroke="var(--color-spend)"
                strokeWidth={datum.partial ? 2 : 0}
                strokeDasharray={datum.partial ? '5 4' : undefined}
              />
            ))}
            <LabelList
              dataKey="text"
              position="top"
              className="fill-foreground text-xs font-semibold"
            />
          </Bar>
        </BarChart>
      </ChartContainer>

      {hasRunningMonth ? (
        <p className="text-muted-foreground text-xs text-pretty">{RUNNING_MONTH_LEGEND}</p>
      ) : null}

      {/* The wrapper is what is hidden: a table is never narrower than its content, so
          `sr-only` on the table itself kept its full width and pushed the page sideways. */}
      <div className="sr-only">
        <table>
          <caption>Valor pago por mês</caption>
          <thead>
            <tr>
              <th scope="col">Mês</th>
              <th scope="col">Gasto</th>
              <th scope="col">Compras</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.month}>
                <th scope="row">
                  {formatMonthName(point.month)}
                  {point.partial ? ` (${RUNNING_MONTH_BADGE})` : ''}
                </th>
                <td>{formatMoney(point.netSpend)}</td>
                <td>{purchaseCountText(point.purchaseCount, formatCount(point.purchaseCount))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The month under its bar, and under that "em andamento" for the one still
 * running, so the difference is on the axis itself and not only in a tooltip that
 * a thumb may never open.
 */
function MonthTick({
  x = 0,
  y = 0,
  payload,
  withYear,
  data,
}: TickProps & { withYear: boolean; data: readonly ChartDatum[] }) {
  const month = String(payload?.value ?? '');
  const partial = data.find((datum) => datum.month === month)?.partial === true;

  return (
    <text x={x} y={y} textAnchor="middle" className="fill-muted-foreground text-xs">
      <tspan x={x} dy="1em" className={partial ? 'fill-foreground font-semibold' : undefined}>
        {formatMonthLabel(month, withYear)}
      </tspan>
      {partial ? (
        <tspan x={x} dy="1.25em">
          {RUNNING_MONTH_BADGE}
        </tspan>
      ) : null}
    </text>
  );
}

function MonthTooltip({ active, payload }: TooltipProps) {
  const datum = payload?.[0]?.payload;

  if (active !== true || datum === undefined) {
    return null;
  }

  return (
    <ChartTooltipCard
      title={datum.tooltip.title}
      rows={datum.tooltip.rows}
      note={datum.partial ? RUNNING_MONTH_CHART_NOTE : undefined}
    />
  );
}
