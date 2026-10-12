import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { isApiError } from '@/shared/api/api-error';
import { errorDetail, messageForError } from '@/shared/api/error-messages';
import { copyToClipboard } from '@/shared/lib/clipboard';

import { Button } from './button';

const GENERIC_MESSAGE = 'Algo deu errado. Tente novamente.';
const COPIED_FOR_MILLISECONDS = 2000;

/**
 * What to show for a failure, in a place with room for it: the sentence in
 * plain Portuguese, the detail that only the typed `details` know, and — when
 * the failure is ours — the support code.
 *
 * The code is the `errorId` when the API recorded one and the `correlationId`
 * otherwise, which is what is left when the response had no body. Without it
 * "deu erro aqui" is all anyone has to go on and the failure cannot be found in
 * the trail. It is shown only for failures nobody could have avoided (a 5xx, or
 * no network); a refused domain rule has no use for it.
 *
 * Never a stack trace, raw JSON, the `code` or the API's English message.
 */
export function UnexpectedError({ error }: { error: unknown }) {
  const apiError = isApiError(error) ? error : null;
  const message = apiError === null ? GENERIC_MESSAGE : messageForError(apiError);
  const detail = apiError === null ? undefined : errorDetail(apiError);
  const supportCode = apiError?.isUnexpected === true ? apiError.supportId : undefined;

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-muted-foreground text-sm">{message}</p>
      {detail === undefined ? null : <p className="text-foreground text-sm">{detail}</p>}
      {supportCode === undefined ? null : <SupportCode code={supportCode} />}
    </div>
  );
}

function SupportCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timer = setTimeout(() => setCopied(false), COPIED_FOR_MILLISECONDS);

    return () => clearTimeout(timer);
  }, [copied]);

  async function copy(): Promise<void> {
    if (await copyToClipboard(code)) {
      setCopied(true);
    } else {
      toast.error('Não foi possível copiar. Selecione o código e copie manualmente.');
    }
  }

  return (
    <div className="border-border bg-muted flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-muted-foreground text-xs">Envie este código para o suporte</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="bg-card min-w-0 rounded px-2 py-1 text-xs break-all select-all">
          {code}
        </code>
        <Button variant="outline" size="sm" onClick={() => void copy()}>
          {copied ? 'Código copiado' : 'Copiar código'}
        </Button>
      </div>
    </div>
  );
}
