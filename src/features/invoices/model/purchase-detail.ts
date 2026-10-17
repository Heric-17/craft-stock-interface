import { Money } from '@/shared/money';
import { Quantity } from '@/shared/quantity';

import type { PurchaseDetailDto, PurchaseItemDto } from '../api/purchase.dto';

import type { DiscountAllocationMode } from './discount-mode';
import { UNKNOWN_ESTABLISHMENT_NAME } from './purchase';

/** One line of a purchase, the way the classification screen reads it. */
export interface PurchaseLine {
  id: string;
  description: string;
  /**
   * How many the note printed, in {@link printedUnit}. It counts packages, not
   * what is inside them, so it carries no consumption unit: `UNIT` is only the
   * container the digits are held in.
   */
  quantity: Quantity;
  /** The unit as the note printed it, with the till's numeric suffix taken off. */
  printedUnit: string | null;
  /** Always the full price of the line, before any discount. */
  grossValue: Money;
  allocatedDiscount: Money;
  isCompanyExpense: boolean;
  isStockMaterial: boolean;
  materialId: string | null;
}

/** A purchase with its lines: the header of the note and what it bought. */
export interface PurchaseDetail {
  id: string;
  /** ISO 8601: when the note was issued. */
  purchaseDate: string;
  establishmentName: string;
  grossTotal: Money;
  discountTotal: Money;
  /** What was paid. */
  netTotal: Money;
  discountAllocationMode: DiscountAllocationMode;
  /** The discount was invalidated by an edit and has not been spread again. */
  allocationPending: boolean;
  /** Only a note with a discount is asked how to spread it. */
  requiresDiscountAllocationChoice: boolean;
  lines: PurchaseLine[];
}

/**
 * The units a till prints, so that `UND9` can be read as `UN` and an unknown
 * code is left exactly as printed. The backend normalises the same way on the
 * lines of an import answer; the purchase read does not carry that field.
 */
const KNOWN_PRINTED_UNITS = [
  'UN',
  'UND',
  'KG',
  'G',
  'MG',
  'L',
  'ML',
  'PCT',
  'CX',
  'PC',
  'DZ',
  'FD',
  'BDJ',
  'GFA',
] as const;

const TRAILING_TILL_SUFFIX = /\d+$/;

/**
 * `UND9` is `UN` and `KG9` is `KG`: the number at the end is the till's, not the
 * note's. A code that is not one of the known units is kept as printed — cutting
 * a suffix off something unrecognised would hide what the note really said.
 *
 * Only for reading. It never becomes a consumption unit or a package quantity.
 */
export function readablePrintedUnit(printed: string | null): string | null {
  if (printed === null) {
    return null;
  }

  const trimmed = printed.trim();
  const candidate = trimmed.toUpperCase().replace(TRAILING_TILL_SUFFIX, '');

  if ((KNOWN_PRINTED_UNITS as readonly string[]).includes(candidate)) {
    return candidate === 'UND' ? 'UN' : candidate;
  }

  return trimmed === '' ? null : trimmed;
}

function toPurchaseLine(dto: PurchaseItemDto): PurchaseLine {
  return {
    id: dto.id,
    description: dto.description,
    quantity: Quantity.fromApi(dto.quantity, 'UNIT'),
    printedUnit: readablePrintedUnit(dto.unit),
    grossValue: Money.parse(dto.grossValue),
    allocatedDiscount: Money.parse(dto.allocatedDiscount),
    isCompanyExpense: dto.isCompanyExpense,
    isStockMaterial: dto.isStockMaterial,
    materialId: dto.materialId,
  };
}

/**
 * The API says nothing about the order of the lines, and the screen must not
 * reshuffle them every time it reads the purchase again. They are put in
 * alphabetical order, with the id to break a tie.
 */
function byDescription(a: PurchaseLine, b: PurchaseLine): number {
  return a.description.localeCompare(b.description, 'pt-BR') || a.id.localeCompare(b.id);
}

export function toPurchaseDetail(dto: PurchaseDetailDto): PurchaseDetail {
  const discountTotal = Money.parse(dto.discountTotal);

  return {
    id: dto.id,
    purchaseDate: dto.purchaseDate,
    establishmentName: dto.establishment?.name ?? UNKNOWN_ESTABLISHMENT_NAME,
    grossTotal: Money.parse(dto.grossTotal),
    discountTotal,
    netTotal: Money.parse(dto.netTotal),
    discountAllocationMode: dto.discountAllocationMode,
    allocationPending: dto.allocationPending,
    // The API's own rule for its `requiresDiscountAllocationChoice`: the note has a discount.
    requiresDiscountAllocationChoice: !discountTotal.isZero(),
    lines: dto.items.map(toPurchaseLine).sort(byDescription),
  };
}
