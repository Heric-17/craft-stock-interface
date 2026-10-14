import { useSyncExternalStore } from 'react';

/** The `md` breakpoint of Tailwind: where the sidebar and the table come back. */
export const DESKTOP_QUERY = '(min-width: 768px)';

/**
 * Whether a media query matches, kept in step as the window changes.
 *
 * Used where the **shape** of the content changes, not just its size: a table
 * and a list of cards are different markup, and rendering both to let CSS hide
 * one would put every row in the document twice for a screen reader and for a
 * test. CSS stays the tool for everything that only needs to stretch.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);

      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** The `lg` breakpoint: where a screen with a sidebar has room for a wide table. */
export const LARGE_DESKTOP_QUERY = '(min-width: 1024px)';

export function useIsLargeDesktop(): boolean {
  return useMediaQuery(LARGE_DESKTOP_QUERY);
}

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
