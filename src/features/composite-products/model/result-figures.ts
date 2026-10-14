import type { Money } from '@/shared/money';

import type { PricingDraft, PricingPreview } from './bom-preview';
import type { CompositeProduct } from './composite-product';

/**
 * The figures the result panel shows, from one of two sources and in one
 * shape: what the API answered for a saved product, or what the preview made
 * of the form. `null` is a figure that cannot be shown yet, and the panel
 * writes a dash for it.
 *
 * Capacity and the bottleneck are not here. They exist only as the API's
 * answer, for the saved product, and the panel takes them from it directly.
 */
export interface ResultFigures {
  materialsCost: Money | null;
  fixedOperationalCost: Money | null;
  totalCost: Money | null;
  suggestedPrice: Money | null;
  /** The practiced price: the manual one when there is one, the suggested otherwise. */
  finalPrice: Money | null;
  manualPriceSet: boolean;
}

export function figuresOfProduct(product: CompositeProduct): ResultFigures {
  return {
    materialsCost: product.materialsCost,
    fixedOperationalCost: product.fixedOperationalCost,
    totalCost: product.totalCost,
    suggestedPrice: product.suggestedPrice,
    finalPrice: product.finalPrice,
    manualPriceSet: product.manualPrice !== null,
  };
}

export function figuresOfPreview(draft: PricingDraft, preview: PricingPreview): ResultFigures {
  return {
    materialsCost: preview.materialsCost,
    fixedOperationalCost: draft.fixedOperationalCost,
    totalCost: preview.totalCost,
    suggestedPrice: preview.suggestedPrice,
    finalPrice: preview.finalPrice,
    manualPriceSet: draft.manualPrice.kind === 'price',
  };
}

/** Where the panel's figures come from: not yet saved, as saved, or recalculated while editing. */
export type ResultSource = 'new' | 'saved' | 'preview';
