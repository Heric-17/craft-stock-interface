/**
 * jsdom has no layout and no `matchMedia`. This gives it just enough of the
 * second to answer the width queries the application asks, so a test can say
 * "a phone" or "a desktop" and get the component that is built for it.
 *
 * It does not measure anything: no overflow, no touch target. That is checked
 * in a real browser, and a jsdom assertion about it would be lying.
 */
import { toInt } from '@/shared/lib/to-int';

type Listener = () => void;

const listeners = new Set<Listener>();
let width = 1280;
let systemDark = false;

function limit(match: RegExpExecArray | null): number | null {
  return match === null ? null : toInt(match[1]);
}

function matches(query: string): boolean {
  if (query.includes('prefers-color-scheme')) {
    return query.includes('dark') ? systemDark : !systemDark;
  }

  const min = limit(/\(min-width:\s*(\d+)px\)/.exec(query));
  const max = limit(/\(max-width:\s*(\d+)px\)/.exec(query));

  return (min === null || width >= min) && (max === null || width <= max);
}

export function setViewportWidth(next: number): void {
  width = next;

  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: next });

  window.matchMedia = (query: string): MediaQueryList => {
    const list = {
      media: query,
      get matches() {
        return matches(query);
      },
      onchange: null,
      addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
      addListener: (listener: Listener) => listeners.add(listener),
      removeListener: (listener: Listener) => listeners.delete(listener),
      dispatchEvent: () => true,
    };

    return list as unknown as MediaQueryList;
  };

  for (const listener of [...listeners]) {
    listener();
  }
}

/** What the system asks the interface to be, for a test about a theme that follows it. */
export function setSystemColorScheme(scheme: 'light' | 'dark'): void {
  systemDark = scheme === 'dark';

  for (const listener of [...listeners]) {
    listener();
  }
}

export const PHONE_WIDTH = 360;
export const TABLET_WIDTH = 768;
export const DESKTOP_WIDTH = 1280;
