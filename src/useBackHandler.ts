import { useEffect, useRef } from 'react';

/** Most recent last, so Back undoes whatever opened last. */
const handlers: Array<() => void> = [];
/** History moves made by releases rather than by the user. */
let ownMoves = 0;
/** Entries released in the current tick, not yet given back. */
let releasedEntries = 0;

function handlePopState() {
  if (ownMoves > 0) {
    ownMoves -= 1;
    return;
  }
  handlers.pop()?.();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', handlePopState);
}

/**
 * Browsers can drop a history move requested while another is pending, so
 * entries released together, such as a dialog and the editor under it, go back
 * as one move.
 */
function releaseEntry() {
  releasedEntries += 1;
  if (releasedEntries > 1) {
    return;
  }
  queueMicrotask(() => {
    ownMoves += 1;
    history.go(-releasedEntries);
    releasedEntries = 0;
  });
}

/**
 * Makes the Back button call `onBack` while `active`, on Android and in a browser.
 * Each active handler holds one history entry, and gives it up when it stops being
 * active some other way, so Back never lands on something already closed.
 */
export function useBackHandler(active: boolean, onBack: () => void): void {
  const latestOnBack = useRef(onBack);
  latestOnBack.current = onBack;

  useEffect(() => {
    if (!active) {
      return;
    }
    const handler = () => latestOnBack.current();
    handlers.push(handler);
    history.pushState(null, '');
    return () => {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
        releaseEntry();
      }
    };
  }, [active]);
}
