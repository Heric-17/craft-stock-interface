import { useCallback, useEffect, useState } from 'react';

/** Often enough that the shown second never lags the real one by a visible beat. */
const TICK_MILLISECONDS = 250;

const MILLISECONDS_PER_SECOND = 1000;

/**
 * A wait that runs down on screen: `start(seconds)` begins it and
 * `remainingSeconds` counts to zero, rounded up, so it reads `1` until the last
 * instant and never shows `0` while the wait is still on.
 *
 * The count is measured from the moment `start` is called, not from a timestamp
 * of the server: the API sends a duration precisely so that a device with a
 * wrong clock waits the right time.
 */
export function useCooldown(): {
  remainingSeconds: number;
  start: (seconds: number) => void;
  clear: () => void;
} {
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline === null) {
      return;
    }

    const timer = setInterval(() => {
      const current = Date.now();

      setNow(current);

      if (current >= deadline) {
        setDeadline(null);
      }
    }, TICK_MILLISECONDS);

    return () => clearInterval(timer);
  }, [deadline]);

  const start = useCallback((seconds: number) => {
    const current = Date.now();

    setNow(current);
    setDeadline(current + seconds * MILLISECONDS_PER_SECOND);
  }, []);

  const clear = useCallback(() => setDeadline(null), []);

  const remainingSeconds =
    deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / MILLISECONDS_PER_SECOND));

  return { remainingSeconds, start, clear };
}
