import { vi } from 'vitest';

/**
 * A camera, for a test. jsdom has no `navigator.mediaDevices`, so a test that is
 * about the camera installs the one it needs: which devices exist, and what
 * `getUserMedia` does. The stream it hands out is made of tracks whose `stop`
 * is a spy, which is how a test knows the camera was let go.
 */
export interface FakeCamera {
  /** The tracks of every stream handed out, in order. */
  tracks: { stop: ReturnType<typeof vi.fn> }[];
  getUserMedia: ReturnType<typeof vi.fn>;
}

interface FakeCameraOptions {
  devices?: { kind: MediaDeviceKind }[];
  /** What opening the camera does. Resolves with a stream by default. */
  getUserMedia?: () => Promise<MediaStream>;
}

export function installFakeCamera(options: FakeCameraOptions = {}): FakeCamera {
  const tracks: FakeCamera['tracks'] = [];

  const getUserMedia = vi.fn(
    options.getUserMedia ??
      (() => {
        const track = { kind: 'video', stop: vi.fn() };
        tracks.push(track);

        return Promise.resolve({
          getTracks: () => [track],
          getVideoTracks: () => [track],
        } as unknown as MediaStream);
      }),
  );

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia,
      enumerateDevices: () => Promise.resolve(options.devices ?? [{ kind: 'videoinput' }]),
    },
  });

  return { tracks, getUserMedia };
}

/** Back to a browser without a camera API, which is what jsdom is. */
export function removeFakeCamera(): void {
  Reflect.deleteProperty(navigator, 'mediaDevices');
}

/** Makes a rejection the way a browser does: an error with the media API's name. */
export function mediaError(name: string): DOMException {
  return new DOMException('Camera refused.', name);
}
