/**
 * Why stock was lost, as the API names it. A closed list: the person picks one
 * and nothing else is accepted, so a loss can always be grouped by it.
 */
export const STOCK_LOSS_REASONS = ['BREAKAGE', 'EXPIRED', 'SPOILAGE', 'LOST', 'OTHER'] as const;

export type StockLossReason = (typeof STOCK_LOSS_REASONS)[number];

export function isStockLossReason(value: unknown): value is StockLossReason {
  return typeof value === 'string' && STOCK_LOSS_REASONS.includes(value as StockLossReason);
}

/** The longest observation the API accepts. */
export const MAX_OBSERVATION_LENGTH = 500;
