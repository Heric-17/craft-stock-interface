import { Money } from '@/shared/money';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type {
  LossTotalsDto,
  StockLossDatasetDto,
  StockLossDto,
  StockLossPageDto,
  StockLossResultDto,
} from '../api/stock-loss.dto';

import { isStockLossReason, type StockLossReason } from './loss-reason';

/**
 * A loss as the list reads it.
 *
 * `value` is the API's, derived there from the cost frozen when the loss was
 * recorded — which is why changing the material's price afterwards does not
 * move it. Nothing here multiplies a quantity by a price.
 */
export interface StockLoss {
  id: string;
  materialId: string;
  materialName: string;
  /** What was lost, positive. `null` when the material's unit is not known. */
  quantity: Quantity | null;
  reason: StockLossReason;
  observation: string | null;
  value: Money;
  /** ISO 8601. */
  createdAt: string;
}

export interface StockLossPage {
  items: StockLoss[];
  /** The size of the filtered set, not of this page. */
  total: number;
  limit: number;
  offset: number;
}

/** A reason this build has never heard of is shown as "Outro": it does not break the list. */
function toReason(value: string): StockLossReason {
  return isStockLossReason(value) ? value : 'OTHER';
}

export function toStockLoss(dto: StockLossDto, unit: ConsumptionUnit | undefined): StockLoss {
  return {
    id: dto.id,
    materialId: dto.materialId,
    materialName: dto.materialName,
    quantity: unit === undefined ? null : Quantity.fromApi(dto.quantity, unit),
    reason: toReason(dto.reason),
    observation: dto.observation,
    value: Money.parse(dto.value),
    createdAt: dto.createdAt,
  };
}

export function toStockLossPage(
  dto: StockLossPageDto,
  unitOf: (materialId: string) => ConsumptionUnit | undefined,
): StockLossPage {
  return {
    items: dto.items.map((item) => toStockLoss(item, unitOf(item.materialId))),
    total: dto.total,
    limit: dto.limit,
    offset: dto.offset,
  };
}

/**
 * What recording a loss answered with, which the toast shows: the balance that
 * is left and what the loss was worth — both the API's, the second derived there
 * from the cost of the material at the moment of the loss.
 */
export interface StockLossResult {
  id: string;
  value: Money;
  stockQuantityAfter: Quantity;
}

export function toStockLossResult(dto: StockLossResultDto, unit: ConsumptionUnit): StockLossResult {
  return {
    id: dto.id,
    value: Money.parse(dto.value),
    stockQuantityAfter: Quantity.fromApi(dto.stockQuantityAfter, unit),
  };
}

// -- The period's dataset ----------------------------------------------------

export interface LossCell {
  lossCount: number;
  lossValue: Money;
}

export interface StockLossDataset {
  months: (LossCell & { month: string })[];
  byReason: (LossCell & { reason: StockLossReason })[];
  byMaterial: (LossCell & { materialId: string; materialName: string })[];
}

function toCell(dto: LossTotalsDto): LossCell {
  return { lossCount: dto.lossCount, lossValue: Money.parse(dto.lossValue) };
}

export function toStockLossDataset(dto: StockLossDatasetDto): StockLossDataset {
  return {
    months: dto.byMonth.map((cell) => ({ month: cell.month, ...toCell(cell) })),
    byReason: dto.byReason.map((cell) => ({ reason: toReason(cell.reason), ...toCell(cell) })),
    byMaterial: dto.byMaterial.map((cell) => ({
      materialId: cell.materialId,
      materialName: cell.materialName,
      ...toCell(cell),
    })),
  };
}

/**
 * What was lost in the period: the dataset's own months added up.
 *
 * A month is a cell the API closed — each loss counted once, in the month it
 * was recorded — so adding cells is exact, for the
 * count as much as for the value. What this never does is add up the rows of
 * the paginated list: a page is a window onto the list, and a sum over it is
 * a plausible wrong number.
 */
export function periodLossTotals(dataset: StockLossDataset): LossCell {
  return {
    lossCount: dataset.months.reduce((total, month) => total + month.lossCount, 0),
    lossValue: Money.sum(dataset.months.map((month) => month.lossValue)),
  };
}

/** The reasons that cost something in the period, biggest first. */
export function reasonsWithLosses(dataset: StockLossDataset): StockLossDataset['byReason'] {
  return dataset.byReason
    .filter((cell) => cell.lossCount > 0)
    .sort((a, b) => b.lossValue.compare(a.lossValue));
}

/** The material that lost the most in the period, or `null` when nothing was lost. */
export function biggestLossMaterial(
  dataset: StockLossDataset,
): StockLossDataset['byMaterial'][number] | null {
  return dataset.byMaterial.reduce<StockLossDataset['byMaterial'][number] | null>(
    (biggest, cell) =>
      cell.lossCount > 0 && (biggest === null || cell.lossValue.compare(biggest.lossValue) > 0)
        ? cell
        : biggest,
    null,
  );
}
