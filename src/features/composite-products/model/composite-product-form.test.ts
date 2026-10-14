import { describe, expect, it } from 'vitest';

import { Money, requireDecimalString } from '@/shared/money';
import { Quantity } from '@/shared/quantity';
import { compositeProductDto, kitPresente, velaBaunilha } from '@/test/fixtures/composite-products';

import { toCompositeProduct } from './composite-product';
import {
  billOfMaterialsChanged,
  buildCreateRequest,
  buildUpdate,
  compositeProductFormValuesFrom,
  EMPTY_COMPOSITE_PRODUCT_FORM,
  hasChanges,
  newBomLine,
  pricingDraftFrom,
  pricingFieldsDiffer,
  readCompositeProductForm,
  readLineQuantity,
  readManualPrice,
  sameBillOfMaterials,
  type CompositeProductFormValues,
} from './composite-product-form';

const product = toCompositeProduct(velaBaunilha);
const kit = toCompositeProduct(kitPresente);

function valuesOf(overrides: Partial<CompositeProductFormValues> = {}): CompositeProductFormValues {
  return { ...compositeProductFormValuesFrom(product), ...overrides };
}

function parsed(values: CompositeProductFormValues) {
  const { parsed: result, issues } = readCompositeProductForm(values);

  expect(issues).toEqual([]);
  expect(result).not.toBeNull();

  return result!;
}

describe('the form of a saved product', () => {
  it('shows the margin as the percentage it is, never as basis points', () => {
    expect(compositeProductFormValuesFrom(product).profitMargin).toBe('35');
    expect(compositeProductFormValuesFrom(kit).profitMargin).toBe('33,33');
  });

  it('writes money and quantities the way they are typed back, so reading them again changes nothing', () => {
    const values = compositeProductFormValuesFrom(kit);

    expect(values.fixedOperationalCost).toBe('5,00');
    expect(values.manualPrice).toBe('60,00');
    expect(values.billOfMaterials[0]?.quantity).toBe('700');
    expect(parsed(values).profitMarginBasisPoints).toBe(3333);
  });

  it('leaves the manual price empty when there is none, not zero', () => {
    expect(compositeProductFormValuesFrom(product).manualPrice).toBe('');
  });
});

describe('reading the form', () => {
  it('starts empty, and tells everything that is missing at once', () => {
    const { parsed: result, issues } = readCompositeProductForm({
      ...EMPTY_COMPOSITE_PRODUCT_FORM,
      billOfMaterials: [
        newBomLine({ id: 'mat-cera', name: 'Cera de soja', consumptionUnit: 'GRAM' }),
      ],
    });

    expect(result).toBeNull();
    expect(issues.map((issue) => issue.path.join('.'))).toEqual([
      'name',
      'fixedOperationalCost',
      'profitMargin',
      'billOfMaterials.0.quantity',
    ]);
  });

  it('turns the margin typed as a percentage into whole basis points, reading the digits', () => {
    for (const [typed, basisPoints] of [
      ['33,33', 3333],
      ['35', 3500],
      ['0,5', 50],
      ['0', 0],
      ['100', 10_000],
      ['999,99', 99_999],
    ] as const) {
      expect(parsed(valuesOf({ profitMargin: typed })).profitMarginBasisPoints).toBe(basisPoints);
    }
  });

  it('refuses a margin the column cannot hold, and a third decimal place', () => {
    for (const typed of ['1000', '-5', '33,333', 'abc']) {
      const { issues } = readCompositeProductForm(valuesOf({ profitMargin: typed }));

      expect(issues.map((issue) => issue.path.join('.'))).toEqual(['profitMargin']);
    }
  });

  it('treats a zero margin and a zero fixed cost as answers, when they are typed', () => {
    const result = parsed(valuesOf({ profitMargin: '0', fixedOperationalCost: '0' }));

    expect(result.profitMarginBasisPoints).toBe(0);
    expect(result.fixedOperationalCost.toCentsString()).toBe('0.00');
  });

  it('reads an empty manual price as none, and an unreadable one as an issue', () => {
    expect(readManualPrice('')).toEqual({ kind: 'none' });
    expect(readManualPrice('  ')).toEqual({ kind: 'none' });
    expect(readManualPrice('12,5')).toMatchObject({ kind: 'price' });
    expect(readManualPrice('12,345')).toEqual({ kind: 'invalid' });
    expect(readManualPrice('-1')).toEqual({ kind: 'invalid' });
    expect(
      readCompositeProductForm(valuesOf({ manualPrice: '12,345' })).issues.map((issue) =>
        issue.path.join('.'),
      ),
    ).toEqual(['manualPrice']);
  });

  it('refuses a negative fixed cost and money finer than the cent', () => {
    for (const typed of ['-1', '2,505']) {
      expect(
        readCompositeProductForm(valuesOf({ fixedOperationalCost: typed })).issues,
      ).toHaveLength(1);
    }
  });

  it('reads a quantity in the unit of its material, and in the larger one when asked', () => {
    const [cera] = valuesOf().billOfMaterials;
    const grams = readLineQuantity({ ...cera!, quantity: '120', scale: 'base' });
    const kilos = readLineQuantity({ ...cera!, quantity: '0,12', scale: 'major' });

    expect(grams?.toApiNumber()).toBe(120);
    expect(kilos?.toApiNumber()).toBe(120);
  });

  it('refuses a quantity of zero, a negative one, and one with a fourth decimal place', () => {
    const [cera] = valuesOf().billOfMaterials;

    for (const typed of ['0', '-1', '1,2345', '', 'abc']) {
      expect(readLineQuantity({ ...cera!, quantity: typed })).toBeNull();
    }
  });

  it('says why a quantity was refused, in a different sentence for each reason', () => {
    const [cera] = valuesOf().billOfMaterials;
    const messageFor = (typed: string) =>
      readCompositeProductForm(valuesOf({ billOfMaterials: [{ ...cera!, quantity: typed }] }))
        .issues[0]?.message;

    expect(messageFor('')).toBe('Informe quanto de insumo cada unidade consome.');
    expect(messageFor('abc')).toMatch(/Não entendi esse valor/);
    expect(messageFor('0')).toBe('A quantidade precisa ser maior do que zero.');
  });
});

describe('the request that registers a product', () => {
  it('sends the margin in basis points and money with two places', () => {
    const request = buildCreateRequest(
      parsed(
        valuesOf({
          name: ' Vela de coco ',
          fixedOperationalCost: '2,5',
          profitMargin: '33,33',
        }),
      ),
    );

    expect(request).toEqual({
      name: 'Vela de coco',
      fixedOperationalCost: '2.50',
      profitMarginBasisPoints: 3333,
      billOfMaterials: [
        { materialId: 'mat-cera', quantity: 120 },
        { materialId: 'mat-essencia', quantity: 6 },
        { materialId: 'mat-pavio', quantity: 1 },
      ],
    });
  });

  it('leaves an empty description and an absent manual price out, rather than sending empty ones', () => {
    const request = buildCreateRequest(parsed(valuesOf()));

    expect(request).not.toHaveProperty('description');
    expect(request).not.toHaveProperty('manualPrice');
  });

  it('sends a description and a manual price when there are some', () => {
    const request = buildCreateRequest(
      parsed(valuesOf({ description: ' Aroma suave ', manualPrice: '60' })),
    );

    expect(request.description).toBe('Aroma suave');
    expect(request.manualPrice).toBe('60.00');
  });

  it('sends a quantity with at most three decimal places', () => {
    const [cera] = valuesOf().billOfMaterials;
    const request = buildCreateRequest(
      parsed(valuesOf({ billOfMaterials: [{ ...cera!, quantity: '0,145' }] })),
    );

    expect(request.billOfMaterials[0]?.quantity).toBe(0.145);
  });

  it('sends an empty bill, which the API accepts', () => {
    expect(buildCreateRequest(parsed(valuesOf({ billOfMaterials: [] }))).billOfMaterials).toEqual(
      [],
    );
  });
});

describe('the request that edits a product', () => {
  it('sends nothing for a form that was not touched', () => {
    const patch = buildUpdate(parsed(valuesOf()), product);

    expect(patch).toEqual({});
    expect(hasChanges(patch)).toBe(false);
  });

  it('sends only the fields that changed', () => {
    expect(buildUpdate(parsed(valuesOf({ name: 'Outro nome' })), product)).toEqual({
      name: 'Outro nome',
    });
    expect(buildUpdate(parsed(valuesOf({ profitMargin: '40' })), product)).toEqual({
      profitMarginBasisPoints: 4000,
    });
    expect(buildUpdate(parsed(valuesOf({ fixedOperationalCost: '3' })), product)).toEqual({
      fixedOperationalCost: '3.00',
    });
  });

  it('does not send the bill back when only something else changed', () => {
    // The API refuses a bill that still has a discontinued material, so a
    // bill that did not change must not be the reason a save fails.
    const patch = buildUpdate(
      parsed(valuesOf({ name: 'Outro nome', profitMargin: '40' })),
      product,
    );

    expect(patch).not.toHaveProperty('billOfMaterials');
  });

  it('sends the whole bill when a quantity changed, or a line was added or removed', () => {
    const [cera, essencia, pavio] = valuesOf().billOfMaterials;

    expect(
      buildUpdate(
        parsed(valuesOf({ billOfMaterials: [{ ...cera!, quantity: '150' }, essencia!, pavio!] })),
        product,
      ).billOfMaterials,
    ).toHaveLength(3);
    expect(
      buildUpdate(parsed(valuesOf({ billOfMaterials: [cera!, essencia!] })), product)
        .billOfMaterials,
    ).toEqual([
      { materialId: 'mat-cera', quantity: 120 },
      { materialId: 'mat-essencia', quantity: 6 },
    ]);
  });

  it('does not count the same quantity typed another way as a change', () => {
    const [cera, essencia, pavio] = valuesOf().billOfMaterials;
    const sameInKilos = { ...cera!, quantity: '0,12', scale: 'major' as const };

    expect(
      buildUpdate(parsed(valuesOf({ billOfMaterials: [sameInKilos, essencia!, pavio!] })), product),
    ).toEqual({});
  });

  it('clears a manual price with null, and sets one as a string', () => {
    const cleared = buildUpdate(
      parsed({ ...compositeProductFormValuesFrom(kit), manualPrice: '' }),
      kit,
    );
    const set = buildUpdate(parsed(valuesOf({ manualPrice: '12,5' })), product);

    expect(cleared.manualPrice).toBeNull();
    expect(set.manualPrice).toBe('12.50');
  });

  it('clears a description with null', () => {
    const described = toCompositeProduct(compositeProductDto({ description: 'Aroma suave' }));

    expect(
      buildUpdate(
        parsed({ ...compositeProductFormValuesFrom(described), description: '' }),
        described,
      ),
    ).toEqual({ description: null });
  });

  it('notices a bill that changed by material or by quantity, whatever the order', () => {
    const lines = parsed(valuesOf()).lines;

    expect(billOfMaterialsChanged(lines, product)).toBe(false);
    expect(billOfMaterialsChanged([...lines].reverse(), product)).toBe(false);
    expect(billOfMaterialsChanged(lines.slice(1), product)).toBe(true);
    expect(
      billOfMaterialsChanged(
        [{ materialId: 'mat-outro', quantity: lines[0]!.quantity }, ...lines.slice(1)],
        product,
      ),
    ).toBe(true);
  });
});

describe('what the form says about the figures', () => {
  it('sees a change in anything that moves a price', () => {
    const saved = valuesOf();

    expect(pricingFieldsDiffer(saved, saved)).toBe(false);
    expect(pricingFieldsDiffer(valuesOf({ profitMargin: '36' }), saved)).toBe(true);
    expect(pricingFieldsDiffer(valuesOf({ fixedOperationalCost: '2,51' }), saved)).toBe(true);
    expect(pricingFieldsDiffer(valuesOf({ manualPrice: '12' }), saved)).toBe(true);
    expect(pricingFieldsDiffer(valuesOf({ billOfMaterials: [] }), saved)).toBe(true);
  });

  it('does not count a name or a description as a change in price', () => {
    expect(pricingFieldsDiffer(valuesOf({ name: 'Outro', description: 'Outra' }), valuesOf())).toBe(
      false,
    );
  });

  it('compares the lines whatever their order, and spaces around what was typed do not matter', () => {
    const saved = valuesOf();

    expect(
      sameBillOfMaterials(
        valuesOf({ billOfMaterials: [...saved.billOfMaterials].reverse() }),
        saved,
      ),
    ).toBe(true);
    expect(pricingFieldsDiffer(valuesOf({ profitMargin: ' 35 ' }), saved)).toBe(false);
  });

  it('prices a line only when its material is known and its quantity can be read', () => {
    const values = valuesOf();
    const materials = new Map([
      [
        'mat-cera',
        {
          packageCost: Money.parse(requireDecimalString('28.00')),
          packageQuantity: Quantity.parse(requireDecimalString('1000'), 'GRAM'),
        },
      ],
    ]);

    const draft = pricingDraftFrom(values, materials);

    expect(draft.lines[0]?.quantity?.toApiNumber()).toBe(120);
    // The other two materials are not on the list: nothing to price them by.
    expect(draft.lines[1]?.quantity).toBeNull();
    expect(draft.lines[2]?.quantity).toBeNull();
    expect(draft.profitMarginBasisPoints).toBe(3500);
    expect(draft.manualPrice).toEqual({ kind: 'none' });
  });
});
