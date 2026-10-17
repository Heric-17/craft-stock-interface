import { describe, expect, it } from 'vitest';

import { NON_BREAKING_SPACE } from '@/shared/format';
import { Quantity } from '@/shared/quantity';
import {
  linhaCera,
  linhaEssencia,
  linhaFita,
  listaComLinhaSemEstimativa,
  listaCompleta,
} from '@/test/fixtures/shortages';

import {
  toShoppingList,
  toShoppingListLine,
  type LineMarks,
  type MaterialPackages,
} from './shopping-list';
import { buildShoppingText, packagesPhrase, totalFor } from './shopping-text';

const SPACE = NON_BREAKING_SPACE;

const essencia = toShoppingListLine(linhaEssencia);
const cera = toShoppingListLine(linhaCera);
const fita = toShoppingListLine(linhaFita);

const PACKAGES: ReadonlyMap<string, MaterialPackages> = new Map([
  ['mat-essencia', { imageUrl: null, packageQuantity: Quantity.fromApi(100, 'MILLILITER') }],
  ['mat-cera', { imageUrl: null, packageQuantity: Quantity.fromApi(1000, 'GRAM') }],
]);

describe('packagesPhrase', () => {
  it('says how many closed packages and of what size', () => {
    expect(packagesPhrase(2, PACKAGES.get('mat-cera'))).toBe(`2 embalagens de 1${SPACE}kg`);
    expect(packagesPhrase(1, PACKAGES.get('mat-essencia'))).toBe(`1 embalagem de 100${SPACE}ml`);
  });

  it('says only how many when the size is not known yet', () => {
    expect(packagesPhrase(3, undefined)).toBe('3 embalagens');
  });
});

describe('buildShoppingText', () => {
  it('writes one line per ticked material, with the packages and the API’s estimate', () => {
    const text = buildShoppingText({
      lines: [essencia, cera],
      packages: PACKAGES,
      saleCount: 2,
      total: null,
    });

    expect(text).toBe(
      [
        'Lista de compras',
        'Baseada em 2 vendas.',
        '',
        `- Essência baunilha: 1 embalagem de 100${SPACE}ml (falta 14${SPACE}ml) — R$${SPACE}38,00`,
        `- Cera de soja: 2 embalagens de 1${SPACE}kg (falta 1,76${SPACE}kg) — R$${SPACE}56,00`,
      ].join('\n'),
    );
  });

  it('says a sale in the singular when there is one', () => {
    const text = buildShoppingText({
      lines: [cera],
      packages: PACKAGES,
      saleCount: 1,
      total: null,
    });

    expect(text).toContain('Baseada em 1 venda.');
  });

  it('never prints a price for a line the API could not estimate', () => {
    const text = buildShoppingText({
      lines: [fita],
      packages: PACKAGES,
      saleCount: 1,
      total: null,
    });

    expect(text).toContain(
      `- Fita de cetim: falta 300${SPACE}cm (sem dados da embalagem) — sem estimativa de custo`,
    );
    expect(text).not.toMatch(/R\$/);
  });

  it('writes the total, and says what it leaves out when a line has no estimate', () => {
    const list = toShoppingList(listaComLinhaSemEstimativa);
    const text = buildShoppingText({
      lines: list.lines.filter((line) => line.materialId !== 'mat-pavio'),
      packages: PACKAGES,
      saleCount: 1,
      total: totalFor(list, new Map()),
    });

    expect(
      text.endsWith(`Total estimado: R$${SPACE}94,00 (não inclui 1 insumo sem estimativa)`),
    ).toBe(true);
  });

  it('writes a plain total when every line was estimated', () => {
    const list = toShoppingList(listaCompleta);
    const text = buildShoppingText({
      lines: list.lines.slice(0, 1),
      packages: PACKAGES,
      saleCount: 1,
      total: totalFor(list, new Map()),
    });

    expect(text.endsWith(`Total estimado: R$${SPACE}94,00`)).toBe(true);
  });
});

describe('totalFor', () => {
  const list = toShoppingList(listaComLinhaSemEstimativa);

  it('is the API’s own total and count when every line that has to be bought is ticked', () => {
    const total = totalFor(list, new Map());

    expect(total?.amount.toCentsString()).toBe('94.00');
    expect(total?.unestimatedLineCount).toBe(1);
  });

  it('is nothing when a line that has to be bought was left out: the API’s total would count it', () => {
    const marks: LineMarks = new Map([['mat-cera', false]]);

    expect(totalFor(list, marks)).toBeNull();
  });

  it('does not mind a line that does not have to be bought being left out', () => {
    expect(totalFor(list, new Map([['mat-pavio', false]]))).not.toBeNull();
  });
});
