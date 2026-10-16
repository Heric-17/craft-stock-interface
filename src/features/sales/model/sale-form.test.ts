import { describe, expect, it } from 'vitest';

import { Money, requireDecimalString as dec } from '@/shared/money';
import { Quantity } from '@/shared/quantity';

import { previewSale } from './sale-preview';
import {
  buildCreateSaleRequest,
  EMPTY_SALE_FORM,
  newMaterialLine,
  newProductLine,
  previewLinesFrom,
  readSaleForm,
  type SaleFormValues,
} from './sale-form';

const cera = { id: 'mat-cera', name: 'Cera de soja', consumptionUnit: 'GRAM' } as const;
const vela = { id: 'prod-baunilha', name: 'Vela de baunilha' };

function form(overrides: Partial<SaleFormValues> = {}): SaleFormValues {
  return {
    customerName: 'Marina',
    customerContact: '',
    paymentMethod: 'Pix',
    items: [],
    ...overrides,
  };
}

describe('a new loose-material line', () => {
  it('starts with both the quantity and the margin empty, never zero', () => {
    const line = newMaterialLine(cera);

    expect(line.quantity).toBe('');
    expect(line.margin).toBe('');
  });

  it('is sold in the material own unit, and a product by the piece', () => {
    expect(newMaterialLine(cera).consumptionUnit).toBe('GRAM');
    expect(newProductLine(vela).consumptionUnit).toBe('UNIT');
    expect(newProductLine(vela).margin).toBe('');
  });
});

describe('readSaleForm: the margin of a loose material', () => {
  const withMargin = (margin: string) =>
    form({ items: [{ ...newMaterialLine(cera), quantity: '120', margin }] });

  it('blocks the sale while the margin is empty, and says that zero is a choice', () => {
    const { parsed, issues } = readSaleForm(withMargin(''));

    expect(parsed).toBeNull();
    expect(issues).toEqual([
      {
        path: ['items', 0, 'margin'],
        message: 'Informe a margem. Digite 0 para vender a preço de custo.',
      },
    ]);
  });

  it('blocks a margin made of spaces just the same', () => {
    expect(readSaleForm(withMargin('   ')).parsed).toBeNull();
  });

  it('accepts a zero that was typed, and sends it as 0 basis points', () => {
    const { parsed, issues } = readSaleForm(withMargin('0'));

    expect(issues).toEqual([]);
    expect(parsed?.lines).toEqual([
      expect.objectContaining({ kind: 'MATERIAL', marginBasisPoints: 0 }),
    ]);
  });

  it('turns the percentage typed into whole basis points: 33,33 is 3333', () => {
    const { parsed } = readSaleForm(withMargin('33,33'));

    expect(parsed?.lines[0]).toEqual(expect.objectContaining({ marginBasisPoints: 3333 }));
  });

  it('refuses a third decimal place instead of rounding it', () => {
    const { parsed, issues } = readSaleForm(withMargin('33,333'));

    expect(parsed).toBeNull();
    expect(issues[0]?.message).toContain('até 2 casas decimais');
  });
});

describe('readSaleForm: the rest of the form', () => {
  it('says everything that is missing at once', () => {
    const { parsed, issues } = readSaleForm(form({ customerName: '', paymentMethod: ' ' }));

    expect(parsed).toBeNull();
    expect(issues.map((issue) => issue.path[0])).toEqual([
      'customerName',
      'paymentMethod',
      'items',
    ]);
  });

  it('asks for a quantity greater than zero on every line', () => {
    const empty = readSaleForm(form({ items: [newProductLine(vela)] }));
    const zero = readSaleForm(form({ items: [{ ...newProductLine(vela), quantity: '0' }] }));

    expect(empty.issues[0]?.message).toBe('Informe a quantidade.');
    expect(zero.issues[0]?.message).toBe('A quantidade precisa ser maior do que zero.');
  });

  it('reads a quantity typed in the larger unit: 1,5 kg is 1500 g', () => {
    const line = {
      ...newMaterialLine(cera),
      quantity: '1,5',
      scale: 'major' as const,
      margin: '0',
    };
    const { parsed } = readSaleForm(form({ items: [line] }));

    expect(parsed?.lines[0]?.quantity.toApiNumber()).toBe(1500);
  });
});

describe('buildCreateSaleRequest', () => {
  it('sends no margin for a product and the margin, zero included, for a loose material', () => {
    const { parsed } = readSaleForm(
      form({
        customerContact: ' 11 99999-0000 ',
        items: [
          { ...newProductLine(vela), quantity: '2' },
          { ...newMaterialLine(cera), quantity: '120', margin: '0' },
        ],
      }),
    );

    expect(buildCreateSaleRequest(parsed!)).toEqual({
      customerName: 'Marina',
      customerContact: '11 99999-0000',
      paymentMethod: 'Pix',
      items: [
        { compositeProductId: 'prod-baunilha', quantity: 2 },
        { materialId: 'mat-cera', quantity: 120, marginBasisPoints: 0 },
      ],
    });
  });

  it('leaves an empty contact out instead of sending an empty string', () => {
    const { parsed } = readSaleForm(form({ items: [{ ...newProductLine(vela), quantity: '1' }] }));

    expect(buildCreateSaleRequest(parsed!)).not.toHaveProperty('customerContact');
  });
});

describe('previewLinesFrom', () => {
  const products = new Map([[vela.id, { finalPrice: Money.parse(dec('11.27')) }]]);
  const materials = new Map([
    [
      cera.id,
      {
        packageCost: Money.parse(dec('28.00')),
        packageQuantity: Quantity.parse(dec('1000'), 'GRAM'),
      },
    ],
  ]);

  it('prices what is typed and leaves the total missing while a margin is empty', () => {
    const values = form({
      items: [
        { ...newProductLine(vela), quantity: '2' },
        { ...newMaterialLine(cera), quantity: '120', margin: '' },
      ],
    });

    const { lineTotals, total } = previewSale(previewLinesFrom(values, products, materials));

    expect(lineTotals[0]?.toCentsString()).toBe('22.54');
    expect(lineTotals[1]).toBeNull();
    expect(total).toBeNull();
  });

  it('prices the same sale once the margin is typed, with the zero chosen on purpose', () => {
    const values = form({
      items: [
        { ...newProductLine(vela), quantity: '2' },
        { ...newMaterialLine(cera), quantity: '120', margin: '0' },
      ],
    });

    expect(previewSale(previewLinesFrom(values, products, materials)).total?.toCentsString()).toBe(
      '25.90',
    );
  });

  it('has nothing to price a line whose product is not on the list yet', () => {
    const values = form({ items: [{ ...newProductLine(vela), quantity: '2' }] });

    expect(previewSale(previewLinesFrom(values, new Map(), materials)).total).toBeNull();
  });

  it('is the empty form for no lines', () => {
    expect(
      previewSale(previewLinesFrom(EMPTY_SALE_FORM, products, materials)).total?.isZero(),
    ).toBe(true);
  });
});
