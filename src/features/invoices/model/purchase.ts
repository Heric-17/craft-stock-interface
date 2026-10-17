import { Money } from '@/shared/money';

import type { PurchasePageDto, PurchaseSummaryDto } from '../api/purchase.dto';

/** What a row says when the note did not name its shop. */
export const UNKNOWN_ESTABLISHMENT_NAME = 'Estabelecimento não identificado';

/** A purchase as the history reads it, money as `Money`. */
export interface PurchaseSummary {
  id: string;
  /** ISO 8601: when the note was issued. */
  purchaseDate: string;
  accessKey: string | null;
  /** The shop's name as the note printed it. */
  establishmentName: string;
  grossTotal: Money;
  discountTotal: Money;
  /** What was paid. */
  netTotal: Money;
  allocationPending: boolean;
  itemCount: number;
  /** `false` for a purchase typed in by hand. */
  hasInvoice: boolean;
}

export interface PurchasePage {
  items: PurchaseSummary[];
  /** The size of the filtered history, not of this page. */
  total: number;
  limit: number;
  offset: number;
}

export function toPurchaseSummary(dto: PurchaseSummaryDto): PurchaseSummary {
  return {
    id: dto.id,
    purchaseDate: dto.purchaseDate,
    accessKey: dto.accessKey,
    establishmentName: dto.establishment?.name ?? UNKNOWN_ESTABLISHMENT_NAME,
    grossTotal: Money.parse(dto.grossTotal),
    discountTotal: Money.parse(dto.discountTotal),
    netTotal: Money.parse(dto.netTotal),
    allocationPending: dto.allocationPending,
    itemCount: dto.itemCount,
    hasInvoice: dto.hasInvoice,
  };
}

export function toPurchasePage(dto: PurchasePageDto): PurchasePage {
  return {
    items: dto.items.map(toPurchaseSummary),
    total: dto.total,
    limit: dto.limit,
    offset: dto.offset,
  };
}

/** How many characters of each end of the key a row shows. */
const KEY_EDGE = 4;

/**
 * The access key short enough for a row and long enough to tell two notes apart:
 * `3524…2345`. The first digits say the state and the month, which every note of
 * a shop shares, so the end carries as much of the difference as the start.
 */
export function shortAccessKey(accessKey: string): string {
  return accessKey.length <= KEY_EDGE * 2
    ? accessKey
    : `${accessKey.slice(0, KEY_EDGE)}…${accessKey.slice(-KEY_EDGE)}`;
}
