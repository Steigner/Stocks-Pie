import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import styles from './InfoTip.module.css';

interface InfoTipProps {
  /** Names what the explanation is about, for screen readers and hover text. */
  label: string;
  children: ReactNode;
}

/**
 * An explanation folded away behind a marker next to the thing it explains.
 *
 * Opens on hover, on focus, and on click - the last one so a touch screen, which
 * has no hover, can open it at all. Closes on leaving, on blur, on Escape, or on
 * a press anywhere else: Safari never focuses a clicked button, so blur alone
 * would leave it open there, and a phone has neither hover nor Escape.
 *
 * Click must open rather than toggle: a click focuses the button first, so a
 * toggle would close what the focus just opened.
 */
export function InfoTip({ label, children }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const bubbleId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const handlePointerDown = (event: Event) => {
      if (!(event.target instanceof Node) || !wrapRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={styles.wrap}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.marker}
        aria-label={`About ${label}`}
        aria-expanded={open}
        aria-describedby={open ? bubbleId : undefined}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <span id={bubbleId} role="tooltip" className={styles.bubble}>
          {children}
        </span>
      )}
    </span>
  );
}
