import { describe, expect, it } from 'vitest';

import { NON_BREAKING_SPACE } from '@/shared/format';

import type { ActivityEntry, FieldChange } from './activity-entry';
import { describeActivity, indexMaterials, type ActivityContext } from './activity-sentence';

const SPACE = NON_BREAKING_SPACE;
const ME = 'user-me';
const CAFE_ID = 'material-cafe';
const FARINHA_ID = 'material-farinha';

const NOW = new Date('2026-10-12T17:00:00-03:00');

const CONTEXT: ActivityContext = {
  viewerId: ME,
  now: NOW,
  materials: indexMaterials([
    { id: CAFE_ID, name: 'Café 3 Corações', consumptionUnit: 'UNIT' },
    { id: FARINHA_ID, name: 'Farinha de trigo', consumptionUnit: 'GRAM' },
  ]),
};

function change(oldValue: unknown, newValue: unknown): FieldChange {
  return { old: oldValue, new: newValue };
}

function entry(
  overrides: Partial<ActivityEntry> & Pick<ActivityEntry, 'entityType'>,
): ActivityEntry {
  return {
    id: 'audit-1',
    occurredAt: '2026-10-12T14:32:00-03:00',
    userId: ME,
    entityId: CAFE_ID,
    entityLabel: 'Café 3 Corações',
    operation: 'UPDATE',
    intent: null,
    changes: {},
    ...overrides,
  };
}

function sentenceOf(value: ActivityEntry, context: ActivityContext = CONTEXT): string {
  return describeActivity(value, context).sentence;
}

describe('Material', () => {
  it('says what a package cost before and after', () => {
    const result = sentenceOf(
      entry({ entityType: 'Material', changes: { packageCost: change('22.9', '24.5') } }),
    );

    expect(result).toBe(
      `Você alterou o custo da embalagem de Café 3 Corações de R$${SPACE}22,90 para R$${SPACE}24,50`,
    );
  });

  it('writes a quantity in the unit of the material, which the trail does not carry', () => {
    const result = sentenceOf(
      entry({
        entityType: 'Material',
        entityId: FARINHA_ID,
        entityLabel: 'Farinha de trigo',
        changes: { stockQuantity: change('1500', '320') },
      }),
    );

    expect(result).toBe(
      `Você alterou o estoque de Farinha de trigo de 1,5${SPACE}kg para 320${SPACE}g`,
    );
  });

  it('leaves the values out when the unit of a quantity is not known, instead of printing a bare number', () => {
    const result = sentenceOf(
      entry({
        entityType: 'Material',
        entityId: 'material-gone',
        changes: { stockQuantity: change('10', '5') },
      }),
    );

    expect(result).toBe('Você alterou o estoque de Café 3 Corações');
  });

  it('names a registration and a removal', () => {
    expect(
      sentenceOf(
        entry({
          entityType: 'Material',
          operation: 'CREATE',
          changes: { id: change(null, CAFE_ID), name: change(null, 'Café 3 Corações') },
        }),
      ),
    ).toBe('Você cadastrou o insumo Café 3 Corações');

    expect(sentenceOf(entry({ entityType: 'Material', operation: 'DELETE' }))).toBe(
      'Você excluiu o insumo Café 3 Corações',
    );
  });

  it('says discontinued and reactivated for the field that carries it', () => {
    expect(
      sentenceOf(
        entry({
          entityType: 'Material',
          changes: { discontinuedAt: change(null, '2026-10-12T17:00:00.000Z') },
        }),
      ),
    ).toBe('Você descontinuou o insumo Café 3 Corações');

    expect(
      sentenceOf(
        entry({
          entityType: 'Material',
          changes: { discontinuedAt: change('2026-10-12T17:00:00.000Z', null) },
        }),
      ),
    ).toBe('Você reativou o insumo Café 3 Corações');
  });

  it('names a unit change with the names of the units', () => {
    expect(
      sentenceOf(
        entry({
          entityType: 'Material',
          changes: { consumptionUnit: change('GRAM', 'UNIT') },
        }),
      ),
    ).toBe('Você alterou a unidade de consumo de Café 3 Corações de Gramas (g) para Unidade (un)');
  });

  it('lists every field when several changed in one write, and says each one below', () => {
    const result = describeActivity(
      entry({
        entityType: 'Material',
        changes: {
          packageCost: change('22.9', '24.5'),
          minimumStockAlert: change('2', '4'),
          name: change('Café', 'Café 3 Corações'),
        },
      }),
      CONTEXT,
    );

    expect(result.sentence).toBe(
      'Você alterou o custo da embalagem, o estoque mínimo e o nome de Café 3 Corações',
    );
    expect(result.details).toEqual([
      `Custo da embalagem: de R$${SPACE}22,90 para R$${SPACE}24,50`,
      `Estoque mínimo: de 2${SPACE}un para 4${SPACE}un`,
      'Nome: de Café para Café 3 Corações',
    ]);
  });

  it('says a description was set or cleared, instead of changed from nothing', () => {
    expect(
      sentenceOf(
        entry({ entityType: 'Material', changes: { description: change(null, 'Torra média') } }),
      ),
    ).toBe('Você definiu a descrição de Café 3 Corações como Torra média');

    expect(
      sentenceOf(
        entry({ entityType: 'Material', changes: { description: change('Torra média', null) } }),
      ),
    ).toBe('Você removeu a descrição de Café 3 Corações');
  });
});

describe('CompositeProduct', () => {
  const product = { entityType: 'CompositeProduct', entityLabel: 'Bolo de cenoura' } as const;

  it('names a registration and a removal', () => {
    expect(sentenceOf(entry({ ...product, operation: 'CREATE' }))).toBe(
      'Você cadastrou o produto Bolo de cenoura',
    );
    expect(sentenceOf(entry({ ...product, operation: 'DELETE' }))).toBe(
      'Você excluiu o produto Bolo de cenoura',
    );
  });

  it('says money as money and the fixed cost as a figure of its own', () => {
    expect(
      sentenceOf(entry({ ...product, changes: { fixedOperationalCost: change('1.5', '2') } })),
    ).toBe(
      `Você alterou o custo fixo do produto Bolo de cenoura de R$${SPACE}1,50 para R$${SPACE}2,00`,
    );
  });

  it('says the margin as a percentage when the trail records it as one, as the column does', () => {
    expect(
      sentenceOf(entry({ ...product, changes: { profitMargin: change('33.33', '50') } })),
    ).toBe('Você alterou a margem de lucro do produto Bolo de cenoura de 33,33% para 50%');
  });

  it('says the margin as a percentage when it arrives in basis points', () => {
    expect(
      sentenceOf(entry({ ...product, changes: { profitMarginBasisPoints: change(3333, 5000) } })),
    ).toBe('Você alterou a margem de lucro do produto Bolo de cenoura de 33,33% para 50%');
  });

  it('never prints basis points as the number they are', () => {
    const result = sentenceOf(
      entry({ ...product, changes: { profitMarginBasisPoints: change(3333, 5000) } }),
    );

    expect(result).not.toContain('3333');
    expect(result).not.toContain('5000');
  });

  it('says a manual price was defined and removed', () => {
    expect(sentenceOf(entry({ ...product, changes: { manualPrice: change(null, '45') } }))).toBe(
      `Você definiu o preço manual do produto Bolo de cenoura como R$${SPACE}45,00`,
    );

    expect(sentenceOf(entry({ ...product, changes: { manualPrice: change('45', null) } }))).toBe(
      'Você removeu o preço manual do produto Bolo de cenoura',
    );
  });

  it('says discontinued for a product as well', () => {
    expect(
      sentenceOf(
        entry({
          ...product,
          changes: { discontinuedAt: change(null, '2026-10-12T17:00:00.000Z') },
        }),
      ),
    ).toBe('Você descontinuou o produto Bolo de cenoura');
  });
});

describe('the photo', () => {
  const material = { entityType: 'Material' } as const;

  it.each(['imageKey', 'imageUrl'])(
    'says the photo changed, whichever of its two names the row carries (%s)',
    (column) => {
      expect(
        sentenceOf(
          entry({
            ...material,
            changes: { [column]: change('3f2a1b7c-old.png', '9d4e6f10-new.png') },
          }),
        ),
      ).toBe('Você alterou a foto de Café 3 Corações');
    },
  );

  it.each(['imageKey', 'imageUrl'])('says it was added and removed (%s)', (column) => {
    expect(
      sentenceOf(entry({ ...material, changes: { [column]: change(null, 'novo.png') } })),
    ).toBe('Você adicionou a foto de Café 3 Corações');
    expect(
      sentenceOf(entry({ ...material, changes: { [column]: change('velho.png', null) } })),
    ).toBe('Você removeu a foto de Café 3 Corações');
  });

  it('does not show the storage key anywhere, in the sentence or under it', () => {
    const key = '9d4e6f10-3a2b-4c5d-8e7f-0123456789ab.webp';
    const result = describeActivity(
      entry({
        ...material,
        changes: { imageKey: change(null, key), packageCost: change('1', '2') },
      }),
      CONTEXT,
    );

    expect([result.sentence, ...result.details].join(' ')).not.toContain('9d4e6f10');
    expect(result.details).toContain('Foto: adicionada');
  });

  it('counts the photo once when a row carries both of its names', () => {
    const result = describeActivity(
      entry({
        ...material,
        changes: { imageUrl: change('a', 'b'), imageKey: change('a', 'b') },
      }),
      CONTEXT,
    );

    expect(result.sentence).toBe('Você alterou a foto de Café 3 Corações');
    expect(result.details).toEqual([]);
  });
});

describe('Sale', () => {
  const sale = { entityType: 'Sale', entityId: 'sale-1', entityLabel: 'Maria' } as const;

  it('names a registration and a removal', () => {
    expect(sentenceOf(entry({ ...sale, operation: 'CREATE' }))).toBe(
      'Você registrou a venda de Maria',
    );
    expect(sentenceOf(entry({ ...sale, operation: 'DELETE' }))).toBe(
      'Você excluiu a venda de Maria',
    );
  });

  it('says each axis of the state by its own label', () => {
    expect(
      sentenceOf(entry({ ...sale, changes: { paymentStatus: change('PENDING', 'PAID') } })),
    ).toBe('Você alterou o pagamento da venda de Maria de Pendente para Pago');

    expect(
      sentenceOf(
        entry({ ...sale, changes: { productionStatus: change('ASSEMBLED', 'DELIVERED') } }),
      ),
    ).toBe('Você alterou a produção da venda de Maria de Montado para Entregue');
  });

  it('leaves out a state this build does not know instead of printing it', () => {
    const result = sentenceOf(
      entry({ ...sale, changes: { productionStatus: change('PENDING', 'ON_THE_WAY') } }),
    );

    expect(result).toBe('Você alterou a produção da venda de Maria');
    expect(result).not.toContain('ON_THE_WAY');
  });

  it('says the other fields of the sale', () => {
    expect(
      sentenceOf(entry({ ...sale, changes: { paymentMethod: change('Pix', 'Cartão') } })),
    ).toBe('Você alterou a forma de pagamento da venda de Maria de Pix para Cartão');
    expect(
      sentenceOf(entry({ ...sale, changes: { customerContact: change(null, '11 98888-7777') } })),
    ).toBe('Você definiu o contato do cliente da venda de Maria como 11 98888-7777');
  });
});

describe('Purchase', () => {
  const purchase = {
    entityType: 'Purchase',
    entityId: 'purchase-1',
    entityLabel: 'Casa das Essências',
  } as const;

  it('says what a registered purchase cost', () => {
    expect(
      sentenceOf(
        entry({
          ...purchase,
          operation: 'CREATE',
          changes: { netTotal: change(null, '248.9'), rawInvoiceData: change(null, { x: 1 }) },
        }),
      ),
    ).toBe(`Você registrou a compra em Casa das Essências no valor de R$${SPACE}248,90`);
  });

  it('registers a purchase without a figure when the trail has none', () => {
    expect(sentenceOf(entry({ ...purchase, operation: 'CREATE' }))).toBe(
      'Você registrou a compra em Casa das Essências',
    );
  });

  it('names a removal', () => {
    expect(sentenceOf(entry({ ...purchase, operation: 'DELETE' }))).toBe(
      'Você excluiu a compra em Casa das Essências',
    );
  });

  it('says how the discount is spread by the name the classification screen gives it', () => {
    expect(
      sentenceOf(
        entry({
          ...purchase,
          changes: { discountAllocationMode: change('PROPORTIONAL', 'MANUAL') },
        }),
      ),
    ).toBe(
      'Você alterou a forma de atribuir o desconto da compra em Casa das Essências de Dividir entre todos os itens para Informar item a item',
    );
  });

  it('says a discount is left to be spread, and that it was spread', () => {
    expect(
      sentenceOf(entry({ ...purchase, changes: { allocationPending: change(false, true) } })),
    ).toBe('Você deixou o desconto da compra em Casa das Essências para distribuir entre os itens');
    expect(
      sentenceOf(entry({ ...purchase, changes: { allocationPending: change(true, false) } })),
    ).toBe('Você distribuiu o desconto da compra em Casa das Essências entre os itens');
  });

  it('says the line edit for the intent that tells it apart, with the totals that moved below', () => {
    const result = describeActivity(
      entry({
        ...purchase,
        intent: 'purchase_item_edit',
        changes: { netTotal: change('248.9', '230'), grossTotal: change('253.9', '235') },
      }),
      CONTEXT,
    );

    expect(result.sentence).toBe('Você editou os itens da compra em Casa das Essências');
    expect(result.details).toEqual([
      `Valor pago: de R$${SPACE}248,90 para R$${SPACE}230,00`,
      `Valor dos itens: de R$${SPACE}253,90 para R$${SPACE}235,00`,
    ]);
  });

  it('says the change of the way the discount is spread for its intent', () => {
    expect(
      sentenceOf(
        entry({
          ...purchase,
          intent: 'discount_allocation_change',
          changes: { discountAllocationMode: change('PROPORTIONAL', 'COMPANY_ONLY') },
        }),
      ),
    ).toBe('Você mudou a atribuição do desconto da compra em Casa das Essências');
  });

  it('ignores an intent it does not know', () => {
    expect(
      sentenceOf(
        entry({
          ...purchase,
          intent: 'something_new',
          changes: { discountTotal: change('5', '6') },
        }),
      ),
    ).toBe(
      `Você alterou o desconto da nota da compra em Casa das Essências de R$${SPACE}5,00 para R$${SPACE}6,00`,
    );
  });

  it('does not say a purchase was edited for a row of another model that shares the request', () => {
    expect(
      sentenceOf(
        entry({
          entityType: 'Material',
          intent: 'purchase_item_edit',
          changes: { packageCost: change('22.9', '24.5') },
        }),
      ),
    ).toBe(
      `Você alterou o custo da embalagem de Café 3 Corações de R$${SPACE}22,90 para R$${SPACE}24,50`,
    );
  });

  it('reads a date as the calendar of Sao Paulo', () => {
    expect(
      sentenceOf(
        entry({
          ...purchase,
          changes: { purchaseDate: change('2026-10-10T15:00:00.000Z', '2026-10-11T15:00:00.000Z') },
        }),
      ),
    ).toBe(
      'Você alterou a data da compra em Casa das Essências de 10 out, 12:00 para Ontem, 12:00',
    );
  });
});

describe('StockLoss', () => {
  const loss = { entityType: 'StockLoss', entityId: 'loss-1', entityLabel: null } as const;

  it('names the quantity, the material by the id in the change, and why', () => {
    expect(
      sentenceOf(
        entry({
          ...loss,
          operation: 'CREATE',
          changes: {
            materialId: change(null, FARINHA_ID),
            quantity: change(null, '500'),
            reason: change(null, 'BREAKAGE'),
            costBasisAmount: change(null, '28'),
          },
        }),
      ),
    ).toBe(`Você registrou uma perda de 500${SPACE}g de Farinha de trigo (quebrou)`);
  });

  it('shows the observation under the sentence', () => {
    const result = describeActivity(
      entry({
        ...loss,
        operation: 'CREATE',
        changes: {
          materialId: change(null, CAFE_ID),
          quantity: change(null, '2'),
          reason: change(null, 'EXPIRED'),
          observation: change(null, 'Lote vencido na prateleira'),
        },
      }),
      CONTEXT,
    );

    expect(result.sentence).toBe(
      `Você registrou uma perda de 2${SPACE}un de Café 3 Corações (venceu)`,
    );
    expect(result.details).toEqual(['Observação: Lote vencido na prateleira']);
  });

  it('reads a deleted loss from the old side and says the stock was not touched', () => {
    const result = describeActivity(
      entry({
        ...loss,
        operation: 'DELETE',
        changes: {
          materialId: change(CAFE_ID, null),
          quantity: change('1', null),
          reason: change('LOST', null),
        },
      }),
      CONTEXT,
    );

    expect(result.sentence).toBe(
      `Você excluiu a perda de 1${SPACE}un de Café 3 Corações (perdido)`,
    );
    expect(result.details).toEqual(['O estoque não foi alterado por esta exclusão.']);
  });

  it('leaves out the quantity and the name when the material is not known, but still says a loss', () => {
    const result = sentenceOf(
      entry({
        ...loss,
        operation: 'CREATE',
        changes: {
          materialId: change(null, 'material-gone'),
          quantity: change(null, '2'),
          reason: change(null, 'OTHER'),
        },
      }),
    );

    expect(result).toBe('Você registrou uma perda de estoque (outro)');
  });

  it('does not print a reason this build does not know', () => {
    const result = sentenceOf(
      entry({
        ...loss,
        operation: 'CREATE',
        changes: {
          materialId: change(null, CAFE_ID),
          quantity: change(null, '2'),
          reason: change(null, 'THEFT'),
        },
      }),
    );

    expect(result).toBe(`Você registrou uma perda de 2${SPACE}un de Café 3 Corações`);
  });

  it('says something readable for an update of a loss, which the system never writes', () => {
    expect(sentenceOf(entry({ ...loss, operation: 'UPDATE' }))).toBe(
      'Você alterou uma perda de estoque',
    );
  });
});

describe('who did it', () => {
  const rename = { entityType: 'Material', changes: { name: change('A', 'B') } } as const;

  it('says "Você" only for the entries of the person looking', () => {
    expect(sentenceOf(entry({ ...rename, userId: ME }))).toMatch(/^Você /);
  });

  it('does not call someone else "Você"', () => {
    expect(sentenceOf(entry({ ...rename, userId: 'user-other' }))).toMatch(/^Outra pessoa /);
  });

  it('attributes a write with no user to the system', () => {
    expect(sentenceOf(entry({ ...rename, userId: null }))).toMatch(/^O sistema /);
  });

  it('does not call anyone "Você" when it is not known who is looking', () => {
    expect(sentenceOf(entry(rename), { ...CONTEXT, viewerId: null })).toMatch(/^Outra pessoa /);
  });
});

describe('what this build does not know', () => {
  it('falls back to a plain sentence with the label for a model it has never heard of', () => {
    expect(
      sentenceOf(
        entry({ entityType: 'Supplier', entityLabel: 'Doces & Cia', operation: 'CREATE' }),
      ),
    ).toBe('Você adicionou Doces & Cia');
    expect(
      sentenceOf(
        entry({ entityType: 'Supplier', entityLabel: 'Doces & Cia', operation: 'UPDATE' }),
      ),
    ).toBe('Você alterou Doces & Cia');
    expect(
      sentenceOf(
        entry({ entityType: 'Supplier', entityLabel: 'Doces & Cia', operation: 'DELETE' }),
      ),
    ).toBe('Você excluiu Doces & Cia');
  });

  it('says "um registro" when an unknown model has no label, and never the name of the model', () => {
    const result = sentenceOf(entry({ entityType: 'SupplierContract', entityLabel: null }));

    expect(result).toBe('Você alterou um registro');
    expect(result).not.toContain('SupplierContract');
  });

  it('falls back for an operation it has never heard of', () => {
    expect(sentenceOf(entry({ entityType: 'Material', operation: 'ARCHIVE' }))).toBe(
      'Você fez uma alteração em Café 3 Corações',
    );
  });

  it('says a known model changed when none of its changed fields is one it can tell', () => {
    const result = sentenceOf(
      entry({
        entityType: 'Material',
        changes: { someNewColumn: change('a', 'b'), updatedAt: change('x', 'y') },
      }),
    );

    expect(result).toBe('Você alterou o insumo Café 3 Corações');
    expect(result).not.toContain('someNewColumn');
  });

  it('never prints the name of a field it does not know, among the ones it does', () => {
    const result = describeActivity(
      entry({
        entityType: 'Material',
        changes: { packageCost: change('1', '2'), brandNewColumn: change('a', 'b') },
      }),
      CONTEXT,
    );

    expect([result.sentence, ...result.details].join(' ')).not.toContain('brandNewColumn');
  });

  it('is not fooled by a model or a column named like a property of every object', () => {
    expect(() =>
      describeActivity(entry({ entityType: 'constructor', operation: 'CREATE' }), CONTEXT),
    ).not.toThrow();
    expect(
      sentenceOf(entry({ entityType: 'Material', changes: { constructor: change('a', 'b') } })),
    ).toBe('Você alterou o insumo Café 3 Corações');
  });

  it('leaves a value out when it is not in the shape the field has, rather than printing it', () => {
    const result = sentenceOf(
      entry({ entityType: 'Material', changes: { packageCost: change('not-a-number', '24.5') } }),
    );

    expect(result).toBe('Você alterou o custo da embalagem de Café 3 Corações');
  });

  it('uses a generic noun when the trail has no label for a model it knows', () => {
    expect(sentenceOf(entry({ entityType: 'Sale', entityLabel: null, operation: 'DELETE' }))).toBe(
      'Você excluiu uma venda',
    );
    expect(
      sentenceOf(
        entry({
          entityType: 'Sale',
          entityLabel: null,
          changes: { paymentStatus: change('PENDING', 'PAID') },
        }),
      ),
    ).toBe('Você alterou o pagamento de uma venda de Pendente para Pago');
  });

  it('cuts a very long text so the sentence stays a sentence', () => {
    const long = 'x'.repeat(200);
    const result = sentenceOf(
      entry({ entityType: 'Material', changes: { description: change('curta', long) } }),
    );

    expect(result.length).toBeLessThan(150);
    expect(result).toContain('…');
  });
});
