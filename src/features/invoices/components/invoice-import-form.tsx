import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ClipboardPaste, ScanLine } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

import { applyApiErrorToForm } from '@/shared/api/form-errors';
import { isApiError } from '@/shared/api/api-error';
import { readFromClipboard } from '@/shared/lib/clipboard';
import { useIsDesktop } from '@/shared/lib/use-media-query';
import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { FormSection } from '@/shared/ui/form-section';
import { TextField } from '@/shared/ui/text-field';

import { useImportInvoice } from '../api/use-invoice-mutations';
import {
  invoiceUrlSchema,
  isHttpsUrl,
  type InvoiceUrlFormValues,
} from '../model/invoice-url.schema';

import { InvoiceFailure } from './invoice-failure';
import { QrScannerDialog } from './qr-scanner-dialog';
import { useCameraAvailable } from './use-camera-available';

interface InvoiceImportFormProps {
  /** Where the second step of a given purchase is. */
  classificationPath: (purchaseId: string) => string;
  /** Bumped by the screen to ask for the address field to take focus. */
  focusRequest: number;
}

type PasteProblem = 'BLOCKED' | 'EMPTY';

const PASTE_PROBLEM_MESSAGES: Record<PasteProblem, string> = {
  BLOCKED:
    'Seu navegador não deixou ler o que você copiou. Toque no campo e cole o endereço por lá (segure o dedo no campo e escolha Colar, ou use Ctrl+V).',
  EMPTY: 'Não há nada copiado. Copie o endereço do QR Code e toque em Colar de novo.',
};

/**
 * The first of the two steps: getting the address of the note's QR Code to the
 * API, by camera or by pasting it.
 *
 * Checks only that it is an address on the web. Whether it is a note, from a
 * state the system reads, is the API's call — and what it answers is shown here
 * as it is, including "this note was already imported", which takes the person
 * to it instead of importing it twice.
 *
 * Scanning on a phone is the main action and is drawn first and large; on a
 * computer the address is pasted and scanning, when there is a camera at all,
 * sits beside it.
 */
export function InvoiceImportForm({ classificationPath, focusRequest }: InvoiceImportFormProps) {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const cameraAvailable = useCameraAvailable();
  const importInvoice = useImportInvoice();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [pasteProblem, setPasteProblem] = useState<PasteProblem | null>(null);

  const { register, handleSubmit, setValue, setError, setFocus, formState } =
    useForm<InvoiceUrlFormValues>({
      resolver: zodResolver(invoiceUrlSchema),
      defaultValues: { url: '' },
    });

  useEffect(() => {
    if (focusRequest > 0) {
      setFocus('url');
    }
  }, [focusRequest, setFocus]);

  const sending = importInvoice.isPending;

  function send(url: string): void {
    importInvoice.mutate(url, {
      onSuccess: (imported) => {
        toast.success(
          imported.merchantName === null
            ? 'Nota importada. Falta classificar os itens.'
            : `Nota de ${imported.merchantName} importada. Falta classificar os itens.`,
        );
        void navigate(classificationPath(imported.purchaseId));
      },
      onError: (error) => {
        // The one failure that is about what was typed: marks the field. Every
        // other one is shown whole, below the form, by `InvoiceFailure`.
        if (isApiError(error) && error.code === 'VALIDATION_FAILED') {
          applyApiErrorToForm(error, setError);
        }
      },
    });
  }

  const onSubmit = handleSubmit((values) => send(values.url));

  async function paste(): Promise<void> {
    const text = await readFromClipboard();

    if (text === null || text.trim() === '') {
      // Not an error to dwell on: the field is right there to paste into.
      setPasteProblem(text === null ? 'BLOCKED' : 'EMPTY');
      setFocus('url');
      return;
    }

    setPasteProblem(null);
    importInvoice.reset();
    setValue('url', text.trim(), { shouldValidate: true, shouldDirty: true });
  }

  function handleScanned(text: string): void {
    const url = text.trim();

    importInvoice.reset();
    setPasteProblem(null);
    // Always shown in the field, so what was read is visible and an address that
    // is not one is explained there; only a valid one is sent without asking.
    setValue('url', url, { shouldValidate: true, shouldDirty: true });

    if (isHttpsUrl(url)) {
      send(url);
    }
  }

  const scanButton = cameraAvailable ? (
    <Button
      type="button"
      variant={isDesktop ? 'outline' : 'primary'}
      className={isDesktop ? undefined : 'h-14 w-full text-base'}
      disabled={sending}
      onClick={() => setScannerOpen(true)}
    >
      <ScanLine aria-hidden="true" className={isDesktop ? undefined : 'size-5'} />
      Escanear QR Code
    </Button>
  ) : null;

  const fieldError = formState.errors.url?.message;
  const formError = formState.errors.root?.api?.message;

  return (
    <FormSection
      title="Nova importação"
      description="Escaneie o QR Code da nota fiscal ou cole o endereço dele. Uma nota escaneada no celular pode ser concluída no computador."
      icon={ScanLine}
    >
      <span className="bg-secondary text-secondary-foreground w-fit rounded-md px-2 py-1 text-xs font-semibold">
        Passo 1 de 2
      </span>

      {isDesktop ? null : scanButton}
      {isDesktop || !cameraAvailable ? null : (
        <p aria-hidden="true" className="text-muted-foreground text-center text-xs">
          ou cole o endereço
        </p>
      )}

      <form
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
        aria-label="Importar nota"
      >
        <TextField
          label="Endereço do QR Code"
          placeholder="https://…"
          inputMode="url"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={sending}
          error={fieldError ?? formError}
          {...register('url', {
            onChange: () => {
              if (importInvoice.isError) {
                importInvoice.reset();
              }
            },
          })}
        />
        <p className="text-muted-foreground -mt-2 text-xs text-pretty">
          Você encontra o QR Code no rodapé da nota fiscal. O endereço começa com https://.
        </p>

        {pasteProblem === null ? null : (
          <Callout tone="info">{PASTE_PROBLEM_MESSAGES[pasteProblem]}</Callout>
        )}

        {importInvoice.isError ? (
          <InvoiceFailure error={importInvoice.error} classificationPath={classificationPath} />
        ) : null}

        {sending ? (
          <p role="status" className="text-muted-foreground text-sm">
            Lendo a nota no portal da SEFAZ. Isso pode levar alguns segundos.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {isDesktop ? scanButton : null}
          <Button type="button" variant="outline" disabled={sending} onClick={() => void paste()}>
            <ClipboardPaste aria-hidden="true" />
            Colar URL
          </Button>
          <Button type="submit" disabled={sending}>
            {sending ? 'Buscando a nota…' : 'Continuar'}
            {sending ? null : <ArrowRight aria-hidden="true" />}
          </Button>
        </div>
      </form>

      <QrScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleScanned} />
    </FormSection>
  );
}
