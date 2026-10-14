import { z } from 'zod';

import { formatQuantity, parseQuantityInput, type QuantityInputScale } from '@/shared/format';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { StockAdjustmentRequestDto } from '../api/material.dto';

/**
 * The three things a person does to a material's stock by hand. They change
 * the same number and go to the same endpoint, but they are not the same act,
 * and the screen keeps them apart:
 *
 * - `ENTRY`: something arrived. Adds to the stock.
 * - `WRITE_OFF`: something left without a sale — a bottle that broke. Takes
 *   from the stock.
 * - `RECOUNT`: the physical count differs from the system. The stock becomes
 *   exactly the number counted, which may be zero.
 *
 * The API records none of the reasons. What it keeps of a manual change is the
 * old and the new quantity, in the audit log.
 */
export type StockAdjustmentKind = 'ENTRY' | 'WRITE_OFF' | 'RECOUNT';

export interface StockAdjustment {
  kind: StockAdjustmentKind;
  quantity: Quantity;
}

/** The form: which material, how much, and in which unit it was typed. */
export interface StockAdjustmentFormValues {
  materialId: string;
  quantity: string;
  /** Whether `quantity` is typed in the base unit or in kg / L / m. */
  scale: QuantityInputScale;
}

export const EMPTY_STOCK_ADJUSTMENT_FORM: StockAdjustmentFormValues = {
  materialId: '',
  quantity: '',
  scale: 'base',
};

/**
 * Zod checks what it can without knowing the material: that one was chosen and
 * that something was typed. The quantity is read afterwards, in the unit of the
 * chosen material, by {@link readStockAdjustment}.
 */
export const stockAdjustmentSchema = z.object({
  materialId: z.string().min(1, 'Escolha o insumo.'),
  quantity: z.string().trim().min(1, 'Informe a quantidade.'),
  scale: z.enum(['base', 'major']),
});

export type StockAdjustmentReading =
  | { ok: true; adjustment: StockAdjustment }
  | {
      ok: false;
      reason: 'UNREADABLE' | 'NOT_POSITIVE' | 'NEGATIVE' | 'EXCEEDS_STOCK';
      message: string;
    };

/**
 * What the field says, checked against what the action allows.
 *
 * A write-off larger than the stock is refused here, before anything is sent:
 * the backend refuses a negative stock as well (a 422 that says only that the
 * material is invalid), so this is the place that can say what is wrong and by
 * how much. The backend stays the authority; this is the courtesy.
 *
 * A recount may be zero — somebody counted and found nothing — and that is
 * typed, never filled in. The other two must be more than zero.
 */
export function readStockAdjustment(
  kind: StockAdjustmentKind,
  text: string,
  unit: ConsumptionUnit,
  scale: QuantityInputScale,
  currentStock: Quantity,
): StockAdjustmentReading {
  const quantity = parseQuantityInput(text, unit, scale);

  if (quantity === null) {
    return {
      ok: false,
      reason: 'UNREADABLE',
      message: 'Não entendi esse valor. Use números, com vírgula nos decimais e até 3 casas.',
    };
  }

  if (kind === 'RECOUNT') {
    return quantity.isNegative()
      ? { ok: false, reason: 'NEGATIVE', message: 'A contagem não pode ser negativa.' }
      : { ok: true, adjustment: { kind, quantity } };
  }

  if (quantity.compare(Quantity.zero(unit)) <= 0) {
    return {
      ok: false,
      reason: 'NOT_POSITIVE',
      message:
        kind === 'ENTRY'
          ? 'A entrada precisa ser maior do que zero.'
          : 'A baixa precisa ser maior do que zero.',
    };
  }

  if (kind === 'WRITE_OFF' && quantity.compare(currentStock) > 0) {
    return {
      ok: false,
      reason: 'EXCEEDS_STOCK',
      message: `Não dá para dar baixa em mais do que há em estoque (${formatQuantity(currentStock)}).`,
    };
  }

  return { ok: true, adjustment: { kind, quantity } };
}

/**
 * The stock the form will leave behind, shown **as a preview** under the field.
 * The backend has no simulation to ask, and this is an exact addition or
 * subtraction of two quantities; once saved, the screen shows the figure the
 * API answers with, and nothing here outlives that.
 */
export function previewStockAfter(adjustment: StockAdjustment, currentStock: Quantity): Quantity {
  switch (adjustment.kind) {
    case 'ENTRY':
      return currentStock.plus(adjustment.quantity);
    case 'WRITE_OFF':
      return currentStock.minus(adjustment.quantity);
    case 'RECOUNT':
      return adjustment.quantity;
  }
}

/**
 * An entry and a write-off are a `relativeIncrement`, positive and negative —
 * the contract has no field of its own for a decrease. A recount is the
 * `absoluteQuantity`. All of them are manual: `INVOICE_SYNC` belongs to an
 * imported invoice.
 */
export function buildStockAdjustmentRequest(
  adjustment: StockAdjustment,
): StockAdjustmentRequestDto {
  const { kind, quantity } = adjustment;

  switch (kind) {
    case 'ENTRY':
      return { source: 'MANUAL', relativeIncrement: quantity.toApiNumber() };
    case 'WRITE_OFF':
      return {
        source: 'MANUAL',
        relativeIncrement: Quantity.zero(quantity.unit).minus(quantity).toApiNumber(),
      };
    case 'RECOUNT':
      return { source: 'MANUAL', absoluteQuantity: quantity.toApiNumber() };
  }
}
