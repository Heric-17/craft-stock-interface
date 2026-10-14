import { describe, expect, it } from 'vitest';

import type { DecimalString } from '@/shared/money';
import {
  ceraLine,
  compositeProductDto,
  kitPresente,
  velaBaunilha,
} from '@/test/fixtures/composite-products';

import { bottleneckItem, toCompositeProduct } from './composite-product';
import { figuresOfProduct } from './result-figures';

describe('the composite product the screens read', () => {
  it('turns every amount into Money and every quantity into Quantity, carrying the API’s derived values through', () => {
    const product = toCompositeProduct(velaBaunilha);

    expect(product.materialsCost.toCentsString()).toBe('5.85');
    expect(product.totalCost.toCentsString()).toBe('8.35');
    expect(product.suggestedPrice.toCentsString()).toBe('11.27');
    expect(product.finalPrice.toCentsString()).toBe('11.27');
    expect(product.productionCapacity).toBe(3);
    expect(product.billOfMaterials[0]?.lineCost.toCentsString()).toBe('3.36');
    expect(product.billOfMaterials[0]?.unitCost.toDecimalString()).toBe('0.0280');
    expect(product.billOfMaterials[0]?.quantity.toApiNumber()).toBe(120);
    expect(product.billOfMaterials[0]?.stockQuantity.toApiNumber()).toBe(680);
  });

  it('keeps the margin as the basis points the API sends, for the form to turn into a percentage', () => {
    expect(toCompositeProduct(kitPresente).profitMarginBasisPoints).toBe(3333);
  });

  it('reads a quantity with three places exactly, however the double spells it', () => {
    const item = toCompositeProduct(
      compositeProductDto({ billOfMaterials: [ceraLine({ quantity: 0.145 })] }),
    ).billOfMaterials[0];

    expect(item?.quantity.toDecimalString()).toBe('0.145');
  });

  it('has a manual price only when the API sent one', () => {
    expect(toCompositeProduct(velaBaunilha).manualPrice).toBeNull();
    expect(toCompositeProduct(kitPresente).manualPrice?.toCentsString()).toBe('60.00');
  });

  it('refuses a monetary field that is not a decimal string', () => {
    const broken = compositeProductDto({
      totalCost: 8.35 as unknown as DecimalString,
    });

    expect(() => toCompositeProduct(broken)).toThrow(/decimal string/);
  });
});

describe('the bottleneck', () => {
  it('is the line of the bill that names the material the API called the bottleneck', () => {
    const item = bottleneckItem(toCompositeProduct(velaBaunilha));

    expect(item?.materialName).toBe('Essência baunilha');
    expect(item?.stockQuantity.toApiNumber()).toBe(18);
    expect(item?.quantity.toApiNumber()).toBe(6);
  });

  it('is nothing for a product with no items', () => {
    const empty = toCompositeProduct(
      compositeProductDto({ billOfMaterials: [], bottleneck: null, productionCapacity: 0 }),
    );

    expect(bottleneckItem(empty)).toBeNull();
  });
});

describe('the figures of a saved product', () => {
  it('are the API’s, with the practiced price marked manual only when it is', () => {
    const figures = figuresOfProduct(toCompositeProduct(kitPresente));

    expect(figures.suggestedPrice?.toCentsString()).toBe('32.80');
    expect(figures.finalPrice?.toCentsString()).toBe('60.00');
    expect(figures.manualPriceSet).toBe(true);
    expect(figuresOfProduct(toCompositeProduct(velaBaunilha)).manualPriceSet).toBe(false);
  });
});
