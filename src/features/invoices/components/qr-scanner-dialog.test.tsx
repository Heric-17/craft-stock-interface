import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeReader as reader, resetFakeReader } from '@/test/fake-qr-reader';
import { installFakeCamera, mediaError } from '@/test/media';

import { QrScannerDialog } from './qr-scanner-dialog';

/**
 * jsdom cannot decode a picture, so the reader library is replaced by one that
 * reports what the test tells it to. What is real is everything the brief is
 * about: the media API — `getUserMedia` and the tracks it hands out — is the
 * simulated one from `test/media`, and the assertions are on those tracks.
 */
vi.mock('@zxing/browser', async () => (await import('@/test/fake-qr-reader')).zxingModule);

const ADDRESS = 'https://www.nfce.fazenda.sp.gov.br/qrcode?p=3524|2|1|1|abc';

function Harness({ onScan }: { onScan: (text: string) => void }) {
  const [open, setOpen] = useState(true);

  return <QrScannerDialog open={open} onOpenChange={setOpen} onScan={onScan} />;
}

beforeEach(resetFakeReader);

async function whenScanning() {
  await screen.findByText('Procurando o QR Code…');
}

describe('the scanner panel', () => {
  it('asks for the rear camera, and for nothing else', async () => {
    const camera = installFakeCamera();
    render(<Harness onScan={vi.fn()} />);

    await whenScanning();

    expect(camera.getUserMedia).toHaveBeenCalledTimes(1);
    expect(camera.getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: { ideal: 'environment' } },
      audio: false,
    });
  });

  it('closes by itself when a QR Code is read, hands over its text once, and lets the camera go', async () => {
    const camera = installFakeCamera();
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);
    await whenScanning();

    // The reader looks again every few hundred milliseconds: the same code is seen twice.
    reader.read?.(ADDRESS);
    reader.read?.(ADDRESS);

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(onScan).toHaveBeenCalledTimes(1);
    expect(onScan).toHaveBeenCalledWith(ADDRESS);
    expect(camera.tracks).toHaveLength(1);
    expect(camera.tracks[0]?.stop).toHaveBeenCalled();
    expect(reader.controls.stop).toHaveBeenCalled();
  });

  it('lets the camera go when the panel is unmounted', async () => {
    const camera = installFakeCamera();
    const { unmount } = render(<Harness onScan={vi.fn()} />);
    await whenScanning();
    expect(camera.tracks[0]?.stop).not.toHaveBeenCalled();

    unmount();

    expect(camera.tracks[0]?.stop).toHaveBeenCalled();
    expect(reader.controls.stop).toHaveBeenCalled();
  });

  it('lets the camera go when the person cancels', async () => {
    const user = userEvent.setup();
    const camera = installFakeCamera();
    const onScan = vi.fn();
    render(<Harness onScan={onScan} />);
    await whenScanning();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(camera.tracks[0]?.stop).toHaveBeenCalled();
    expect(onScan).not.toHaveBeenCalled();
  });

  it('lets the camera go even when the panel is closed before the camera had finished opening', async () => {
    const user = userEvent.setup();
    const track = { kind: 'video', stop: vi.fn() };
    let openCamera: (stream: MediaStream) => void = () => undefined;
    installFakeCamera({
      getUserMedia: () =>
        new Promise<MediaStream>((resolve) => {
          openCamera = resolve;
        }),
    });
    render(<Harness onScan={vi.fn()} />);
    await screen.findByText(/Abrindo a câmera/);

    // The permission prompt is still on screen; the person gives up on the panel.
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // And then the browser opens the camera anyway.
    openCamera({
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream);

    await waitFor(() => {
      expect(track.stop).toHaveBeenCalled();
    });
  });
});

describe('when the camera cannot be opened', () => {
  it('says the permission was refused and offers to try again', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const camera = installFakeCamera({
      getUserMedia: () => {
        attempts += 1;

        return attempts === 1
          ? Promise.reject(mediaError('NotAllowedError'))
          : Promise.resolve({
              getTracks: () => [],
              getVideoTracks: () => [],
            } as unknown as MediaStream);
      },
    });
    render(<Harness onScan={vi.fn()} />);

    expect(await screen.findByText(/O acesso à câmera foi bloqueado/)).toBeInTheDocument();
    // Pasting is the way out of a camera that will not open, and the message says so.
    expect(screen.getByText(/cole o endereço da nota/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    await whenScanning();
    expect(camera.getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('says there is no camera, with nothing to retry', async () => {
    installFakeCamera({ getUserMedia: () => Promise.reject(mediaError('NotFoundError')) });
    render(<Harness onScan={vi.fn()} />);

    expect(await screen.findByText(/não tem câmera disponível/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tentar de novo' })).not.toBeInTheDocument();
  });

  it('says the camera is taken by another app', async () => {
    installFakeCamera({ getUserMedia: () => Promise.reject(mediaError('NotReadableError')) });
    render(<Harness onScan={vi.fn()} />);

    expect(await screen.findByText(/sendo usada por outro aplicativo/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument();
  });

  it('has a sentence of its own for a failure it does not know, and never the browser’s', async () => {
    installFakeCamera({ getUserMedia: () => Promise.reject(new TypeError('boom')) });
    render(<Harness onScan={vi.fn()} />);

    expect(await screen.findByText(/Não foi possível abrir a câmera/)).toBeInTheDocument();
    expect(screen.queryByText(/boom/)).not.toBeInTheDocument();
  });
});
