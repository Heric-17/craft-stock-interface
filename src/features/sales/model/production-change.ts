import type { ProductionStatus } from './status';

/**
 * What moving a sale along the production axis does to the stock, because it
 * is the one change on this screen that reaches beyond the sale itself.
 *
 * The API's rule is one rule about the axis, not about pairs of states:
 * **pending means nothing was taken from the stock; any other state means it
 * was.** So the stock moves only when a sale crosses the line between pending
 * and the rest:
 *
 *  - leaving pending, for assembled **or** delivered, **debits** it, if it has
 *    not been debited already;
 *  - returning to pending, from assembled or delivered, **returns** exactly
 *    what was debited;
 *  - moving between assembled and delivered leaves it alone.
 *
 * The screen never works out how much: it says what will happen, and the stock
 * it shows afterwards is the API's.
 */
export type ProductionChangeEffect = 'DEBITS_STOCK' | 'RETURNS_STOCK' | 'NONE';

export function productionChangeEffect(
  from: ProductionStatus,
  to: ProductionStatus,
): ProductionChangeEffect {
  if (from === to) {
    return 'NONE';
  }

  if (from === 'PENDING') {
    return 'DEBITS_STOCK';
  }

  return to === 'PENDING' ? 'RETURNS_STOCK' : 'NONE';
}

export interface ProductionConfirmation {
  title: string;
  /** What will happen, in the first line the person reads. */
  effect: string;
  /** What else is worth knowing. */
  note: string;
  confirmLabel: string;
}

const TARGET_WORDS: Record<
  Exclude<ProductionStatus, 'PENDING'>,
  { title: string; confirmLabel: string }
> = {
  ASSEMBLED: { title: 'Marcar esta venda como montada?', confirmLabel: 'Marcar como montada' },
  DELIVERED: { title: 'Marcar esta venda como entregue?', confirmLabel: 'Marcar como entregue' },
};

/**
 * The question asked before a move that touches the stock. Leaving pending
 * debits whichever state it goes to, so assembled and delivered ask the same
 * thing; going back to pending asks the opposite.
 */
export function productionConfirmation(
  effect: Exclude<ProductionChangeEffect, 'NONE'>,
  to: ProductionStatus,
): ProductionConfirmation {
  if (effect === 'DEBITS_STOCK' && to !== 'PENDING') {
    return {
      ...TARGET_WORDS[to],
      effect:
        'O estoque será debitado agora: os insumos usados nos itens desta venda saem do estoque.',
      note: 'Se faltar estoque de algum insumo, o sistema debita só o que existe, deixa o estoque dele em zero e marca a venda mesmo assim. Para desfazer, volte a produção para Pendente: volta exatamente o que foi debitado.',
    };
  }

  return {
    title: 'Voltar a produção para Pendente?',
    effect:
      'O estoque debitado será devolvido: os insumos voltam ao estoque na mesma quantidade que saiu quando a venda deixou de estar pendente.',
    note: 'O pagamento não muda. A venda volta a poder ser editada, e na próxima vez que sair de Pendente o estoque é debitado de novo, com os itens que ela tiver então.',
    confirmLabel: 'Voltar para Pendente',
  };
}
