import { useEffect, useState } from 'react';

/**
 * The current instant, kept fresh while the screen is open.
 *
 * For what depends on how long ago something happened — a capture that has been
 * "processing" for ten minutes is not processing — so that the answer changes
 * on screen without waiting for the next response from the API to re-render it.
 */
export function useNow(refreshEveryMilliseconds: number): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), refreshEveryMilliseconds);

    return () => clearInterval(timer);
  }, [refreshEveryMilliseconds]);

  return now;
}
