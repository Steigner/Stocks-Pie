import type { ReactNode } from 'react';
import styles from './Banner.module.css';

type Tone = 'info' | 'success' | 'warning' | 'error';

interface BannerProps {
  tone: Tone;
  /** A control shown at the end of the banner, e.g. the button that resolves it. */
  action?: ReactNode;
  children: ReactNode;
}

export function Banner({ tone, action, children }: BannerProps) {
  return (
    <div
      className={`${styles.banner} ${styles[tone]}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      <span className={styles.message}>{children}</span>
      {action}
    </div>
  );
}
