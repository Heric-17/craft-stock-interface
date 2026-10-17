import type { CameraFailure } from './camera-failure';
import type { ConcludeBlock, ConclusionSummary, StockTarget } from './classification-draft';
import type { DiscountAllocationMode, DiscountModeBlock } from './discount-mode';
import type { ManualLineIssue } from './manual-allocation';
import type { InvoiceState } from './pending-invoice';

/** What the screen calls each state of a note in the queue. */
export const INVOICE_STATE_LABELS: Record<InvoiceState, string> = {
  PROCESSING: 'Processando',
  STALLED: 'Sem resposta',
  SOURCE_UNAVAILABLE: 'Portal instável',
  STRUCTURE_CHANGED: 'Portal alterado',
  IMPORTED: 'Importada',
};

/** One line under the row saying what is happening and what can be done. */
export const INVOICE_STATE_DESCRIPTIONS: Record<InvoiceState, string> = {
  PROCESSING: 'Estamos lendo a nota no portal da SEFAZ. Isso leva alguns segundos.',
  STALLED: 'A leitura desta nota não terminou. Tente novamente.',
  SOURCE_UNAVAILABLE: 'O portal da SEFAZ não respondeu. Tente novamente em instantes.',
  STRUCTURE_CHANGED:
    'A leitura da nota quebrou e o suporte precisa ajustar o sistema antes de tentar de novo.',
  IMPORTED: 'A nota foi lida.',
};

export function invoiceCountText(total: number, formatted: string): string {
  return total === 1 ? '1 nota' : `${formatted} notas`;
}

export function attemptsText(count: number): string {
  return count === 1 ? '1 tentativa' : `${count} tentativas`;
}

/** Why the camera did not open, and what to do about it. */
export const CAMERA_FAILURE_MESSAGES: Record<CameraFailure, string> = {
  PERMISSION_DENIED:
    'O acesso à câmera foi bloqueado. Libere a câmera nas permissões do navegador para este site, ou feche e cole o endereço da nota.',
  NO_CAMERA: 'Este aparelho não tem câmera disponível. Feche e cole o endereço da nota.',
  IN_USE:
    'A câmera está sendo usada por outro aplicativo. Feche-o e tente de novo, ou cole o endereço da nota.',
  UNAVAILABLE:
    'Não foi possível abrir a câmera. Tente de novo, ou feche e cole o endereço da nota.',
};

/** The four ways of spreading the discount of a note, as the person chooses them. */
export const DISCOUNT_MODE_LABELS: Record<DiscountAllocationMode, string> = {
  PROPORTIONAL: 'Dividir entre todos os itens',
  COMPANY_ONLY: 'Só nos itens da empresa',
  PERSONAL_ONLY: 'Só nos itens pessoais',
  MANUAL: 'Informar item a item',
};

/** What each way does, under its name. */
export const DISCOUNT_MODE_HINTS: Record<DiscountAllocationMode, string> = {
  PROPORTIONAL: 'Cada item recebe uma parte do desconto, em proporção ao seu valor.',
  COMPANY_ONLY: 'O desconto fica só nos itens marcados como gasto da empresa.',
  PERSONAL_ONLY: 'O desconto fica só nos itens que não são da empresa.',
  MANUAL: 'Você diz quanto do desconto vai para cada item.',
};

/** Why a way of spreading the discount is switched off. */
export const DISCOUNT_MODE_BLOCK_REASONS: Record<DiscountModeBlock, string> = {
  NO_LINES: 'A nota não tem itens para receber o desconto.',
  NO_COMPANY_LINE: 'Nenhum item está marcado como gasto da empresa.',
  NO_PERSONAL_LINE: 'Todos os itens estão marcados como gasto da empresa.',
};

/** Why "Concluir" is off, and what to do about it. */
export const CONCLUDE_BLOCK_MESSAGES: Record<ConcludeBlock, string> = {
  NOTHING_TO_CLASSIFY: 'Todos os itens desta nota já deram entrada no estoque.',
  LINES_INCOMPLETE: 'Falta completar os insumos de estoque marcados acima.',
  DISCOUNT_MODE_MISSING: 'Escolha como dividir o desconto da nota.',
  MANUAL_NOT_CLOSED: 'Distribua todo o desconto entre os itens para concluir.',
};

/** What is wrong with the amount typed for one line when the discount is informed item by item. */
export const MANUAL_LINE_ISSUE_MESSAGES: Record<ManualLineIssue, string> = {
  UNREADABLE: 'Não entendi esse valor. Valores em reais têm no máximo 2 casas decimais.',
  NEGATIVE: 'O desconto de um item não pode ser negativo.',
  OVER_CEILING: 'O desconto não pode passar do valor do item.',
};

/** How the two ways of pointing a stock line at a material are offered. */
export const STOCK_TARGET_LABELS: Record<StockTarget, string> = {
  EXISTING: 'Insumo que já existe',
  NEW: 'Criar insumo novo',
};

function counted(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

/**
 * What concluding will do, one sentence per effect, for the confirmation. The
 * counts are of lines, not of money: what each entry is worth is the API's.
 */
export function conclusionLines(summary: ConclusionSummary): string[] {
  const lines: string[] = [];

  if (summary.stockEntries > 0) {
    lines.push(
      `${counted(summary.stockEntries, 'insumo recebe', 'insumos recebem')} entrada no estoque.`,
    );
  }

  if (summary.newMaterials > 0) {
    lines.push(
      `${counted(summary.newMaterials, 'insumo novo será criado', 'insumos novos serão criados')}.`,
    );
  }

  lines.push(
    `${counted(summary.companyExpenses, 'item entra', 'itens entram')} nos gastos da empresa.`,
  );

  if (summary.personalItems > 0) {
    lines.push(
      `${counted(summary.personalItems, 'item fica', 'itens ficam')} de fora, como gasto pessoal.`,
    );
  }

  return lines;
}
