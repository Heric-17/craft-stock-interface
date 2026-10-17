import type { InvoiceState } from './pending-invoice';
import type { CameraFailure } from './camera-failure';

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
