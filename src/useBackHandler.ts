import { useEffect, useRef } from 'react';

/** Most recent last, so Back undoes whatever opened last. */
const handlers: Array<() => void> = [];
/** History steps taken by a release rather than by the user. */
let ownSteps = 0;

function handlePopState() {
  if (ownSteps > 0) {
    ownSteps -= 1;
    return;
  }
  handlers.pop()?.();
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', handlePopState);
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
        ownSteps += 1;
        history.back();
      }
    };
  }, [active]);
}
