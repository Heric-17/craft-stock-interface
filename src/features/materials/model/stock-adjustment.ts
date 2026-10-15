import { z } from 'zod';

import { formatQuantity, parseQuantityInput, type QuantityInputScale } from '@/shared/format';
import { Quantity, type ConsumptionUnit } from '@/shared/quantity';

import type { StockEntryRequestDto } from '../api/material.dto';
import type { RecordLossRequestDto } from '../api/stock-loss.dto';

import { isStockLossReason, MAX_OBSERVATION_LENGTH, type StockLossReason } from './loss-reason';

/**
 * The three things a person does to a material's stock by hand. They change
 * the same number, but they are not the same act, and the screen keeps them
 * apart — even though two of them reach the API by the same route:
 *
 * - `ENTRY`: something arrived. Adds to the stock (`stock-entries`).
 * - `WRITE_OFF`: something left without a sale — a bottle that broke, a batch
 *   that expired. Takes from the stock and is kept, with its reason, as a loss
 *   (`losses`). It is a quantity **taken**, typed positive: nobody
 *   types "-1 bottle".
 * - `RECOUNT`: the physical count differs from the system. The stock becomes
 *   exactly the number counted, which may be zero (`stock-entries`).
 */
export type StockAdjustmentKind = 'ENTRY' | 'WRITE_OFF' | 'RECOUNT';

export interface StockAdjustment {
  kind: StockAdjustmentKind;
  quantity: Quantity;
}

/** The form: which material, how much, in which unit it was typed, and for a loss, why. */
export interface StockAdjustmentFormValues {
  materialId: string;
  quantity: string;
  /** Whether `quantity` is typed in the base unit or in kg / L / m. */
  scale: QuantityInputScale;
  /** Only read for a write-off. Starts empty: a reason is chosen, never assumed. */
  reason: string;
  /** Only read for a write-off. Optional. */
  observation: string;
}

export const EMPTY_STOCK_ADJUSTMENT_FORM: StockAdjustmentFormValues = {
  materialId: '',
  quantity: '',
  scale: 'base',
  reason: '',
  observation: '',
};

/**
 * Zod checks what it can without knowing the material: that one was chosen,
 * that something was typed and, for a write-off, that a reason was picked. The
 * quantity is read afterwards, in the unit of the chosen material, by
 * {@link readStockAdjustment}.
 */
export function stockAdjustmentSchemaFor(kind: StockAdjustmentKind) {
  return z
    .object({
      materialId: z.string().min(1, 'Escolha o insumo.'),
      quantity: z.string().trim().min(1, 'Informe a quantidade.'),
      scale: z.enum(['base', 'major']),
      reason: z.string(),
      observation: z.string(),
    })
    .superRefine((values, ctx) => {
      if (kind !== 'WRITE_OFF') {
        return;
      }

      const details = readLossDetails(values.reason, values.observation);

      if (!details.ok) {
        ctx.addIssue({ code: 'custom', path: [details.field], message: details.message });
      }
    });
}

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
 * A write-off larger than the stock is refused here, before anything is sent,
 * and the message is the one the API would give: how much there is. The
 * backend stays the authority — it refuses with `INSUFFICIENT_STOCK` if the
 * stock changed under the screen — and this is what keeps the ordinary case
 * from ever making the round trip.
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
      message: `Você tem apenas ${formatQuantity(currentStock)} em estoque.`,
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

/** Why and how a loss is explained: the reason from the closed list, and a free note. */
export interface LossDetails {
  reason: StockLossReason;
  /** `null` when left empty: an optional field that was not filled is absent. */
  observation: string | null;
}

export type LossDetailsReading =
  | { ok: true; details: LossDetails }
  | { ok: false; field: 'reason' | 'observation'; message: string };

export function readLossDetails(reasonText: string, observationText: string): LossDetailsReading {
  if (!isStockLossReason(reasonText)) {
    return { ok: false, field: 'reason', message: 'Escolha o motivo da baixa.' };
  }

  const observation = observationText.trim();

  if (observation.length > MAX_OBSERVATION_LENGTH) {
    return {
      ok: false,
      field: 'observation',
      message: `A observação pode ter até ${MAX_OBSERVATION_LENGTH} caracteres.`,
    };
  }

  return {
    ok: true,
    details: { reason: reasonText, observation: observation === '' ? null : observation },
  };
}

/**
 * An entry is a `relativeIncrement` and a recount the `absoluteQuantity`, both
 * on `stock-entries` and both manual: `INVOICE_SYNC` belongs to an imported
 * invoice. A write-off is not one of them — the API refuses a negative
 * increment there — and goes through {@link buildLossRequest}.
 */
export function buildStockEntryRequest(adjustment: StockAdjustment): StockEntryRequestDto {
  const { kind, quantity } = adjustment;

  switch (kind) {
    case 'ENTRY':
      return { source: 'MANUAL', relativeIncrement: quantity.toApiNumber() };
    case 'RECOUNT':
      return { source: 'MANUAL', absoluteQuantity: quantity.toApiNumber() };
    case 'WRITE_OFF':
      throw new Error('A write-off is a loss, not a stock entry: use buildLossRequest.');
  }
}

/** A loss: the quantity **taken**, positive, as the API wants it, with why. */
export function buildLossRequest(quantity: Quantity, details: LossDetails): RecordLossRequestDto {
  return {
    quantity: quantity.toApiNumber(),
    reason: details.reason,
    ...(details.observation === null ? {} : { observation: details.observation }),
  };
}
