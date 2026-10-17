import { Copy, Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';

import { copyToClipboard } from '@/shared/lib/clipboard';
import { canShareText, shareText } from '@/shared/lib/share';
import { Button } from '@/shared/ui/button';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';

import { PrintArea } from './print-area';

const TITLE = 'Lista de compras';

interface ShoppingListSheetProps {
  /** The text of the list, or `null` while the panel is closed. */
  text: string | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * The list of what to buy, written out and ready to leave the screen: copied,
 * sent through the phone's share sheet where there is one, or printed.
 *
 * It exists only here. The list is made from what was ticked at the moment the
 * button was pressed, shown as the very text that is copied, and saved nowhere —
 * closing the panel is the end of it, and pressing the button again makes it
 * again from the screen as it is then.
 */
export function ShoppingListSheet({ text, onOpenChange }: ShoppingListSheetProps) {
  return (
    <ResponsiveSheet open={text !== null} onOpenChange={onOpenChange} title={TITLE}>
      {text === null ? null : <ListBody text={text} />}
    </ResponsiveSheet>
  );
}

function ListBody({ text }: { text: string }) {
  const lineCount = text.split('\n').length;

  async function copy(): Promise<void> {
    if (await copyToClipboard(text)) {
      toast.success('Lista copiada.');
    } else {
      toast.error('Não foi possível copiar. Selecione o texto da lista e copie por ele.');
    }
  }

  async function share(): Promise<void> {
    // Closing the share sheet without choosing is not a failure, and says nothing.
    if ((await shareText(TITLE, text)) === 'failed') {
      toast.error('Não foi possível compartilhar. Copie o texto e envie por onde preferir.');
    }
  }

  return (
    <>
      <SheetPanel
        title={TITLE}
        description="Feita agora com os insumos marcados. Ela não fica salva: ao fechar, é só gerar de novo."
        footer={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              Imprimir
            </Button>
            {canShareText() ? (
              <Button variant="outline" onClick={() => void share()}>
                <Share2 aria-hidden="true" />
                Compartilhar
              </Button>
            ) : null}
            <Button onClick={() => void copy()}>
              <Copy aria-hidden="true" />
              Copiar texto
            </Button>
          </>
        }
      >
        <textarea
          readOnly
          aria-label="Texto da lista de compras"
          value={text}
          rows={Math.min(Math.max(lineCount + 1, 6), 18)}
          // `rows` is the fallback for a browser that cannot size a field to its text: a
          // line that wraps on a phone is more than one row, and the panel scrolls.
          className="border-input bg-background text-foreground field-sizing-content w-full resize-none rounded-md border p-3 text-base leading-relaxed md:text-sm"
        />
      </SheetPanel>
      <PrintArea text={text} />
    </>
  );
}
