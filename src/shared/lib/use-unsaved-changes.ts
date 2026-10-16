import { useCallback, useRef } from 'react';
import { useBlocker, type Blocker } from 'react-router';

interface UnsavedChangesGuard {
  /** Whether a navigation is waiting for the person's answer. */
  blocker: Blocker;
  /**
   * Call right before leaving on purpose — after saving, after deleting — so the
   * navigation that follows is not mistaken for walking away from unsaved work.
   */
  allowLeaving: () => void;
}

/**
 * Stops a navigation that would throw away what is typed in a form, and holds
 * it until the person says whether to leave. It covers every way out at once —
 * a link, the menu, the back button — because it sits in the router and not in
 * any one button.
 *
 * Moving between screens only: a change of the query string or the hash stays
 * on the same screen and is not leaving.
 */
export function useUnsavedChanges(dirty: boolean): UnsavedChangesGuard {
  const leaving = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );

  const allowLeaving = useCallback(() => {
    leaving.current = true;
  }, []);

  return { blocker, allowLeaving };
}
