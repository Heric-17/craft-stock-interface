import { formatDateTime, formatMarginPercent, formatMoney, formatQuantity } from '@/shared/format';
import { basisPointsFromDecimalString, Money, parseDecimalString } from '@/shared/money';
import { isConsumptionUnit, Quantity, type ConsumptionUnit } from '@/shared/quantity';

import { DISCONTINUATION_VALUES, MAX_TEXT_LENGTH, type FieldKind } from './labels';

/** Whether a side of a change holds nothing: the field was unset, or cleared. */
export function isEmptyValue(raw: unknown): boolean {
  return raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '');
}

export interface ValueContext {
  /** The unit a quantity on this side is in, when it can be known. */
  unit: ConsumptionUnit | null;
  now: Date;
}

/**
 * A value written for a person, or `null` when it cannot be written honestly.
 *
 * `null` is deliberate: a quantity whose unit is unknown, a date that is not
 * one, a decimal the contract does not allow — each is left out of the sentence
 * instead of printed raw, because "10" with no unit, or a value in the
 * database's own spelling, is worse than saying less.
 */
export function formatFieldValue(
  kind: FieldKind,
  raw: unknown,
  context: ValueContext,
): string | null {
  switch (kind.type) {
    case 'text':
      return typeof raw === 'string' ? truncate(raw.trim()) : null;

    case 'money': {
      const decimal = parseDecimalString(raw);

      return decimal === null ? null : formatMoney(Money.parse(decimal));
    }

    case 'quantity': {
      const decimal = parseDecimalString(raw);

      if (decimal === null || context.unit === null) {
        return null;
      }

      return formatQuantity(Quantity.parse(decimal, context.unit));
    }

    case 'percent': {
      const basisPoints = basisPointsFromDecimalString(typeof raw === 'string' ? raw : '');

      return basisPoints === null ? null : formatMarginPercent(basisPoints);
    }

    case 'basisPoints':
      return typeof raw === 'number' && Number.isInteger(raw) && raw >= 0
        ? formatMarginPercent(raw)
        : null;

    case 'enum':
      return typeof raw === 'string' && Object.hasOwn(kind.labels, raw)
        ? (kind.labels[raw] ?? null)
        : null;

    case 'date':
      return readDate(raw, context.now);

    case 'flag':
      return typeof raw === 'boolean' ? (raw ? kind.whenTrue : kind.whenFalse) : null;

    case 'discontinuation':
      return isEmptyValue(raw)
        ? DISCONTINUATION_VALUES.active
        : DISCONTINUATION_VALUES.discontinued;

    // The value of a photo is where it is stored, which means nothing to anyone.
    case 'image':
      return null;
  }
}

/** A consumption unit read off a change, when it holds one this build knows. */
export function readUnit(raw: unknown): ConsumptionUnit | null {
  return isConsumptionUnit(raw) ? raw : null;
}

function readDate(raw: unknown, now: Date): string | null {
  if (typeof raw !== 'string') {
    return null;
  }

  try {
    return formatDateTime(raw, now);
  } catch {
    return null;
  }
}

function truncate(text: string): string {
  return text.length <= MAX_TEXT_LENGTH ? text : `${text.slice(0, MAX_TEXT_LENGTH).trimEnd()}…`;
}
