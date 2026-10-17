import { useEffect, useState } from 'react';

/**
 * Whether this device can scan, decided without opening the camera — asking for
 * it would raise the permission prompt on a screen that only wanted to know
 * whether to draw a button.
 *
 * `mediaDevices` does not exist outside a secure context, which is how a page
 * served over plain HTTP finds out it has no camera. Beyond that the browser
 * lists the devices by kind, even before permission is given. A list that is
 * empty altogether is read as "cannot tell" rather than "no camera": some
 * browsers hide the devices until the first permission, and hiding the button
 * from someone who has one is worse than a message when they open it.
 *
 * Starts `false` and becomes `true` once confirmed, so a computer with no camera
 * never draws the button and then takes it away.
 */
export function useCameraAvailable(): boolean {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void detectCamera().then((found) => {
      if (!cancelled) {
        setAvailable(found);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return available;
}

async function detectCamera(): Promise<boolean> {
  // Typed as always present, and it is not: see above.
  const media = navigator.mediaDevices as MediaDevices | undefined;

  if (typeof media?.getUserMedia !== 'function' || typeof media.enumerateDevices !== 'function') {
    return false;
  }

  try {
    const devices = await media.enumerateDevices();

    return devices.length === 0 || devices.some((device) => device.kind === 'videoinput');
  } catch {
    return false;
  }
}
