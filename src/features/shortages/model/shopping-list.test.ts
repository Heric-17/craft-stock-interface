import { describe, expect, it } from 'vitest';

import {
  linhaCera,
  linhaEssencia,
  linhaFita,
  linhaPavio,
  listaComLinhaSemEstimativa,
} from '@/test/fixtures/shortages';

import {
  isLineMarked,
  isUnestimated,
  needsPurchase,
  onlyMissing,
  resolveSaleSelection,
  toggleLineMark,
  toShoppingList,
  toShoppingListLine,
  type LineMarks,
} from './shopping-list';

const essencia = toShoppingListLine(linhaEssencia);
const pavio = toShoppingListLine(linhaPavio);
const cera = toShoppingListLine(linhaCera);
const fita = toShoppingListLine(linhaFita);

describe('toShoppingList', () => {
  it('carries the quantities with the unit of each material and the money as the API wrote it', () => {
    const list = toShoppingList(listaComLinhaSemEstimativa);

    expect(list.lines.map((line) => line.name)).toEqual([
      'Essência baunilha',
      'Pavio encerado',
      'Cera de soja',
      'Fita de cetim',
    ]);
    expect(cera.shortage.toDecimalString()).toBe('1760.000');
    expect(cera.shortage.unit).toBe('GRAM');
    expect(essencia.shortage.unit).toBe('MILLILITER');
    expect(cera.packagesToBuy).toBe(2);
    expect(cera.estimatedCost?.toCentsString()).toBe('56.00');
    expect(list.estimatedTotal.toCentsString()).toBe('94.00');
    expect(list.unestimatedLineCount).toBe(1);
  });

  it('keeps an unknown estimate unknown: null, never a zero', () => {
    expect(fita.estimatedCost).toBeNull();
    expect(fita.packagesToBuy).toBeNull();
    expect(fita.estimateIssue).toBe('MISSING_PACKAGE_DATA');
    expect(isUnestimated(fita)).toBe(true);
  });

  it('keeps a real zero as a zero: nothing to buy costs nothing', () => {
    expect(pavio.estimatedCost?.isZero()).toBe(true);
    expect(pavio.packagesToBuy).toBe(0);
    expect(isUnestimated(pavio)).toBe(false);
  });
});

describe('what has to be bought', () => {
  it('is what the API says is missing', () => {
    expect(needsPurchase(essencia)).toBe(true);
    expect(needsPurchase(fita)).toBe(true);
    expect(needsPurchase(pavio)).toBe(false);
  });

  it('is the only thing "apenas faltantes" leaves', () => {
    expect(onlyMissing([essencia, pavio, cera, fita]).map((line) => line.name)).toEqual([
      'Essência baunilha',
      'Cera de soja',
      'Fita de cetim',
    ]);
  });
});

describe('the ticks', () => {
  const none: LineMarks = new Map();

  it('start ticked for what has to be bought and never for what does not', () => {
    expect(isLineMarked(essencia, none)).toBe(true);
    expect(isLineMarked(fita, none)).toBe(true);
    expect(isLineMarked(pavio, none)).toBe(false);
  });

  it('are changed one line at a time, without touching the others', () => {
    const unticked = toggleLineMark(none, cera);

    expect(isLineMarked(cera, unticked)).toBe(false);
    expect(isLineMarked(essencia, unticked)).toBe(true);
    expect(isLineMarked(cera, toggleLineMark(unticked, cera))).toBe(true);
  });

  it('cannot tick a line with nothing to buy', () => {
    expect(isLineMarked(pavio, toggleLineMark(none, pavio))).toBe(false);
  });

  it('do not change the map they were given', () => {
    toggleLineMark(none, cera);

    expect(none.size).toBe(0);
  });
});

describe('resolveSaleSelection', () => {
  const available = ['sale-1', 'sale-2', 'sale-3'];

  it('is every sale that is available until a choice is made', () => {
    expect(resolveSaleSelection(available, null)).toEqual(available);
  });

  it('is the chosen ones, in the order they are listed', () => {
    expect(resolveSaleSelection(available, new Set(['sale-3', 'sale-1']))).toEqual([
      'sale-1',
      'sale-3',
    ]);
  });

  it('drops a chosen sale that is no longer available, instead of asking the API about it', () => {
    expect(resolveSaleSelection(['sale-1'], new Set(['sale-1', 'sale-gone']))).toEqual(['sale-1']);
  });

  it('is empty when none of the chosen ones is left', () => {
    expect(resolveSaleSelection(['sale-1'], new Set(['sale-gone']))).toEqual([]);
  });
});
