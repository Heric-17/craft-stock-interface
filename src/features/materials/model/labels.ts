import type { ConsumptionUnit } from '@/shared/quantity';

import type { StockLossReason } from './loss-reason';
import type { PriceChangeOrigin } from './material';
import type { StockAdjustmentKind } from './stock-adjustment';

/** How each consumption unit is offered in a select: the name, then the symbol. */
export const CONSUMPTION_UNIT_LABELS: Record<ConsumptionUnit, string> = {
  UNIT: 'Unidade (un)',
  GRAM: 'Gramas (g)',
  MILLILITER: 'Mililitros (ml)',
  CENTIMETER: 'Centímetros (cm)',
};

/** Where a package cost came from, for the price history. */
export const PRICE_ORIGIN_LABELS: Record<PriceChangeOrigin, string> = {
  CREATION: 'Cadastro',
  MANUAL_EDIT: 'Edição manual',
  INVOICE_SYNC: 'Nota fiscal',
  UNKNOWN: 'Outra origem',
};

export const STOCK_FILTER_LABELS = {
  all: 'Todos os itens',
  low: 'Estoque baixo',
} as const;

export type StockFilter = keyof typeof STOCK_FILTER_LABELS;

interface StockAdjustmentText {
  /** The button that opens it. */
  action: string;
  title: string;
  description: string;
  field: string;
  submit: string;
  submitting: string;
  /** Under the field, before a material is chosen. */
  chooseMaterial: string;
  /** The toast, with the stock the API answered with. */
  done: (name: string, stock: string) => string;
}

/**
 * Three acts that change the same number, each with its own words: an entry is
 * something that arrived, a write-off is something that left without a sale,
 * and a recount is the physical count disagreeing with the system.
 */
export const STOCK_ADJUSTMENT_TEXT: Record<StockAdjustmentKind, StockAdjustmentText> = {
  ENTRY: {
    action: 'Dar entrada',
    title: 'Dar entrada no estoque',
    description: 'Some ao estoque o que chegou, na unidade em que o insumo é consumido.',
    field: 'Quantidade que entrou',
    submit: 'Registrar entrada',
    submitting: 'Registrando…',
    chooseMaterial: 'Escolha o insumo para informar a quantidade que entrou.',
    done: (name, stock) => `Entrada registrada em ${name}. Estoque agora: ${stock}.`,
  },
  WRITE_OFF: {
    action: 'Dar baixa / perda',
    title: 'Dar baixa ou registrar perda',
    description:
      'Tire do estoque o que saiu sem ser por venda, como uma garrafa que quebrou ou um lote que venceu. Fica no histórico de perdas, com o motivo.',
    field: 'Quantidade que saiu',
    submit: 'Registrar baixa',
    submitting: 'Registrando…',
    chooseMaterial: 'Escolha o insumo para informar a quantidade que saiu.',
    done: (name, stock) => `Baixa registrada em ${name}. Estoque agora: ${stock}.`,
  },
  RECOUNT: {
    action: 'Corrigir contagem',
    title: 'Corrigir contagem do estoque',
    description:
      'Use quando a contagem física não bate com o sistema. O estoque passa a ser exatamente o que você contou.',
    field: 'Quantidade contada',
    submit: 'Salvar contagem',
    submitting: 'Salvando…',
    chooseMaterial: 'Escolha o insumo para informar a quantidade contada.',
    done: (name, stock) => `Contagem de ${name} corrigida. Estoque agora: ${stock}.`,
  },
};

/** Why stock was lost, as it is picked and as it is read in the history. */
export const STOCK_LOSS_REASON_LABELS: Record<StockLossReason, string> = {
  BREAKAGE: 'Quebrou',
  EXPIRED: 'Venceu',
  SPOILAGE: 'Estragou',
  LOST: 'Perdido',
  OTHER: 'Outro',
};
