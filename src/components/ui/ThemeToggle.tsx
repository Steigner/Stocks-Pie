import { useState } from 'react';
import { THEMES, applyTheme, readTheme, type Theme } from '../../theme';
import { useTranslation } from '../../useTranslation';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { text } = useTranslation();
  const [theme, setTheme] = useState<Theme>(readTheme);

  const choose = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };

  return (
    <div className={styles.toggle} role="group" aria-label={text.colourTheme}>
      {THEMES.map((option) => (
        <button
          key={option}
          type="button"
          className={`${styles.option} ${option === theme ? styles.optionActive : ''}`}
          aria-pressed={option === theme}
          onClick={() => choose(option)}
        >
          {text.themes[option]}
        </button>
      ))}
    </div>
  );
}
