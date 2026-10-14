import { useEffect, useState } from 'react';

/**
 * A value that follows `value` after it has been still for `delayMs`. For a
 * search box: the request goes out when the person pauses, not on every key.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
