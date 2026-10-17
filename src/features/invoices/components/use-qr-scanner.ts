import type { IScannerControls } from '@zxing/browser';
import { useEffect, useRef, useState, type RefObject } from 'react';

import { classifyCameraFailure, type CameraFailure } from '../model/camera-failure';

export type ScannerState =
  { status: 'starting' } | { status: 'scanning' } | { status: 'failed'; failure: CameraFailure };

/** How long the reader waits between two looks at the picture. */
const SCAN_DELAY_MS = 200;

/**
 * Opens the rear camera into a `<video>` and reports the first QR Code it
 * reads, once.
 *
 * **The stream is this hook's, not the reader's.** It is requested here and
 * every track of it is stopped here — when the screen unmounts, when the scan
 * fails halfway, even when the person closes the panel before the camera had
 * finished opening — so the camera light goes off whatever the reader does or
 * does not release. The reader only looks at the picture.
 *
 * The reader library is imported when this hook starts, which is when the
 * camera is opened and not before: nobody who pastes the address ever
 * downloads it. Only the *type* of the library is imported statically, and
 * that is erased at build time.
 */
export function useQrScanner(onScan: (text: string) => void): {
  videoRef: RefObject<HTMLVideoElement | null>;
  state: ScannerState;
} {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<ScannerState>({ status: 'starting' });

  // The latest callback, without restarting the camera when the parent re-renders.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

  useEffect(() => {
    const video = videoRef.current;
    let cancelled = false;
    let reported = false;
    let stream: MediaStream | null = null;
    let controls: IScannerControls | null = null;

    // Safe to call more than once, and from every path out.
    function release(): void {
      controls?.stop();
      controls = null;
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;

      if (video !== null) {
        video.srcObject = null;
      }
    }

    async function start(): Promise<void> {
      if (video === null) {
        return;
      }

      try {
        // Started now and awaited after the permission: the two overlap.
        const loadingReader = import('@zxing/browser');
        loadingReader.catch(() => undefined);

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });

        if (cancelled) {
          release();
          return;
        }

        const { BrowserQRCodeReader } = await loadingReader;

        if (cancelled) {
          release();
          return;
        }

        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: SCAN_DELAY_MS,
        });
        const started = await reader.decodeFromStream(stream, video, (result) => {
          // Called for every look at the picture: most of them find nothing.
          if (result !== undefined && !reported) {
            reported = true;
            onScanRef.current(result.getText());
          }
        });

        if (cancelled) {
          started.stop();
          release();
          return;
        }

        controls = started;
        setState({ status: 'scanning' });
      } catch (error) {
        release();

        if (!cancelled) {
          setState({ status: 'failed', failure: classifyCameraFailure(error) });
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      release();
    };
  }, []);

  return { videoRef, state };
}
