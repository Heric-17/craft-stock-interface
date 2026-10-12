import { toast } from 'sonner';

import { isApiError } from '@/shared/api/api-error';
import { errorDetail, messageForError } from '@/shared/api/error-messages';
import { copyToClipboard } from '@/shared/lib/clipboard';

/**
 * A failure that does not belong to a field, as a toast. For an unexpected one
 * the support code rides along with a button to copy it, for the same reason
 * `UnexpectedError` shows it: it is the only handle on the failure.
 */
export function showErrorToast(error: unknown): void {
  if (!isApiError(error)) {
    toast.error('Algo deu errado. Tente novamente.');
    return;
  }

  const supportCode = error.isUnexpected ? error.supportId : undefined;
  const detail = errorDetail(error);

  toast.error(messageForError(error), {
    ...(supportCode !== undefined
      ? {
          description: `Envie este código para o suporte: ${supportCode}`,
          action: {
            label: 'Copiar código',
            onClick: () => void copyToClipboard(supportCode),
          },
        }
      : detail !== undefined
        ? { description: detail }
        : {}),
  });
}
