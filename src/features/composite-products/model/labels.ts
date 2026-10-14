import { formatCount } from '@/shared/format';

import type { ResultSource } from './result-figures';

/** "1 unidade", "24 unidades": a count of finished products, never a quantity of a material. */
export function unitsText(count: number): string {
  return count === 1 ? '1 unidade' : `${formatCount(count)} unidades`;
}

/** The seal on the figures of the result panel: which of the two kinds they are. */
export const RESULT_SOURCE_LABELS: Record<ResultSource, string> = {
  new: 'Prévia',
  preview: 'Prévia',
  saved: 'Salvo',
};

/** The sentence under the figures, saying where they come from. */
export const RESULT_SOURCE_NOTES: Record<ResultSource, string> = {
  new: 'Prévia calculada enquanto você preenche. Depois de salvar, valem os valores do sistema.',
  preview: 'Prévia calculada enquanto você edita. Depois de salvar, valem os valores do sistema.',
  saved: 'Valores calculados pelo sistema com o estoque e os custos de agora.',
};

export const CAPACITY_TEXT = {
  title: 'Dá para produzir',
  zero: 'Não dá para produzir com o estoque atual.',
  noItems: 'Esta ficha não tem itens, então não há nada que limite — nem que permita — produzir.',
  newProduct:
    'A capacidade de produção é calculada pelo sistema depois que a ficha é salva, com o estoque de cada insumo.',
  stale:
    'Vale para a ficha salva. Salve as mudanças nos itens para recalcular com o estoque de cada insumo.',
  bottleneck: 'Insumo gargalo',
  inStock: 'Em estoque',
  perUnit: 'Cada unidade consome',
} as const;
