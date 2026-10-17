import { useState } from 'react';

import { Button } from '@/shared/ui/button';
import { Callout } from '@/shared/ui/callout';
import { ResponsiveSheet, SheetPanel } from '@/shared/ui/sheet-panel';

import { CAMERA_FAILURE_MESSAGES } from '../model/labels';

import { useQrScanner } from './use-qr-scanner';

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once, with the text of the QR Code. The panel closes itself right before. */
  onScan: (text: string) => void;
}

/**
 * The camera, in a panel that comes up from the bottom on a phone. It closes by
 * itself when a QR Code is read, and everything it opened closes with it: the
 * content only exists while the panel is open, so the camera is released the
 * moment it is not.
 */
export function QrScannerDialog({ open, onOpenChange, onScan }: QrScannerDialogProps) {
  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Escanear QR Code">
      <SheetPanel
        title="Escanear QR Code"
        description="Aponte a câmera para o QR Code no rodapé da nota fiscal. A nota é enviada assim que ele for lido."
        footer={
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        }
      >
        <ScannerView
          onScan={(text) => {
            onOpenChange(false);
            onScan(text);
          }}
        />
      </SheetPanel>
    </ResponsiveSheet>
  );
}

function ScannerView({ onScan }: { onScan: (text: string) => void }) {
  // Trying again is starting over: a new key mounts a new scanner, and a new
  // scanner opens the camera from scratch.
  const [attempt, setAttempt] = useState(0);

  return <Scanner key={attempt} onScan={onScan} onRetry={() => setAttempt((count) => count + 1)} />;
}

function Scanner({ onScan, onRetry }: { onScan: (text: string) => void; onRetry: () => void }) {
  const { videoRef, state } = useQrScanner(onScan);
  const failed = state.status === 'failed';

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted relative aspect-4/3 w-full overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          muted
          playsInline
          aria-label="Imagem da câmera"
          className="absolute inset-0 size-full object-cover"
        />
        {failed ? null : (
          <span
            aria-hidden="true"
            className="border-primary pointer-events-none absolute inset-[18%] rounded-xl border-4"
          />
        )}
      </div>

      {state.status === 'starting' ? (
        <p role="status" className="text-muted-foreground text-center text-sm">
          Abrindo a câmera… Se o navegador pedir, permita o acesso.
        </p>
      ) : null}

      {state.status === 'scanning' ? (
        <p role="status" className="text-muted-foreground text-center text-sm">
          Procurando o QR Code…
        </p>
      ) : null}

      {state.status === 'failed' ? (
        <>
          <Callout tone="danger" alert>
            {CAMERA_FAILURE_MESSAGES[state.failure]}
          </Callout>
          {state.failure === 'NO_CAMERA' ? null : (
            <Button type="button" variant="outline" onClick={onRetry}>
              Tentar de novo
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}
