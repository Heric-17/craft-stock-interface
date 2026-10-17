import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { copyToClipboard } from '@/shared/lib/clipboard';

import { Button } from './button';

const COPIED_FOR_MILLISECONDS = 2000;

/**
 * The code a person hands to support, with a button to copy it. Shown wherever
 * a failure needs someone else to act: it is the only handle on what happened.
 */
export function SupportCode({ code }: { code: string }) {
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
