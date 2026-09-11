import { useState } from 'react';
import { THEMES, applyTheme, readTheme, type Theme } from '../../theme';
import styles from './ThemeToggle.module.css';

const LABELS: Record<Theme, string> = {
  system: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  const choose = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div className={styles.toggle} role="group" aria-label="Colour theme">
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          className={`${styles.option} ${option === theme ? styles.optionActive : ''}`}
          aria-pressed={option === theme}
          onClick={() => choose(option)}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}
