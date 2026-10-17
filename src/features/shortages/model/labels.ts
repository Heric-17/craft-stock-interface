import { formatCount } from '@/shared/format';

/** "1 venda", "4 vendas": a count with its noun, the number written as every other count is. */
export function countText(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${formatCount(count)} ${plural}`;
}

export const salesCountText = (count: number) => countText(count, 'venda', 'vendas');

export const packagesCountText = (count: number) => countText(count, 'embalagem', 'embalagens');

export const LINE_STATUS_LABELS = {
  buy: 'Comprar',
  enough: 'Suficiente',
} as const;

/** What is said on a line the API could not estimate, and why, in the words of someone who produces. */
export const UNESTIMATED_LINE_TEXT = {
  badge: 'Sem estimativa',
  reason: 'Falta o tamanho ou o preço da embalagem no cadastro do insumo.',
  packages: 'Embalagens: não dá para calcular',
} as const;

/**
 * Why the total on top is not the whole story. It is a floor while any line has
 * no estimate, and the screen says so instead of presenting it as complete.
 */
export function partialTotalText(unestimatedLineCount: number): string {
  const lines = countText(unestimatedLineCount, 'insumo', 'insumos');

  return `Este total não cobre ${lines} sem estimativa: falta o tamanho ou o preço da embalagem no cadastro. O valor real é maior.`;
}
