/**
 * Light/dark preference, kept in this browser only.
 *
 * Applied from `main.tsx` before the first render rather than from an inline
 * script in the document head: the shipped Content-Security-Policy allows no
 * inline scripts, and weakening it for a colour scheme would be a bad trade.
 */
const STORAGE_KEY = 'stocks-pie:theme';

export type Theme = 'system' | 'light' | 'dark';

export const THEMES: readonly Theme[] = ['system', 'light', 'dark'];

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as readonly string[]).includes(value);
}

export function readTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : 'system';
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the system
    // scheme is a perfectly good answer.
    return 'system';
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // A preference that cannot be remembered still applies to this visit.
  }
}
