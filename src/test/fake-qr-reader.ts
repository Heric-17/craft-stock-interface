import { vi } from 'vitest';

/**
 * Stands in for `@zxing/browser` in a test, because jsdom cannot decode a
 * picture. Use it as the factory of `vi.mock`:
 *
 *     vi.mock('@zxing/browser', async () => (await import('@/test/fake-qr-reader')).zxingModule);
 *
 * Only the reader is replaced. The camera it looks through is the simulated
 * media API of `test/media`, so what a test asserts about the stream is about
 * the real code that opens and releases it.
 */
export const fakeReader = {
  controls: { stop: vi.fn() },
  /** Reads a QR Code, as if the camera had seen it. Set once the reader starts. */
  read: undefined as ((text: string) => void) | undefined,
};

export const zxingModule = {
  BrowserQRCodeReader: class {
    decodeFromStream(
      _stream: MediaStream,
      _video: HTMLVideoElement,
      callback: (result: { getText: () => string }, error: undefined, controls: unknown) => void,
    ) {
      fakeReader.read = (text) => callback({ getText: () => text }, undefined, fakeReader.controls);

      return Promise.resolve(fakeReader.controls);
    }
  },
};

export function resetFakeReader(): void {
  fakeReader.controls.stop.mockClear();
  fakeReader.read = undefined;
}
